import { Colors as LightColors } from './colors';
import { DarkColors } from './darkColors';
import { useThemeStore } from '../store/themeStore';

export type ThemeColors = typeof LightColors;

const lowStimulationColors = (colors: ThemeColors): ThemeColors => ({
  ...colors,
  primaryContainer: colors.surfaceContainerHigh,
  secondaryContainer: colors.surfaceContainerHigh,
  tertiaryContainer: colors.surfaceContainerHigh,
  errorContainer: colors.surfaceContainerHigh,
  surfaceContainerHighest: colors.surfaceContainerHigh,
  gradientStart: colors.surfaceContainerLow,
  gradientEnd: colors.surfaceContainerHigh,
});

export function getColors(): ThemeColors {
  const { mode, lowStimulation } = useThemeStore.getState();
  const colors = mode === 'dark' ? (DarkColors as unknown as ThemeColors) : LightColors;
  return lowStimulation ? lowStimulationColors(colors) : colors;
}

export function useColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  const lowStimulation = useThemeStore((s) => s.lowStimulation);
  const colors = mode === 'dark' ? (DarkColors as unknown as ThemeColors) : LightColors;
  return lowStimulation ? lowStimulationColors(colors) : colors;
}
