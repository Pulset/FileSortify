use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::RwLock;
use std::hash::Hash; // 添加这一行导入Hash trait

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)] // 添加Hash
pub enum Language {
    English,
    Chinese,
}

impl Default for Language {
    fn default() -> Self {
        Language::English
    }
}

impl From<&str> for Language {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "zh" | "chinese" | "中文" => Language::Chinese,
            _ => Language::English,
        }
    }
}

lazy_static! {
    static ref CURRENT_LANGUAGE: RwLock<Language> = RwLock::new(Language::default());
    
    static ref TRANSLATIONS: HashMap<Language, HashMap<&'static str, &'static str>> = {
        let mut translations = HashMap::new();
        
        // 英文翻译
        let mut en = HashMap::new();
        // 错误消息
        en.insert("trial_ended", "Trial period has ended, please subscribe to continue using");
        en.insert("init_failed", "Initialization failed: {}");
        en.insert("organize_failed", "File organization failed: {}");
        en.insert("monitoring_start_failed", "Failed to start monitoring: {}");
        en.insert("load_config_failed", "Failed to load configuration: {}");
        en.insert("save_config_failed", "Failed to save configuration: {}");
        en.insert("folder_selection_cancelled", "Folder selection cancelled or failed");
        en.insert("downloads_folder_not_found", "Could not find default downloads folder");
        
        // 成功消息
        en.insert("config_saved", "Configuration saved successfully");
        en.insert("files_organized", "Successfully organized {} files");
        
        // 通知
        en.insert("monitoring_stopped_title", "File Monitoring Stopped");
        en.insert("monitoring_stopped_body", "Automatic file classification monitoring has stopped");
        en.insert("monitoring_started_title", "File Monitoring Started");
        en.insert("monitoring_started_body", "Monitoring folder: {}");
        
        // 在英文翻译部分添加
        // 设置相关
        en.insert("enable_autostart_failed", "Failed to enable auto start: {}");
        en.insert("disable_autostart_failed", "Failed to disable auto start: {}");
        en.insert("settings_saved", "General settings saved successfully");
        en.insert("save_settings_failed", "Failed to save general settings: {}");
        en.insert("setting_updated", "Setting {} updated successfully");
        
        // 系统托盘
        en.insert("show_window", "Show Window");
        en.insert("hide_window", "Hide Window");
        en.insert("quit", "Quit");
        
        // 订阅相关
        en.insert("fetch_packages_failed", "Failed to fetch packages: {}");
        en.insert("payment_disabled", "This feature is disabled, please use Creem payment");
        en.insert("apple_purchase_init_failed", "Failed to initialize StoreKit: {}");
        en.insert("apple_purchase_start_failed", "Failed to start purchase: {}");
        en.insert("apple_purchase_started", "App Store purchase process started");
        en.insert("apple_purchase_macos_only", "App Store purchases are only available on macOS");
        en.insert("apple_receipt_verify_success", "Your Apple subscription has been successfully verified!");
        en.insert("apple_receipt_verify_success_title", "Subscription Verification Successful");
        en.insert("apple_receipt_verify_failed", "Failed to verify Apple receipt: {}");
        
        // 窗口相关
        en.insert("main_window_not_found", "Main window not found");
        
        // 配置相关
        en.insert("config_file_description", "File auto-classification tool configuration file");
        
        // 分类名称
        en.insert("category_images", "Images");
        en.insert("category_documents", "Documents");
        en.insert("category_spreadsheets", "Spreadsheets");
        en.insert("category_presentations", "Presentations");
        en.insert("category_audio", "Audio");
        en.insert("category_video", "Video");
        en.insert("category_archives", "Archives");
        en.insert("category_programs", "Programs");
        en.insert("category_code", "Code");
        en.insert("category_fonts", "Fonts");
        en.insert("category_others", "Others");
        
        // 中文翻译
        let mut zh = HashMap::new();
        // 错误消息
        zh.insert("trial_ended", "试用期已结束，请订阅后继续使用");
        zh.insert("init_failed", "初始化失败: {}");
        zh.insert("organize_failed", "整理文件失败: {}");
        zh.insert("monitoring_start_failed", "启动监控失败: {}");
        zh.insert("load_config_failed", "加载配置失败: {}");
        zh.insert("save_config_failed", "保存配置失败: {}");
        zh.insert("folder_selection_cancelled", "文件夹选择已取消或失败");
        zh.insert("downloads_folder_not_found", "无法找到默认下载文件夹");
        
        // 成功消息
        zh.insert("config_saved", "配置保存成功");
        zh.insert("files_organized", "成功整理了 {} 个文件");
        
        // 设置相关
        zh.insert("enable_autostart_failed", "启用开机启动失败: {}");
        zh.insert("disable_autostart_failed", "禁用开机启动失败: {}");
        zh.insert("settings_saved", "通用设置保存成功");
        zh.insert("save_settings_failed", "保存通用设置失败: {}");
        zh.insert("setting_updated", "设置 {} 更新成功");
        
        // 系统托盘
        zh.insert("show_window", "显示窗口");
        zh.insert("hide_window", "隐藏窗口");
        zh.insert("quit", "退出");
        
        // 订阅相关
        zh.insert("fetch_packages_failed", "获取套餐信息失败: {}");
        zh.insert("payment_disabled", "此功能已禁用，请使用 Creem 支付");
        zh.insert("apple_purchase_init_failed", "初始化StoreKit失败: {}");
        zh.insert("apple_purchase_start_failed", "启动购买失败: {}");
        zh.insert("apple_purchase_started", "已启动App Store购买流程");
        zh.insert("apple_purchase_macos_only", "App Store内购仅在macOS上可用");
        zh.insert("apple_receipt_verify_success", "您的Apple订阅已成功验证！");
        zh.insert("apple_receipt_verify_success_title", "订阅验证成功");
        zh.insert("apple_receipt_verify_failed", "验证Apple收据失败: {}");
        
        // 窗口相关
        zh.insert("main_window_not_found", "找不到主窗口");
        
        // 配置相关
        zh.insert("config_file_description", "文件自动分类工具配置文件");
        
        // 分类名称
        zh.insert("category_images", "图片");
        zh.insert("category_documents", "文档");
        zh.insert("category_spreadsheets", "表格");
        zh.insert("category_presentations", "演示");
        zh.insert("category_audio", "音频");
        zh.insert("category_video", "视频");
        zh.insert("category_archives", "压缩包");
        zh.insert("category_programs", "程序");
        zh.insert("category_code", "代码");
        zh.insert("category_fonts", "字体");
        zh.insert("category_others", "其他");
        
        zh.insert("monitoring_stopped_title", "文件监控已停止");
        zh.insert("monitoring_stopped_body", "文件自动分类监控已停止");
        zh.insert("monitoring_started_title", "文件监控已启动");
        zh.insert("monitoring_started_body", "正在监控文件夹: {}");
        
        translations.insert(Language::English, en);
        translations.insert(Language::Chinese, zh);
        
        translations
    };
}

/// 设置当前语言
pub fn set_language(lang: Language) {
    let mut current = CURRENT_LANGUAGE.write().unwrap();
    *current = lang;
}

/// 获取当前语言
pub fn get_language() -> Language {
    *CURRENT_LANGUAGE.read().unwrap()
}

/// 翻译函数，类似前端的t()
pub fn t(key: &str) -> String {
    let lang = get_language();
    match TRANSLATIONS.get(&lang) {
        Some(translations) => {
            match translations.get(key) {
                Some(text) => text.to_string(),
                None => key.to_string(), // 如果找不到翻译，返回键名
            }
        },
        None => key.to_string(), // 如果找不到语言，返回键名
    }
}

/// 带格式化参数的翻译函数
pub fn t_format(key: &str, args: &[&str]) -> String {
    let template = t(key);
    let mut result = template.clone();
    
    for (i, arg) in args.iter().enumerate() {
        result = result.replace(&format!("{{{}}}", i), arg);
    }
    
    result
}