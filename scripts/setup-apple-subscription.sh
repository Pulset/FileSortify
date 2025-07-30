#!/bin/bash

# Apple订阅设置脚本
# 用于配置Apple App Store内购订阅环境

set -e

echo "🍎 Apple订阅设置向导"
echo "===================="

# 检查是否在macOS上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ 此脚本只能在macOS上运行"
    exit 1
fi

# 检查必要工具
echo "🔍 检查必要工具..."

if ! command -v cargo &> /dev/null; then
    echo "❌ Rust/Cargo 未安装，请先安装 Rust"
    echo "   访问: https://rustup.rs/"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ Node.js/npm 未安装，请先安装 Node.js"
    echo "   访问: https://nodejs.org/"
    exit 1
fi

echo "✅ 工具检查完成"

# 创建环境配置文件
echo "📝 配置环境变量..."

if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ 已创建 .env 文件"
else
    echo "⚠️  .env 文件已存在，跳过创建"
fi

# 提示用户配置必要信息
echo ""
echo "📋 请手动配置以下信息："
echo "1. 编辑 .env 文件，填入你的 Apple 共享密钥"
echo "2. 确认产品ID与App Store Connect中的配置一致"
echo "3. 设置正确的Bundle ID"

# 检查Tauri配置
echo ""
echo "🔧 检查Tauri配置..."

if [ -f "src-tauri/tauri.conf.json" ]; then
    BUNDLE_ID=$(grep -o '"identifier": "[^"]*"' src-tauri/tauri.conf.json | cut -d'"' -f4)
    echo "当前Bundle ID: $BUNDLE_ID"
    
    if [ "$BUNDLE_ID" != "com.fileSortify.tool" ]; then
        echo "⚠️  Bundle ID 可能需要更新以匹配App Store Connect配置"
    fi
else
    echo "❌ 未找到 tauri.conf.json 文件"
    exit 1
fi

# 安装依赖
echo ""
echo "📦 安装项目依赖..."

if [ -f "package.json" ]; then
    npm install
    echo "✅ npm 依赖安装完成"
fi

cd src-tauri
cargo check
echo "✅ Rust 依赖检查完成"
cd ..

# 构建项目
echo ""
echo "🔨 构建项目..."

if cargo tauri build --debug; then
    echo "✅ 项目构建成功"
else
    echo "❌ 项目构建失败，请检查错误信息"
    exit 1
fi

# 完成提示
echo ""
echo "🎉 Apple订阅设置完成！"
echo ""
echo "📋 下一步操作："
echo "1. 在App Store Connect中配置内购产品"
echo "2. 生成并配置共享密钥到 .env 文件"
echo "3. 创建沙盒测试用户"
echo "4. 运行 'npm run dev' 开始测试"
echo ""
echo "📖 详细配置指南请查看: APPLE_SUBSCRIPTION_SETUP.md"
echo ""
echo "🚀 开始开发: npm run dev"
echo "🏗️  构建发布: npm run build-mac"