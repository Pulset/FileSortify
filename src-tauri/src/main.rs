// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{State, Manager, WindowEvent, RunEvent};
use tokio::sync::Mutex;

mod file_organizer;
mod config;
mod subscription;
mod apple_subscription;
mod updater;
mod settings;
mod autostart;

#[cfg(target_os = "macos")]
mod storekit_bridge;

use file_organizer::fileSortify;
use config::Config;
use subscription::{Subscription, SubscriptionPlan, PricingInfo, PackagesResponse};
use settings::GeneralSettings;
use autostart::AutoStart;

// 全局状态
use std::collections::HashMap;

struct AppState {
    organizers: Mutex<HashMap<String, fileSortify>>,
    subscription: Mutex<Subscription>,
    settings: Mutex<GeneralSettings>,
}

// Tauri命令：开始整理文件
// 在文件顶部添加
mod i18n;
use i18n::{t, t_format, set_language, Language};

// 修改organize_files函数中的硬编码文本
#[tauri::command]
async fn organize_files(
    folder_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // 检查订阅状态
    {
        let subscription = state.subscription.lock().await;
        if !subscription.can_use_app() {
            return Err(t("trial_ended"));
        }
    }
    
    // 只临时创建 organizer，不插入 organizers HashMap
    match fileSortify::new(&folder_path) {
        Ok(mut organizer) => {
            organizer = organizer.with_app_handle(app_handle.clone());
            match organizer.organize_existing_files() {
                Ok(count) => Ok(t_format("files_organized", &[&count.to_string()])),
                Err(e) => Err(t_format("organize_failed", &[&e.to_string()]))
            }
        }
        Err(e) => Err(t_format("init_failed", &[&e.to_string()]))
    }
}

