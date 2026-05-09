import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
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
import { registerPushTokenForUser, unregisterPushTokenForUser } from './src/services/pushTokenRegistry';
import { initializeMobileAds } from './src/services/ads/rewardedStreakAds';
import { configureFontScaling } from './src/theme/fontScaling';
import { Colors } from './src/theme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WelcomeGreetingModal } from './src/components/WelcomeGreetingModal';
import { getProfileDisplayName } from './src/types/profile';

configureFontScaling();

const NEW_ACCOUNT_GREETING_WINDOW_MS = 48 * 60 * 60 * 1000;
const WELCOME_BACK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type GreetingState = {
  kind: 'new' | 'returning';
  displayName: string;
};

const timestampToMillis = (value: any) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

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
  const profile = useAuthStore((s) => s.profile);
  const [greeting, setGreeting] = useState<GreetingState | null>(null);
  const handledGreetingUserRef = useRef<string | null>(null);

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
    initializeMobileAds().catch((e: any) => console.warn('AdMob init failed:', e?.message || e));
    return unsubscribe;
  }, []);

  useEffect(() => {
    useThemeStore.getState().loadSettings(user?.uid || null);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    // Firestore rules require an authenticated user for this seed step.
    initializeCommunities().catch((e: any) => console.warn('Communities init failed:', e));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    setupStreakNotifications().catch(console.warn);

    if (notificationsEnabled) {
      registerPushTokenForUser(user.uid).catch(console.warn);
    } else {
      unregisterPushTokenForUser(user.uid).catch(console.warn);
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

  useEffect(() => {
    if (!user?.uid) {
      handledGreetingUserRef.current = null;
      setGreeting(null);
      return;
    }
    if (!profile?.uid || profile.uid !== user.uid) return;
    if (handledGreetingUserRef.current === user.uid) return;

    handledGreetingUserRef.current = user.uid;

    const now = Date.now();
    const authCreatedAt = user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : 0;
    const createdAt = timestampToMillis(profile.createdAt) || (Number.isNaN(authCreatedAt) ? 0 : authCreatedAt);
    const lastAppOpenAt = timestampToMillis(profile.lastAppOpenAt);
    const welcomeSeenAt = timestampToMillis(profile.welcomeGreetingSeenAt);
    const isNewAccount = !welcomeSeenAt && createdAt > 0 && now - createdAt <= NEW_ACCOUNT_GREETING_WINDOW_MS;
    const isReturningAfterBreak = !isNewAccount && lastAppOpenAt > 0 && now - lastAppOpenAt >= WELCOME_BACK_WINDOW_MS;

    if (isNewAccount || isReturningAfterBreak) {
      setGreeting({
        kind: isNewAccount ? 'new' : 'returning',
        displayName: getProfileDisplayName(profile, user.displayName || 'there'),
      });
    }

    saveUserProfile(user.uid, {
      lastAppOpenAt: now,
      ...(isNewAccount ? { welcomeGreetingSeenAt: now } : {}),
    }).catch((error) => console.warn('Could not update greeting status:', error));
  }, [
    profile?.createdAt,
    profile?.lastAppOpenAt,
    profile?.uid,
    profile?.welcomeGreetingSeenAt,
    user?.displayName,
    user?.metadata.creationTime,
    user?.uid,
  ]);

  if (!fontsLoaded) {
    return <View style={styles.splash} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <AppNavigator />
      <WelcomeGreetingModal
        visible={!!greeting}
        kind={greeting?.kind || 'new'}
        displayName={greeting?.displayName || 'there'}
        onClose={() => setGreeting(null)}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
  },
});
