use serde::{Deserialize, Serialize};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};
use tokio::time;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSchedulerConfig {
    pub enabled: bool,
    pub check_interval_hours: u64,
    pub auto_download: bool,
    pub auto_install: bool,
}

impl Default for UpdateSchedulerConfig {
    fn default() -> Self {
        Self {
            enabled: true,
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
pub fn get_scheduler_config() -> UpdateSchedulerConfig {
    // 这里可以从配置文件读取，暂时返回默认值
    UpdateSchedulerConfig::default()
}

#[tauri::command]
pub fn update_scheduler_config(config: UpdateSchedulerConfig) -> Result<(), String> {
    // 这里可以保存配置到文件
    log::info!("Update scheduler config updated: {:?}", config);
    Ok(())
}