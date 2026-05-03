import React, { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert, Modal, TextInput, ActivityIndicator, Linking, Platform } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useThemeStore } from '../../store/themeStore';
import { auth } from '../../services/firebase/config';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';

import { cancelStreakNotifications, setupStreakNotifications } from '../../store/streakStore';
import { getLanguageLabel, LANGUAGE_OPTIONS, translateText } from '../../i18n';

// ─── Setting Row Component ───────────────────────────────────────────
interface SettingRowProps {
  icon: string;
  label: string;
  value?: boolean;
  onToggle?: (v: boolean) => void;
  onPress?: () => void;
  showArrow?: boolean;
  sublabel?: string;
  iconColor?: string;
  iconBg?: string;
  danger?: boolean;
}

const SettingRow: React.FC<SettingRowProps & { colors: any }> = ({
  icon, label, value, onToggle, onPress, showArrow, sublabel, iconColor, iconBg, danger, colors,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={onPress ? 0.65 : 1}
    style={styles.settingRow}
  >
    <View style={[styles.settingIcon, { backgroundColor: iconBg || colors.primaryContainer }]}>
      <Ionicons name={icon as any} size={20} color={iconColor || colors.primary} />
    </View>
    <View style={styles.settingLabel}>
      <Text style={[styles.settingText, { color: danger ? colors.error : colors.onSurface }]}>
        {label}
      </Text>
      {sublabel && (
        <Text style={[styles.settingSub, { color: colors.onSurfaceVariant }]}>{sublabel}</Text>
      )}
    </View>
    {onToggle !== undefined && (
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.outlineVariant, true: colors.primaryContainer }}
        thumbColor={value ? colors.primary : colors.surfaceContainerHighest}
      />
    )}
    {showArrow && <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant} />}
  </TouchableOpacity>
);

