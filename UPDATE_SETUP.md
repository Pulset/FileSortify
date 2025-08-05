# FileSortify 更新密钥和GitHub Actions设置指南

## 1. 设置GitHub Secrets

在GitHub仓库设置中添加以下Secrets：

### Tauri签名相关
- `TAURI_PRIVATE_KEY`: 私钥内容 (从 ~/.tauri/FileSortify.key 获取)
- `TAURI_KEY_PASSWORD`: 私钥密码 (生成密钥时设置的密码)

### Apple代码签名相关 (macOS构建需要)
- `APPLE_CERTIFICATE`: Apple开发者证书 (base64编码的.p12文件)
- `APPLE_CERTIFICATE_PASSWORD`: 证书密码
- `APPLE_SIGNING_IDENTITY`: 签名身份 (如: "Developer ID Application: Your Name")
- `APPLE_ID`: Apple ID邮箱
- `APPLE_APP_PASSWORD`: App专用密码
- `APPLE_TEAM_ID`: Apple团队ID

## 2. 获取私钥内容

```bash
# 获取私钥内容并复制到剪贴板
cat ~/.tauri/FileSortify.key | pbcopy
```

## 3. 发布新版本

1. 更新 `src-tauri/tauri.conf.json` 中的版本号
2. 创建并推送标签：
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```
3. GitHub Actions将自动构建并创建Release

## 4. 更新端点配置

记得在 `tauri.conf.json` 中更新实际的GitHub仓库地址：

```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://api.github.com/repos/YOUR_USERNAME/FileSortify/releases/latest"]
    }
  }
}
```

## 5. 私有仓库访问

如果仓库是私有的，需要在应用中设置GitHub Token来访问releases。可以通过环境变量或配置文件提供。