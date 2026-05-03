import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';

const FEATURES = [
  { icon: 'journal-outline' as const, title: 'Private Journal', desc: 'Encrypted mood tracking and reflections' },
  { icon: 'people-outline' as const, title: 'Safe Community', desc: 'Anonymous peer support circles' },
  { icon: 'leaf-outline' as const, title: 'Calm Room', desc: 'Guided meditations and breathing exercises' },
  { icon: 'chatbubble-ellipses-outline' as const, title: 'AI Companion', desc: 'Thoughtful, non-judgmental conversations' },
];

const TEAM = [
  { emoji: '🧠', name: 'Mental Health Advisors', role: 'Clinical guidance & content review' },
  { emoji: '💻', name: 'Engineering Team', role: 'Building with empathy and precision' },
  { emoji: '🎨', name: 'Design Team', role: 'Crafting the Breathable Sanctuary' },
  { emoji: '🤝', name: 'Community Team', role: 'Fostering safe, inclusive spaces' },
];

export const AboutAppScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.onSurface }]}>About Mindspace</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero Card */}
        <LinearGradient
          colors={[C.primaryContainer, C.tertiaryContainer]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={[styles.logoCircle, { backgroundColor: C.primary }]}>
            <Text style={[styles.logoText, { color: C.onPrimary }]}>M</Text>
          </View>
          <Text style={[styles.appName, { color: C.onPrimaryContainer }]}>mindspace</Text>
          <Text style={[styles.tagline, { color: C.onPrimaryContainer }]}>
            A sanctuary built on compassion and radical trust
          </Text>
          <View style={[styles.versionBadge, { backgroundColor: `${C.primary}22` }]}>
            <Text style={[styles.versionText, { color: C.primary }]}>Version 2.4.0 (Luminous)</Text>
          </View>
        </LinearGradient>

        {/* Mission */}
        <View style={[styles.card, { backgroundColor: C.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Our Mission</Text>
          <Text style={[styles.bodyText, { color: C.onSurfaceVariant }]}>
            Mindspace exists to create a safe, judgment-free digital sanctuary where anyone can explore their mental health journey. We believe that healing happens through connection with yourself and with others who understand.
          </Text>
          <Text style={[styles.bodyText, { color: C.onSurfaceVariant }]}>
            Every feature, every color, and every interaction in this app is designed to lower your cognitive load and make you feel genuinely safe. Your wellness is not a product. It is our purpose.
          </Text>
        </View>

        {/* Features */}
        <View style={[styles.card, { backgroundColor: C.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Core Features</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f, i) => (
              <View key={i} style={[styles.featureItem, { backgroundColor: C.surfaceContainerLow }]}>
                <View style={[styles.featureIcon, { backgroundColor: `${C.primary}18` }]}>
                  <Ionicons name={f.icon} size={22} color={C.primary} />
                </View>
                <Text style={[styles.featureTitle, { color: C.onSurface }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: C.onSurfaceVariant }]}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Team */}
        <View style={[styles.card, { backgroundColor: C.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Our Team</Text>
          {TEAM.map((t, i) => (
            <View key={i} style={[styles.teamRow, { backgroundColor: C.surfaceContainerLow }]}>
              <View style={[styles.teamEmoji, { backgroundColor: C.primaryContainer }]}>
                <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.teamName, { color: C.onSurface }]}>{t.name}</Text>
                <Text style={[styles.teamRole, { color: C.onSurfaceVariant }]}>{t.role}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Links */}
        <View style={[styles.card, { backgroundColor: C.surfaceContainerLowest }]}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Connect With Us</Text>
          {[
            { icon: 'globe-outline', label: 'Website', url: 'https://mindspace.app' },
            { icon: 'logo-twitter', label: 'Twitter / X', url: 'https://x.com/mindspace' },
            { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/mindspace' },
            { icon: 'mail-outline', label: 'Support Email', url: 'mailto:support@mindspace.app' },
          ].map((link, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.linkRow, { backgroundColor: C.surfaceContainerLow }]}
              onPress={() => Linking.openURL(link.url)}
              activeOpacity={0.7}
            >
              <View style={[styles.linkIcon, { backgroundColor: `${C.primary}18` }]}>
                <Ionicons name={link.icon as any} size={18} color={C.primary} />
              </View>
              <Text style={[styles.linkLabel, { color: C.onSurface }]}>{link.label}</Text>
              <Ionicons name="open-outline" size={16} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: C.onSurfaceVariant }]}>
            Mindspace supports safe reflection, thoughtful connection, and everyday resilience.
          </Text>
          <Text style={[styles.footerSub, { color: C.outline }]}>
            © 2026 Mindspace. All rights reserved.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingTop: 60, paddingBottom: Spacing[4],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
  },
  content: { padding: Spacing[5], gap: Spacing[4] },

  heroCard: {
    borderRadius: Radius.xl,
    padding: Spacing[6],
    alignItems: 'center',
    gap: Spacing[3],
  },
  logoCircle: {
    width: 64, height: 64, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.ambient,
  },
  logoText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 28,
  },
  appName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    letterSpacing: -0.5,
  },
  tagline: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: Typography.fontSize.md * 1.6,
  },
  versionBadge: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
    marginTop: Spacing[1],
  },
  versionText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
  },

  card: {
    borderRadius: Radius.lg,
    padding: Spacing[5],
    gap: Spacing[4],
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  bodyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.7,
  },

  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing[3],
  },
  featureItem: {
    width: '47%',
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  featureIcon: {
    width: 40, height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  featureTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  featureDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.5,
  },

  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  teamEmoji: {
    width: 44, height: 44,
    borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  teamName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  teamRole: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  linkIcon: {
    width: 36, height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  linkLabel: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
    flex: 1,
  },

  footer: {
    alignItems: 'center',
    paddingVertical: Spacing[4],
    gap: Spacing[2],
  },
  footerText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  footerSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
});
