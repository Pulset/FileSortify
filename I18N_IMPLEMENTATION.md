# FileSortify 多语言功能实现

## 概述

已为 FileSortify 应用实现了完整的多语言功能，支持中文和英文两种语言，默认语言为英文。语言切换按钮位于设置页面的通用设置中。

## 实现的功能

### 1. 国际化上下文 (I18nContext)
- 位置: `src/contexts/I18nContext.tsx`
- 提供全局的语言状态管理
- 支持动态语言切换
- 自动保存用户的语言偏好到 localStorage

### 2. 语言资源文件
- 英文: `src/locales/en.json`
- 中文: `src/locales/zh.json`
- 包含所有界面文案的翻译

### 3. 已国际化的组件
- **Sidebar**: 导航菜单
- **Dashboard**: 概览页面
- **SettingsView**: 设置页面（包含语言切换功能）
- **OrganizeView**: 文件整理页面（部分完成）

### 4. 语言切换功能
- 位置: 设置页面 → 通用设置 → 语言
- 支持英文和中文切换
- 切换后立即生效，无需重启应用

## 使用方法

### 在组件中使用国际化

```tsx
import { useI18n } from '../contexts/I18nContext';

const MyComponent: React.FC = () => {
  const { t, language, setLanguage } = useI18n();

  return (
    <div>
      <h1>{t('nav.dashboard')}</h1>
      <p>{t('dashboard.description')}</p>
      
      {/* 带参数的翻译 */}
      <p>{t('dashboard.stats.daysRemaining', { days: 5 })}</p>
      
      {/* 语言切换 */}
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="zh">中文</option>
      </select>
    </div>
  );
};
```

### 添加新的翻译

1. 在 `src/locales/en.json` 中添加英文翻译
2. 在 `src/locales/zh.json` 中添加对应的中文翻译
3. 在组件中使用 `t('key.path')` 调用

## 翻译键值结构

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "organize": "Organize",
    "rules": "Rules",
    "logs": "Logs", 
    "subscription": "Subscription",
    "settings": "Settings"
  },
  "dashboard": {
    "title": "Dashboard",
    "description": "File organization status and quick actions",
    "stats": {
      "filesOrganized": "Files Organized",
      "lastOrganized": "Last Organized"
    }
  },
  "settings": {
    "title": "Settings",
    "general": {
      "language": "Language",
      "autoStart": "Auto Start"
    }
  },
  "common": {
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

## 参数化翻译

支持在翻译中使用参数：

```json
{
  "messages": {
    "daysRemaining": "{{days}} days remaining"
  }
}
```

使用方法：
```tsx
t('messages.daysRemaining', { days: 5 })
// 输出: "5 days remaining"
```

## 测试

可以打开 `test-i18n-simple.html` 文件在浏览器中测试多语言功能的基本实现。

## 待完成的工作

1. 完成 OrganizeView 组件的完整国际化
2. 国际化 RulesView 组件
3. 国际化 LogsView 组件  
4. 国际化 SubscriptionView 组件
5. 国际化所有错误消息和提示信息
6. 添加更多语言支持（如需要）

## 技术细节

- 使用 React Context API 进行状态管理
- 支持嵌套的翻译键值
- 自动回退到键名（如果翻译不存在）
- 语言偏好持久化存储
- 支持参数替换功能

## 文件结构

```
src/
├── contexts/
│   └── I18nContext.tsx          # 国际化上下文
├── locales/
│   ├── en.json                  # 英文翻译
│   └── zh.json                  # 中文翻译
└── components/
    ├── Sidebar.tsx              # ✅ 已国际化
    ├── Dashboard.tsx            # ✅ 已国际化
    ├── SettingsView.tsx         # ✅ 已国际化（含语言切换）
    ├── OrganizeView.tsx         # 🔄 部分国际化
    ├── RulesView.tsx            # ❌ 待国际化
    ├── LogsView.tsx             # ❌ 待国际化
    └── SubscriptionView.tsx     # ❌ 待国际化
```

## 注意事项

1. 所有新增的界面文案都应该添加到翻译文件中
2. 避免在组件中硬编码文本
3. 保持英文和中文翻译文件的结构一致
4. 测试语言切换功能确保正常工作