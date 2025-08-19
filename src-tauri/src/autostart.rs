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
            .map_err(|e| format!("Failed to get app path: {}", e))?;
        
        // Resolve app bundle path (.../Contents/MacOS/FileSortify -> .../FileSortify.app)
        let app_bundle = app_path
            .parent() // MacOS
            .and_then(|p| p.parent()) // Contents
            .and_then(|p| p.parent()) // FileSortify.app
            .ok_or("Failed to resolve app bundle path")?;
        
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
        
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        let launch_agents_dir = home_dir.join("Library/LaunchAgents");
        std::fs::create_dir_all(&launch_agents_dir)
            .map_err(|e| format!("Failed to create LaunchAgents directory: {}", e))?;
        
        let plist_path = launch_agents_dir.join("com.filesortify.app.plist");
        std::fs::write(&plist_path, plist_content)
            .map_err(|e| format!("Failed to write plist file: {}", e))?;
        
        // load plist
        let output = Command::new("launchctl")
            .args(&["load", plist_path.to_str().unwrap()])
            .output()
            .map_err(|e| format!("Failed to execute launchctl load: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("launchctl load failed: {}", String::from_utf8_lossy(&output.stderr)));
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    fn disable_macos() -> Result<(), String> {
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        let plist_path = home_dir.join("Library/LaunchAgents/com.filesortify.app.plist");
        
        if plist_path.exists() {
            // unload plist
            let output = Command::new("launchctl")
                .args(&["unload", plist_path.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Failed to execute launchctl unload: {}", e))?;
            
            // remove plist file
            std::fs::remove_file(&plist_path)
                .map_err(|e| format!("Failed to remove plist file: {}", e))?;
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "macos")]
    fn is_enabled_macos() -> Result<bool, String> {
        let home_dir = dirs::home_dir().ok_or("Failed to get home directory")?;
        let plist_path = home_dir.join("Library/LaunchAgents/com.filesortify.app.plist");
        Ok(plist_path.exists())
    }
    
    #[cfg(target_os = "windows")]
    fn enable_windows() -> Result<(), String> {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get app path: {}", e))?;
        
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
            .map_err(|e| format!("Failed to execute reg add: {}", e))?;
        
        if !output.status.success() {
            return Err(format!("Registry add failed: {}", String::from_utf8_lossy(&output.stderr)));
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
            .map_err(|e| format!("Failed to execute reg delete: {}", e))?;
        
        // ignore missing key error
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
            .map_err(|e| format!("Failed to execute reg query: {}", e))?;
        
        Ok(output.status.success())
    }
    
    #[cfg(target_os = "linux")]
    fn enable_linux() -> Result<(), String> {
        let app_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get app path: {}", e))?;
        
        let desktop_content = format!(r#"[Desktop Entry]
Type=Application
Name=FileSortify
Exec={}
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
"#, app_path.display());
        
        let config_dir = dirs::config_dir().ok_or("Failed to get config directory")?;
        let autostart_dir = config_dir.join("autostart");
        std::fs::create_dir_all(&autostart_dir)
            .map_err(|e| format!("Failed to create autostart directory: {}", e))?;
        
        let desktop_path = autostart_dir.join("filesortify.desktop");
        std::fs::write(&desktop_path, desktop_content)
            .map_err(|e| format!("Failed to write desktop file: {}", e))?;
        
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    fn disable_linux() -> Result<(), String> {
        let config_dir = dirs::config_dir().ok_or("Failed to get config directory")?;
        let desktop_path = config_dir.join("autostart/filesortify.desktop");
        
        if desktop_path.exists() {
            std::fs::remove_file(&desktop_path)
                .map_err(|e| format!("Failed to remove desktop file: {}", e))?;
        }
        
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    fn is_enabled_linux() -> Result<bool, String> {
        let config_dir = dirs::config_dir().ok_or("Failed to get config directory")?;
        let desktop_path = config_dir.join("autostart/filesortify.desktop");
        Ok(desktop_path.exists())
    }
}