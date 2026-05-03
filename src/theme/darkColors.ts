// Mindspace Design System — Dark Mode Color Tokens
// Derived from the Breathable Sanctuary palette, inverted for dark mode

export const DarkColors = {
  // Primary
  primary: '#a4d4c1',
  primaryContainer: '#2a5043',
  primaryDim: '#8bc4ab',
  primaryFixed: '#c0ecda',
  primaryFixedDim: '#b3decc',
  onPrimary: '#1a3e32',
  onPrimaryContainer: '#c0ecda',
  onPrimaryFixed: '#1e4639',
  onPrimaryFixedVariant: '#3c6355',
  inversePrimary: '#446c5e',

  // Secondary
  secondary: '#c3c8f0',
  secondaryContainer: '#3e4565',
  secondaryDim: '#a9aee0',
  secondaryFixed: '#dde1ff',
  secondaryFixedDim: '#cbd2fc',
  onSecondary: '#2a3050',
  onSecondaryContainer: '#dde1ff',
  onSecondaryFixed: '#363d5f',
  onSecondaryFixedVariant: '#525a7d',

  // Tertiary
  tertiary: '#a9c9dc',
  tertiaryContainer: '#2e4d5e',
  tertiaryDim: '#91b8ce',
  tertiaryFixed: '#c9e6fd',
  tertiaryFixedDim: '#bbd8ee',
  onTertiary: '#1e3a4a',
  onTertiaryContainer: '#c9e6fd',
  onTertiaryFixed: '#264254',
  onTertiaryFixedVariant: '#435f71',

  // Surface
  surface: '#141412',
  surfaceBright: '#3a3a35',
  surfaceContainer: '#201f1b',
  surfaceContainerHigh: '#2a2a25',
  surfaceContainerHighest: '#353530',
  surfaceContainerLow: '#1b1b17',
  surfaceContainerLowest: '#0f0e0c',
  surfaceDim: '#141412',
  surfaceTint: '#a4d4c1',
  surfaceVariant: '#44453d',
  onSurface: '#e6e3d2',
  onSurfaceVariant: '#c6c5b5',
  inverseSurface: '#e6e3d2',
  inverseOnSurface: '#313126',

  // Error
  error: '#ffb4ab',
  errorContainer: '#93000a',
  errorDim: '#ff897d',
  onError: '#690005',
  onErrorContainer: '#ffdad6',

  // Outline
  outline: '#8e8d7e',
  outlineVariant: '#48483d',

  // Background
  background: '#141412',
  onBackground: '#e6e3d2',

  // Gradient
  gradientStart: '#2a5043',
  gradientEnd: '#a4d4c1',
};

export type DarkColorKey = keyof typeof DarkColors;
