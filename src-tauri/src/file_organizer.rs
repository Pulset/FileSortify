use notify::{Watcher, RecursiveMode, Event, EventKind};
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use std::path::{Path, PathBuf};
use std::fs;
use serde::{Deserialize, Serialize};
use std::thread::JoinHandle;
use std::collections::{HashMap, VecDeque};
use tauri::{AppHandle, Emitter};
use chrono;
use rand;

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
    pub actual_file_name: String, // 实际移动后的文件名（可能被重命名）
    pub category: String,
    pub timestamp: String,
    pub folder_path: String,
    pub original_path: String, // 原始完整路径
    pub moved_to_path: String, // 实际移动到的完整路径
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UndoAction {
    pub id: String,
    pub file_name: String,
    pub original_path: PathBuf,
    pub moved_to_path: PathBuf,
    pub category: String,
    pub timestamp: String,
    pub downloads_path: PathBuf,
    pub source: String, // "manual" or "monitoring"
}

#[derive(Debug, Clone)]
pub struct UndoHistory {
    actions: VecDeque<UndoAction>,
    max_size: usize,
}

impl UndoHistory {
    pub fn new(max_size: usize) -> Self {
        Self {
            actions: VecDeque::new(),
            max_size,
        }
    }

    pub fn add_action(&mut self, action: UndoAction) {
        if self.actions.len() >= self.max_size {
            self.actions.pop_front();
        }
        self.actions.push_back(action);
    }

    pub fn get_latest_actions(&self, count: usize) -> Vec<UndoAction> {
        self.actions
            .iter()
            .rev()
            .take(count)
            .cloned()
            .collect()
    }

    pub fn remove_action(&mut self, action_id: &str) -> Option<UndoAction> {
        if let Some(pos) = self.actions.iter().position(|a| a.id == action_id) {
            self.actions.remove(pos)
        } else {
            None
        }
    }

    pub fn clear(&mut self) {
        self.actions.clear();
    }

    pub fn is_empty(&self) -> bool {
        self.actions.is_empty()
    }

    pub fn len(&self) -> usize {
        self.actions.len()
    }
}

#[derive(Debug)]
pub struct fileSortify {
    pub downloads_path: PathBuf,
    pub config: Config,
    pub monitoring_stop_signal: Option<Arc<AtomicBool>>,
    pub monitoring_thread: Option<JoinHandle<()>>,
    pub app_handle: Option<AppHandle>,
    pub undo_history: UndoHistory,
}

impl Clone for fileSortify {
    fn clone(&self) -> Self {
        Self {
            downloads_path: self.downloads_path.clone(),
            config: self.config.clone(),
            monitoring_stop_signal: None, // 新实例不继承监控状态
            monitoring_thread: None, // 新实例不继承线程句柄
            app_handle: self.app_handle.clone(),
            undo_history: self.undo_history.clone(),
        }
    }
}

