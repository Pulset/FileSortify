use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Duration};
use crate::apple_subscription::{AppleSubscriptionValidator, AppleSubscriptionConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionPlan {
    Free,
    Lifetime,  // 买断版本
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionStatus {
    Trial,      // 试用期
    Active,     // 活跃订阅
    Expired,    // 已过期
    Cancelled,  // 已取消
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub plan: SubscriptionPlan,
    pub status: SubscriptionStatus,
    pub trial_start_date: Option<DateTime<Utc>>,
    pub subscription_start_date: Option<DateTime<Utc>>,
    pub subscription_end_date: Option<DateTime<Utc>>,
    pub last_check_date: DateTime<Utc>,
    pub device_id: String,
    pub apple_receipt_data: Option<String>,
    pub apple_transaction_id: Option<String>,
    pub auto_renew_enabled: bool,
    // Creem 相关字段
    pub creem_session_id: Option<String>,
    pub creem_transaction_id: Option<String>,
    pub webhook_server_url: String,
    pub package_id: String
}

impl Subscription {
    pub fn new() -> Self {
        let device_id = Self::generate_device_id();
        
        Subscription {
            plan: SubscriptionPlan::Free,
            status: SubscriptionStatus::Trial,
            trial_start_date: Some(Utc::now()),
            subscription_start_date: None,
            subscription_end_date: None,
            last_check_date: Utc::now(),
            device_id,
            apple_receipt_data: None,
            apple_transaction_id: None,
            auto_renew_enabled: false,
            creem_session_id: None,
            creem_transaction_id: None,
            webhook_server_url: "http://localhost:3000".to_string(),
            package_id: "cme9f2aum0000uph23ghk00sd".to_string(),
        }
    }
    
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_subscription_path();
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            let mut subscription: Subscription = serde_json::from_str(&content)?;
            
            // 更新检查时间
            subscription.last_check_date = Utc::now();
            subscription.save()?;
            
            Ok(subscription)
        } else {
            let subscription = Self::new();
            subscription.save()?;
            Ok(subscription)
        }
    }
    
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = Self::get_subscription_path();
        
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, content)?;
        
        Ok(())
    }
    
    pub fn is_trial_active(&self) -> bool {
        if let Some(trial_start) = self.trial_start_date {
            let trial_end = trial_start + Duration::days(3);
            Utc::now() < trial_end && matches!(self.status, SubscriptionStatus::Trial)
        } else {
            false
        }
    }
    
    pub fn is_subscription_active(&self) -> bool {
        match self.status {
            SubscriptionStatus::Active => {
                // 买断版本没有过期时间，一旦激活就永久有效
                match self.plan {
                    SubscriptionPlan::Lifetime => true,
                    _ => false,
                }
            }
            _ => false
        }
    }
    
    pub fn can_use_app(&self) -> bool {
        self.is_trial_active() || self.is_subscription_active()
    }
    
    pub fn get_trial_days_remaining(&self) -> i64 {
        if let Some(trial_start) = self.trial_start_date {
            let trial_end = trial_start + Duration::days(3);
            let remaining = trial_end - Utc::now();
            remaining.num_days().max(0)
        } else {
            0
        }
    }
    
    pub fn get_subscription_days_remaining(&self) -> i64 {
        if let Some(end_date) = self.subscription_end_date {
            let remaining = end_date - Utc::now();
            remaining.num_days().max(0)
        } else {
            0
        }
    }
    
    pub fn activate_subscription(&mut self, plan: SubscriptionPlan) -> Result<(), Box<dyn std::error::Error>> {
        let now = Utc::now();
        
        match plan {
            SubscriptionPlan::Lifetime => {
                self.plan = plan;
                self.status = SubscriptionStatus::Active;
                self.subscription_start_date = Some(now);
                self.subscription_end_date = None; // 买断版本没有过期时间
            }
            SubscriptionPlan::Free => return Err("无法激活免费计划".into()),
        }
        
        self.save()?;
        Ok(())
    }
    
    pub fn cancel_subscription(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.status = SubscriptionStatus::Cancelled;
        self.save()?;
        Ok(())
    }
    
    pub fn get_pricing_info() -> PricingInfo {
        PricingInfo {
            lifetime_price: 20.0,
            trial_days: 3,
            currency: "USD".to_string(),
        }
    }

    pub fn get_packages_info() -> PackagesResponse {
        let pricing = Self::get_pricing_info();
        
        PackagesResponse {
            packages: PackageInfo {
                id:"cme9f2aum0000uph23ghk00sd".to_string(),
                name: "File Sortify".to_string(),
                description: "".to_string(),
                price: (pricing.lifetime_price * 100.0) as i32, // Convert to cents
                currency: pricing.currency,
                product_id: "prod_1FjuD56FEgYYC8VKIwEACW".to_string(),
                created_at: "2025-08-13T03:34:20.014Z".to_string(),
                updated_at: "2025-08-13T03:34:20.014Z".to_string(),
            }
        }
    }

    /// 从服务端获取套餐信息
    pub async fn fetch_packages_from_server(&mut self) -> Result<PackagesResponse, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let response = client
            .get(&format!("{}/api/packages?name=File%20Sortify", self.webhook_server_url))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to fetch packages: {}", response.status()).into());
        }

        let packages_response: PackagesResponse = response.json().await?;
        
        self.package_id = packages_response.packages.id.clone();
        self.save()?;
        Ok(packages_response)
    }

    /// 验证Apple订阅收据 (已禁用，仅保留兼容性)
    pub async fn verify_apple_receipt(&mut self, _receipt_data: String) -> Result<(), Box<dyn std::error::Error>> {
        // Apple Store 功能已禁用，直接返回错误
        Err("Apple Store 功能已禁用，请使用 Creem 支付".into())
    }

    /// 刷新Apple订阅状态 (已禁用，仅保留兼容性)
    pub async fn refresh_apple_subscription(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Apple Store 功能已禁用，直接返回错误
        Err("Apple Store 功能已禁用，请使用 Creem 支付".into())
    }

    /// 检查是否需要刷新订阅状态
    pub fn should_refresh_subscription(&self) -> bool {
        let last_check = self.last_check_date;
        let now = Utc::now();
        let hours_since_check = (now - last_check).num_hours();
        
        // 每24小时检查一次，或者如果订阅即将过期则更频繁检查
        if hours_since_check >= 24 {
            return true;
        }
        
        // 如果订阅在48小时内过期，每小时检查一次
        if let Some(end_date) = self.subscription_end_date {
            let hours_until_expiry = (end_date - now).num_hours();
            if hours_until_expiry <= 48 && hours_since_check >= 1 {
                return true;
            }
        }
        
        false
    }
    
    fn generate_device_id() -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        
        // 使用系统信息生成设备ID
        if let Ok(hostname) = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .or_else(|_| std::env::var("HOST")) {
            hostname.hash(&mut hasher);
        }
        
        if let Ok(username) = std::env::var("USERNAME")
            .or_else(|_| std::env::var("USER")) {
            username.hash(&mut hasher);
        }
        
        format!("{:x}", hasher.finish())
    }
    
    fn get_subscription_path() -> PathBuf {
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("fileSortify").join("subscription.json")
        } else {
            PathBuf::from("subscription.json")
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingInfo {
    pub lifetime_price: f64,
    pub trial_days: i32,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub price: i32, // Price in cents
    pub currency: String,
    #[serde(rename = "productId")]
    pub product_id: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackagesResponse {
    pub packages: PackageInfo,
}

impl Default for Subscription {
    fn default() -> Self {
        Self::new()
    }
}

// Creem 相关结构体
#[derive(Debug, Serialize, Deserialize)]
pub struct CreemSessionRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "packageId")]
    pub package_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserPackage {
    pub id: String,
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "packageId")]
    pub package_id: String,
    #[serde(rename = "checkoutId")]
    pub checkout_id: Option<String>,
    pub status: String,
    pub amount: i32,
    pub currency: String,
    pub metadata: serde_json::Value,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<String>,
    pub package: PackageInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreemSessionResponse {
    #[serde(rename = "userPackage")]
    pub user_package: UserPackage,
    #[serde(rename = "checkoutUrl")]
    pub checkout_url: String,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreemPaymentStatus {
    #[serde(rename = "userPackage")]
    pub user_package: UserPackage,
}



impl Subscription {
    /// 创建 Creem 支付会话
    pub async fn create_creem_session(&mut self, plan: SubscriptionPlan) -> Result<CreemSessionResponse, Box<dyn std::error::Error>> {
        let _plan_str = match plan {
            SubscriptionPlan::Lifetime => "lifetime",
            SubscriptionPlan::Free => return Err("Cannot create session for free plan".into()),
        };

        let request = CreemSessionRequest {
            user_id: self.device_id.clone(),
            package_id: self.package_id.clone(),
        };

        let client = reqwest::Client::new();
        let response = client
            .post(&format!("{}/api/checkout", self.webhook_server_url))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to create session: {}", response.status()).into());
        }

        let session_response: CreemSessionResponse = response.json().await?;
        
        // 保存会话ID（使用 userPackage 的 id）
        self.creem_session_id = Some(session_response.user_package.id.clone());
        self.save()?;

        Ok(session_response)
    }

    /// 检查 Creem 支付状态
    pub async fn check_creem_payment_status(&mut self) -> Result<CreemPaymentStatus, Box<dyn std::error::Error>> {
        let session_id = self.creem_session_id.as_ref()
            .ok_or("No active Creem session")?;

        let client = reqwest::Client::new();
        let response = client
            .get(&format!("{}/api/user-packages/{}", self.webhook_server_url, session_id))
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Failed to check status: {}", response.status()).into());
        }

        let payment_status: CreemPaymentStatus = response.json().await?;

        // 如果支付完成，更新订阅状态
        if payment_status.user_package.status == "PAID" {
            // 对于买断版本，直接激活为 Lifetime 计划
            let plan = SubscriptionPlan::Lifetime;
            
            // 使用 checkout_id 作为 transaction_id
            let transaction_id = payment_status.user_package.checkout_id
                .clone()
                .unwrap_or_else(|| payment_status.user_package.id.clone());

            self.activate_creem_subscription(plan, transaction_id)?;
        }

        Ok(payment_status)
    }

    /// 激活 Creem 订阅
    pub fn activate_creem_subscription(&mut self, plan: SubscriptionPlan, transaction_id: String) -> Result<(), Box<dyn std::error::Error>> {
        let now = Utc::now();

        match plan {
            SubscriptionPlan::Lifetime => {
                self.plan = plan;
                self.status = SubscriptionStatus::Active;
                self.subscription_start_date = Some(now);
                self.subscription_end_date = None; // 买断版本没有过期时间
                self.creem_transaction_id = Some(transaction_id);
                self.last_check_date = Utc::now();
            }
            SubscriptionPlan::Free => return Err("Cannot activate free plan".into()),
        }

        self.save()?;
        Ok(())
    }

    /// 设置 webhook 服务器 URL
    pub fn set_webhook_server_url(&mut self, url: String) -> Result<(), Box<dyn std::error::Error>> {
        self.webhook_server_url = url;
        self.save()?;
        Ok(())
    }

    /// 获取当前的支付会话信息
    pub fn get_current_session_info(&self) -> Option<String> {
        self.creem_session_id.clone()
    }
}