# 🗂️ 文件自动分类工具 - Mac 客户端

基于 Tauri 构建的原生 Mac 应用，提供智能文件自动分类功能。

## ✨ 特性

- 🍎 **原生 Mac 体验**：完美集成 macOS 系统
- ⚡ **轻量高效**：比 Electron 小 90%以上
- 🔒 **安全可靠**：Rust 后端 + Web 前端
- 🎯 **系统集成**：系统托盘、通知、菜单栏
- 🔄 **实时监控**：文件系统监控，自动分类
- ⚙️ **自定义规则**：完全可定制的分类规则
- 📊 **统计报告**：详细的分类统计信息
- 💎 **订阅服务**：3 天免费试用，灵活的订阅计划

## 💰 订阅计划

- 🎁 **免费试用**：3 天完整功能体验
- 📅 **月度订阅**：$1.99/月
- 🎯 **年度订阅**：$19.99/年（节省$4.89）

### 订阅包含功能

- ✅ 无限制文件整理
- ✅ 实时文件监控
- ✅ 自定义分类规则
- ✅ 技术支持
- ✅ 未来功能更新

## 🚀 快速开始

### 环境要求

**macOS:**

- macOS 10.13+
- Rust 1.60+
- Node.js 16+

**Windows:**

- Windows 10/11
- Rust 1.60+
- Node.js 16+
- Visual Studio Build Tools
- WebView2 运行时

**Linux:**

- Ubuntu 18.04+ / 其他现代 Linux 发行版
- Rust 1.60+
- Node.js 16+
- GTK3 开发库

### 安装依赖

```bash
# 安装Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 安装Tauri CLI
cargo install tauri-cli

# 安装Node.js依赖
npm install
```

### 开发模式

```bash
# 启动开发服务器
npm run dev
```

### 构建应用

#### 跨平台构建（推荐）

```bash
# 自动检测系统并构建
./build-cross-platform.sh
```

#### 平台特定构建

```bash
# macOS
npm run build-mac        # Intel Mac
npm run build-mac-arm    # Apple Silicon Mac

# Windows
npm run build-windows    # 或运行 build-windows.bat

# Linux
npm run build-linux

# 通用构建（当前平台）
npm run build
```

#### 构建产物位置

- **macOS**: `src-tauri/target/release/bundle/dmg/` 和 `macos/`
- **Windows**: `src-tauri/target/release/bundle/msi/` 和 `nsis/`
- **Linux**: `src-tauri/target/release/bundle/deb/` 和 `appimage/`

## 📱 功能说明

### 主要功能

1. **文件整理**

   - 一键整理现有文件
   - 根据扩展名自动分类
   - 智能重命名避免冲突

2. **实时监控**

   - 监控指定文件夹
   - 新文件自动分类
   - 系统通知提醒

3. **自定义分类**

   - 添加/删除分类
   - 管理扩展名列表
   - 导入/导出配置

4. **系统集成**
   - 系统托盘常驻
   - 原生通知
   - 菜单栏快捷操作

### 系统托盘功能

- **左键点击**：显示主窗口
- **右键菜单**：
  - 显示窗口
  - 整理文件
  - 开始/停止监控
  - 退出应用

## 🔧 配置文件

配置文件位置：`~/Library/Application Support/fileSortify/config.json`

```json
{
  "categories": {
    "图片": [".jpg", ".png", ".gif"],
    "文档": [".pdf", ".doc", ".txt"],
    "音频": [".mp3", ".wav", ".aac"],
    "视频": [".mp4", ".avi", ".mov"]
  },
  "version": "1.0",
  "description": "文件自动分类工具配置文件"
}
```

## 🛠️ 开发说明

### 项目结构

```
FileSortify/
├── src/                    # 前端代码
│   ├── index.html         # 主界面
│   ├── style.css          # 样式文件
│   └── script.js          # JavaScript逻辑
├── src-tauri/             # Rust后端
│   ├── src/
│   │   ├── main.rs        # 主程序
│   │   ├── file_organizer.rs  # 文件整理逻辑
│   │   └── config.rs      # 配置管理
│   ├── Cargo.toml         # Rust依赖
│   └── tauri.conf.json    # Tauri配置
└── package.json           # Node.js配置
```

### 技术栈

- **前端**：HTML + CSS + JavaScript
- **后端**：Rust + Tauri
- **文件监控**：notify crate
- **配置管理**：serde + JSON
- **系统集成**：Tauri 系统 API

### 添加新功能

1. **后端 API**：在 `src-tauri/src/main.rs` 中添加新的 Tauri 命令
2. **前端调用**：在 `src/script.js` 中使用 `invoke()` 调用后端 API
3. **界面更新**：修改 `src/index.html` 和 `src/style.css`

## 📦 分发

### 创建安装包

```bash
# 构建DMG安装包
npm run build
```

生成的文件：

- `src-tauri/target/release/bundle/dmg/文件自动分类工具_1.0.0_aarch64.dmg`
- `src-tauri/target/release/bundle/macos/文件自动分类工具.app`

### App Store 分发

1. 配置开发者证书
2. 更新 `tauri.conf.json` 中的签名配置
3. 构建并提交审核

## 🐛 故障排除

### 常见问题

1. **构建失败**

   - 检查 Rust 和 Node.js 版本
   - 清理缓存：`cargo clean && npm clean-install`

2. **权限问题**

   - 确保应用有文件系统访问权限
   - 在系统偏好设置中授权

3. **监控不工作**
   - 检查文件夹路径是否正确
   - 确认文件夹存在且可访问

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

如有问题，请创建 Issue 或联系开发者。
