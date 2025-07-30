# Apple App Store 订阅集成指南

本文档详细说明如何为文件整理工具配置 Apple App Store 内购订阅功能。

## 前置要求

1. **Apple Developer Account**: 需要有效的 Apple 开发者账户
2. **App Store Connect**: 应用已在 App Store Connect 中创建
3. **Xcode**: 用于代码签名和构建

## 配置步骤

### 1. App Store Connect 配置

#### 创建内购产品

1. 登录 [App Store Connect](https://appstoreconnect.apple.com)
2. 选择你的应用
3. 进入 "功能" → "App 内购买项目"
4. 创建两个自动续期订阅产品：

**月度订阅**

- 产品 ID: `com.fileSortify.monthly`
- 参考名称: `File Sortify Monthly Subscription`
- 价格: $1.99/月
- 订阅群组: 创建新群组 "File Sortify Subscriptions"

**年度订阅**

- 产品 ID: `com.fileSortify.yearly`
- 参考名称: `File Sortify Yearly Subscription`
- 价格: $19.99/年
- 订阅群组: 使用相同群组 "File Sortify Subscriptions"

#### 配置共享密钥

1. 在 App Store Connect 中，进入 "我的 App" → 选择应用
2. 进入 "App 信息" → "App 专用共享密钥"
3. 生成共享密钥并记录下来

### 2. 项目配置

#### 环境变量设置

复制 `.env.example` 为 `.env` 并填入实际值：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
APPLE_SHARED_SECRET=your-actual-shared-secret-here
APPLE_BUNDLE_ID=com.fileSortify.tool
APPLE_MONTHLY_PRODUCT_ID=com.fileSortify.monthly
APPLE_YEARLY_PRODUCT_ID=com.fileSortify.yearly
```

#### Tauri 配置更新

确保 `tauri.conf.json` 中的 bundle identifier 与 App Store Connect 中的一致：

```json
{
  "identifier": "com.fileSortify.tool"
}
```

### 3. 代码签名配置

#### 开发环境

```bash
# 设置开发团队ID
export DEVELOPMENT_TEAM="YOUR_TEAM_ID"

# 构建开发版本
npm run dev
```

#### 生产环境

```bash
# 构建生产版本（需要分发证书）
npm run build-mac
```

### 4. 测试配置

#### 沙盒测试

1. 在 App Store Connect 中创建沙盒测试用户
2. 在设备上登录沙盒账户
3. 运行应用并测试购买流程

#### 测试步骤

1. 启动应用
2. 点击订阅按钮
3. 完成沙盒购买
4. 验证订阅状态更新

### 5. 收据验证

应用使用以下流程验证收据：

1. **本地收据获取**: 从应用包中读取收据数据
2. **Apple 服务器验证**: 发送收据到 Apple 验证服务器
3. **状态更新**: 根据验证结果更新本地订阅状态

#### 验证服务器

- 生产环境: `https://buy.itunes.apple.com/verifyReceipt`
- 沙盒环境: `https://sandbox.itunes.apple.com/verifyReceipt`

### 6. 常见问题

#### Q: 购买按钮点击后没有反应

A: 检查以下项目：

- 产品 ID 是否正确配置
- 是否在沙盒环境下测试
- 设备是否登录了沙盒测试账户

#### Q: 收据验证失败

A: 可能的原因：

- 共享密钥配置错误
- 网络连接问题
- 收据数据格式错误

#### Q: 订阅状态不更新

A: 检查：

- 收据验证逻辑
- 本地存储权限
- 应用重启后状态

### 7. 部署清单

发布前确认：

- [ ] 产品 ID 配置正确
- [ ] 共享密钥已设置
- [ ] 代码签名证书有效
- [ ] 沙盒测试通过
- [ ] 收据验证正常工作
- [ ] 订阅状态正确显示
- [ ] 恢复购买功能正常

### 8. 监控和分析

建议集成以下监控：

1. **购买转化率**: 跟踪用户从试用到付费的转化
2. **订阅续费率**: 监控订阅的续费情况
3. **收据验证成功率**: 确保验证流程稳定
4. **错误日志**: 记录购买和验证过程中的错误

### 9. 法律合规

确保应用符合以下要求：

- 清晰的订阅条款
- 隐私政策更新
- 退款政策说明
- 自动续费提醒

### 10. 技术支持

如遇到技术问题，可以：

1. 查看 Apple 开发者文档
2. 在 Apple 开发者论坛提问
3. 联系 Apple 技术支持
4. 查看应用日志和错误信息

## 相关链接

- [Apple Developer Documentation](https://developer.apple.com/documentation/storekit)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [StoreKit Testing Guide](https://developer.apple.com/documentation/storekit/in-app_purchase/testing_in-app_purchases)
- [Receipt Validation Guide](https://developer.apple.com/documentation/storekit/in-app_purchase/validating_receipts_with_the_app_store)
