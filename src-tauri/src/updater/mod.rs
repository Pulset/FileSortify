pub mod github;
pub mod scheduler;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub version: String,
    pub notes: String,
    pub pub_date: String,
    pub signature: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateStatus {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub download_url: Option<String>,
    pub body: Option<String>,
}

pub async fn check_for_updates(app: AppHandle) -> Result<UpdateStatus, String> {
    let current_version = app.package_info().version.to_string();
    
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    Ok(UpdateStatus {
                        available: true,
                        current_version,
                        latest_version: Some(update.version.clone()),
                        download_url: Some(update.download_url.to_string()),
                        body: Some(update.body.unwrap_or_default()),
                    })
                },
                Ok(None) => {
                    Ok(UpdateStatus {
                        available: false,
                        current_version,
                        latest_version: None,
                        download_url: None,
                        body: None,
                    })
                },
                Err(e) => {
                    log::error!("Update check failed: {}", e);
                    Err(format!("Update check failed: {}", e))
                }
            }
        },
        Err(e) => {
            log::error!("Failed to get updater: {}", e);
            Err(format!("Failed to get updater: {}", e))
        }
    }
}

pub async fn download_and_install(app: AppHandle) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    let mut downloaded = 0;

                    match update.download_and_install(
                        |chunk_length, content_length| {
                            downloaded += chunk_length;
                            let progress = if let Some(total) = content_length {
                                (downloaded as f64 / total as f64) * 100.0
                            } else {
                                0.0
                            };
                            
                            let _ = app.emit("update-progress", progress);
                        },
                        || {
                            let _ = app.emit("update-completed", ());
                        },
                    ).await {
                        Ok(_) => Ok(()),
                        Err(e) => {
                            log::error!("Update installation failed: {}", e);
                            Err(format!("Update installation failed: {}", e))
                        }
                    }
                },
                Ok(None) => {
                    Err("No update available".to_string())
                },
                Err(e) => {
                    log::error!("Update check failed: {}", e);
                    Err(format!("Update check failed: {}", e))
                }
            }
        },
        Err(e) => {
            log::error!("Failed to get updater: {}", e);
            Err(format!("Failed to get updater: {}", e))
        }
    }
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<UpdateStatus, String> {
    check_for_updates(app).await
}

#[tauri::command]
pub async fn install_update(app: AppHandle) -> Result<(), String> {
    download_and_install(app).await
}