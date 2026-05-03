import ar from './translations/ar';
import bn from './translations/bn';
import de from './translations/de';
import es from './translations/es';
import fr from './translations/fr';
import hi from './translations/hi';
import ja from './translations/ja';
import pt from './translations/pt';
import zh from './translations/zh';
import type { TranslationDictionary } from './translations/types';

export type LanguageCode = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'pt' | 'ar' | 'bn' | 'ja' | 'zh';

export interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
}

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
];

const LANGUAGE_LOCALES: Record<LanguageCode, string> = {
  en: 'en-US',
  hi: 'hi-IN',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  pt: 'pt-BR',
  ar: 'ar',
  bn: 'bn-BD',
  ja: 'ja-JP',
  zh: 'zh-CN',
};

const translations: Partial<Record<LanguageCode, TranslationDictionary>> = {
  hi,
  es,
  fr,
  de,
  pt,
  ar,
  bn,
  ja,
  zh,
};

const languageAliases: Record<string, LanguageCode> = {
  english: 'en',
  hindi: 'hi',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  portuguese: 'pt',
  arabic: 'ar',
  bengali: 'bn',
  japanese: 'ja',
  chinese: 'zh',
};

export const normalizeLanguage = (value?: string | null): LanguageCode => {
  if (!value) return DEFAULT_LANGUAGE;
  const normalized = value.trim().toLowerCase();
  const byCode = LANGUAGE_OPTIONS.find((option) => option.code === normalized);
  if (byCode) return byCode.code;
  return languageAliases[normalized] || DEFAULT_LANGUAGE;
};

export const getLanguageLabel = (value?: string | null) => {
  const code = normalizeLanguage(value);
  const option = LANGUAGE_OPTIONS.find((item) => item.code === code);
  return option ? `${option.nativeName} (${option.name})` : 'English';
};

export const getLanguageLocale = (value?: string | null) =>
  LANGUAGE_LOCALES[normalizeLanguage(value)];

export const translateText = (value: string, languageValue?: string | null): string => {
  const language = normalizeLanguage(languageValue);
  if (language === DEFAULT_LANGUAGE || !value.trim()) return value;

  const leading = value.match(/^\s*/)?.[0] || '';
  const trailing = value.match(/\s*$/)?.[0] || '';
  const core = value.trim();
  const translated = translations[language]?.[core];

  return translated ? `${leading}${translated}${trailing}` : value;
};

export const translateIfNeeded = (
  value: string | undefined,
  languageValue?: string | null
) => (value ? translateText(value, languageValue) : value);
