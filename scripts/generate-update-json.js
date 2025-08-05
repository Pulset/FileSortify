#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 配置
const config = {
  version: process.argv[2] || '1.0.0',
  notes: process.argv[3] || 'FileSortify 版本更新',
  pubDate: new Date().toISOString(),
  repoOwner: 'Pulset', // 替换为您的 GitHub 用户名
  repoName: 'FileSortify', // 替换为您的仓库名
  pubkey:
    'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDlCOTUxQkEwRDAxNzE3MDIKUldRQ0Z4ZlFvQnVWbTVTSTJ5ZzBLU2FIR21RWFhqRG56YUVLY2JHcFp6eVhoellnTWg1TEMrUXgK',
};

// 生成更新 JSON
const updateJson = {
  version: config.version,
  notes: config.notes,
  pub_date: config.pubDate,
  platforms: {
    'darwin-aarch64': {
      signature: config.pubkey,
      url: `https://github.com/${config.repoOwner}/${config.repoName}/releases/download/v${config.version}/FileSortify_${config.version}_aarch64.dmg`,
    },
    'darwin-x86_64': {
      signature: config.pubkey,
      url: `https://github.com/${config.repoOwner}/${config.repoName}/releases/download/v${config.version}/FileSortify_${config.version}_x64.dmg`,
    },
    'linux-x86_64': {
      signature: config.pubkey,
      url: `https://github.com/${config.repoOwner}/${config.repoName}/releases/download/v${config.version}/FileSortify_${config.version}_amd64.AppImage`,
    },
    'windows-x86_64': {
      signature: config.pubkey,
      url: `https://github.com/${config.repoOwner}/${config.repoName}/releases/download/v${config.version}/FileSortify_${config.version}_x64_en-US.msi`,
    },
  },
};

// 确保 public 目录存在
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 写入文件
const outputPath = path.join(publicDir, 'updates.json');
fs.writeFileSync(outputPath, JSON.stringify(updateJson, null, 2));

console.log(`✅ 更新 JSON 文件已生成: ${outputPath}`);
console.log(`📦 版本: ${config.version}`);
console.log(`📝 说明: ${config.notes}`);
console.log(
  `🔗 端点: https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/main/public/updates.json`
);
