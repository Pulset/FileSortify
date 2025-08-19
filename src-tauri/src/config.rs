use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::i18n::t;

// 路径配置和状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathConfig {
    pub id: String,
    pub path: String,
    pub name: String,
    #[serde(rename = "isMonitoring")]
    pub is_monitoring: bool,
    #[serde(rename = "autoOrganize")]
    pub auto_organize: bool,
    pub stats: PathStats,
    #[serde(rename = "customCategories")]
    pub custom_categories: Option<HashMap<String, Vec<String>>>,
    #[serde(rename = "excludePatterns")]
    pub exclude_patterns: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathStats {
    #[serde(rename = "filesOrganized")]
    pub files_organized: u64,
    #[serde(rename = "lastOrganized")]
    pub last_organized: Option<String>,
    #[serde(rename = "monitoringSince")]
    pub monitoring_since: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub categories: HashMap<String, Vec<String>>,
    pub version: String,
    pub description: String,
    pub paths: Option<Vec<PathConfig>>,
    // 向后兼容的旧字段
    #[serde(rename = "downloadsFolder")]
    pub downloads_folder: Option<String>,
    #[serde(rename = "autoOrganize")]
    pub auto_organize: Option<bool>,
    #[serde(rename = "notificationEnabled")]
    pub notification_enabled: Option<bool>,
    pub rules: Option<Vec<serde_json::Value>>,
}

impl Config {
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let config_path = Self::get_config_path();
        
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            let config: Config = serde_json::from_str(&content)?;
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
            config_dir.join("fileSortify").join("config.json")
        } else {
            PathBuf::from("file_organizer_config.json")
        }
    }
    
    pub fn add_category(&mut self, name: String, extensions: Vec<String>) {
        self.categories.insert(name, extensions);
    }
    
    pub fn remove_category(&mut self, name: &str) -> bool {
        if name != t("category_others") {
            self.categories.remove(name).is_some()
        } else {
            false
        }
    }
    
    pub fn update_category(&mut self, name: String, extensions: Vec<String>) -> bool {
        if self.categories.contains_key(&name) {
            self.categories.insert(name, extensions);
            true
        } else {
            false
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        let mut categories = HashMap::new();
        
        categories.insert(t("category_images"), vec![
            ".jpg".to_string(), ".jpeg".to_string(), ".png".to_string(), 
            ".gif".to_string(), ".bmp".to_string(), ".svg".to_string(), 
            ".webp".to_string(), ".tiff".to_string(), ".ico".to_string()
        ]);
        
        categories.insert(t("category_documents"), vec![
            ".pdf".to_string(), ".doc".to_string(), ".docx".to_string(), 
            ".txt".to_string(), ".rtf".to_string(), ".pages".to_string(), 
            ".odt".to_string(), ".epub".to_string()
        ]);
        
        categories.insert(t("category_spreadsheets"), vec![
            ".xls".to_string(), ".xlsx".to_string(), ".csv".to_string(), 
            ".numbers".to_string(), ".ods".to_string()
        ]);
        
        categories.insert(t("category_presentations"), vec![
            ".ppt".to_string(), ".pptx".to_string(), ".key".to_string(), 
            ".odp".to_string()
        ]);
        
        categories.insert(t("category_audio"), vec![
            ".mp3".to_string(), ".wav".to_string(), ".aac".to_string(), 
            ".flac".to_string(), ".m4a".to_string(), ".ogg".to_string(), 
            ".wma".to_string()
        ]);
        
        categories.insert(t("category_video"), vec![
            ".mp4".to_string(), ".avi".to_string(), ".mov".to_string(), 
            ".mkv".to_string(), ".wmv".to_string(), ".flv".to_string(), 
            ".webm".to_string(), ".m4v".to_string()
        ]);
        
        categories.insert(t("category_archives"), vec![
            ".zip".to_string(), ".rar".to_string(), ".7z".to_string(), 
            ".tar".to_string(), ".gz".to_string(), ".bz2".to_string(), 
            ".xz".to_string()
        ]);
        
        categories.insert(t("category_programs"), vec![
            ".dmg".to_string(), ".pkg".to_string(), ".app".to_string(), 
            ".exe".to_string(), ".deb".to_string(), ".rpm".to_string()
        ]);
        
        categories.insert(t("category_code"), vec![
            ".py".to_string(), ".js".to_string(), ".html".to_string(), 
            ".css".to_string(), ".java".to_string(), ".cpp".to_string(), 
            ".c".to_string(), ".php".to_string(), ".rb".to_string(), 
            ".go".to_string(), ".rs".to_string()
        ]);
        
        categories.insert(t("category_fonts"), vec![
            ".ttf".to_string(), ".otf".to_string(), ".woff".to_string(), 
            ".woff2".to_string()
        ]);
        
        categories.insert(t("category_others"), vec![]);
        
        Config {
            categories,
            version: "1.0".to_string(),
            description: t("config_file_description"),
            paths: Some(vec![]),
            downloads_folder: None,
            auto_organize: None,
            notification_enabled: None,
            rules: None,
        }
    }
}