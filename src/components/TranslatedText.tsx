import React from 'react';
import { Text as RNText, TextProps } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { translateText } from '../i18n';

type TranslatedTextProps = TextProps & {
  translate?: boolean;
};

const translateChildren = (children: React.ReactNode, language: string): React.ReactNode => {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return translateText(child, language);
    return child;
  });
};

export const Text: React.FC<TranslatedTextProps> = ({
  children,
  translate = true,
  ...props
}) => {
  const language = useThemeStore((state) => state.language);

  return (
    <RNText {...props}>
      {translate ? translateChildren(children, language) : children}
    </RNText>
  );
};
