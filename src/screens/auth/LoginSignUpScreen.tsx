import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/Input';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { signIn, signUp } from '../../services/firebase/auth';

export const LoginSignUpScreen = () => {
  const C = useColors();
  const isDark = C.surface === '#141412';
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    if (!password || password.length < 6) e.password = 'At least 6 characters';
    if (mode === 'signup' && !name.trim()) e.name = 'Name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password, name.trim());
      }
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password'
        : err.code === 'auth/email-already-in-use'
        ? 'Email already in use. Try signing in.'
        : err.message || 'Something went wrong';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Background gradient – non-interactive */}
      <LinearGradient
        colors={[C.primaryContainer, C.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* ── Hero ── */}
          <View style={styles.hero}>
            <View style={[styles.logoBadge, { backgroundColor: C.primaryContainer }]}>
              <Text style={styles.logoEmoji}>🌿</Text>
            </View>
            <Text style={[styles.appName, { color: C.onSurface }]}>Mindspace</Text>
            <Text style={[styles.tagline, { color: C.onSurfaceVariant }]}>Your breathable sanctuary for mental wellness</Text>
          </View>

          {/* ── Mode toggle ── */}
          <View style={[styles.tabRow, { backgroundColor: C.surfaceContainerHighest }]}>
            {(['login', 'signup'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                onPress={() => { setMode(tab); setErrors({}); }}
                style={[styles.tab, mode === tab && { backgroundColor: C.surface }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabText, { color: C.onSurfaceVariant }, mode === tab && { color: C.primary, fontFamily: Typography.fontFamily.semiBold }]}>
                  {tab === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Form fields ── */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <Input
                label="Your Name"
                placeholder="How should we call you?"
                value={name}
                onChangeText={t => { setName(t); setErrors(p => ({ ...p, name: '' })); }}
                error={errors.name}
                autoCapitalize="words"
              />
            )}
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={t => { setEmail(t); setErrors(p => ({ ...p, email: '' })); }}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <View>
              <Input
                label="Password"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={t => { setPassword(t); setErrors(p => ({ ...p, password: '' })); }}
                error={errors.password}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          </View>

          {/* ── PRIMARY SUBMIT BUTTON (always visible) ── */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: C.primary }, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={C.onPrimary} />
              : (
                <>
                  <Text style={[styles.submitText, { color: C.onPrimary }]}>
                    {mode === 'login' ? 'Sign In' : 'Create My Sanctuary'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={C.onPrimary} />
                </>
              )}
          </TouchableOpacity>

          {/* ── Switch mode link ── */}
          <TouchableOpacity
            style={styles.switchRow}
            onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErrors({}); }}
          >
            <Text style={[styles.switchText, { color: C.onSurfaceVariant }]}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={[styles.switchLink, { color: C.primary }]}>
                {mode === 'login' ? 'Create one →' : 'Sign in →'}
              </Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: Spacing[6],
    paddingTop: 80,
    paddingBottom: 48,
    gap: Spacing[5],
    flexGrow: 1,
  },
  hero: { alignItems: 'center', gap: Spacing[2] },
  logoBadge: {
    width: 72, height: 72, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing[1],
  },
  logoEmoji: { fontSize: 36 },
  appName: {
    fontFamily: Typography.fontFamily.extraBold,
    fontSize: Typography.fontSize['3xl'],
    letterSpacing: 0,
  },
  tagline: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: 4,
  },
  tab: {
    flex: 1, paddingVertical: Spacing[3],
    borderRadius: Radius.full, alignItems: 'center',
  },
  tabText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  form: { gap: Spacing[4] },
  eyeBtn: { position: 'absolute', right: Spacing[4], top: 38 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    borderRadius: Radius.full,
    paddingVertical: Spacing[5],
    marginTop: Spacing[2],
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    letterSpacing: 0,
  },
  switchRow: { alignItems: 'center' },
  switchText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
  },
  switchLink: {
    fontFamily: Typography.fontFamily.semiBold,
  },
});
