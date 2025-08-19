use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use tokio::time;
use crate::i18n::{t, t_format};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSchedulerConfig {
    pub enabled: bool,
    pub check_interval_hours: u64,
    pub auto_download: bool,
    pub auto_install: bool,
}

impl UpdateSchedulerConfig {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path();
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            let config: UpdateSchedulerConfig = serde_json::from_str(&content)?;
            Ok(config)
        } else {
            let config = Self::default();
            config.save()?;
            Ok(config)
        }
    }
    
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path();
        
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&config_path, content)?;
        
        Ok(())
    }
    
    fn get_config_path() -> PathBuf {
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("fileSortify").join("update_scheduler.json")
        } else {
            PathBuf::from("update_scheduler_config.json")
        }
    }
}

impl Default for UpdateSchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            check_interval_hours: 24, // 每24小时检查一次
            auto_download: false,
            auto_install: false,
        }
    }
}

pub struct UpdateScheduler {
    config: UpdateSchedulerConfig,
    last_check: Option<SystemTime>,
}

impl UpdateScheduler {
    pub fn new(config: UpdateSchedulerConfig) -> Self {
        Self {
            config,
            last_check: None,
        }
    }

    pub fn should_check_for_updates(&self) -> bool {
        if !self.config.enabled {
            return false;
        }

        match self.last_check {
            Some(last) => {
                let elapsed = SystemTime::now()
                    .duration_since(last)
                    .unwrap_or(Duration::ZERO);
                elapsed >= Duration::from_secs(self.config.check_interval_hours * 3600)
            }
            None => true,
        }
    }

    pub fn mark_checked(&mut self) {
        self.last_check = Some(SystemTime::now());
    }

    pub fn start_background_task(config: UpdateSchedulerConfig, app: AppHandle) {
        if !config.enabled {
            return;
        }

        let interval = Duration::from_secs(config.check_interval_hours * 3600);
        let auto_download = config.auto_download;
        
        tokio::spawn(async move {
            let mut interval_timer = time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                
                match super::check_for_updates(app.clone()).await {
                    Ok(update_status) => {
                        if update_status.available {
                            // 发送更新可用通知
                            let _ = app.emit("update-available", &update_status);
                            
                            // 如果启用自动下载
                            if auto_download {
                                if let Ok(_) = super::download_and_install(app.clone()).await {
                                    let _ = app.emit("update-downloaded", ());
                                }
                            }
                        }
                    }
                    Err(e) => {
                        log::error!("Background update check failed: {}", e);
                    }
                }
            }
        });
    }

    pub fn update_config(&mut self, config: UpdateSchedulerConfig) {
        self.config = config;
    }
}

#[tauri::command]
pub fn get_scheduler_config() -> Result<UpdateSchedulerConfig, String> {
    match UpdateSchedulerConfig::load() {
        Ok(config) => Ok(config),
        Err(e) => {
            log::error!("Failed to load scheduler config: {}", e);
            Ok(UpdateSchedulerConfig::default())
        }
    }
}

#[tauri::command]
pub fn update_scheduler_config(config: UpdateSchedulerConfig) -> Result<String, String> {
    match config.save() {
        Ok(_) => {
            log::info!("Update scheduler config updated: {:?}", config);
            Ok(t("update_scheduler_config_success").to_string())
        }
        Err(e) => {
            log::error!("Failed to save scheduler config: {}", e);
            Err(t_format("update_scheduler_config_failed", &[&e.to_string()]))
        }
    }
}