use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc, Duration};
use crate::apple_subscription::{AppleSubscriptionValidator, AppleSubscriptionConfig};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionPlan {
    Free,
    Monthly,
    Yearly,
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
                if let Some(end_date) = self.subscription_end_date {
                    Utc::now() < end_date
                } else {
                    false
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
        let duration = match plan {
            SubscriptionPlan::Monthly => Duration::days(30),
            SubscriptionPlan::Yearly => Duration::days(365),
            SubscriptionPlan::Free => return Err("无法激活免费计划".into()),
        };
        
        self.plan = plan;
        self.status = SubscriptionStatus::Active;
        self.subscription_start_date = Some(now);
        self.subscription_end_date = Some(now + duration);
        
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
            monthly_price: 1.99,
            yearly_price: 19.99,
            trial_days: 3,
            currency: "USD".to_string(),
        }
    }

    /// 验证Apple订阅收据
    pub async fn verify_apple_receipt(&mut self, receipt_data: String) -> Result<(), Box<dyn std::error::Error>> {
        let config = AppleSubscriptionConfig::default();
        let validator = AppleSubscriptionValidator::new(config.shared_secret, config.bundle_id);
        
        let apple_status = validator.validate_subscription(&receipt_data).await?;
        
        if apple_status.is_active {
            // 根据产品ID确定订阅计划
            let plan = if apple_status.product_id == config.monthly_product_id {
                SubscriptionPlan::Monthly
            } else if apple_status.product_id == config.yearly_product_id {
                SubscriptionPlan::Yearly
            } else {
                return Err("Unknown product ID".into());
            };

            self.plan = plan;
            self.status = SubscriptionStatus::Active;
            self.subscription_start_date = Some(Utc::now());
            self.subscription_end_date = apple_status.expires_date;
            self.apple_receipt_data = Some(receipt_data);
            self.auto_renew_enabled = apple_status.auto_renew_status;
            
            if apple_status.is_cancelled {
                self.status = SubscriptionStatus::Cancelled;
            }
        } else {
            self.status = SubscriptionStatus::Expired;
        }
        
        self.save()?;
        Ok(())
    }

    /// 刷新Apple订阅状态
    pub async fn refresh_apple_subscription(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(receipt_data) = &self.apple_receipt_data {
            let config = AppleSubscriptionConfig::default();
            let validator = AppleSubscriptionValidator::new(config.shared_secret, config.bundle_id);
            
            let apple_status = validator.validate_subscription(receipt_data).await?;
            
            if apple_status.is_active {
                self.status = SubscriptionStatus::Active;
                self.subscription_end_date = apple_status.expires_date;
                self.auto_renew_enabled = apple_status.auto_renew_status;
                
                if apple_status.is_cancelled {
                    self.status = SubscriptionStatus::Cancelled;
                }
            } else {
                self.status = SubscriptionStatus::Expired;
            }
            
            self.save()?;
        }
        
        Ok(())
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
    pub monthly_price: f64,
    pub yearly_price: f64,
    pub trial_days: i32,
    pub currency: String,
}

impl Default for Subscription {
    fn default() -> Self {
        Self::new()
    }
}