// 修改toggle_monitoring函数中的硬编码文本
#[tauri::command]
async fn toggle_monitoring(
    folder_path: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<bool, String> {
    // 检查订阅状态
    {
        let subscription = state.subscription.lock().await;
        if !subscription.can_use_app() {
            return Err(t("trial_ended"));
        }
    }
    
    let mut organizers = state.organizers.lock().await;
    
    if let Some(organizer) = organizers.get_mut(&folder_path) {
        // 路径已经在监控，停止它
        organizer.stop_monitoring();
        organizers.remove(&folder_path);
        
        // 发送通知
        let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
            .builder()
            .title(&t("monitoring_stopped_title"))
            .body(&t("monitoring_stopped_body"))
            .show();
            
        Ok(false)
    } else {
        // 开始新的监控
        match fileSortify::new(&folder_path) {
            Ok(mut organizer) => {
                organizer = organizer.with_app_handle(app_handle.clone());
                if let Err(e) = organizer.start_monitoring() {
                    return Err(t_format("monitoring_start_failed", &[&e.to_string()]));
                }
                
                // 发送通知
                let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                    .builder()
                    .title(&t("monitoring_started_title"))
                    .body(&t_format("monitoring_started_body", &[&folder_path]))
                    .show();
                    
                organizers.insert(folder_path.clone(), organizer);
                Ok(true)
            },
            Err(e) => Err(t_format("init_failed", &[&e.to_string()]))
        }
    }
}

// Tauri命令：获取配置
// 修改get_config函数
#[tauri::command]
async fn get_config() -> Result<Config, String> {
    match Config::load() {
        Ok(config) => Ok(config),
        Err(e) => Err(t_format("load_config_failed", &[&e.to_string()]))
    }
}

// 修改save_config函数
#[tauri::command]
async fn save_config(config: Config) -> Result<String, String> {
    match config.save() {
        Ok(_) => Ok(t("config_saved")),
        Err(e) => Err(t_format("save_config_failed", &[&e.to_string()]))
    }
}

// 修改select_folder函数
#[tauri::command]
async fn select_folder(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;
    
    let (tx, rx) = oneshot::channel();
    
    app_handle.dialog().file().pick_folder(move |folder_path| {
        let path_string = folder_path.map(|p| p.to_string());
        let _ = tx.send(path_string);
    });
    
    match rx.await {
        Ok(result) => Ok(result),
        Err(_) => Err(t("folder_selection_cancelled")),
    }
}

// 修改get_default_downloads_folder函数
#[tauri::command]
async fn get_default_downloads_folder() -> Result<String, String> {
    if let Some(downloads_dir) = dirs::download_dir() {
        return Ok(downloads_dir.to_string_lossy().to_string());
    }
    
    // 备用方案
    #[cfg(windows)]
    {
        if let Some(home_dir) = dirs::home_dir() {
            return Ok(home_dir.join("Downloads").to_string_lossy().to_string());
        }
    }
    
    #[cfg(not(windows))]
    {
        if let Some(home_dir) = dirs::home_dir() {
            return Ok(home_dir.join("Downloads").to_string_lossy().to_string());
        }
    }
    
    Err(t("downloads_folder_not_found"))
}

// 订阅相关命令

// Tauri命令：获取订阅状态
#[tauri::command]
async fn get_subscription_status(
    state: State<'_, AppState>,
) -> Result<Subscription, String> {
    let subscription = state.subscription.lock().await;
    Ok(subscription.clone())
}

// Tauri命令：检查是否可以使用应用
#[tauri::command]
async fn can_use_app(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let subscription = state.subscription.lock().await;
    Ok(subscription.can_use_app())
}

// Tauri命令：安全检查应用使用权限（包含服务端验证）
#[tauri::command]
async fn can_use_app_secure(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let mut subscription = state.subscription.lock().await;
    let can_use = subscription.can_use_app_secure().await;
    Ok(can_use)
}

// Tauri命令：获取套餐信息 (API: /api/packages)
#[tauri::command]
async fn get_packages() -> Result<PackagesResponse, String> {
    Ok(Subscription::get_packages_info())
}

// Tauri命令：从服务端获取套餐信息
#[tauri::command]
async fn fetch_packages_from_server(
    state: State<'_, AppState>,
) -> Result<PackagesResponse, String> {
    // 先克隆订阅数据，避免跨异步边界持有锁
    let mut subscription_clone = {
        let subscription = state.subscription.lock().await;
        subscription.clone()
    };
    
    match subscription_clone.fetch_packages_from_server().await {
        Ok(packages) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }
            Ok(packages)
        },
        Err(e) => Err(t_format("fetch_packages_failed", &[&e.to_string()]))
    }
}

// Tauri命令：激活订阅（模拟支付成功后调用）
#[tauri::command]
async fn activate_subscription(
    plan: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut subscription = state.subscription.lock().await;
    
    let subscription_plan = match plan.as_str() {
        "lifetime" => SubscriptionPlan::Lifetime,
        _ => return Err(t("invalid_subscription_plan")),
    };
    
    match subscription.activate_subscription(subscription_plan) {
        Ok(_) => {
            // 发送通知
            let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title(&t("purchase_success_title"))
                .body(&t("purchase_success_body"))
                .show();
                
            Ok(t("purchase_activation_success"))
        }
        Err(e) => Err(t_format("purchase_activation_failed", &[&e.to_string()]))
    }
}

// Tauri命令：取消订阅
#[tauri::command]
async fn cancel_subscription(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut subscription = state.subscription.lock().await;
    
    match subscription.cancel_subscription() {
        Ok(_) => {
            // 发送通知
            let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title(&t("subscription_cancelled_title"))
                .body(&t("subscription_cancelled_body"))
                .show();
                
            Ok(t("subscription_cancelled"))
        }
        Err(e) => Err(t_format("cancel_subscription_failed", &[&e.to_string()]))
    }
}

