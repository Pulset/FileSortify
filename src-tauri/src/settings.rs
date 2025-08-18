use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneralSettings {
    pub auto_start: bool,
    pub theme: String,
}

impl GeneralSettings {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let settings_path = Self::get_settings_path();
        
        if settings_path.exists() {
            let content = fs::read_to_string(&settings_path)?;
            let settings: GeneralSettings = serde_json::from_str(&content)?;
            Ok(settings)
        } else {
            let settings = Self::default();
            settings.save()?;
            Ok(settings)
        }
    }
    
    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let settings_path = Self::get_settings_path();
        
        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        let content = serde_json::to_string_pretty(self)?;
        fs::write(&settings_path, content)?;
        
        Ok(())
    }
    
    fn get_settings_path() -> PathBuf {
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("fileSortify").join("settings.json")
        } else {
            PathBuf::from("file_organizer_settings.json")
        }
    }
    
    pub fn update_setting(&mut self, key: &str, value: serde_json::Value) -> Result<(), String> {
        match key {
            "auto_start" => {
                if let Some(val) = value.as_bool() {
                    self.auto_start = val;
                } else {
                    return Err("auto_start must be a boolean".to_string());
                }
            }
            "theme" => {
                if let Some(val) = value.as_str() {
                    self.theme = val.to_string();
                } else {
                    return Err("theme must be a string".to_string());
                }
            }
            _ => return Err(format!("Unknown setting key: {}", key)),
        }
        Ok(())
    }
}

impl Default for GeneralSettings {
    fn default() -> Self {
        GeneralSettings {
            auto_start: false,
            theme: "system".to_string(),
        }
    }
}