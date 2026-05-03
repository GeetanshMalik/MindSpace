import { Platform } from 'react-native';

const APP_SCHEME = 'mindspace';

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

const getConfiguredBaseUrl = () => {
  const env = (globalThis as any)?.process?.env;
  return typeof env?.EXPO_PUBLIC_APP_URL === 'string' ? env.EXPO_PUBLIC_APP_URL.trim() : '';
};

export const getPostShareUrl = (postId: string) => {
  const path = `post/${encodeURIComponent(postId)}`;
  const configuredBaseUrl = getConfiguredBaseUrl();

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/+$/g, '')}/${path}`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/${path}`;
  }

  return `${APP_SCHEME}://${path}`;
};
