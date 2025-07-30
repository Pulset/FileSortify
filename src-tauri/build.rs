use std::env;

fn main() {
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap();
    
    if target_os == "macos" {
        // 编译Objective-C代码
        cc::Build::new()
            .file("src/storekit.m")
            .flag("-fobjc-arc")
            .compile("storekit");
        
        // 链接系统框架
        println!("cargo:rustc-link-lib=framework=Foundation");
        println!("cargo:rustc-link-lib=framework=StoreKit");
        
        // 告诉cargo重新构建如果这些文件改变了
        println!("cargo:rerun-if-changed=src/storekit.m");
        println!("cargo:rerun-if-changed=src/storekit.h");
    }
    
    tauri_build::build()
}