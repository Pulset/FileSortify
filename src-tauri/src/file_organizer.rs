use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use std::time::Duration;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};

use crate::config::Config;

#[derive(Debug, Serialize, Deserialize)]
pub struct fileSortify {
    pub downloads_path: PathBuf,
    pub organized_path: PathBuf,
    pub config: Config,
}

impl fileSortify {
    pub fn new(downloads_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let downloads_path = PathBuf::from(downloads_path);
        
        // 根据操作系统选择合适的文件夹名称
        let folder_name = if cfg!(windows) {
            "Organized Files"  // Windows使用英文名避免编码问题
        } else {
            "已分类文件"
        };
        
        let organized_path = downloads_path.join(folder_name);
        let config = Config::load()?;
        
        Ok(fileSortify {
            downloads_path,
            organized_path,
            config,
        })
    }
    
    pub fn organize_existing_files(&mut self) -> Result<usize, Box<dyn std::error::Error>> {
        self.create_folders()?;
        
        let mut files_moved = 0;
        
        for entry in fs::read_dir(&self.downloads_path)? {
            let entry = entry?;
            let path = entry.path();
            
            // 跳过文件夹和隐藏文件
            if path.is_dir() || path.file_name()
                .and_then(|name| name.to_str())
                .map(|name| name.starts_with('.'))
                .unwrap_or(false) {
                continue;
            }
            
            if let Some(category) = self.get_file_category(&path) {
                if self.move_file(&path, &category)? {
                    files_moved += 1;
                }
            } else {
                log::info!("跳过未匹配文件: {:?} (保持在原地)", path.file_name());
            }
        }
        
        log::info!("整理完成，共移动 {} 个文件", files_moved);
        Ok(files_moved)
    }
    
    pub fn start_monitoring(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let (tx, rx) = channel();
        
        let mut watcher = notify::recommended_watcher(tx)?;
        watcher.watch(&self.downloads_path, RecursiveMode::NonRecursive)?;
        
        let _downloads_path = self.downloads_path.clone();
        let config = self.config.clone();
        let organized_path = self.organized_path.clone();
        
        std::thread::spawn(move || {
            loop {
                match rx.recv() {
                    Ok(event) => {
                        match event {
                            Ok(Event { kind: EventKind::Create(_), paths, .. }) |
                            Ok(Event { kind: EventKind::Modify(_), paths, .. }) => {
                                for path in paths {
                                    if path.is_file() {
                                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                                            // 跳过隐藏文件和临时文件
                                            if file_name.starts_with('.') || file_name.ends_with(".tmp") {
                                                continue;
                                            }
                                        }
                                        
                                        // 等待文件写入完成
                                        std::thread::sleep(Duration::from_secs(1));
                                        
                                        if let Some(category) = Self::get_file_category_static(&path, &config) {
                                            if let Err(e) = Self::move_file_static(&path, &category, &organized_path) {
                                                log::error!("移动文件失败: {:?}", e);
                                            } else {
                                                log::info!("新文件已分类: {:?} -> {}", path.file_name(), category);
                                            }
                                        } else {
                                            log::info!("新文件未匹配分类，保持在原地: {:?}", path.file_name());
                                        }
                                    }
                                }
                            }
                            _ => {}
                        }
                    }
                    Err(e) => {
                        log::error!("监控错误: {:?}", e);
                        break;
                    }
                }
            }
        });
        
        // 注意：在新版本中我们不能存储watcher，因为它不能Clone
        // self.watcher = Some(watcher);
        Ok(())
    }
    
    pub fn stop_monitoring(&mut self) {
        // 在新的实现中，我们无法直接停止监控
        // 这需要更复杂的实现，暂时留空
        log::info!("停止监控请求");
    }
    
    fn create_folders(&self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.organized_path.exists() {
            fs::create_dir_all(&self.organized_path)?;
        }
        
        for category in self.config.categories.keys() {
            if category != "其他" {
                let category_path = self.organized_path.join(category);
                if !category_path.exists() {
                    fs::create_dir_all(&category_path)?;
                    log::info!("创建文件夹: {}", category);
                }
            }
        }
        
        Ok(())
    }
    
    fn get_file_category(&self, file_path: &Path) -> Option<String> {
        Self::get_file_category_static(file_path, &self.config)
    }
    
    fn get_file_category_static(file_path: &Path, config: &Config) -> Option<String> {
        let extension = file_path.extension()
            .and_then(|ext| ext.to_str())
            .map(|ext| format!(".{}", ext.to_lowercase()))?;
        
        for (category, extensions) in &config.categories {
            if category != "其他" && extensions.contains(&extension) {
                return Some(category.clone());
            }
        }
        
        None
    }
    
    fn move_file(&self, source_path: &Path, category: &str) -> Result<bool, Box<dyn std::error::Error>> {
        Self::move_file_static(source_path, category, &self.organized_path)
    }
    
    fn move_file_static(source_path: &Path, category: &str, organized_path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
        let filename = source_path.file_name()
            .ok_or("无法获取文件名")?;
        
        let destination_folder = organized_path.join(category);
        let mut destination_path = destination_folder.join(filename);
        
        // 如果目标文件已存在，添加数字后缀
        let mut counter = 1;
        let original_destination = destination_path.clone();
        
        while destination_path.exists() {
            if let Some(stem) = original_destination.file_stem().and_then(|s| s.to_str()) {
                if let Some(ext) = original_destination.extension().and_then(|e| e.to_str()) {
                    destination_path = destination_folder.join(format!("{}_{}.{}", stem, counter, ext));
                } else {
                    destination_path = destination_folder.join(format!("{}_{}", stem, counter));
                }
            }
            counter += 1;
        }
        
        fs::rename(source_path, &destination_path)?;
        log::info!("移动文件: {:?} -> {}", filename, category);
        
        Ok(true)
    }
}