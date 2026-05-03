import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';
import { DEFAULT_LANGUAGE, LanguageCode, normalizeLanguage } from '../i18n';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  lowStimulation: boolean;
  notificationsEnabled: boolean;
  dailyReminder: boolean;
  emailNotifications: boolean;
  language: LanguageCode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setLowStimulation: (value: boolean) => void;
  setNotificationsEnabled: (value: boolean) => void;
  setDailyReminder: (value: boolean) => void;
  setEmailNotifications: (value: boolean) => void;
  setLanguage: (lang: string) => void;
  syncSettingsToCloud: () => Promise<void>;
  loadSettings: (userId?: string | null) => Promise<void>;
}

const STORAGE_KEY = 'mindspace_settings';
const CLOUD_SETTINGS_PATH = 'preferences';

type PersistedSettings = Pick<
  ThemeState,
  'mode' | 'lowStimulation' | 'notificationsEnabled' | 'dailyReminder' | 'emailNotifications' | 'language'
>;

const DEFAULT_SETTINGS: PersistedSettings = {
  mode: 'light',
  lowStimulation: false,
  notificationsEnabled: true,
  dailyReminder: true,
  emailNotifications: true,
  language: DEFAULT_LANGUAGE,
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...DEFAULT_SETTINGS,

  setMode: (mode) => {
    set({ mode });
    persistAndSync({ ...get(), mode });
  },
  toggleMode: () => {
    const newMode = get().mode === 'light' ? 'dark' : 'light';
    set({ mode: newMode });
    persistAndSync({ ...get(), mode: newMode });
  },
  setLowStimulation: (lowStimulation) => {
    set({ lowStimulation });
    persistAndSync({ ...get(), lowStimulation });
  },
  setNotificationsEnabled: (notificationsEnabled) => {
    set({ notificationsEnabled });
    persistAndSync({ ...get(), notificationsEnabled });
  },
  setDailyReminder: (dailyReminder) => {
    set({ dailyReminder });
    persistAndSync({ ...get(), dailyReminder });
  },
  setEmailNotifications: (emailNotifications) => {
    set({ emailNotifications });
    persistAndSync({ ...get(), emailNotifications });
  },
  setLanguage: (language) => {
    const normalizedLanguage = normalizeLanguage(language);
    set({ language: normalizedLanguage });
    persistAndSync({ ...get(), language: normalizedLanguage });
  },
  syncSettingsToCloud: async () => {
    await syncSettingsToCloud(get());
  },
  loadSettings: async (userId) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = normalizeSettings(JSON.parse(raw));
        set(data);
      }

      const uid = userId || auth.currentUser?.uid;
      if (!uid) return;

      const cloudSnap = await getDoc(doc(db, 'users', uid, 'settings', CLOUD_SETTINGS_PATH));
      if (cloudSnap.exists()) {
        const cloudSettings = normalizeSettings(cloudSnap.data());
        set(cloudSettings);
        await persistSettings(cloudSettings);
        return;
      }

      await syncSettingsToCloud(get());
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  },
}));

function normalizeSettings(data: Partial<PersistedSettings> | Record<string, any>): PersistedSettings {
  return {
    mode: data.mode === 'dark' ? 'dark' : 'light',
    lowStimulation: Boolean(data.lowStimulation),
    notificationsEnabled: data.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
    dailyReminder: data.dailyReminder ?? DEFAULT_SETTINGS.dailyReminder,
    emailNotifications: data.emailNotifications ?? DEFAULT_SETTINGS.emailNotifications,
    language: normalizeLanguage(data.language),
  };
}

function getPersistableSettings(state: Partial<ThemeState>): PersistedSettings {
  return normalizeSettings(state);
}

async function persistSettings(state: Partial<ThemeState>) {
  const data = {
    mode: state.mode,
    lowStimulation: state.lowStimulation,
    notificationsEnabled: state.notificationsEnabled,
    dailyReminder: state.dailyReminder,
    emailNotifications: state.emailNotifications,
    language: state.language,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function persistAndSync(state: Partial<ThemeState>) {
  const settings = getPersistableSettings(state);
  persistSettings(settings).catch(console.warn);
  syncSettingsToCloud(settings).catch(console.warn);
}

async function syncSettingsToCloud(state: Partial<ThemeState>) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const settings = getPersistableSettings(state);
  await setDoc(doc(db, 'users', uid, 'settings', CLOUD_SETTINGS_PATH), {
    ...settings,
    updatedAt: Date.now(),
  }, { merge: true });

  await setDoc(doc(db, 'users', uid), {
    notificationSettings: {
      notificationsEnabled: settings.notificationsEnabled,
      dailyReminder: settings.dailyReminder,
      emailNotifications: settings.emailNotifications,
    },
    appSettings: settings,
    updatedAt: Date.now(),
  }, { merge: true });
}
