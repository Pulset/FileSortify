import { useI18n } from '../contexts/I18nContext';
import type { Language, TranslationFunction } from '../contexts/I18nContext';

// Return type for useTranslation hook
export interface UseTranslationReturn {
    t: TranslationFunction;
    language: Language;
    setLanguage: (lang: Language) => void;
    isLoading: boolean;
}

/**
 * Custom hook for accessing translation functionality
 * This is a convenience wrapper around useI18n context
 */
export function useTranslation(): UseTranslationReturn {
    const { t, language, setLanguage, isLoading } = useI18n();

    return {
        t,
        language,
        setLanguage,
        isLoading
    };
}

export default useTranslation;