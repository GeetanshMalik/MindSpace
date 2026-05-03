import { useMemo } from 'react';
import { useThemeStore } from '../store/themeStore';
import { getLanguageLocale, translateText } from '.';

export const useTranslation = () => {
  const language = useThemeStore((state) => state.language);

  return useMemo(
    () => ({
      language,
      locale: getLanguageLocale(language),
      t: (value: string) => translateText(value, language),
    }),
    [language]
  );
};
