import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { initAuthListener, useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { initDatabase } from './src/services/database/sqlite';
import { initializeCommunities, saveUserProfile } from './src/services/firebase/firestore';
import { setupStreakNotifications, useStreakStore } from './src/store/streakStore';
import { registerForPushNotificationsAsync } from './src/services/pushNotifications';
import { Colors } from './src/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const themeMode = useThemeStore((s) => s.mode);
  const notificationsEnabled = useThemeStore((s) => s.notificationsEnabled);
  const dailyReminder = useThemeStore((s) => s.dailyReminder);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    try {
      // Initialize local SQLite database
      initDatabase();
    } catch (e) {
      console.warn('SQLite init failed:', e);
    }
    // Subscribe to Firebase auth state changes
    const unsubscribe = initAuthListener();
    // Load persisted theme settings
    useThemeStore.getState().loadSettings();
    // Initialize default communities in Firestore (no-op if already exist)
    initializeCommunities().catch((e: any) => console.warn('Communities init failed:', e));
    return unsubscribe;
  }, []);

  useEffect(() => {
    useThemeStore.getState().loadSettings(user?.uid || null);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    setupStreakNotifications().catch(console.warn);

    // Register for real push notifications
    if (notificationsEnabled) {
      registerForPushNotificationsAsync().then((token) => {
        if (token) {
          saveUserProfile(user.uid, { pushToken: token }).catch(console.warn);
        }
      });
    }
  }, [user?.uid, notificationsEnabled, dailyReminder]);

  useEffect(() => {
    const initStreak = async () => {
      if (!user?.uid) {
        await useStreakStore.getState().loadStreak(null);
        return;
      }
      await useStreakStore.getState().checkAndUpdateStreak(user.uid);
    };
    initStreak();
  }, [user?.uid]);

  if (!fontsLoaded) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
  },
});
