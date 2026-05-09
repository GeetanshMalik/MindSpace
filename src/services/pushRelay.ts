import Constants from 'expo-constants';
import { auth } from './firebase/config';

type PushRelayExtra = {
  pushRelayUrl?: string;
};

const normalizeBaseUrl = (value?: string | null) => (value || '').trim().replace(/\/+$/, '');

export const getPushRelayUrl = () => {
  const extra = Constants.expoConfig?.extra as PushRelayExtra | undefined;
  return normalizeBaseUrl(extra?.pushRelayUrl || process.env.EXPO_PUBLIC_PUSH_RELAY_URL || '');
};

export const isPushRelayConfigured = () => getPushRelayUrl().length > 0;

const getFunctionUrl = (functionName: string) => {
  const base = getPushRelayUrl();
  if (!base) return '';
  const path = functionName.replace(/^\/+/, '');
  return base.includes('/.netlify/functions')
    ? `${base}/${path}`
    : `${base}/.netlify/functions/${path}`;
};

export const callPushRelay = async <T = any>(functionName: string, body: Record<string, any>): Promise<T> => {
  const user = auth.currentUser;
  const url = getFunctionUrl(functionName);
  if (!user || !url) throw new Error('Push relay is not configured');

  const idToken = await user.getIdToken();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(json?.error || `Push relay request failed (${response.status})`);
  }
  return json as T;
};

export const sendNotificationThroughRelay = (
  targetUserId: string,
  notification: Record<string, any>
) => callPushRelay('send-notification', { targetUserId, notification });

export const registerPushTokenThroughRelay = (token: string) =>
  callPushRelay('register-push-token', { token });

export const unregisterPushTokenThroughRelay = (token: string) =>
  callPushRelay('unregister-push-token', { token });

