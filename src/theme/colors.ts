// Mindspace Design System — Color Tokens
// Sourced directly from Stitch "Breathable Sanctuary" design system

export const Colors = {
  // Primary
  primary: '#446c5e',
  primaryContainer: '#c0ecda',
  primaryDim: '#386052',
  primaryFixed: '#c0ecda',
  primaryFixedDim: '#b3decc',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#32594b',
  onPrimaryFixed: '#1e4639',
  onPrimaryFixedVariant: '#3c6355',
  inversePrimary: '#ccf8e5',

  // Secondary
  secondary: '#5b6287',
  secondaryContainer: '#dde1ff',
  secondaryDim: '#4f567a',
  secondaryFixed: '#dde1ff',
  secondaryFixedDim: '#cbd2fc',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#495073',
  onSecondaryFixed: '#363d5f',
  onSecondaryFixedVariant: '#525a7d',

  // Tertiary
  tertiary: '#4c687b',
  tertiaryContainer: '#c9e6fd',
  tertiaryDim: '#405c6e',
  tertiaryFixed: '#c9e6fd',
  tertiaryFixedDim: '#bbd8ee',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#395567',
  onTertiaryFixed: '#264254',
  onTertiaryFixedVariant: '#435f71',

  // Surface
  surface: '#fffbff',
  surfaceBright: '#fffbff',
  surfaceContainer: '#f8f4e5',
  surfaceContainerHigh: '#f2eedf',
  surfaceContainerHighest: '#ece8d7',
  surfaceContainerLow: '#fdf9ed',
  surfaceContainerLowest: '#ffffff',
  surfaceDim: '#e6e3d2',
  surfaceTint: '#446c5e',
  surfaceVariant: '#ece8d7',
  onSurface: '#39382d',
  onSurfaceVariant: '#666557',
  inverseSurface: '#0f0e09',
  inverseOnSurface: '#9f9d94',

  // Error
  error: '#af3d3b',
  errorContainer: '#fa746f',
  errorDim: '#67040d',
  onError: '#ffffff',
  onErrorContainer: '#6e0a12',

  // Outline
  outline: '#838173',
  outlineVariant: '#bcbaaa',

  // Background
  background: '#fffbff',
  onBackground: '#39382d',

  // Gradient
  gradientStart: '#c0ecda',
  gradientEnd: '#446c5e',
};

export type ColorKey = keyof typeof Colors;
