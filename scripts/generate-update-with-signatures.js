#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 生成带有正确签名的更新 JSON 文件
 * 使用方法：
 * node scripts/generate-update-with-signatures.js <version> [notes]
 * node scripts/generate-update-with-signatures.js 1.0.1 "修复签名问题"
 *
 * 注意：此脚本需要在 Tauri 构建完成后运行，以便读取生成的 .sig 文件
 */

function readSignatureFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
        console.warn(`⚠️  签名文件不存在: ${filePath}`);
        return '';
    } catch (error) {
        console.warn(`⚠️  读取签名文件失败: ${filePath}`, error.message);
        return '';
    }
}

// 配置
const config = {
    version: process.argv[2] || '1.0.1',
    notes: process.argv[3] || 'FileSortify 版本更新',
    pubDate: new Date().toISOString(),
    baseUrl: 'https://oss.picasso-designs.com/FileSortify/releases',
};

// 构建产物目录
const targetDir = path.join(
    __dirname,
    '..',
    'src-tauri',
    'target',
    'aarch64-apple-darwin',
    'release',
    'bundle'
);

// 读取各平台的签名文件
const signatures = {
    'darwin-aarch64': readSignatureFile(
        path.join(targetDir, 'macos', `File Sortify.app.tar.gz.sig`)
    ),
    'darwin-x86_64': readSignatureFile(
        path.join(targetDir, 'macos', `File Sortify.app.tar.gz.sig`)
    ),
    'linux-x86_64': readSignatureFile(
        path.join(targetDir, 'appimage', `File Sortify.app.tar.gz.sig`)
    ),
    'windows-x86_64': readSignatureFile(
        path.join(targetDir, 'msi', `File Sortify.app.tar.gz.sig`)
    ),
};

// 生成更新 JSON
const updateJson = {
    version: config.version,
    notes: config.notes,
    pub_date: config.pubDate,
    platforms: {
        'darwin-aarch64': {
            signature: signatures['darwin-aarch64'],
            url: `${config.baseUrl}/v${config.version}/File%20Sortify.app.tar.gz`,
        },
        'darwin-x86_64': {
            signature: signatures['darwin-x86_64'],
            url: `${config.baseUrl}/v${config.version}/File%20Sortify_x64.dmg`,
        },
        'linux-x86_64': {
            signature: signatures['linux-x86_64'],
            url: `${config.baseUrl}/v${config.version}/File%20Sortify_amd64.AppImage`,
        },
        'windows-x86_64': {
            signature: signatures['windows-x86_64'],
            url: `${config.baseUrl}/v${config.version}/File%20Sortify_x64_en-US.msi`,
        },
    },
};

// 确保输出目录存在
const outputDir = path.join(
    __dirname,
    '..',
    'public',
    'FileSortify',
    'releases'
);
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 写入文件
const outputPath = path.join(outputDir, 'updates.json');
fs.writeFileSync(outputPath, JSON.stringify(updateJson, null, 2));

console.log(`✅ 更新 JSON 文件已生成: ${outputPath}`);
console.log(`📦 版本: ${config.version}`);
console.log(`📝 说明: ${config.notes}`);
console.log(
    `🔗 端点: https://oss.picasso-designs.com/FileSortify/releases/updates.json`
);

// 显示签名状态
console.log('\n📋 签名状态:');
Object.entries(signatures).forEach(([platform, signature]) => {
    const status = signature ? '✅' : '❌';
    console.log(
        `  ${status} ${platform}: ${signature ? '已找到签名' : '未找到签名'}`
    );
});

if (Object.values(signatures).some((sig) => !sig)) {
    console.log('\n⚠️  警告: 某些平台的签名文件未找到。请确保：');
    console.log('   1. 已运行 Tauri 构建命令 (npm run tauri:build)');
    console.log('   2. 构建过程中启用了 createUpdaterArtifacts');
    console.log('   3. 签名文件路径正确');
}
