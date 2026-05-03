import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { Text } from './TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Radius, Spacing, Typography } from '../theme';
import { useColors } from '../theme/useColors';
import { translateText } from '../i18n';
import { useThemeStore } from '../store/themeStore';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const C = useColors();
  const language = useThemeStore((state) => state.language);
  const lowStimulation = useThemeStore((state) => state.lowStimulation);
  const translatedTitle = translateText(title, language);

  if (variant === 'primary') {
    if (lowStimulation) {
      return (
        <TouchableOpacity
          onPress={onPress}
          disabled={disabled || loading}
          activeOpacity={0.85}
          style={[styles.base, styles.lowStimPrimary, { backgroundColor: C.primary }, style]}
        >
          {loading ? (
            <ActivityIndicator color={C.onPrimary} />
          ) : (
            <Text style={[styles.primaryText, { color: C.onPrimary }, textStyle]}>{translatedTitle}</Text>
          )}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[styles.base, style]}
      >
        <LinearGradient
          colors={[C.gradientStart, C.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={C.onPrimary} />
          ) : (
            <Text style={[styles.primaryText, { color: C.onPrimary }, textStyle]}>{translatedTitle}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        style={[styles.base, styles.secondary, { backgroundColor: C.secondaryContainer }, style]}
      >
        {loading ? (
          <ActivityIndicator color={C.onSecondaryContainer} />
        ) : (
          <Text style={[styles.secondaryText, { color: C.onSecondaryContainer }, textStyle]}>{translatedTitle}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[styles.base, styles.ghost, style]}
    >
      <Text style={[styles.ghostText, { color: C.primary }, textStyle]}>{translatedTitle}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.full,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    width: '100%',
    height: '100%',
    paddingHorizontal: Spacing[6],
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
  },
  lowStimPrimary: {
    paddingHorizontal: Spacing[6],
  },
  primaryText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: 0.2,
  },
  secondary: {
    paddingHorizontal: Spacing[6],
  },
  secondaryText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
  },
  ghost: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing[6],
  },
  ghostText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.lg,
  },
});
