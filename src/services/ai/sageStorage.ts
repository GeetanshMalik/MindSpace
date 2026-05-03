export const LEGACY_SAGE_CHAT_STORAGE_KEY = 'sage_chat_history';

export const getSageChatStorageKey = (userId?: string | null) =>
  `${LEGACY_SAGE_CHAT_STORAGE_KEY}:${userId || 'guest'}`;
