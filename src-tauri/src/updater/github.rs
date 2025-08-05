use serde::{Deserialize, Serialize};
use reqwest;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRelease {
    pub tag_name: String,
    pub name: String,
    pub body: String,
    pub published_at: String,
    pub prerelease: bool,
    pub assets: Vec<GitHubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
    pub content_type: String,
}

pub struct GitHubClient {
    token: Option<String>,
    repo_owner: String,
    repo_name: String,
}

impl GitHubClient {
    pub fn new(repo_owner: String, repo_name: String, token: Option<String>) -> Self {
        Self {
            token,
            repo_owner,
            repo_name,
        }
    }

    pub async fn get_latest_release(&self) -> Result<GitHubRelease, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases/latest",
            self.repo_owner, self.repo_name
        );

        let mut request = client.get(&url);
        
        // 添加认证头（如果有token）
        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("token {}", token));
        }
        
        request = request.header("User-Agent", "FileSortify-Updater");

        let response = request.send().await?;
        
        if !response.status().is_success() {
            return Err(format!("GitHub API request failed: {}", response.status()).into());
        }

        let release: GitHubRelease = response.json().await?;
        Ok(release)
    }

    pub async fn get_releases(&self, per_page: u32) -> Result<Vec<GitHubRelease>, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.github.com/repos/{}/{}/releases?per_page={}",
            self.repo_owner, self.repo_name, per_page
        );

        let mut request = client.get(&url);
        
        if let Some(token) = &self.token {
            request = request.header("Authorization", format!("token {}", token));
        }
        
        request = request.header("User-Agent", "FileSortify-Updater");

        let response = request.send().await?;
        
        if !response.status().is_success() {
            return Err(format!("GitHub API request failed: {}", response.status()).into());
        }

        let releases: Vec<GitHubRelease> = response.json().await?;
        Ok(releases)
    }

    pub fn get_platform_asset<'a>(&self, release: &'a GitHubRelease) -> Option<&'a GitHubAsset> {
        let platform = get_current_platform();
        let arch = get_current_arch();
        
        // 根据平台和架构查找对应的asset
        release.assets.iter().find(|asset| {
            let name = asset.name.to_lowercase();
            let platform_match = match platform.as_str() {
                "windows" => name.contains("windows") || name.ends_with(".msi") || name.ends_with(".exe"),
                "macos" => name.contains("darwin") || name.contains("macos") || name.ends_with(".dmg") || name.ends_with(".app.tar.gz"),
                "linux" => name.contains("linux") || name.ends_with(".deb") || name.ends_with(".rpm") || name.ends_with(".AppImage"),
                _ => false,
            };
            platform_match && (arch == "universal" || name.contains(&arch))
        })
    }
}

fn get_current_platform() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

fn get_current_arch() -> String {
    #[cfg(target_arch = "x86_64")]
    return "x64".to_string();
    
    #[cfg(target_arch = "aarch64")]
    return "arm64".to_string();
    
    #[cfg(target_arch = "x86")]
    return "x86".to_string();
    
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64", target_arch = "x86")))]
    return "unknown".to_string();
}

#[tauri::command]
pub async fn get_github_releases(
    repo_owner: String,
    repo_name: String,
    token: Option<String>
) -> Result<Vec<GitHubRelease>, String> {
    let client = GitHubClient::new(repo_owner, repo_name, token);
    client.get_releases(10).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_latest_github_release(
    repo_owner: String,
    repo_name: String,
    token: Option<String>
) -> Result<GitHubRelease, String> {
    let client = GitHubClient::new(repo_owner, repo_name, token);
    client.get_latest_release().await.map_err(|e| e.to_string())
}