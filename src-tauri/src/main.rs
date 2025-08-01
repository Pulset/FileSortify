// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{State, Manager, WindowEvent, RunEvent};
use std::sync::Mutex;

mod file_organizer;
mod config;
mod subscription;
mod apple_subscription;

#[cfg(target_os = "macos")]
mod storekit_bridge;

use file_organizer::fileSortify;
use config::Config;
use subscription::{Subscription, SubscriptionPlan, PricingInfo};

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
        let subscription = state.subscription.lock().unwrap();
        if !subscription.can_use_app() {
            return Err("试用期已结束，请订阅后继续使用".to_string());
        }
    }
    
    let mut organizer_guard = state.organizer.lock().unwrap();
    
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
        let subscription = state.subscription.lock().unwrap();
        if !subscription.can_use_app() {
            return Err("试用期已结束，请订阅后继续使用".to_string());
        }
    }
    
    let mut is_monitoring = state.is_monitoring.lock().unwrap();
    let mut organizer_guard = state.organizer.lock().unwrap();
    
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
    let subscription = state.subscription.lock().unwrap();
    Ok(subscription.clone())
}

// Tauri命令：检查是否可以使用应用
#[tauri::command]
async fn can_use_app(
    state: State<'_, AppState>,
) -> Result<bool, String> {
    let subscription = state.subscription.lock().unwrap();
    Ok(subscription.can_use_app())
}

// Tauri命令：获取定价信息
#[tauri::command]
async fn get_pricing_info() -> Result<PricingInfo, String> {
    Ok(Subscription::get_pricing_info())
}

// Tauri命令：激活订阅（模拟支付成功后调用）
#[tauri::command]
async fn activate_subscription(
    plan: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut subscription = state.subscription.lock().unwrap();
    
    let subscription_plan = match plan.as_str() {
        "monthly" => SubscriptionPlan::Monthly,
        "yearly" => SubscriptionPlan::Yearly,
        _ => return Err("无效的订阅计划".to_string()),
    };
    
    match subscription.activate_subscription(subscription_plan) {
        Ok(_) => {
            // 发送通知
            let _ = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title("订阅激活成功")
                .body(&format!("感谢您订阅{}计划！", 
                    if plan == "monthly" { "月度" } else { "年度" }))
                .show();
                
            Ok("订阅激活成功".to_string())
        }
        Err(e) => Err(format!("激活订阅失败: {}", e))
    }
}

// Tauri命令：取消订阅
#[tauri::command]
async fn cancel_subscription(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let mut subscription = state.subscription.lock().unwrap();
    
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

// Tauri命令：打开支付页面
#[tauri::command]
async fn open_payment_page(plan: String, app_handle: tauri::AppHandle) -> Result<(), String> {
    let url = match plan.as_str() {
        "monthly" => "https://your-payment-provider.com/monthly",
        "yearly" => "https://your-payment-provider.com/yearly",
        _ => return Err("无效的订阅计划".to_string()),
    };
    
    use tauri_plugin_opener::OpenerExt;
    
    if let Err(e) = app_handle.opener().open_url(url, None::<String>) {
        return Err(format!("打开支付页面失败: {}", e));
    }
    
    Ok(())
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
        let subscription = state.subscription.lock().unwrap();
        subscription.clone()
    };
    
    match subscription_clone.verify_apple_receipt(receipt_data).await {
        Ok(_) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().unwrap();
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
        let subscription = state.subscription.lock().unwrap();
        subscription.clone()
    };
    
    match subscription_clone.refresh_apple_subscription().await {
        Ok(_) => {
            // 更新状态
            {
                let mut subscription = state.subscription.lock().unwrap();
                *subscription = subscription_clone;
            }
            
            Ok("订阅状态已刷新".to_string())
        }
        Err(e) => Err(format!("刷新订阅状态失败: {}", e))
    }
}

// Tauri命令：获取Apple产品信息
#[tauri::command]
async fn get_apple_products() -> Result<serde_json::Value, String> {
    let config = apple_subscription::AppleSubscriptionConfig::default();
    
    let products = serde_json::json!({
        "monthly": {
            "product_id": config.monthly_product_id,
            "price": "$1.99",
            "period": "month"
        },
        "yearly": {
            "product_id": config.yearly_product_id,
            "price": "$19.99",
            "period": "year"
        }
    });
    
    Ok(products)
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
            get_pricing_info,
            activate_subscription,
            cancel_subscription,
            open_payment_page,
            verify_apple_receipt,
            refresh_apple_subscription,
            get_apple_products,
            start_apple_purchase,
            restore_apple_purchases,
            get_local_receipt_data,
            show_main_window,
            hide_main_window
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