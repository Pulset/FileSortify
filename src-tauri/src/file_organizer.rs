use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use std::thread::JoinHandle;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use chrono;

use crate::config::Config;
use crate::i18n::{t, t_format};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogMessage {
    pub message: String,
    pub log_type: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileOrganizedEvent {
    pub file_name: String,
    pub category: String,
    pub timestamp: String,
}

#[derive(Debug)]
pub struct fileSortify {
    pub downloads_path: PathBuf,
    pub organized_path: PathBuf,
    pub config: Config,
    pub monitoring_stop_signal: Option<Arc<AtomicBool>>,
    pub monitoring_thread: Option<JoinHandle<()>>,
    pub app_handle: Option<AppHandle>,
}

impl Clone for fileSortify {
    fn clone(&self) -> Self {
        Self {
            downloads_path: self.downloads_path.clone(),
            organized_path: self.organized_path.clone(),
            config: self.config.clone(),
            monitoring_stop_signal: None, // 新实例不继承监控状态
            monitoring_thread: None, // 新实例不继承线程句柄
            app_handle: self.app_handle.clone(),
        }
    }
}

impl fileSortify {
    pub fn new(downloads_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let downloads_path = PathBuf::from(downloads_path);
        
        // 根据操作系统选择合适的文件夹名称
        let folder_name = if cfg!(windows) {
            "Organized Files"  // Windows使用英文名避免编码问题
        } else {
            "Organized Files"
        };
        
        let organized_path = downloads_path.join(folder_name);
        let config = Config::load()?;
        
        Ok(fileSortify {
            downloads_path,
            organized_path,
            config,
            monitoring_stop_signal: None,
            monitoring_thread: None,
            app_handle: None,
        })
    }

    pub fn with_app_handle(mut self, app_handle: AppHandle) -> Self {
        self.app_handle = Some(app_handle);
        self
    }

    fn emit_log(&self, message: &str, log_type: &str) {
        if let Some(app_handle) = &self.app_handle {
            let log_message = LogMessage {
                message: message.to_string(),
                log_type: log_type.to_string(),
                timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
            };
            
            if let Err(e) = app_handle.emit("log-message", &log_message) {
                eprintln!("Failed to emit log message: {}", e);
            }
        }
        
        // 同时保留原有的日志输出
        match log_type {
            "error" => log::error!("{}", message),
            "warning" => log::warn!("{}", message),
            "success" => log::info!("{}", message),
            _ => log::info!("{}", message),
        }
    }

    fn emit_file_organized(&self, file_name: &str, category: &str) {
        if let Some(app_handle) = &self.app_handle {
            let event = FileOrganizedEvent {
                file_name: file_name.to_string(),
                category: category.to_string(),
                timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
            };
            
            if let Err(e) = app_handle.emit("file-organized", &event) {
                eprintln!("Failed to emit file organized event: {}", e);
            }
        }
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
                if let Some(file_name) = path.file_name() {
                    self.emit_log(&t_format("skip_unmatched_file", &[&format!("{:?}", file_name)]), "info");
                }
            }
        }
        
        self.emit_log(&t_format("organize_complete_moved_count", &[&files_moved.to_string()]), "success");
        Ok(files_moved)
    }
    
    pub fn start_monitoring(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // 如果已经在监控，先停止
        if self.monitoring_stop_signal.is_some() {
            self.stop_monitoring();
        }

        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(tx)?;
        watcher.watch(&self.downloads_path, RecursiveMode::NonRecursive)?;
        
        let stop_signal = Arc::new(AtomicBool::new(false));
        self.monitoring_stop_signal = Some(stop_signal.clone());
        
        let config = self.config.clone();
        let organized_path = self.organized_path.clone();
        let app_handle = self.app_handle.clone();
        
        // 用于去重的文件处理记录
        let mut last_processed: std::collections::HashMap<PathBuf, std::time::Instant> = std::collections::HashMap::new();
        
        let handle = std::thread::spawn(move || {
            // watcher必须在这个线程中保持活跃
            let _watcher = watcher;
            
            // 创建一个辅助函数来发送日志
            let emit_log = |message: &str, log_type: &str| {
                if let Some(app_handle) = &app_handle {
                    let log_message = LogMessage {
                        message: message.to_string(),
                        log_type: log_type.to_string(),
                        timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                    };
                    
                    if let Err(e) = app_handle.emit("log-message", &log_message) {
                        eprintln!("Failed to emit log message: {}", e);
                    }
                }
                
                // 同时保留原有的日志输出
                match log_type {
                    "error" => log::error!("{}", message),
                    "warning" => log::warn!("{}", message),
                    "success" => log::info!("{}", message),
                    _ => log::info!("{}", message),
                }
            };
            
            loop {
                // 检查停止信号
                if stop_signal.load(Ordering::Relaxed) {
                    emit_log(&t("monitor_stop_signal_received"), "info");
                    break;
                }

                match rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(event) => {
                        match event {
                            Ok(Event { kind, paths, .. }) => {
                                match kind {
                                    EventKind::Create(_) => {
                                        emit_log(&t_format("file_create_event_detected", &[&paths.len().to_string()]), "info");
                                        for path in paths {
                                    if path.is_file() {
                                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                                            // 跳过隐藏文件和临时文件
                                            if file_name.starts_with('.') || file_name.ends_with(".tmp") {
                                                continue;
                                            }
                                        }
                                        
                                        // 检查是否在短时间内已经处理过这个文件（去重）
                                        let now = std::time::Instant::now();
                                        if let Some(last_time) = last_processed.get(&path) {
                                            let duration = now.duration_since(*last_time);
                                            emit_log(&t_format("file_recently_processed_skip", &[&format!("{:?}", path.file_name()), &format!("{:?}", duration)]), "info");
                                            if duration < Duration::from_secs(5) {
                                                continue; // 跳过重复处理
                                            }
                                        }
                                        emit_log(&t_format("start_processing_file", &[&format!("{:?}", path.file_name())]), "info");
                                        last_processed.insert(path.clone(), now);
                                        
                                        // 等待文件写入完成
                                        std::thread::sleep(Duration::from_secs(1));
                                        
                                        if let Some(category) = Self::get_file_category_static(&path, &config) {
                                            match Self::move_file_static(&path, &category, &organized_path) {
                                                Ok(_) => {
                                                    if let Some(file_name) = path.file_name() {
                                                        if let Some(file_name_str) = file_name.to_str() {
                                                            emit_log(&t_format("new_file_categorized", &[file_name_str, &category]), "success");
                                                            
                                                            // 发送文件整理事件
                                                            if let Some(app_handle) = &app_handle {
                                                                let event = FileOrganizedEvent {
                                                                    file_name: file_name_str.to_string(),
                                                                    category: category.clone(),
                                                                    timestamp: chrono::Local::now().format("%H:%M:%S").to_string(),
                                                                };
                                                                
                                                                if let Err(e) = app_handle.emit("file-organized", &event) {
                                                                    eprintln!("Failed to emit file organized event: {}", e);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                Err(e) => {
                                                    emit_log(&t_format("move_file_failed", &[&format!("{:?}", e)]), "error");
                                                }
                                            }
                                        } else {
                                            if let Some(file_name) = path.file_name() {
                                                emit_log(&t_format("new_file_unmatched", &[&format!("{:?}", file_name)]), "info");
                                            }
                                        }
                                    }
                                }
                                    }
                                    _ => {
                                        // emit_log(&format!("忽略其他类型事件: {:?}", kind), "info");
                                    }
                                }
                            }
                            Err(e) => {
                                emit_log(&t_format("event_process_error", &[&format!("{:?}", e)]), "error");
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        // 超时是正常的，继续循环
                        continue;
                    }
                    Err(e) => {
                        emit_log(&t_format("monitor_error", &[&format!("{:?}", e)]), "error");
                        break;
                    }
                }
            }
        });
        
        self.monitoring_thread = Some(handle);
        self.emit_log(&t("monitor_started"), "success");
        Ok(())
    }
    
    pub fn stop_monitoring(&mut self) {
        if let Some(stop_signal) = &self.monitoring_stop_signal {
            stop_signal.store(true, Ordering::Relaxed);
            self.emit_log(&t("monitor_stop_signal_sent"), "info");
        }
        
        // 等待线程结束
        if let Some(handle) = self.monitoring_thread.take() {
            // 给线程一些时间来响应停止信号
            std::thread::sleep(Duration::from_millis(200));
            if let Err(e) = handle.join() {
                self.emit_log(&t_format("join_monitor_thread_error", &[&format!("{:?}", e)]), "error");
            }
        }
        
        // 清理资源
        self.monitoring_stop_signal = None;
        
        self.emit_log(&t("monitor_stopped"), "success");
    }
    
    fn create_folders(&self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.organized_path.exists() {
            fs::create_dir_all(&self.organized_path)?;
        }
        
        for category in self.config.categories.keys() {
            if *category != t("category_others") {
                let category_path = self.organized_path.join(category);
                if !category_path.exists() {
                    fs::create_dir_all(&category_path)?;
                    self.emit_log(&t_format("create_folder", &[category]), "info");
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
            if category != &t("category_others") && extensions.contains(&extension) {
                return Some(category.clone());
            }
        }
        
        None
    }
    
    fn move_file(&self, source_path: &Path, category: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let result = Self::move_file_static(source_path, category, &self.organized_path);
        
        if result.is_ok() {
            if let Some(filename) = source_path.file_name() {
                if let Some(filename_str) = filename.to_str() {
                    self.emit_log(&t_format("move_file_success", &[filename_str, category]), "success");
                    self.emit_file_organized(filename_str, category);
                }
            }
        }
        
        result
    }
    
    fn move_file_static(source_path: &Path, category: &str, organized_path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
        let filename = source_path.file_name()
            .ok_or("Failed to get file name")?;
        
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
        // 注意：这里不发送日志，因为静态方法无法访问 app_handle
        // 日志会在调用方法中发送
        log::info!("Moved file: {:?} -> {}", filename, category);
        
        Ok(true)
    }
}