use serde::{Deserialize, Serialize};

use chrono::{DateTime, Utc};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleReceiptData {
    pub receipt_data: String,
    pub password: String, // App-specific shared secret
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleVerificationResponse {
    pub status: i32,
    pub environment: Option<String>,
    pub receipt: Option<AppleReceipt>,
    pub latest_receipt_info: Option<Vec<AppleTransaction>>,
    pub pending_renewal_info: Option<Vec<ApplePendingRenewal>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleReceipt {
    pub receipt_type: String,
    pub bundle_id: String,
    pub application_version: String,
    pub in_app: Vec<AppleTransaction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleTransaction {
    pub product_id: String,
    pub transaction_id: String,
    pub original_transaction_id: String,
    pub purchase_date: String,
    pub purchase_date_ms: String,
    pub expires_date: Option<String>,
    pub expires_date_ms: Option<String>,
    pub is_trial_period: Option<String>,
    pub is_in_intro_offer_period: Option<String>,
    pub cancellation_date: Option<String>,
    pub cancellation_date_ms: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplePendingRenewal {
    pub product_id: String,
    pub original_transaction_id: String,
    pub auto_renew_status: String,
    pub auto_renew_product_id: String,
    pub expiration_intent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppleSubscriptionStatus {
    pub is_active: bool,
    pub product_id: String,
    pub expires_date: Option<DateTime<Utc>>,
    pub is_trial: bool,
    pub is_cancelled: bool,
    pub auto_renew_status: bool,
}

pub struct AppleSubscriptionValidator {
    client: Client,
    shared_secret: String,
    bundle_id: String,
}

impl AppleSubscriptionValidator {
    pub fn new(shared_secret: String, bundle_id: String) -> Self {
        Self {
            client: Client::new(),
            shared_secret,
            bundle_id,
        }
    }

    /// 验证App Store收据
    pub async fn verify_receipt(&self, receipt_data: &str) -> Result<AppleVerificationResponse, Box<dyn std::error::Error>> {
        let request_body = AppleReceiptData {
            receipt_data: receipt_data.to_string(),
            password: self.shared_secret.clone(),
        };

        // 首先尝试生产环境
        let production_url = "https://buy.itunes.apple.com/verifyReceipt";
        let response = self.send_verification_request(production_url, &request_body).await?;

        // 如果是沙盒收据，切换到沙盒环境
        if response.status == 21007 {
            let sandbox_url = "https://sandbox.itunes.apple.com/verifyReceipt";
            return self.send_verification_request(sandbox_url, &request_body).await;
        }

        Ok(response)
    }

    async fn send_verification_request(
        &self,
        url: &str,
        request_body: &AppleReceiptData,
    ) -> Result<AppleVerificationResponse, Box<dyn std::error::Error>> {
        let response = self
            .client
            .post(url)
            .json(request_body)
            .send()
            .await?;

        let verification_response: AppleVerificationResponse = response.json().await?;
        Ok(verification_response)
    }

    /// 获取订阅状态
    pub fn get_subscription_status(&self, verification_response: &AppleVerificationResponse) -> Result<AppleSubscriptionStatus, Box<dyn std::error::Error>> {
        if verification_response.status != 0 {
            return Err(format!("Apple verification failed with status: {}", verification_response.status).into());
        }

        // 获取最新的交易信息
        let transactions = verification_response
            .latest_receipt_info
            .as_ref()
            .or_else(|| verification_response.receipt.as_ref().map(|r| &r.in_app))
            .ok_or("No transaction data found")?;

        if transactions.is_empty() {
            return Err("No transactions found".into());
        }

        // 找到最新的订阅交易
        let latest_transaction = transactions
            .iter()
            .filter(|t| self.is_subscription_product(&t.product_id))
            .max_by_key(|t| t.purchase_date_ms.parse::<i64>().unwrap_or(0))
            .ok_or("No subscription transactions found")?;

        let expires_date = if let Some(expires_ms) = &latest_transaction.expires_date_ms {
            let timestamp = expires_ms.parse::<i64>()?;
            Some(DateTime::from_timestamp_millis(timestamp).unwrap_or_else(|| Utc::now()))
        } else {
            None
        };

        let is_active = if let Some(expires) = expires_date {
            expires > Utc::now() && latest_transaction.cancellation_date.is_none()
        } else {
            false
        };

        let is_trial = latest_transaction
            .is_trial_period
            .as_ref()
            .map(|s| s == "true")
            .unwrap_or(false);

        let is_cancelled = latest_transaction.cancellation_date.is_some();

        // 检查自动续费状态
        let auto_renew_status = verification_response
            .pending_renewal_info
            .as_ref()
            .and_then(|renewals| {
                renewals
                    .iter()
                    .find(|r| r.original_transaction_id == latest_transaction.original_transaction_id)
            })
            .map(|renewal| renewal.auto_renew_status == "1")
            .unwrap_or(false);

        Ok(AppleSubscriptionStatus {
            is_active,
            product_id: latest_transaction.product_id.clone(),
            expires_date,
            is_trial,
            is_cancelled,
            auto_renew_status,
        })
    }

    /// 检查是否为订阅产品
    fn is_subscription_product(&self, product_id: &str) -> bool {
        // 根据你的产品ID配置
        matches!(product_id, "com.fileSortify.monthly" | "com.fileSortify.yearly")
    }

    /// 验证收据并返回订阅状态
    pub async fn validate_subscription(&self, receipt_data: &str) -> Result<AppleSubscriptionStatus, Box<dyn std::error::Error>> {
        let verification_response = self.verify_receipt(receipt_data).await?;
        self.get_subscription_status(&verification_response)
    }
}

/// Apple订阅产品配置
#[derive(Debug, Clone)]
pub struct AppleSubscriptionConfig {
    pub monthly_product_id: String,
    pub yearly_product_id: String,
    pub shared_secret: String,
    pub bundle_id: String,
}

impl Default for AppleSubscriptionConfig {
    fn default() -> Self {
        Self {
            monthly_product_id: "com.fileSortify.monthly".to_string(),
            yearly_product_id: "com.fileSortify.yearly".to_string(),
            shared_secret: std::env::var("APPLE_SHARED_SECRET")
                .unwrap_or_else(|_| "your-app-specific-shared-secret".to_string()),
            bundle_id: "com.fileSortify.tool".to_string(),
        }
    }
}