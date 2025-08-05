# FileSortify 静态更新系统

本项目使用静态 JSON 文件来实现 Tauri 应用的自动更新功能，参考了 [Tauri Action](https://github.com/tauri-apps/tauri-action) 项目的最佳实践。

## 系统架构

### 1. 更新 JSON 文件结构

更新信息存储在 `public/updates.json` 文件中，格式如下：

```json
{
  "version": "1.0.0",
  "notes": "FileSortify 1.0.0 版本发布",
  "pub_date": "2024-01-01T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "公钥签名",
      "url": "下载链接"
    },
    "darwin-x86_64": {
      "signature": "公钥签名",
      "url": "下载链接"
    },
    "linux-x86_64": {
      "signature": "公钥签名",
      "url": "下载链接"
    },
    "windows-x86_64": {
      "signature": "公钥签名",
      "url": "下载链接"
    }
  }
}
```

### 2. 配置文件

在 `src-tauri/tauri.conf.json` 中配置更新端点：

```json
{
  "plugins": {
    "updater": {
      "dialog": false,
      "endpoints": [
        "https://raw.githubusercontent.com/Pulset/FileSortify/main/public/updates.json"
      ],
      "pubkey": "您的公钥",
      "windows": {
        "installMode": "passive"
      }
    }
  }
}
```

## 使用方法

### 1. 手动生成更新 JSON

```bash
# 生成指定版本的更新 JSON
node scripts/generate-update-json.js 1.0.0 "版本说明"

# 使用默认版本
node scripts/generate-update-json.js
```

### 2. 自动生成（推荐）

当您推送一个版本标签时，GitHub Actions 会自动：

1. 生成更新 JSON 文件
2. 构建应用
3. 创建 GitHub Release
4. 上传构建产物

```bash
# 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0
```

### 3. 配置说明

在 `scripts/generate-update-json.js` 中修改以下配置：

```javascript
const config = {
  repoOwner: 'Pulset', // 替换为您的 GitHub 用户名
  repoName: 'FileSortify', // 替换为您的仓库名
  pubkey: '您的公钥', // 替换为您的公钥
};
```

## 工作流程

1. **开发阶段**：在本地开发时，应用会检查更新端点
2. **发布阶段**：推送版本标签触发 GitHub Actions
3. **构建阶段**：自动生成更新 JSON 并构建应用
4. **发布阶段**：创建 GitHub Release 并上传构建产物
5. **更新阶段**：用户的应用会自动检查并下载更新

## 优势

- ✅ **简单可靠**：使用静态 JSON 文件，无需复杂的服务器
- ✅ **自动集成**：与 GitHub Actions 完美集成
- ✅ **多平台支持**：支持 macOS、Linux、Windows
- ✅ **安全签名**：使用 Tauri 的签名验证机制
- ✅ **版本管理**：与 Git 标签系统集成

## 注意事项

1. 确保 `public/updates.json` 文件被提交到仓库
2. 更新端点 URL 必须使用 HTTPS
3. 公钥必须与签名私钥匹配
4. 下载链接必须指向有效的 GitHub Release 资产

## 故障排除

### 更新检查失败

- 检查网络连接
- 验证端点 URL 是否正确
- 确认 JSON 文件格式正确

### 签名验证失败

- 检查公钥是否正确
- 确认构建时使用了正确的私钥
- 验证签名算法是否匹配

### 下载失败

- 检查 GitHub Release 是否存在
- 确认资产文件名是否正确
- 验证下载链接是否可访问