impl fileSortify {
    pub fn new(downloads_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let downloads_path = PathBuf::from(downloads_path);
        let config = Config::load()?;
        let undo_history = UndoHistory::new(50); // 最多保存50个撤销操作
        Ok(fileSortify {
            downloads_path,
            config,
            monitoring_stop_signal: None,
            monitoring_thread: None,
            app_handle: None,
            undo_history,
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
                timestamp: chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
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

    fn emit_file_organized(&self, original_file_name: &str, actual_file_name: &str, category: &str, original_path: &Path, moved_to_path: &Path) {
        if let Some(app_handle) = &self.app_handle {
            let event = FileOrganizedEvent {
                file_name: original_file_name.to_string(),
                actual_file_name: actual_file_name.to_string(),
                category: category.to_string(),
                timestamp: chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
                folder_path: self.downloads_path.to_string_lossy().to_string(),
                original_path: original_path.to_string_lossy().to_string(),
                moved_to_path: moved_to_path.to_string_lossy().to_string(),
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
                if self.move_file(&path, &category, true)? { // 手动整理时记录撤销历史
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
    let app_handle = self.app_handle.clone();
    let downloads_path = self.downloads_path.clone();

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
                        timestamp: chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
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
                                    // 处理文件创建事件
                                    EventKind::Create(_) => {
                                        emit_log(&t_format("file_create_event_detected", &[&paths.len().to_string()]), "info");
                                        for path in paths {
                                            Self::process_file_event(&path, &config, &downloads_path, &mut last_processed, &app_handle, &emit_log, false);
                                        }
                                    }
                                    // 处理文件修改事件（用于处理下载完成的文件）
                                    EventKind::Modify(_) => {
                                        emit_log(&t_format("file_modify_event_detected", &[&paths.len().to_string()]), "info");
                                        for path in paths {
                                            Self::process_file_event(&path, &config, &downloads_path, &mut last_processed, &app_handle, &emit_log, true);
                                        }
                                    }
                                    // 处理文件重命名/移动事件（用于处理临时文件重命名为最终文件）
                                    EventKind::Other => {
                                        emit_log(&t_format("file_other_event_detected", &[&paths.len().to_string()]), "info");
                                        for path in paths {
                                            Self::process_file_event(&path, &config, &downloads_path, &mut last_processed, &app_handle, &emit_log, true);
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
        // 创建所有分类文件夹（不再区分“其他”）
        for category in self.config.categories.keys() {
            let category_path = self.downloads_path.join(category);
            if !category_path.exists() {
                fs::create_dir_all(&category_path)?;
                self.emit_log(&t_format("create_folder", &[category]), "info");
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
            .map(|ext| format!(".{}", ext.to_lowercase()));
        if let Some(ext) = extension {
            for (category, extensions) in &config.categories {
                if extensions.contains(&ext) {
                    return Some(category.clone());
                }
            }
        }
        // 没有匹配到规则时返回 None
        None
    }
    
    fn move_file(&mut self, source_path: &Path, category: &str, record_undo: bool) -> Result<bool, Box<dyn std::error::Error>> {
        let filename = source_path.file_name()
            .ok_or("Failed to get file name")?;
        let destination_folder = self.downloads_path.join(category);
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
        
        // 执行文件移动
        fs::rename(source_path, &destination_path)?;
        
        // 只在手动整理时记录撤销历史
        if record_undo {
            let undo_action = UndoAction {
                id: format!("{}-{}", chrono::Local::now().timestamp_millis(), rand::random::<u32>()),
                file_name: filename.to_string_lossy().to_string(),
                original_path: source_path.to_path_buf(),
                moved_to_path: destination_path.clone(),
                category: category.to_string(),
                timestamp: chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
                downloads_path: self.downloads_path.clone(),
                source: "manual".to_string(),
            };
            
            self.undo_history.add_action(undo_action);
        }
        
        // 发送日志和事件
        if let Some(filename) = source_path.file_name() {
            if let Some(filename_str) = filename.to_str() {
                // 获取实际移动后的文件名
                let actual_filename = destination_path.file_name()
                    .and_then(|name| name.to_str())
                    .unwrap_or(filename_str);
                
                self.emit_log(&t_format("move_file_success", &[actual_filename, category]), "success");
                self.emit_file_organized(filename_str, actual_filename, category, source_path, &destination_path);
            }
        }
        
        Ok(true)
    }
    
    fn move_file_static(source_path: &Path, category: &str, downloads_path: &Path) -> Result<PathBuf, Box<dyn std::error::Error>> {
        let filename = source_path.file_name()
            .ok_or("Failed to get file name")?;
        let destination_folder = downloads_path.join(category);
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
        // 返回实际的目标路径
        log::info!("Moved file: {:?} -> {:?}", filename, destination_path.file_name());
        Ok(destination_path)
    }
    
    // 统一的文件事件处理方法
    fn process_file_event(
        path: &Path,
        config: &Config,
        downloads_path: &Path,
        last_processed: &mut std::collections::HashMap<PathBuf, std::time::Instant>,
        app_handle: &Option<AppHandle>,
        emit_log: &dyn Fn(&str, &str),
        is_modify_event: bool,
    ) {
        // 只处理文件，跳过目录
        if !path.is_file() {
            return;
        }

        let file_name = match path.file_name().and_then(|n| n.to_str()) {
            Some(name) => name,
            None => return,
        };

        // 优化的文件过滤逻辑
        if Self::should_skip_file(file_name, is_modify_event) {
            return;
        }

        // 检查去重机制
        let now = std::time::Instant::now();
        if let Some(last_time) = last_processed.get(path) {
            let duration = now.duration_since(*last_time);
            // 根据事件类型调整去重时间
            let skip_duration = if is_modify_event {
                Duration::from_secs(2) // 修改事件允许更频繁的处理
            } else {
                Duration::from_secs(5) // 创建事件保持原来的去重时间
            };
            
            if duration < skip_duration {
                emit_log(&t_format("file_recently_processed_skip", &[&format!("{:?}", path.file_name()), &format!("{:?}", duration)]), "info");
                return;
            }
        }

        emit_log(&t_format("start_processing_file", &[&format!("{:?}", path.file_name())]), "info");
        last_processed.insert(path.to_path_buf(), now);

        // 等待文件写入完成，修改事件可以缩短等待时间
        let wait_time = if is_modify_event {
            Duration::from_millis(500)
        } else {
            Duration::from_secs(1)
        };
        std::thread::sleep(wait_time);

        // 尝试分类和移动文件
        if let Some(category) = Self::get_file_category_static(path, config) {
            match Self::move_file_static(path, &category, downloads_path) {
                Ok(actual_path) => {
                    // 获取实际的文件名
                    let actual_filename = actual_path.file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or(file_name);
                    
                    emit_log(&t_format("new_file_categorized", &[actual_filename, &category]), "success");

                    // 发送文件整理事件
                    if let Some(app_handle) = app_handle {
                        let event = FileOrganizedEvent {
                            file_name: file_name.to_string(),
                            actual_file_name: actual_filename.to_string(),
                            category: category.clone(),
                            timestamp: chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string(),
                            folder_path: downloads_path.to_string_lossy().to_string(),
                            original_path: path.to_string_lossy().to_string(),
                            moved_to_path: actual_path.to_string_lossy().to_string(),
                        };
                        if let Err(e) = app_handle.emit("file-organized", &event) {
                            eprintln!("Failed to emit file organized event: {}", e);
                        }
                    }
                }
                Err(e) => {
                    emit_log(&t_format("move_file_failed", &[&format!("{:?}", e)]), "error");
                }
            }
        } else {
            emit_log(&t_format("new_file_unmatched", &[&format!("{:?}", file_name)]), "info");
        }
    }

    // 优化的文件过滤逻辑
    fn should_skip_file(file_name: &str, is_modify_event: bool) -> bool {
        // 始终跳过的文件类型
        if file_name.starts_with("._") || // macOS 资源分叉文件
           file_name == ".DS_Store" || // macOS 系统文件
           file_name.starts_with("~$") || // Office 临时文件
           file_name.ends_with(".tmp") && file_name.len() < 10 || // 短的tmp文件通常是真正的临时文件
           file_name.ends_with(".part") && !is_modify_event // Firefox下载文件，但修改事件时可能已完成
        {
            return true;
        }

        // 对于创建事件，跳过一些临时格式
        if !is_modify_event {
            if file_name.starts_with('.') && !Self::is_likely_final_file(file_name) {
                return true;
            }
        }

        false
    }

    // 判断以点开头的文件是否可能是最终文件
    fn is_likely_final_file(file_name: &str) -> bool {
        // 一些以点开头但是正常文件的情况
        let normal_dot_files = [
            ".env", ".gitignore", ".gitattributes", ".editorconfig",
            ".eslintrc", ".prettierrc", ".babelrc", ".npmrc"
        ];
        
        for normal_file in &normal_dot_files {
            if file_name.starts_with(normal_file) {
                return true;
            }
        }

        // 如果文件有明确的扩展名，很可能是最终文件
        if let Some(dot_pos) = file_name.rfind('.') {
            if dot_pos > 1 && dot_pos < file_name.len() - 1 {
                let extension = &file_name[dot_pos..];
                // 检查是否是常见的文件扩展名
                return matches!(extension, ".txt" | ".pdf" | ".jpg" | ".png" | ".mp4" | ".zip" | ".doc" | ".docx");
            }
        }

        false
    }
    
    // 撤销操作相关方法
    pub fn get_undo_history(&self, count: usize) -> Vec<UndoAction> {
        self.undo_history.get_latest_actions(count)
    }
    
    pub fn undo_action(&mut self, action_id: &str) -> Result<String, Box<dyn std::error::Error>> {
        let action = self.undo_history.remove_action(action_id)
            .ok_or("Undo action not found")?;
        
        // 检查目标文件是否还存在
        if !action.moved_to_path.exists() {
            return Err(format!("File {} has been deleted or moved", action.file_name).into());
        }
        
        // 检查原始路径是否被占用
        if action.original_path.exists() {
            return Err(format!("Original location {} is occupied", action.original_path.display()).into());
        }
        
        // 执行撤销（将文件移回原位置）
        fs::rename(&action.moved_to_path, &action.original_path)?;
        
        let message = t_format("undo_action_success", &[&action.file_name]);
        self.emit_log(&message, "success");
        
        // 发送撤销事件
        if let Some(app_handle) = &self.app_handle {
            let undo_event = serde_json::json!({
                "action_id": action.id,
                "file_name": action.file_name,
                "original_path": action.original_path,
                "category": action.category,
                "timestamp": chrono::Local::now().format("%Y/%m/%d %H:%M:%S").to_string()
            });
            
            if let Err(e) = app_handle.emit("file-undone", &undo_event) {
                eprintln!("Failed to emit undo event: {}", e);
            }
        }
        
        Ok(message)
    }
    
    pub fn clear_undo_history(&mut self) {
        self.undo_history.clear();
        self.emit_log(&t("undo_history_cleared"), "info");
    }
    
    pub fn get_undo_history_count(&self) -> usize {
        self.undo_history.len()
    }
}