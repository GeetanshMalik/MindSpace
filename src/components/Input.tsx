import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps, ViewStyle } from 'react-native';
import { Text } from './TranslatedText';
import { Radius, Spacing, Typography } from '../theme';
import { useColors } from '../theme/useColors';
import { translateIfNeeded } from '../i18n';
import { useThemeStore } from '../store/themeStore';
import { cappedFontScalingProps } from '../theme/fontScaling';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  style,
  ...props
}) => {
  const C = useColors();
  const language = useThemeStore((state) => state.language);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={[styles.label, { color: C.onSurfaceVariant }]}>{label}</Text>}
      <TextInput
        {...props}
        {...cappedFontScalingProps}
        placeholder={translateIfNeeded(props.placeholder, language)}
        style={[
          styles.input,
          { backgroundColor: `${C.surfaceContainerHighest}80`, color: C.onSurface },
          focused && { borderColor: `${C.primary}66` },
          error && { borderColor: `${C.error}66` },
          style,
        ]}
        placeholderTextColor={C.onSurfaceVariant}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error && <Text style={[styles.error, { color: C.error }]}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing[2],
  },
  label: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  input: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[4],
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  error: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    paddingHorizontal: Spacing[2],
  },
});
