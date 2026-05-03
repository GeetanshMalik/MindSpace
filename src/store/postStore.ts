import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FeedTab, Post } from '../services/firebase/firestore';

const SAVED_KEY = 'mindspace_saved_posts';

type FeedCacheEntry = {
  posts: Post[];
  updatedAt: number;
};

interface PostStoreState {
  savedPostIds: string[];
  feedCache: Record<string, FeedCacheEntry>;
  toggleSave: (postId: string) => void;
  isSaved: (postId: string) => boolean;
  loadSaved: () => Promise<void>;
  getFeedCache: (key: string) => FeedCacheEntry | null;
  setFeedCache: (key: string, posts: Post[]) => void;
}

export const getFeedCacheKey = (
  mode: FeedTab,
  category = 'All',
  userId?: string | null
) => `${userId || 'guest'}:${mode}:${category || 'All'}`;

export const usePostStore = create<PostStoreState>((set, get) => ({
  savedPostIds: [],
  feedCache: {},

  toggleSave: (postId: string) => {
    const current = get().savedPostIds;
    const next = current.includes(postId)
      ? current.filter(id => id !== postId)
      : [...current, postId];
    set({ savedPostIds: next });
    AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next)).catch(console.warn);
  },

  isSaved: (postId: string) => get().savedPostIds.includes(postId),

  loadSaved: async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_KEY);
      if (raw) set({ savedPostIds: JSON.parse(raw) });
    } catch (e) {
      console.warn('Failed to load saved posts:', e);
    }
  },

  getFeedCache: (key) => get().feedCache[key] || null,

  setFeedCache: (key, posts) => {
    set((state) => ({
      feedCache: {
        ...state.feedCache,
        [key]: { posts, updatedAt: Date.now() },
      },
    }));
  },
}));
