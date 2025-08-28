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
        en.insert("files_organized", "Successfully organized {0} files");
        
        // 通知
        en.insert("monitoring_stopped_title", "File Monitoring Stopped");
        en.insert("monitoring_stopped_body", "Automatic file classification monitoring has stopped");
        en.insert("monitoring_started_title", "File Monitoring Started");
        en.insert("monitoring_started_body", "Monitoring folder: {}");
        
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
        // en.insert("category_others", "Others");
        
        // 新增的翻译键
        en.insert("invalid_subscription_plan", "Invalid subscription plan");
        en.insert("purchase_success_title", "Purchase Successful");
        en.insert("purchase_success_body", "Thank you for purchasing FileSortify! You can now use all features without restrictions.");
        en.insert("purchase_activation_success", "Purchase activated successfully");
        en.insert("purchase_activation_failed", "Failed to activate purchase: {}");
        en.insert("subscription_cancelled_title", "Subscription Cancelled");
        en.insert("subscription_cancelled_body", "Your subscription has been successfully cancelled");
        en.insert("subscription_cancelled", "Subscription cancelled");
        en.insert("cancel_subscription_failed", "Failed to cancel subscription: {}");
        en.insert("apple_receipt_verify_failed_format", "Failed to verify Apple receipt: {}");
        en.insert("subscription_status_refreshed", "Subscription status refreshed");
        en.insert("refresh_subscription_failed", "Failed to refresh subscription status: {}");
        en.insert("apple_purchase_macos_only_format", "App Store purchases are only available on macOS");
        en.insert("storekit_init_failed", "Failed to initialize StoreKit: {}");
        en.insert("restore_purchases_failed", "Failed to restore purchases: {}");
        en.insert("purchase_restore_started", "Purchase restoration process started");
        en.insert("receipt_data_failed", "Failed to get receipt data: {}");
        en.insert("receipt_macos_only", "App Store receipts are only available on macOS");
        en.insert("create_payment_session_failed", "Failed to create payment session: {}");
        en.insert("check_payment_status_failed", "Failed to check payment status: {}");
        en.insert("open_payment_page_failed", "Failed to open payment page: {}");
        en.insert("webhook_url_updated", "Webhook server URL updated");
        en.insert("update_url_failed", "Failed to update URL: {}");
        en.insert("app_minimized_title", "File Sortify");
        en.insert("app_minimized_body", "Application minimized to system tray");
        en.insert("updater_started", "Update scheduler started, check interval: {} hours");
        // file_organizer keys
        en.insert("organized_folder_name", "Organized Files");
        en.insert("skip_unmatched_file", "Skip unmatched file: {} (left in place)");
        en.insert("organize_complete_moved_count", "Organization complete, moved {} files");
        en.insert("monitor_stop_signal_received", "Received stop monitoring signal, exiting monitor thread");
        en.insert("file_create_event_detected", "File create event detected, count: {}");
        en.insert("file_recently_processed_skip", "File {:?} processed {:?} ago, skipping");
        en.insert("start_processing_file", "Start processing file: {:?}");
        en.insert("new_file_categorized", "New file categorized: {} -> {}");
        en.insert("move_file_failed", "Failed to move file: {:?}");
        en.insert("new_file_unmatched", "New file unmatched, left in place: {:?}");
        en.insert("event_process_error", "Event processing error: {:?}");
        en.insert("monitor_error", "Monitor error: {:?}");
        en.insert("monitor_started", "File monitoring started");
        en.insert("monitor_stop_signal_sent", "Stop monitoring signal sent");
        en.insert("join_monitor_thread_error", "Error while joining monitor thread: {:?}");
        en.insert("monitor_stopped", "File monitoring stopped");
        en.insert("move_file_success", "Moved file: {} -> {}");
        en.insert("update_scheduler_config_success", "Update scheduler config saved successfully");
        en.insert("update_scheduler_config_failed", "Failed to save update scheduler config: {}");
        en.insert("create_folder", "Create folder: {}");
        
        // 新增的文件监控键
        en.insert("file_modify_event_detected", "File modify event detected, count: {}");
        en.insert("file_other_event_detected", "File other event detected, count: {}");
        
        // 撤销相关键
        en.insert("undo_action_success", "Undo successful: {} moved back to original location");
        en.insert("undo_history_cleared", "Undo history cleared");
        en.insert("undo_success_title", "Undo Successful");
        en.insert("undo_failed", "Undo failed: {}");
        en.insert("no_monitoring_for_path", "No active monitoring for this path");

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
        zh.insert("files_organized", "成功整理了 {0} 个文件");
        
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
        // zh.insert("category_others", "其他");
        
        zh.insert("monitoring_stopped_title", "文件监控已停止");
        zh.insert("monitoring_stopped_body", "文件自动分类监控已停止");
        zh.insert("monitoring_started_title", "文件监控已启动");
        zh.insert("monitoring_started_body", "正在监控文件夹: {}");
        
        // 新增的翻译键
        zh.insert("invalid_subscription_plan", "无效的订阅计划");
        zh.insert("purchase_success_title", "购买成功");
        zh.insert("purchase_success_body", "感谢您购买 FileSortify！现在可以无限制使用所有功能。");
        zh.insert("purchase_activation_success", "购买激活成功");
        zh.insert("purchase_activation_failed", "激活购买失败: {}");
        zh.insert("subscription_cancelled_title", "订阅已取消");
        zh.insert("subscription_cancelled_body", "您的订阅已成功取消");
        zh.insert("subscription_cancelled", "订阅已取消");
        zh.insert("cancel_subscription_failed", "取消订阅失败: {}");
        zh.insert("apple_receipt_verify_failed_format", "验证Apple收据失败: {}");
        zh.insert("subscription_status_refreshed", "订阅状态已刷新");
        zh.insert("refresh_subscription_failed", "刷新订阅状态失败: {}");
        zh.insert("apple_purchase_macos_only_format", "App Store内购仅在macOS上可用");
        zh.insert("storekit_init_failed", "初始化StoreKit失败: {}");
        zh.insert("restore_purchases_failed", "恢复购买失败: {}");
        zh.insert("purchase_restore_started", "已启动购买恢复流程");
        zh.insert("receipt_data_failed", "获取收据失败: {}");
        zh.insert("receipt_macos_only", "App Store收据仅在macOS上可用");
        zh.insert("create_payment_session_failed", "创建支付会话失败: {}");
        zh.insert("check_payment_status_failed", "检查支付状态失败: {}");
        zh.insert("open_payment_page_failed", "打开支付页面失败: {}");
        zh.insert("webhook_url_updated", "Webhook 服务器 URL 已更新");
        zh.insert("update_url_failed", "更新 URL 失败: {}");
        zh.insert("app_minimized_title", "File Sortify");
        zh.insert("app_minimized_body", "应用已最小化到系统托盘");
        zh.insert("updater_started", "启动更新调度器，检查间隔: {} 小时");
        // file_organizer keys
        zh.insert("organized_folder_name", "已分类文件");
        zh.insert("skip_unmatched_file", "跳过未匹配文件: {} (保持在原地)");
        zh.insert("organize_complete_moved_count", "整理完成，共移动 {} 个文件");
        zh.insert("monitor_stop_signal_received", "收到停止监控信号，退出监控线程");
        zh.insert("file_create_event_detected", "检测到文件创建事件，文件数量: {}");
        zh.insert("file_recently_processed_skip", "文件 {:?} 在 {:?} 前已处理过，跳过");
        zh.insert("start_processing_file", "开始处理文件: {:?}");
        zh.insert("new_file_categorized", "新文件已分类: {} -> {}");
        zh.insert("move_file_failed", "移动文件失败: {:?}");
        zh.insert("new_file_unmatched", "新文件未匹配分类，保持在原地: {:?}");
        zh.insert("event_process_error", "事件处理错误: {:?}");
        zh.insert("monitor_error", "监控错误: {:?}");
        zh.insert("monitor_started", "文件监控已启动");
        zh.insert("monitor_stop_signal_sent", "已发送停止监控信号");
        zh.insert("join_monitor_thread_error", "加入监控线程时出错: {:?}");
        zh.insert("monitor_stopped", "文件监控已停止");
        zh.insert("move_file_success", "移动文件: {} -> {}");
        zh.insert("update_scheduler_config_success", "更新调度器配置保存成功");
        zh.insert("update_scheduler_config_failed", "保存更新调度器配置失败: {}");
        en.insert("create_folder", "创建文件夹: {}");
        
        // 新增的文件监控键
        zh.insert("file_modify_event_detected", "检测到文件修改事件，文件数量: {}");
        zh.insert("file_other_event_detected", "检测到其他文件事件，文件数量: {}");
        
        // 撤销相关键
        zh.insert("undo_action_success", "撤销成功：{} 已移回原位置");
        zh.insert("undo_history_cleared", "撤销历史已清空");
        zh.insert("undo_success_title", "撤销成功");
        zh.insert("undo_failed", "撤销失败：{}");
        zh.insert("no_monitoring_for_path", "该路径未启动监控");

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
        // 支持 {0} 风格
        result = result.replace(&format!("{{{}}}", i), arg);
        // 兼容 {} 顺序占位符，每次只替换一个
        if result.contains("{}") {
            result = result.replacen("{}", arg, 1);
        }
    }
    
    result
}