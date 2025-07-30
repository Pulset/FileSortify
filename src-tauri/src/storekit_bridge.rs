use std::ffi::{CStr, CString};
use std::os::raw::c_char;

// 定义StoreKit相关的外部函数接口
#[cfg(target_os = "macos")]
extern "C" {
    fn init_store_kit() -> bool;
    fn request_products(product_ids: *const c_char) -> bool;
    fn purchase_product(product_id: *const c_char) -> bool;
    fn restore_purchases() -> bool;
    fn get_receipt_data() -> *const c_char;
    fn finish_transaction(transaction_id: *const c_char) -> bool;
}

pub struct StoreKitManager {
    initialized: bool,
}

impl StoreKitManager {
    pub fn new() -> Self {
        Self {
            initialized: false,
        }
    }

    #[cfg(target_os = "macos")]
    pub fn initialize(&mut self) -> Result<(), String> {
        unsafe {
            if init_store_kit() {
                self.initialized = true;
                Ok(())
            } else {
                Err("Failed to initialize StoreKit".to_string())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn initialize(&mut self) -> Result<(), String> {
        Err("StoreKit is only available on macOS".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn request_products(&self, product_ids: &[String]) -> Result<(), String> {
        if !self.initialized {
            return Err("StoreKit not initialized".to_string());
        }

        let product_ids_json = serde_json::to_string(product_ids)
            .map_err(|e| format!("Failed to serialize product IDs: {}", e))?;
        
        let c_product_ids = CString::new(product_ids_json)
            .map_err(|e| format!("Failed to create C string: {}", e))?;

        unsafe {
            if request_products(c_product_ids.as_ptr()) {
                Ok(())
            } else {
                Err("Failed to request products".to_string())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn request_products(&self, _product_ids: &[String]) -> Result<(), String> {
        Err("StoreKit is only available on macOS".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn purchase_product(&self, product_id: &str) -> Result<(), String> {
        if !self.initialized {
            return Err("StoreKit not initialized".to_string());
        }

        let c_product_id = CString::new(product_id)
            .map_err(|e| format!("Failed to create C string: {}", e))?;

        unsafe {
            if purchase_product(c_product_id.as_ptr()) {
                Ok(())
            } else {
                Err("Failed to start purchase".to_string())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn purchase_product(&self, _product_id: &str) -> Result<(), String> {
        Err("StoreKit is only available on macOS".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn restore_purchases(&self) -> Result<(), String> {
        if !self.initialized {
            return Err("StoreKit not initialized".to_string());
        }

        unsafe {
            if restore_purchases() {
                Ok(())
            } else {
                Err("Failed to restore purchases".to_string())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn restore_purchases(&self) -> Result<(), String> {
        Err("StoreKit is only available on macOS".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn get_receipt_data(&self) -> Result<String, String> {
        unsafe {
            let receipt_ptr = get_receipt_data();
            if receipt_ptr.is_null() {
                return Err("No receipt data available".to_string());
            }

            let c_str = CStr::from_ptr(receipt_ptr);
            let receipt_str = c_str.to_str()
                .map_err(|e| format!("Failed to convert receipt data: {}", e))?;
            
            Ok(receipt_str.to_string())
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn get_receipt_data(&self) -> Result<String, String> {
        Err("StoreKit is only available on macOS".to_string())
    }

    #[cfg(target_os = "macos")]
    pub fn finish_transaction(&self, transaction_id: &str) -> Result<(), String> {
        let c_transaction_id = CString::new(transaction_id)
            .map_err(|e| format!("Failed to create C string: {}", e))?;

        unsafe {
            if finish_transaction(c_transaction_id.as_ptr()) {
                Ok(())
            } else {
                Err("Failed to finish transaction".to_string())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    pub fn finish_transaction(&self, _transaction_id: &str) -> Result<(), String> {
        Err("StoreKit is only available on macOS".to_string())
    }
}

impl Default for StoreKitManager {
    fn default() -> Self {
        Self::new()
    }
}

// StoreKit回调处理
#[no_mangle]
pub extern "C" fn on_products_received(products_json: *const c_char) {
    if products_json.is_null() {
        return;
    }

    unsafe {
        if let Ok(c_str) = CStr::from_ptr(products_json).to_str() {
            log::info!("Products received: {}", c_str);
            // 这里可以发送事件到前端
        }
    }
}

#[no_mangle]
pub extern "C" fn on_purchase_completed(transaction_json: *const c_char) {
    if transaction_json.is_null() {
        return;
    }

    unsafe {
        if let Ok(c_str) = CStr::from_ptr(transaction_json).to_str() {
            log::info!("Purchase completed: {}", c_str);
            // 这里可以发送事件到前端，触发收据验证
        }
    }
}

#[no_mangle]
pub extern "C" fn on_purchase_failed(error_message: *const c_char) {
    if error_message.is_null() {
        return;
    }

    unsafe {
        if let Ok(c_str) = CStr::from_ptr(error_message).to_str() {
            log::error!("Purchase failed: {}", c_str);
            // 这里可以发送错误事件到前端
        }
    }
}

#[no_mangle]
pub extern "C" fn on_restore_completed(transactions_json: *const c_char) {
    if transactions_json.is_null() {
        return;
    }

    unsafe {
        if let Ok(c_str) = CStr::from_ptr(transactions_json).to_str() {
            log::info!("Restore completed: {}", c_str);
            // 这里可以发送事件到前端，触发收据验证
        }
    }
}