// Tauri命令：打开支付页面 (已禁用，仅保留兼容性)
#[tauri::command]
async fn open_payment_page(_plan: String, _app_handle: tauri::AppHandle) -> Result<(), String> {
    Err(t("payment_disabled"))
}

// 修改verify_apple_receipt函数
#[tauri::command]
async fn verify_apple_receipt(
    receipt_data: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // 先克隆订阅数据，避免跨异步边界持有锁
    let mut subscription_clone = {
        let subscription = state.subscription.lock().await;
        subscription.clone()
    };
    
    match subscription_clone.verify_apple_receipt(receipt_data).await {
        Ok(_) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }
            
            // 发送通知
            let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title(&t("apple_receipt_verify_success_title"))
                .body(&t("apple_receipt_verify_success"))
                .show();
                
            Ok(t("apple_receipt_verify_success"))
        }
        Err(e) => Err(t_format("apple_receipt_verify_failed_format", &[&e.to_string()]))
    }
}

// Tauri命令：刷新Apple订阅状态
#[tauri::command]
async fn refresh_apple_subscription(
    state: State<'_, AppState>,
) -> Result<String, String> {
    // 先克隆订阅数据，避免跨异步边界持有锁
    let mut subscription_clone = {
        let subscription = state.subscription.lock().await;
        subscription.clone()
    };
    
    match subscription_clone.refresh_apple_subscription().await {
        Ok(_) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }
            
            Ok(t("subscription_status_refreshed"))
        }
        Err(e) => Err(t_format("refresh_subscription_failed", &[&e.to_string()]))
    }
}

// 修改get_apple_products函数
#[tauri::command]
async fn get_apple_products() -> Result<serde_json::Value, String> {
    Err(t("payment_disabled"))
}

// 修改start_apple_purchase函数
#[tauri::command]
async fn start_apple_purchase(product_id: String, _state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let mut store_manager = StoreKitManager::new();
        store_manager.initialize().map_err(|e| t_format("apple_purchase_init_failed", &[&e.to_string()]))?;
        
        store_manager.purchase_product(&product_id).map_err(|e| t_format("apple_purchase_start_failed", &[&e.to_string()]))?;
        
        Ok(t("apple_purchase_started"))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err(t("apple_purchase_macos_only_format"))
    }
}

// Tauri命令：恢复购买
#[tauri::command]
async fn restore_apple_purchases(_state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let mut store_manager = StoreKitManager::new();
        store_manager.initialize().map_err(|e| t_format("storekit_init_failed", &[&e.to_string()]))?;
        
        store_manager.restore_purchases().map_err(|e| t_format("restore_purchases_failed", &[&e.to_string()]))?;
        
        Ok(t("purchase_restore_started"))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err(t("apple_purchase_macos_only_format"))
    }
}

// Tauri命令：获取本地收据数据
#[tauri::command]
async fn get_local_receipt_data() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let store_manager = StoreKitManager::new();
        store_manager.get_receipt_data().map_err(|e| t_format("receipt_data_failed", &[&e.to_string()]))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err(t("receipt_macos_only"))
    }
}

// Creem 订阅相关命令

// Tauri命令：创建 Creem 支付会话
#[tauri::command]
async fn create_creem_session(
    plan: String,
    state: State<'_, AppState>,
) -> Result<subscription::CreemSessionResponse, String> {
    let subscription_plan = match plan.as_str() {
        "lifetime" => SubscriptionPlan::Lifetime,
        _ => return Err(t("invalid_subscription_plan")),
    };

    // 先克隆订阅数据，避免跨异步边界持有锁
    let mut subscription_clone = {
        let subscription = state.subscription.lock().await;
        subscription.clone()
    };

    match subscription_clone.create_creem_session(subscription_plan).await {
        Ok(session_response) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }
            Ok(session_response)
        }
        Err(e) => Err(t_format("create_payment_session_failed", &[&e.to_string()]))
    }
}

