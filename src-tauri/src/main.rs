// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{State, Manager, WindowEvent, RunEvent};
use tokio::sync::Mutex;

mod file_organizer;
mod config;
mod subscription;
mod apple_subscription;
mod updater;

#[cfg(target_os = "macos")]
mod storekit_bridge;

use file_organizer::fileSortify;
use config::Config;
use subscription::{Subscription, SubscriptionPlan, PricingInfo, PackagesResponse};

// 全局状态
struct AppState {
    organizer: Mutex<Option<fileSortify>>,
    is_monitoring: Mutex<bool>,
    subscription: Mutex<Subscription>,
}

// Tauri命令：开始整理文件
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
            return Err("试用期已结束，请订阅后继续使用".to_string());
        }
    }
    
    let mut organizer_guard = state.organizer.lock().await;
    
    match fileSortify::new(&folder_path) {
        Ok(organizer) => {
            let mut organizer = organizer.with_app_handle(app_handle);
            match organizer.organize_existing_files() {
                Ok(count) => {
                    *organizer_guard = Some(organizer);
                    Ok(format!("成功整理了 {} 个文件", count))
                }
                Err(e) => Err(format!("整理文件失败: {}", e))
            }
        }
        Err(e) => Err(format!("初始化失败: {}", e))
    }
}

// Tauri命令：开始/停止监控
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
            return Err("试用期已结束，请订阅后继续使用".to_string());
        }
    }
    
    let mut is_monitoring = state.is_monitoring.lock().await;
    let mut organizer_guard = state.organizer.lock().await;
    
    if *is_monitoring {
        // 停止监控
        if let Some(organizer) = organizer_guard.as_mut() {
            organizer.stop_monitoring();
        }
        *is_monitoring = false;
        
        // 发送通知
        let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
            .builder()
            .title("文件监控已停止")
            .body("文件自动分类监控已停止")
            .show();
            
        Ok(false)
    } else {
        // 开始监控
        match fileSortify::new(&folder_path) {
            Ok(organizer) => {
                let mut organizer = organizer.with_app_handle(app_handle.clone());
                match organizer.start_monitoring() {
                    Ok(_) => {
                        *organizer_guard = Some(organizer);
                        *is_monitoring = true;
                        
                        // 发送通知
                        let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                            .builder()
                            .title("文件监控已启动")
                            .body(&format!("正在监控文件夹: {}", folder_path))
                            .show();
                            
                        Ok(true)
                    }
                    Err(e) => Err(format!("启动监控失败: {}", e))
                }
            }
            Err(e) => Err(format!("初始化失败: {}", e))
        }
    }
}

// Tauri命令：获取配置
#[tauri::command]
async fn get_config() -> Result<Config, String> {
    match Config::load() {
        Ok(config) => Ok(config),
        Err(e) => Err(format!("加载配置失败: {}", e))
    }
}

// Tauri命令：保存配置
#[tauri::command]
async fn save_config(config: Config) -> Result<String, String> {
    match config.save() {
        Ok(_) => Ok("配置保存成功".to_string()),
        Err(e) => Err(format!("保存配置失败: {}", e))
    }
}

// Tauri命令：选择文件夹
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
        Err(_) => Err("文件夹选择被取消或失败".to_string()),
    }
}

// Tauri命令：获取默认下载文件夹
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
    
    Err("无法获取默认下载文件夹".to_string())
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
        Err(e) => Err(format!("获取套餐信息失败: {}", e))
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
        _ => return Err("无效的订阅计划".to_string()),
    };
    
    match subscription.activate_subscription(subscription_plan) {
        Ok(_) => {
            // 发送通知
            let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title("购买成功")
                .body("感谢您购买 FileSortify！现在可以无限制使用所有功能。")
                .show();
                
            Ok("购买激活成功".to_string())
        }
        Err(e) => Err(format!("激活购买失败: {}", e))
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
                .title("订阅已取消")
                .body("您的订阅已成功取消")
                .show();
                
            Ok("订阅已取消".to_string())
        }
        Err(e) => Err(format!("取消订阅失败: {}", e))
    }
}

