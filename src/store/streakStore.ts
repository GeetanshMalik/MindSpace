import { create } from 'zustand';
import Constants from 'expo-constants';
import { getUserStreak, saveUserStreak, UserStreak } from '../services/firebase/firestore';
import { useThemeStore } from './themeStore';

export interface StreakState {
  userId: string | null;
  streak: number;
  lastOpened: number | null;
  lostStreak: number; 
  missedStreakDays: number;
  hasLostStreak: boolean;
  
  loadStreak: (userId?: string | null) => Promise<void>;
  checkAndUpdateStreak: (userId?: string | null) => Promise<void>;
  restoreStreak: (userId?: string | null) => Promise<void>;
}

const getStartOfDay = (timestamp: number) => {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const getNativeNotifications = () => {
  if (Constants.appOwnership === 'expo') return null;
  return require('expo-notifications');
};

export const cancelStreakNotifications = async () => {
  const Notifications = getNativeNotifications();
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
};

export const useStreakStore = create<StreakState>((set, get) => ({
  userId: null,
  streak: 0,
  lastOpened: null,
  lostStreak: 0,
  missedStreakDays: 0,
  hasLostStreak: false,

  loadStreak: async (userId) => {
    try {
      if (userId) {
        const data = await getUserStreak(userId);
        set({ userId, ...data });
      } else {
        set({ userId: null, streak: 0, lastOpened: null, lostStreak: 0, missedStreakDays: 0, hasLostStreak: false });
      }
    } catch(e) {}
  },

  checkAndUpdateStreak: async (userIdParam) => {
    const userId = userIdParam || get().userId;
    if (!userId) return;

    await get().loadStreak(userId);
    const now = Date.now();
    const { streak, lastOpened } = get();
    
    const todayBegin = getStartOfDay(now);
    
    let newStreak = streak;
    let newLostStreak = get().lostStreak;
    let newMissedStreakDays = get().missedStreakDays;
    let newHasLostStreak = get().hasLostStreak;

    if (!lastOpened) {
      newStreak = 1;
      newLostStreak = 0;
      newMissedStreakDays = 0;
      newHasLostStreak = false;
    } else {
      const lastOpenedBegin = getStartOfDay(lastOpened);
      const diffDays = Math.round((todayBegin - lastOpenedBegin) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        // Opened next day -> increment streak
        newStreak += 1;
        newLostStreak = 0;
        newMissedStreakDays = 0;
        newHasLostStreak = false;
      } else if (diffDays > 1) {
        // Missed one or more days
        if (streak > 0) {
          newLostStreak = streak;
          newMissedStreakDays = Math.max(1, diffDays - 1);
          newHasLostStreak = true;
        }
        newStreak = 1; // Current open starts a new streak
      }
    }

    const nextState: UserStreak = {
      streak: newStreak,
      lastOpened: now,
      lostStreak: newLostStreak,
      missedStreakDays: newMissedStreakDays,
      hasLostStreak: newHasLostStreak,
    };
    
    set({ userId, ...nextState });
    await saveUserStreak(userId, nextState);
    
    // Reschedule absence notifications
    await setupStreakNotifications();
  },

  restoreStreak: async (userIdParam) => {
    const userId = userIdParam || get().userId;
    if (!userId) return;

    const { lostStreak, missedStreakDays } = get();
    const restoredDays = Math.max(1, missedStreakDays || 0);
    const nextState: UserStreak = {
      streak: lostStreak + restoredDays + 1, // Previous streak + restored missed days + today
      lastOpened: Date.now(),
      hasLostStreak: false,
      lostStreak: 0,
      missedStreakDays: 0,
    };
    set({ userId, ...nextState });
    await saveUserStreak(userId, nextState);
  }
}));

// Setup notifications 12h, 18h, 23h from NOW
export const setupStreakNotifications = async () => {
  try {
    const { notificationsEnabled, dailyReminder } = useThemeStore.getState();
    if (!notificationsEnabled || !dailyReminder) {
      await cancelStreakNotifications();
      return;
    }

    const Notifications = getNativeNotifications();
    if (!Notifications) return;

    // Cancel all existing
    await Notifications.cancelAllScheduledNotificationsAsync();
    
    // Request permission
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    const messages = [
      { hours: 12, title: "Keep it up!", body: "Take a mindful moment to continue your streak today. 🧘" },
      { hours: 18, title: "Your streak is calling", body: "Don't forget your daily reflection! Open Mindspace to keep your streak." },
      { hours: 23, title: "🚨 1 hour left!", body: "Your streak is about to reset! Open the app now to save it." },
    ];

    for (const msg of messages) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: msg.title,
          body: msg.body,
          sound: true,
        },
        trigger: {
          // TimeInterval trigger
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: msg.hours * 60 * 60,
        },
      });
    }
  } catch (e) {
    console.warn("Failed to setup notifications", e);
  }
};