// Tauri命令：检查 Creem 支付状态
#[tauri::command]
async fn check_creem_payment_status(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<subscription::CreemPaymentStatus, String> {
    // 先克隆订阅数据，避免跨异步边界持有锁
    let mut subscription_clone = {
        let subscription = state.subscription.lock().await;
        subscription.clone()
    };

    match subscription_clone.check_creem_payment_status().await {
        Ok(payment_status) => {
            // 如果支付完成，发送通知（只要有userPackages返回就表示已经购买了）
            if !payment_status.user_packages.is_empty() {
                let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                    .builder()
                    .title(&t("purchase_success_title"))
                    .body(&t("purchase_success_body"))
                    .show();
            }

            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }

            Ok(payment_status)
        }
        Err(e) => Err(t_format("check_payment_status_failed", &[&e.to_string()]))
    }
}

// Tauri命令：打开 Creem 支付页面
#[tauri::command]
async fn open_creem_payment_page(
    plan: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    // 创建支付会话
    let session_response = create_creem_session(plan, state).await?;

    // 打开支付页面
    use tauri_plugin_opener::OpenerExt;
    
    if let Err(e) = app_handle.opener().open_url(&session_response.checkout_url, None::<String>) {
        return Err(t_format("open_payment_page_failed", &[&e.to_string()]));
    }

    Ok(session_response.user_package.id)
}

// Tauri命令：设置 webhook 服务器 URL
#[tauri::command]
async fn set_webhook_server_url(
    url: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut subscription = state.subscription.lock().await;
    
    match subscription.set_webhook_server_url(url) {
        Ok(_) => Ok(t("webhook_url_updated")),
        Err(e) => Err(t_format("update_url_failed", &[&e.to_string()]))
    }
}

// Tauri命令：获取当前支付会话信息
#[tauri::command]
async fn get_current_session_info(
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let subscription = state.subscription.lock().await;
    Ok(subscription.get_current_session_info())
}

// Tauri命令：显示主窗口
#[tauri::command]
async fn show_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        Ok(())
    } else {
        Err(t("main_window_not_found"))
    }
}

// Tauri命令：隐藏主窗口
#[tauri::command]
async fn hide_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err(t("main_window_not_found"))
    }
}

// Tauri命令：获取应用版本
#[tauri::command]
async fn get_app_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}

// Tauri命令：获取通用设置
#[tauri::command]
async fn get_general_settings(
    state: State<'_, AppState>,
) -> Result<GeneralSettings, String> {
    let settings = state.settings.lock().await;
    Ok(settings.clone())
}

// Tauri命令：更新通用设置
#[tauri::command]
async fn update_general_settings(
    settings: GeneralSettings,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut current_settings = state.settings.lock().await;
    let old_auto_start = current_settings.auto_start;
    
    // 处理开机启动设置变化
    if old_auto_start != settings.auto_start {
        if settings.auto_start {
            if let Err(e) = AutoStart::enable() {
                return Err(t_format("enable_autostart_failed", &[&e.to_string()]));
            }
        } else {
            if let Err(e) = AutoStart::disable() {
                return Err(t_format("disable_autostart_failed", &[&e.to_string()]));
            }
        }
    }
    
    *current_settings = settings.clone();
    
    match settings.save() {
        Ok(_) => Ok(t("settings_saved")),
        Err(e) => Err(t_format("save_settings_failed", &[&e.to_string()]))
    }
}

// 修改update_setting函数
#[tauri::command]
async fn update_setting(
    key: String,
    value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut settings = state.settings.lock().await;
    
    match settings.update_setting(&key, value) {
        Ok(_) => {
            match settings.save() {
                Ok(_) => Ok(t_format("setting_updated", &[&key])),
                Err(e) => Err(t_format("save_settings_failed", &[&e.to_string()]))
            }
        }
        Err(e) => Err(e)
    }
}

