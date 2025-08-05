#!/bin/bash

echo "🔧 FileSortify 更新功能测试脚本"
echo "================================="

# 检查必要的文件是否存在
echo "📋 检查文件完整性..."

files_to_check=(
    "src-tauri/src/updater/mod.rs"
    "src-tauri/src/updater/github.rs"
    "src-tauri/src/updater/scheduler.rs"
    "src/components/UpdateDialog.tsx"
    "src/components/UpdateSettings.tsx"
    ".github/workflows/build-and-release.yml"
    "UPDATE_SETUP.md"
)

for file in "${files_to_check[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
    else
        echo "❌ $file - 文件不存在"
    fi
done

echo ""
echo "🔑 检查签名配置..."

# 检查私钥是否存在
if [[ -f ~/.tauri/FileSortify.key ]]; then
    echo "✅ 私钥文件存在"
else
    echo "❌ 私钥文件不存在，请运行: cargo tauri signer generate -w ~/.tauri/FileSortify.key"
fi

# 检查公钥是否存在
if [[ -f ~/.tauri/FileSortify.key.pub ]]; then
    echo "✅ 公钥文件存在"
    echo "📄 公钥内容:"
    cat ~/.tauri/FileSortify.key.pub | head -1
else
    echo "❌ 公钥文件不存在"
fi

echo ""
echo "📦 检查依赖配置..."

# 检查 Cargo.toml 中是否包含 updater 插件
if grep -q "tauri-plugin-updater" src-tauri/Cargo.toml; then
    echo "✅ Cargo.toml 包含 updater 插件"
else
    echo "❌ Cargo.toml 缺少 updater 插件"
fi

# 检查 tauri.conf.json 中是否配置了 updater
if grep -q '"updater"' src-tauri/tauri.conf.json; then
    echo "✅ tauri.conf.json 包含 updater 配置"
else
    echo "❌ tauri.conf.json 缺少 updater 配置"
fi

echo ""
echo "🏗️ 编译测试..."

# 编译检查
echo "正在检查 Rust 代码编译..."
if cargo check --manifest-path src-tauri/Cargo.toml --quiet; then
    echo "✅ Rust 代码编译通过"
else
    echo "❌ Rust 代码编译失败"
fi

echo "正在检查前端代码编译..."
if npm run build > /dev/null 2>&1; then
    echo "✅ 前端代码编译通过"
else
    echo "❌ 前端代码编译失败"
fi

echo ""
echo "🎯 下一步操作指引:"
echo "1. 设置 GitHub Secrets (参考 UPDATE_SETUP.md)"
echo "2. 更新 tauri.conf.json 中的仓库地址"
echo "3. 推送代码并创建 release 标签进行测试"
echo "4. 测试更新对话框和设置界面"

echo ""
echo "测试完成! 🎉"