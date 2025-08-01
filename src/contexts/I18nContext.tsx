import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';

// Import translation files directly
import zhTranslations from '../locales/zh.json';
import enTranslations from '../locales/en.json';

// Supported languages
export type Language = 'zh' | 'en';

// Translation function type
export type TranslationFunction = (
  key: string,
  params?: Record<string, string>
) => string;

// Context interface
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationFunction;
  isLoading: boolean;
}

// Create context
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Translation storage
let translations: Record<Language, Record<string, any>> = {
  zh: {},
  en: {},
};

// Helper function to get nested value from object using dot notation
function getNestedValue(obj: any, path: string): string | undefined {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

// Helper function to interpolate parameters in translation strings
function interpolateParams(
  text: string,
  params?: Record<string, string>
): string {
  if (!params) return text;

  return Object.entries(params).reduce((result, [key, value]) => {
    return result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }, text);
}

// Load translation file
async function loadTranslation(
  language: Language
): Promise<Record<string, any>> {
  try {
    switch (language) {
      case 'zh':
        return zhTranslations;
      case 'en':
        return enTranslations;
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  } catch (error) {
    console.error(`Error loading ${language} translations:`, error?.message);
    // Return empty object as fallback
    return {};
  }
}

// Provider props
interface I18nProviderProps {
  children: ReactNode;
}

// I18n Provider component
export function I18nProvider({ children }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>('zh'); // Default to Chinese
  const [isLoading, setIsLoading] = useState(true);

  // Load translations for a specific language
  const loadLanguageTranslations = async (lang: Language) => {
    setIsLoading(true);
    try {
      const translationData = await loadTranslation(lang);
      translations[lang] = translationData;
    } catch (error) {
      console.error(`Failed to load translations for ${lang}:`, error?.message);
      // Keep existing translations or empty object
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize translations and load saved language preference
  useEffect(() => {
    const initializeI18n = async () => {
      // Load saved language preference from localStorage
      const savedLanguage = localStorage.getItem(
        'fileSortify_language'
      ) as Language;
      const initialLanguage =
        savedLanguage && ['zh', 'en'].includes(savedLanguage)
          ? savedLanguage
          : 'zh';

      // Load translations for both languages (for fallback)
      await Promise.all([
        loadLanguageTranslations('zh'), // Always load Chinese as fallback
        initialLanguage !== 'zh'
          ? loadLanguageTranslations(initialLanguage)
          : Promise.resolve(),
      ]);

      setLanguageState(initialLanguage);
      setIsLoading(false);
    };

    initializeI18n();
  }, []);

  // Set language with persistence
  const setLanguage = async (lang: Language) => {
    if (lang === language) return;

    setIsLoading(true);

    try {
      // Load translations for the new language if not already loaded
      if (!translations[lang] || Object.keys(translations[lang]).length === 0) {
        await loadLanguageTranslations(lang);
      }

      // Update state and persist to localStorage
      setLanguageState(lang);
      localStorage.setItem('fileSortify_language', lang);
    } catch (error) {
      console.error(`Failed to switch to language ${lang}:`, error?.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Translation function
  const t: TranslationFunction = (
    key: string,
    params?: Record<string, string>
  ) => {
    // Get translation from current language
    let translation = getNestedValue(translations[language], key);

    // Fallback to Chinese if translation not found and current language is not Chinese
    if (translation === undefined && language !== 'zh') {
      translation = getNestedValue(translations.zh, key);
    }

    // Final fallback: return the key itself
    if (translation === undefined) {
      console.warn(`Translation missing for key: ${key}`);
      return key;
    }

    // Handle parameter interpolation
    return interpolateParams(translation, params);
  };

  const contextValue: I18nContextType = {
    language,
    setLanguage,
    t,
    isLoading,
  };

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
}

// Custom hook to use I18n context
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