// 修改setup_system_tray函数中的菜单项文本
fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };
    
    // 创建托盘菜单
    let show_item = MenuItem::with_id(app, "show", &t("show_window"), true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", &t("hide_window"), true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", &t("quit"), true, None::<&str>)?;
    
    let menu = Menu::with_items(app, &[&show_item, &hide_item, &separator, &quit_item])?;
    
    // 创建系统托盘图标
    let _tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .tooltip("File Sortify")
        .icon(app.default_window_icon().unwrap().clone())
        .on_tray_icon_event(|tray, event| {
            let app_handle = tray.app_handle();
            
            match event {
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } => {
                    // 左键点击显示/隐藏窗口
                    if let Some(window) = app_handle.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        })
        .on_menu_event(|app_handle, event| {
            match event.id().as_ref() {
                "show" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
                "hide" => {
                    if let Some(window) = app_handle.get_webview_window("main") {
                        let _ = window.hide();
                    }
                }
                "quit" => {
                    app_handle.exit(0);
                }
                _ => {}
            }
        })
        .build(app)?;
    
    Ok(())
}

// 添加同步语言的命令
#[tauri::command]
async fn sync_language(language: String) -> Result<(), String> {
    let lang = match language.as_str() {
        "zh" => Language::Chinese,
        "en" => Language::English,
        _ => Language::English,
    };
    
    set_language(lang);
    Ok(())
}

// 撤销相关命令
#[tauri::command]
async fn get_undo_history(
    folder_path: String,
    count: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<file_organizer::UndoAction>, String> {
    let organizers = state.organizers.lock().await;
    
    if let Some(organizer) = organizers.get(&folder_path) {
        let history_count = count.unwrap_or(10);
        Ok(organizer.get_undo_history(history_count))
    } else {
        Err(t("no_monitoring_for_path"))
    }
}

#[tauri::command]
async fn undo_file_action(
    folder_path: String,
    action_id: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut organizers = state.organizers.lock().await;
    
    if let Some(organizer) = organizers.get_mut(&folder_path) {
        match organizer.undo_action(&action_id) {
            Ok(message) => {
                // 发送通知
                let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                    .builder()
                    .title(&t("undo_success_title"))
                    .body(&message)
                    .show();
                Ok(message)
            }
            Err(e) => Err(t_format("undo_failed", &[&e.to_string()]))
        }
    } else {
        Err(t("no_monitoring_for_path"))
    }
}

#[tauri::command]
async fn clear_undo_history(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut organizers = state.organizers.lock().await;
    
    if let Some(organizer) = organizers.get_mut(&folder_path) {
        organizer.clear_undo_history();
        Ok(t("undo_history_cleared"))
    } else {
        Err(t("no_monitoring_for_path"))
    }
}

#[tauri::command]
async fn get_undo_history_count(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let organizers = state.organizers.lock().await;
    
    if let Some(organizer) = organizers.get(&folder_path) {
        Ok(organizer.get_undo_history_count())
    } else {
        Err(t("no_monitoring_for_path"))
    }
}

#[tauri::command]
async fn move_file_direct(
    source_path: String,
    target_path: String,
) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    // 检查源文件是否存在
    if !Path::new(&source_path).exists() {
        return Err(format!("源文件不存在: {}", source_path));
    }
    
    // 准备目标路径，如果冲突则自动重命名
    let target_path_buf = Path::new(&target_path);
    let mut final_target_path = target_path_buf.to_path_buf();
    
    // 如果目标位置已被占用，添加数字后缀
    let mut counter = 1;
    let original_target = final_target_path.clone();
    while final_target_path.exists() {
        if let Some(stem) = original_target.file_stem().and_then(|s| s.to_str()) {
            if let Some(ext) = original_target.extension().and_then(|e| e.to_str()) {
                final_target_path = original_target.with_file_name(format!("{}_{}.{}", stem, counter, ext));
            } else {
                final_target_path = original_target.with_file_name(format!("{}_{}", stem, counter));
            }
        } else {
            // 如果无法解析文件名，直接添加后缀
            final_target_path = Path::new(&format!("{}_{}", target_path, counter)).to_path_buf();
        }
        counter += 1;
        
        // 防止无限循环
        if counter > 1000 {
            return Err("无法找到可用的文件名".to_string());
        }
    }
    
    // 确保目标目录存在
    if let Some(parent) = final_target_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
        }
    }
    
    // 执行文件移动
    fs::rename(&source_path, &final_target_path)
        .map_err(|e| format!("文件移动失败: {}", e))?;
    
    Ok(format!("文件已成功移动: {} -> {}", source_path, final_target_path.display()))
}

