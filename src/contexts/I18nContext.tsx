// 全局 t 方法，初始为 key=>key，I18nProvider 挂载后会自动指向当前语言
export let t: (key: string, params?: Record<string, any>) => string = (key) =>
  key;
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
// 支持的语言类型
export type Language = 'en' | 'zh';

// 国际化上下文类型
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

// 创建上下文
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// 语言资源
const translations: Record<Language, any> = {
  en: {},
  zh: {},
};

// 加载语言资源
const loadTranslations = async () => {
  try {
    const [enModule, zhModule] = await Promise.all([
      import('../locales/en.json'),
      import('../locales/zh.json'),
    ]);

    translations.en = enModule.default;
    translations.zh = zhModule.default;
  } catch (error) {
    console.error('Failed to load translations:', error);
  }
};

// 翻译函数
const translate = (
  language: Language,
  key: string,
  params?: Record<string, any>
): string => {
  const keys = key.split('.');
  let value: any = translations[language];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果找不到翻译，返回key本身
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // 处理参数替换
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? String(params[paramKey]) : match;
    });
  }

  return value;
};

// Provider组件
interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // 初始化语言设置
  useEffect(() => {
    const initializeLanguage = async () => {
      await loadTranslations();

      // 从localStorage读取保存的语言设置
      const savedLanguage = localStorage.getItem('app-language') as Language;
      if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'zh')) {
        setLanguageState(savedLanguage);
      } else {
        // 默认使用英文
        setLanguageState('en');
      }

      setIsLoaded(true);
    };

    initializeLanguage();
  }, []);

  // 在setLanguage函数中添加同步到后端的代码
  const setLanguage = (newLanguage: Language) => {
    if (newLanguage !== language) {
      setLanguageState(newLanguage);
      localStorage.setItem('language', newLanguage);

      // 同步语言到后端
      invoke('sync_language', { language: newLanguage }).catch((err) =>
        console.error('Failed to sync language to backend:', err)
      );
    }
  };

  const tInner = (key: string, params?: Record<string, any>) => {
    if (!isLoaded) return key;
    return translate(language, key, params);
  };
  // 让全局 t 始终指向当前语言
  t = tInner;

  // 在语言资源加载完成前显示loading
  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t: tInner }}>
      {children}
    </I18nContext.Provider>
  );
};

// Hook
export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
