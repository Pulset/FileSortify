use std::process::Command;
use std::path::PathBuf;

pub struct AutoStart;

impl AutoStart {
    pub fn enable() -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            Self::enable_macos()
        }
        
        #[cfg(target_os = "windows")]
        {
            Self::enable_windows()
        }
        
        #[cfg(target_os = "linux")]
        {
            Self::enable_linux()
        }
    }
    
    pub fn disable() -> Result<(), String> {
        #[cfg(target_os = "macos")]
        {
            Self::disable_macos()
        }
        
        #[cfg(target_os = "windows")]
        {
            Self::disable_windows()
        }
        
        #[cfg(target_os = "linux")]
        {
            Self::disable_linux()
        }
    }
    
    pub fn is_enabled() -> Result<bool, String> {
        #[cfg(target_os = "macos")]
        {
            Self::is_enabled_macos()
        }
        
        #[cfg(target_os = "windows")]
        {
            Self::is_enabled_windows()
        }
        
        #[cfg(target_os = "linux")]
        {
            Self::is_enabled_linux()
        }
    }
    
    #[cfg(target_os = "macos")]
    fn enable_macos() -> Result<(), String> {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("获取应用路径失败: {}", e))?;
        
        // 获取应用包路径 (从 .../Contents/MacOS/FileSortify 到 .../FileSortify.app)
        let app_bundle = app_path
            .parent() // MacOS
            .and_then(|p| p.parent()) // Contents
            .and_then(|p| p.parent()) // FileSortify.app
            .ok_or("无法确定应用包路径")?;
        
        let plist_content = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.filesortify.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>open</string>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
</dict>
</plist>"#, app_bundle.display());
        
        let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
        let launch_agents_dir = home_dir.join("Library/LaunchAgents");
        std::fs::create_dir_all(&launch_agents_dir)
            .map_err(|e| format!("创建LaunchAgents目录失败: {}", e))?;
        
        let plist_path = launch_agents_dir.join("com.filesortify.app.plist");
        std::fs::write(&plist_path, plist_content)
            .map_err(|e| format!("写入plist文件失败: {}", e))?;
        
        // 加载plist
        let output = Command::new("launchctl")
            .args(&["load", plist_path.to_str().unwrap()])
            .output()
            .map_err(|e| format!("执行launchctl load失败: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("launchctl load失败: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    fn disable_macos() -> Result<(), String> {
        let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
        let plist_path = home_dir.join("Library/LaunchAgents/com.filesortify.app.plist");
        
        if plist_path.exists() {
            // 卸载plist
            let output = Command::new("launchctl")
                .args(&["unload", plist_path.to_str().unwrap()])
                .output()
                .map_err(|e| format!("执行launchctl unload失败: {}", e))?;
            
            // 删除plist文件
            std::fs::remove_file(&plist_path)
                .map_err(|e| format!("删除plist文件失败: {}", e))?;
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    fn is_enabled_macos() -> Result<bool, String> {
        let home_dir = dirs::home_dir().ok_or("无法获取用户目录")?;
        let plist_path = home_dir.join("Library/LaunchAgents/com.filesortify.app.plist");
        Ok(plist_path.exists())
    }
    
    #[cfg(target_os = "windows")]
    fn enable_windows() -> Result<(), String> {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("获取应用路径失败: {}", e))?;
        
        let output = Command::new("reg")
            .args(&[
                "add",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "FileSortify",
                "/t",
                "REG_SZ",
                "/d",
                &format!("\"{}\"", app_path.display()),
                "/f"
            ])
            .output()
            .map_err(|e| format!("执行reg add失败: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("注册表添加失败: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "windows")]
    fn disable_windows() -> Result<(), String> {
        let output = Command::new("reg")
            .args(&[
                "delete",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "FileSortify",
                "/f"
            ])
            .output()
            .map_err(|e| format!("执行reg delete失败: {}", e))?;
        
        // 忽略删除不存在项的错误
        Ok(())
    }
    
    #[cfg(target_os = "windows")]
    fn is_enabled_windows() -> Result<bool, String> {
        let output = Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "FileSortify"
            ])
            .output()
            .map_err(|e| format!("执行reg query失败: {}", e))?;
        
        Ok(output.status.success())
    }
    
    #[cfg(target_os = "linux")]
    fn enable_linux() -> Result<(), String> {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("获取应用路径失败: {}", e))?;
        
        let desktop_content = format!(r#"[Desktop Entry]
Type=Application
Name=FileSortify
Exec={}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
"#, app_path.display());
        
        let config_dir = dirs::config_dir().ok_or("无法获取配置目录")?;
        let autostart_dir = config_dir.join("autostart");
        std::fs::create_dir_all(&autostart_dir)
            .map_err(|e| format!("创建autostart目录失败: {}", e))?;
        
        let desktop_path = autostart_dir.join("filesortify.desktop");
        std::fs::write(&desktop_path, desktop_content)
            .map_err(|e| format!("写入desktop文件失败: {}", e))?;
        
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    fn disable_linux() -> Result<(), String> {
        let config_dir = dirs::config_dir().ok_or("无法获取配置目录")?;
        let desktop_path = config_dir.join("autostart/filesortify.desktop");
        
        if desktop_path.exists() {
            std::fs::remove_file(&desktop_path)
                .map_err(|e| format!("删除desktop文件失败: {}", e))?;
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    fn is_enabled_linux() -> Result<bool, String> {
        let config_dir = dirs::config_dir().ok_or("无法获取配置目录")?;
        let desktop_path = config_dir.join("autostart/filesortify.desktop");
        Ok(desktop_path.exists())
    }
}