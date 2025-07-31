# Design Document

## Overview

The multi-language support feature will implement a comprehensive internationalization (i18n) system for FileSortify, supporting Chinese (default) and English languages. The system will use React Context for state management, JSON files for translations, and localStorage for persistence. The design integrates seamlessly with the existing Tauri-based architecture and React component structure.

## Architecture

### Translation System Architecture
```
Frontend (React)
├── I18nContext (Language state management)
├── Translation Files (JSON)
│   ├── zh.json (Chinese - default)
│   └── en.json (English)
├── useTranslation Hook (Translation utilities)
└── Language Selector Component

Backend (Rust)
├── Config Management (Language preference storage)
└── Notification System (Localized messages)
```

### Data Flow
1. User selects language → I18nContext updates → localStorage saves preference
2. App initialization → Load saved language preference → Apply to all components
3. Component renders → useTranslation hook → Get translated text → Display

## Components and Interfaces

### I18nContext Interface
```typescript
interface I18nContextType {
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
  t: (key: string, params?: Record<string, string>) => string;
  isLoading: boolean;
}
```

### Translation File Structure
```typescript
interface TranslationKeys {
  // Navigation
  nav: {
    dashboard: string;
    organize: string;
    rules: string;
    logs: string;
    subscription: string;
  };
  
  // Dashboard
  dashboard: {
    title: string;
    description: string;
    stats: {
      filesOrganized: string;
      lastOrganized: string;
      monitoringStatus: string;
      monitoring: string;
      stopped: string;
      notStarted: string;
    };
    actions: {
      quickActions: string;
      organizeFiles: string;
      organizeFilesDesc: string;
      toggleMonitoring: string;
      startMonitoring: string;
      stopMonitoring: string;
      autoMonitorDesc: string;
    };
  };
  
  // Common UI elements
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    confirm: string;
    save: string;
    delete: string;
    edit: string;
    add: string;
  };
  
  // Messages and notifications
  messages: {
    appStarted: string;
    trialExpired: string;
    initializationFailed: string;
    organizingFiles: string;
    organizationComplete: string;
    monitoringStarted: string;
    monitoringStopped: string;
    folderSelected: string;
    folderSelectionCancelled: string;
    subscriptionRequired: string;
  };
  
  // Error messages
  errors: {
    selectFolderFirst: string;
    organizationFailed: string;
    monitoringToggleFailed: string;
    folderSelectionFailed: string;
    subscriptionCheckFailed: string;
  };
}
```

### Language Selector Component
```typescript
interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
}
```

### useTranslation Hook
```typescript
interface UseTranslationReturn {
  t: (key: string, params?: Record<string, string>) => string;
  language: 'zh' | 'en';
  setLanguage: (lang: 'zh' | 'en') => void;
  isLoading: boolean;
}
```

## Data Models

### Translation Storage
- **Location**: `src/locales/` directory
- **Files**: `zh.json`, `en.json`
- **Format**: Nested JSON objects with dot-notation keys
- **Fallback**: Chinese as default, key display if translation missing

### Language Preference Storage
- **Frontend**: localStorage key `fileSortify_language`
- **Backend**: Integrated into existing config system in Rust
- **Default**: 'zh' (Chinese)
- **Validation**: Enum validation for supported languages

### Configuration Integration
```typescript
// Extended Config interface
interface Config {
  categories: FileCategory;
  downloads_folder: string;
  auto_organize: boolean;
  notification_enabled: boolean;
  rules: any[];
  language: 'zh' | 'en'; // New field
}
```

## Error Handling

### Translation Loading Errors
- **Missing Translation Files**: Fallback to Chinese, log warning
- **Invalid JSON**: Display error message, use fallback translations
- **Network Issues**: Use cached translations, retry mechanism

### Missing Translation Keys
- **Strategy**: Display translation key as fallback
- **Development Mode**: Console warnings for missing keys
- **Production Mode**: Silent fallback with error logging

### Language Switching Errors
- **Invalid Language Code**: Ignore request, maintain current language
- **Storage Errors**: Continue with current session, log error
- **Context Errors**: Fallback to default language

## Testing Strategy

### Unit Tests
- **Translation Hook**: Test key resolution, parameter interpolation
- **I18nContext**: Test language switching, persistence
- **Language Selector**: Test UI interactions, language changes
- **Translation Files**: Validate JSON structure, key completeness

### Integration Tests
- **Component Integration**: Test translated text rendering
- **Storage Integration**: Test language preference persistence
- **Context Integration**: Test provider/consumer relationships

### End-to-End Tests
- **Language Switching**: Full user flow testing
- **Persistence**: Test language retention across sessions
- **Component Coverage**: Verify all UI elements are translated

### Translation Validation
- **Key Completeness**: Automated checks for missing translations
- **Parameter Validation**: Test parameter interpolation
- **Character Encoding**: Test Chinese character display
- **Text Length**: Test UI layout with different text lengths

## Implementation Considerations

### Performance Optimizations
- **Lazy Loading**: Load only current language translations
- **Memoization**: Cache translated strings to prevent re-computation
- **Bundle Splitting**: Separate translation files from main bundle

### Accessibility
- **Screen Readers**: Ensure translated content is accessible
- **Language Attributes**: Set appropriate HTML lang attributes
- **RTL Support**: Future-ready for right-to-left languages

### Maintenance
- **Translation Management**: Clear process for adding new translations
- **Key Naming**: Consistent naming convention for translation keys
- **Documentation**: Guidelines for developers adding new translatable content

### Backend Integration
- **Rust Configuration**: Extend existing config system for language preference
- **Notification Localization**: Translate system notifications
- **Error Message Translation**: Localize backend error messages sent to frontend