// 在main函数中注册这个命令
fn main() {
    // 初始化订阅状态和设置
    let subscription = Subscription::load().unwrap_or_default();
    let settings = GeneralSettings::load().unwrap_or_default();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            organizers: Mutex::new(HashMap::new()),
            subscription: Mutex::new(subscription),
            settings: Mutex::new(settings),
        })
        .invoke_handler(tauri::generate_handler![
            organize_files,
            toggle_monitoring,
            get_config,
            save_config,
            select_folder,
            get_default_downloads_folder,
            get_subscription_status,
            can_use_app,
            can_use_app_secure,
            get_packages,
            fetch_packages_from_server,
            activate_subscription,
            cancel_subscription,
            // Apple Store 相关命令已隐藏
            // verify_apple_receipt,
            // refresh_apple_subscription,
            // get_apple_products,
            // start_apple_purchase,
            // restore_apple_purchases,
            // get_local_receipt_data,
            create_creem_session,
            check_creem_payment_status,
            open_creem_payment_page,
            set_webhook_server_url,
            get_current_session_info,
            show_main_window,
            hide_main_window,
            get_app_version,
            get_general_settings,
            update_general_settings,
            update_setting,
            sync_language,
            // 撤销相关命令
            get_undo_history,
            undo_file_action,
            clear_undo_history,
            get_undo_history_count,
            move_file_direct,
            updater::check_update,
            updater::install_update,
            updater::scheduler::get_scheduler_config,
            updater::scheduler::update_scheduler_config,
            updater::github::get_github_releases,
            updater::github::get_latest_github_release
        ])
        .setup(|app| {
            // 设置默认语言
            set_language(Language::English);
            // 设置系统托盘
            setup_system_tray(app)?;
            
            // 设置窗口事件处理
            let window = app.get_webview_window("main").unwrap();
            let app_handle = app.handle().clone();
            
            window.on_window_event(move |event| {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        // 阻止默认的关闭行为
                        api.prevent_close();
                        
                        // 隐藏窗口到系统托盘
                        let window = app_handle.get_webview_window("main").unwrap();
                        let _ = window.hide();
                        
                        // 显示通知
                        let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                            .builder()
                            .title(&t("app_minimized_title"))
                            .body(&t("app_minimized_body"))
                            .show();
                    }
                    _ => {}
                }
            });
            
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            match event {
                RunEvent::Ready => {
                    // 应用启动完成后启动更新调度器
                    let app_handle_clone = app_handle.clone();
                    tauri::async_runtime::spawn(async move {
                        // 等待应用完全启动
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                        
                        // 加载更新调度器配置并启动后台任务
                        if let Ok(update_config) = updater::scheduler::UpdateSchedulerConfig::load() {
                            if update_config.enabled {
                                log::info!("{}", t_format("updater_started", &[&update_config.check_interval_hours.to_string()]));
                                updater::scheduler::UpdateScheduler::start_background_task(update_config, app_handle_clone);
                            }
                        }
                    });
                }
                RunEvent::Reopen { has_visible_windows, .. } => {
                    // 当点击 Dock 图标时触发（macOS 特有）
                    if !has_visible_windows {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                }
                _ => {}
            }
        });
}