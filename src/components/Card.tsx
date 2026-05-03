import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Radius, Shadow, Spacing } from '../theme';
import { useColors } from '../theme/useColors';
import { useThemeStore } from '../store/themeStore';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'container';
}

export const Card: React.FC<CardProps> = ({ children, style, variant = 'default' }) => {
  const C = useColors();
  const lowStimulation = useThemeStore((state) => state.lowStimulation);
  const bgMap = {
    default: C.surfaceContainerLow,
    elevated: C.surfaceContainerLowest,
    container: C.surfaceContainer,
  };
  return (
    <View style={[styles.base, variant === 'elevated' && !lowStimulation && Shadow.ambient, { backgroundColor: bgMap[variant] }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing[5],
  },
});