// ─── Main Settings Screen ────────────────────────────────────────────
export const SettingsScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const {
    mode, lowStimulation, notificationsEnabled, dailyReminder, emailNotifications, language,
    setMode, setLowStimulation, setNotificationsEnabled, setDailyReminder, setEmailNotifications, setLanguage,
  } = useThemeStore();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const isDark = mode === 'dark';
  const languageLabel = useMemo(() => getLanguageLabel(language), [language]);
  const t = useCallback((value: string) => translateText(value, language), [language]);

  const handleNotificationsToggle = useCallback(async (value: boolean) => {
    setNotificationsEnabled(value);
    if (!value) {
      await cancelStreakNotifications().catch(() => {});
      return;
    }
    await setupStreakNotifications();
  }, [setNotificationsEnabled]);

  const handleDailyReminderToggle = useCallback(async (value: boolean) => {
    setDailyReminder(value);
    if (!value) {
      await cancelStreakNotifications().catch(() => {});
      return;
    }
    if (notificationsEnabled) await setupStreakNotifications();
  }, [notificationsEnabled, setDailyReminder]);

  const closePasswordModal = useCallback(() => {
    if (passwordSaving) return;
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [passwordSaving]);

  const handlePasswordUpdate = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      Alert.alert(t('Change Password'), 'Please sign in again before changing your password.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('Change Password'), 'Please fill in all password fields.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert(t('Change Password'), t('At least 6 characters'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('Change Password'), 'New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);
      closePasswordModal();
      Alert.alert(t('Change Password'), 'Your password was updated successfully.');
    } catch (error: any) {
      const message = error?.code === 'auth/wrong-password' || error?.code === 'auth/invalid-credential'
        ? 'Current password is incorrect.'
        : error?.message || 'Could not update password. Please try again.';
      Alert.alert(t('Change Password'), message);
    } finally {
      setPasswordSaving(false);
    }
  }, [closePasswordModal, confirmPassword, currentPassword, newPassword, t]);

  const handleProfileVisibility = useCallback(() => {
    Alert.alert(t('Profile Visibility'), t('This functionality is coming soon.'));
  }, [t]);

  const handleRateMindspace = useCallback(async () => {
    const androidPackage = 'com.mindspace.app';
    const playStoreUrl = `https://play.google.com/store/apps/details?id=${androidPackage}`;
    const nativeStoreUrl = `market://details?id=${androidPackage}`;

    try {
      if (Platform.OS === 'android') {
        await Linking.openURL(nativeStoreUrl);
        return;
      }
      await Linking.openURL(playStoreUrl);
    } catch {
      try {
        await Linking.openURL(playStoreUrl);
      } catch {
        Alert.alert(t('Rate Mindspace'), t('Rating will open here once Mindspace is live on the Play Store.'));
      }
    }
  }, [t]);

  const handleLogout = useCallback(() => {
    Alert.alert(
      t('Sign Out'),
      t('Are you sure you want to sign out of Mindspace?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Sign Out'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (e) {
              console.warn('Logout error:', e);
            }
          },
        },
      ],
    );
  }, [t]);



  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      t('Delete Account'),
      t('This will permanently delete your account and all associated data. This action cannot be undone.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete Account'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(t('Account Deletion'), t('Please contact support@mindspace.app to complete account deletion.'));
          },
        },
      ],
    );
  }, [t]);

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={[styles.backCircle, { backgroundColor: C.surfaceContainerHigh }]}>
            <Ionicons name="chevron-back" size={22} color={C.onSurface} />
          </View>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, { color: C.onSurface }]}>Settings</Text>
          <Text style={[styles.subtitle, { color: C.onSurfaceVariant }]}>
            Customize your Mindspace experience
          </Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── App Theme ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>APP THEME</Text>
        <View style={[styles.themeCard, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <View style={styles.themeRow}>
            {/* Light */}
            <TouchableOpacity
              style={[
                styles.themeOption,
                {
                  backgroundColor: !isDark ? C.primaryContainer : C.surfaceContainerHigh,
                  borderWidth: !isDark ? 2 : 0,
                  borderColor: !isDark ? C.primary : 'transparent',
                },
              ]}
              onPress={() => setMode('light')}
              activeOpacity={0.8}
            >
              <View style={[styles.themePreview, { backgroundColor: '#fffbff' }]}>
                <View style={[styles.themePreviewDot, { backgroundColor: '#c0ecda' }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: '#f2eedf', width: '70%' }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: '#ece8d7', width: '50%' }]} />
              </View>
              <View style={styles.themeOptionInfo}>
                <Ionicons name="sunny" size={18} color={!isDark ? C.primary : C.onSurfaceVariant} />
                <Text style={[styles.themeOptionLabel, { color: !isDark ? C.primary : C.onSurfaceVariant }]}>
                  Light
                </Text>
              </View>
              {!isDark && (
                <View style={[styles.themeCheck, { backgroundColor: C.primary }]}>
                  <Ionicons name="checkmark" size={12} color={C.onPrimary} />
                </View>
              )}
            </TouchableOpacity>

            {/* Dark */}
            <TouchableOpacity
              style={[
                styles.themeOption,
                {
                  backgroundColor: isDark ? C.primaryContainer : C.surfaceContainerHigh,
                  borderWidth: isDark ? 2 : 0,
                  borderColor: isDark ? C.primary : 'transparent',
                },
              ]}
              onPress={() => setMode('dark')}
              activeOpacity={0.8}
            >
              <View style={[styles.themePreview, { backgroundColor: '#141412' }]}>
                <View style={[styles.themePreviewDot, { backgroundColor: '#2a5043' }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: '#2a2a25', width: '70%' }]} />
                <View style={[styles.themePreviewLine, { backgroundColor: '#353530', width: '50%' }]} />
              </View>
              <View style={styles.themeOptionInfo}>
                <Ionicons name="moon" size={18} color={isDark ? C.primary : C.onSurfaceVariant} />
                <Text style={[styles.themeOptionLabel, { color: isDark ? C.primary : C.onSurfaceVariant }]}>
                  Dark
                </Text>
              </View>
              {isDark && (
                <View style={[styles.themeCheck, { backgroundColor: C.primary }]}>
                  <Ionicons name="checkmark" size={12} color={C.onPrimary} />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Accessibility ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>ACCESSIBILITY</Text>
        <View style={[styles.group, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <SettingRow
            colors={C}
            icon="leaf-outline"
            label="Low-Stimulation Mode"
            sublabel="Reduces animations and visual noise"
            value={lowStimulation}
            onToggle={setLowStimulation}
          />
        </View>

        {/* ── Notifications ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>NOTIFICATIONS</Text>
        <View style={[styles.group, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <SettingRow
            colors={C}
            icon="notifications-outline"
            label="Push Notifications"
            sublabel="Receive mindful reminders"
            value={notificationsEnabled}
            onToggle={handleNotificationsToggle}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="alarm-outline"
            label="Daily Check-in Reminder"
            sublabel="Remind me to log my mood"
            value={dailyReminder}
            onToggle={handleDailyReminderToggle}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="mail-outline"
            label="Email Notifications"
            sublabel="Weekly wellness summaries"
            value={emailNotifications}
            onToggle={setEmailNotifications}
          />
        </View>

        {/* ── General Account ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>GENERAL ACCOUNT</Text>
        <View style={[styles.group, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <SettingRow
            colors={C}
            icon="person-outline"
            label="Edit Profile"
            showArrow
            onPress={() => navigation.navigate('ProfileTab')}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="eye-off-outline"
            label="Hidden Posts"
            sublabel="View and unhide posts you've hidden"
            showArrow
            onPress={() => navigation.navigate('HiddenPosts')}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="bookmark-outline"
            label="Saved Posts"
            sublabel="View your bookmarked posts"
            showArrow
            onPress={() => navigation.navigate('SavedPosts')}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="language-outline"
            label="Language"
            sublabel={languageLabel}
            showArrow
            onPress={() => setShowLanguagePicker(true)}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="lock-closed-outline"
            label="Change Password"
            showArrow
            onPress={() => setShowPasswordModal(true)}
          />
        </View>

        {/* ── Privacy & Legal ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>PRIVACY & LEGAL</Text>
        <View style={[styles.group, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <SettingRow
            colors={C}
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            showArrow
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="document-text-outline"
            label="Terms & Conditions"
            showArrow
            onPress={() => navigation.navigate('Terms')}
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="eye-off-outline"
            label="Profile Visibility"
            sublabel="Control who can see your activity"
            showArrow
            onPress={handleProfileVisibility}
          />

        </View>

        {/* ── About Mindspace ── */}
        <Text style={[styles.groupLabel, { color: C.onSurfaceVariant }]}>ABOUT MINDSPACE</Text>
        <View style={[styles.aboutCard, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <LinearGradient
            colors={[C.primaryContainer, `${C.tertiaryContainer}88`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.aboutGradient}
          >
            <View style={[styles.aboutLogoCircle, { backgroundColor: C.primary }]}>
              <Text style={[styles.aboutLogoText, { color: C.onPrimary }]}>M</Text>
            </View>
            <Text style={[styles.aboutDescription, { color: C.onPrimaryContainer }]}>
              A sanctuary built on compassion and radical trust, providing tools for individual flourishing.
            </Text>
          </LinearGradient>

          <View style={styles.aboutMeta}>
            <SettingRow
              colors={C}
              icon="information-circle-outline"
              label="About App"
              sublabel="Version 2.4.0 (Luminous)"
              showArrow
              onPress={() => navigation.navigate('AboutApp')}
            />
            <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
            <SettingRow
              colors={C}
              icon="star-outline"
              label="Rate Mindspace"
              sublabel="Help others find their sanctuary"
              showArrow
              onPress={handleRateMindspace}
            />
            <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
            <SettingRow
              colors={C}
              icon="chatbox-outline"
              label="Send Feedback"
              showArrow
              onPress={() => navigation.navigate('FeedbackSupport')}
            />
          </View>
        </View>

        {/* ── Danger Zone ── */}
        <View style={[styles.group, { backgroundColor: C.surfaceContainerLowest, ...(lowStimulation ? {} : Shadow.ambient) }]}>
          <SettingRow
            colors={C}
            icon="log-out-outline"
            label="Sign Out"
            showArrow
            onPress={handleLogout}
            iconColor={C.error}
            iconBg={`${C.error}18`}
            danger
          />
          <View style={[styles.divider, { backgroundColor: C.outlineVariant }]} />
          <SettingRow
            colors={C}
            icon="close-circle-outline"
            label="Delete Account"
            showArrow
            onPress={handleDeleteAccount}
            iconColor={C.error}
            iconBg={`${C.error}18`}
            danger
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.onSurfaceVariant }]}>Mindspace supports safe reflection, thoughtful connection, and everyday resilience.</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showLanguagePicker}
        transparent
        animationType={lowStimulation ? 'none' : 'fade'}
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLanguagePicker(false)}
        >
          <View style={[styles.modalCard, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.onSurface }]}>Select Language</Text>
            <Text style={[styles.modalSubtitle, { color: C.onSurfaceVariant }]}>
              {t('App labels, page names, settings, and built-in copy will update. Your journals and messages stay unchanged.')}
            </Text>
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {LANGUAGE_OPTIONS.map((option) => {
                const active = option.code === language;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.languageOption,
                      {
                        backgroundColor: active ? C.primaryContainer : C.surfaceContainerLow,
                        borderColor: active ? C.primary : C.outlineVariant + '55',
                      },
                    ]}
                    onPress={() => {
                      setLanguage(option.code);
                      setShowLanguagePicker(false);
                    }}
                  >
                    <View style={styles.languageTextWrap}>
                      <Text style={[styles.languageNative, { color: active ? C.primary : C.onSurface }]}>
                        {option.nativeName}
                      </Text>
                      <Text style={[styles.languageEnglish, { color: C.onSurfaceVariant }]}>
                        {option.name}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark-circle" size={22} color={C.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType={lowStimulation ? 'none' : 'slide'}
        onRequestClose={closePasswordModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: C.surface }]}>
            <Text style={[styles.modalTitle, { color: C.onSurface }]}>Change Password</Text>
            <Text style={[styles.modalSubtitle, { color: C.onSurfaceVariant }]}>
              Enter your current password first. If it matches your account, your new password will be saved for the next login.
            </Text>
            <TextInput
              style={[styles.passwordInput, { color: C.onSurface, backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant + '55' }]}
              placeholder={t('Current Password')}
              placeholderTextColor={C.onSurfaceVariant}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.passwordInput, { color: C.onSurface, backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant + '55' }]}
              placeholder={t('New Password')}
              placeholderTextColor={C.onSurfaceVariant}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.passwordInput, { color: C.onSurface, backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant + '55' }]}
              placeholder={t('Confirm New Password')}
              placeholderTextColor={C.onSurfaceVariant}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.secondaryAction, { backgroundColor: C.surfaceContainerHigh }]}
                onPress={closePasswordModal}
                disabled={passwordSaving}
              >
                <Text style={[styles.secondaryActionText, { color: C.onSurfaceVariant }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, { backgroundColor: C.primary, opacity: passwordSaving ? 0.7 : 1 }]}
                onPress={handlePasswordUpdate}
                disabled={passwordSaving}
              >
                {passwordSaving ? (
                  <ActivityIndicator color={C.onPrimary} />
                ) : (
                  <Text style={[styles.primaryActionText, { color: C.onPrimary }]}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing[5], paddingTop: 60, paddingBottom: Spacing[3],
    gap: Spacing[3],
  },
  backBtn: {},
  backCircle: {
    width: 44, height: 44, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, gap: 2 },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },

  // Content
  content: { padding: Spacing[5], gap: Spacing[3] },

  // Group labels
  groupLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing[2],
    marginTop: Spacing[3],
  },

  // Card groups
  group: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },

  // Setting rows
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3] + 2,
  },
  settingIcon: {
    width: 36, height: 36,
    borderRadius: Radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingLabel: { flex: 1, gap: 2 },
  settingText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  settingSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  divider: {
    height: 1,
    opacity: 0.15,
    marginHorizontal: Spacing[4],
  },

  // Theme card
  themeCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
  },
  themeRow: {
    flexDirection: 'row',
    gap: Spacing[3],
  },
  themeOption: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing[3],
    alignItems: 'center',
    gap: Spacing[3],
    position: 'relative',
  },
  themePreview: {
    width: '100%',
    height: 72,
    borderRadius: Radius.md,
    padding: Spacing[3],
    gap: Spacing[2],
    justifyContent: 'center',
  },
  themePreviewDot: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
  },
  themePreviewLine: {
    height: 6,
    borderRadius: 3,
  },
  themeOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  themeOptionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // About card
  aboutCard: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  aboutGradient: {
    padding: Spacing[5],
    alignItems: 'center',
    gap: Spacing[3],
  },
  aboutLogoCircle: {
    width: 48, height: 48,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aboutLogoText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 22,
  },
  aboutDescription: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
    opacity: 0.9,
  },
  aboutMeta: {},

  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
  },
  footerText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing[4],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.36)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[5],
    paddingBottom: 36,
    gap: Spacing[3],
    maxHeight: '86%',
  },
  modalTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  modalSubtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.55,
  },
  languageList: {
    marginTop: Spacing[2],
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing[4],
    marginBottom: Spacing[2],
  },
  languageTextWrap: {
    gap: 2,
  },
  languageNative: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  languageEnglish: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  passwordInput: {
    minHeight: 50,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing[4],
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  primaryActionText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
});
