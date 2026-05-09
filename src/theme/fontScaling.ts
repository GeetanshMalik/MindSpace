import { Text as RNText, TextInput } from 'react-native';

export const MAX_FONT_SIZE_MULTIPLIER = 1.2;

export const cappedFontScalingProps = {
  maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
};

let configured = false;

export const configureFontScaling = () => {
  if (configured) return;
  configured = true;

  const textComponent = RNText as typeof RNText & { defaultProps?: Record<string, unknown> };
  const inputComponent = TextInput as typeof TextInput & { defaultProps?: Record<string, unknown> };

  textComponent.defaultProps = {
    ...(textComponent.defaultProps || {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
  };

  inputComponent.defaultProps = {
    ...(inputComponent.defaultProps || {}),
    allowFontScaling: true,
    maxFontSizeMultiplier: MAX_FONT_SIZE_MULTIPLIER,
  };
};