// Tauri命令：打开支付页面 (已禁用，仅保留兼容性)
#[tauri::command]
async fn open_payment_page(_plan: String, _app_handle: tauri::AppHandle) -> Result<(), String> {
    Err("此功能已禁用，请使用 Creem 支付".to_string())
}

// Tauri命令：验证Apple收据
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
                .title("订阅验证成功")
                .body("您的Apple订阅已成功验证！")
                .show();
                
            Ok("Apple订阅验证成功".to_string())
        }
        Err(e) => Err(format!("验证Apple收据失败: {}", e))
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
            
            Ok("订阅状态已刷新".to_string())
        }
        Err(e) => Err(format!("刷新订阅状态失败: {}", e))
    }
}

// Tauri命令：获取Apple产品信息 (已禁用，仅保留兼容性)
#[tauri::command]
async fn get_apple_products() -> Result<serde_json::Value, String> {
    Err("Apple Store 功能已禁用，请使用 Creem 支付".to_string())
}

// Tauri命令：启动App Store内购流程
#[tauri::command]
async fn start_apple_purchase(product_id: String, _state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let mut store_manager = StoreKitManager::new();
        store_manager.initialize().map_err(|e| format!("初始化StoreKit失败: {}", e))?;
        
        store_manager.purchase_product(&product_id).map_err(|e| format!("启动购买失败: {}", e))?;
        
        Ok("已启动App Store购买流程".to_string())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("App Store内购仅在macOS上可用".to_string())
    }
}

// Tauri命令：恢复购买
#[tauri::command]
async fn restore_apple_purchases(_state: State<'_, AppState>) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let mut store_manager = StoreKitManager::new();
        store_manager.initialize().map_err(|e| format!("初始化StoreKit失败: {}", e))?;
        
        store_manager.restore_purchases().map_err(|e| format!("恢复购买失败: {}", e))?;
        
        Ok("已启动购买恢复流程".to_string())
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("App Store内购仅在macOS上可用".to_string())
    }
}

// Tauri命令：获取本地收据数据
#[tauri::command]
async fn get_local_receipt_data() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        use crate::storekit_bridge::StoreKitManager;
        
        let store_manager = StoreKitManager::new();
        store_manager.get_receipt_data().map_err(|e| format!("获取收据失败: {}", e))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Err("App Store收据仅在macOS上可用".to_string())
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
        _ => return Err("无效的订阅计划".to_string()),
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
        Err(e) => Err(format!("创建支付会话失败: {}", e))
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
                    .title("购买成功")
                    .body("感谢您购买 FileSortify！现在可以无限制使用所有功能。")
                    .show();
            }

            // 更新状态
            {
                let mut subscription = state.subscription.lock().await;
                *subscription = subscription_clone;
            }

            Ok(payment_status)
        }
        Err(e) => Err(format!("检查支付状态失败: {}", e))
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
        return Err(format!("打开支付页面失败: {}", e));
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
        Ok(_) => Ok("Webhook 服务器 URL 已更新".to_string()),
        Err(e) => Err(format!("更新 URL 失败: {}", e))
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
        Err("找不到主窗口".to_string())
    }
}

// Tauri命令：隐藏主窗口
#[tauri::command]
async fn hide_main_window(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
        Ok(())
    } else {
        Err("找不到主窗口".to_string())
    }
}

// Tauri命令：获取应用版本
#[tauri::command]
async fn get_app_version(app_handle: tauri::AppHandle) -> Result<String, String> {
    Ok(app_handle.package_info().version.to_string())
}

// 设置系统托盘
fn setup_system_tray(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    };
    
    // 创建托盘菜单
    let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    
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

fn main() {
    // 初始化订阅状态
    let subscription = Subscription::load().unwrap_or_default();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(AppState {
            organizer: Mutex::new(None),
            is_monitoring: Mutex::new(false),
            subscription: Mutex::new(subscription),
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
            updater::check_update,
            updater::install_update,
            updater::scheduler::get_scheduler_config,
            updater::scheduler::update_scheduler_config,
            updater::github::get_github_releases,
            updater::github::get_latest_github_release
        ])
        .setup(|app| {
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
                            .title("File Sortify")
                            .body("应用已最小化到系统托盘")
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