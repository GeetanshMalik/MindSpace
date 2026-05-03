import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';

const SECTIONS = [
  {
    title: 'Information We Collect',
    content:
      'We collect information you provide directly, such as your mood entries, journal reflections, and profile details. We also automatically collect usage data including app interaction patterns, device information, and session analytics to improve your experience.',
  },
  {
    title: 'How We Use Your Data',
    content:
      'Your personal data is used to provide and personalize the Mindspace experience. Mood and journal data remain private and encrypted on your device. We never sell your data to third parties. Anonymized, aggregated analytics may be used to improve features and research.',
  },
  {
    title: 'Data Storage & Security',
    content:
      'All sensitive data, including journal entries and mood logs, is stored locally on your device using encrypted storage. Cloud backups, if enabled, use end-to-end encryption. We employ industry-standard security measures to protect your information.',
  },
  {
    title: 'Third-Party Services',
    content:
      'Mindspace uses Firebase for authentication. We may use anonymous analytics services to understand app usage patterns. These services have their own privacy policies and do not have access to your journal or mood content.',
  },
  {
    title: 'Your Rights',
    content:
      'You have the right to access, modify, or delete your personal data at any time. You can export your journal data or permanently delete your account from the Settings page. All locally stored data can be cleared independently.',
  },
  {
    title: 'Data Retention',
    content:
      'We retain your account data for as long as your account is active. If you delete your account, we remove all personal data within 30 days. Anonymous analytics data may be retained indefinitely for research purposes.',
  },
  {
    title: 'Children\'s Privacy',
    content:
      'Mindspace is not intended for children under 13 years of age. We do not knowingly collect personal information from children. If we learn that we have collected data from a child under 13, we will delete it promptly.',
  },
  {
    title: 'Changes to This Policy',
    content:
      'We may update this Privacy Policy from time to time. We will notify you of any significant changes via in-app notification. The "last updated" date at the top of this policy will be revised accordingly.',
  },
];

export const PrivacyPolicyScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.onSurface }]}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: C.primaryContainer }]}>
          <View style={[styles.headerIconCircle, { backgroundColor: `${C.primary}33` }]}>
            <Ionicons name="shield-checkmark" size={28} color={C.primary} />
          </View>
          <Text style={[styles.headerCardTitle, { color: C.onPrimaryContainer }]}>
            Your Privacy Matters
          </Text>
          <Text style={[styles.headerCardSub, { color: C.onPrimaryContainer }]}>
            At Mindspace, we believe your mental health journey is deeply personal. We are committed to protecting your data with the highest standards.
          </Text>
          <Text style={[styles.lastUpdated, { color: C.onPrimaryContainer }]}>
            Last Updated: March 15, 2026
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <View key={i} style={[styles.sectionCard, { backgroundColor: C.surfaceContainerLowest }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionNum, { backgroundColor: C.primaryContainer }]}>
                <Text style={[styles.sectionNumText, { color: C.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: C.onSurface }]}>{section.title}</Text>
            </View>
            <Text style={[styles.sectionContent, { color: C.onSurfaceVariant }]}>
              {section.content}
            </Text>
          </View>
        ))}

        {/* Contact */}
        <View style={[styles.contactCard, { backgroundColor: C.surfaceContainerLow }]}>
          <Ionicons name="mail-outline" size={20} color={C.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.contactTitle, { color: C.onSurface }]}>Questions about privacy?</Text>
            <Text style={[styles.contactSub, { color: C.onSurfaceVariant }]}>
              Contact us at privacy@mindspace.app
            </Text>
          </View>
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

  headerCard: {
    borderRadius: Radius.lg,
    padding: Spacing[5],
    gap: Spacing[3],
    alignItems: 'center',
  },
  headerIconCircle: {
    width: 56, height: 56, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCardTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
    textAlign: 'center',
  },
  headerCardSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
    opacity: 0.85,
  },
  lastUpdated: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    opacity: 0.7,
    marginTop: Spacing[1],
  },

  sectionCard: {
    borderRadius: Radius.lg,
    padding: Spacing[5],
    gap: Spacing[3],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  sectionNum: {
    width: 28, height: 28,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionNumText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
    flex: 1,
  },
  sectionContent: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.7,
    paddingLeft: Spacing[2],
  },

  contactCard: {
    flexDirection: 'row',
    gap: Spacing[3],
    alignItems: 'center',
    padding: Spacing[4],
    borderRadius: Radius.lg,
  },
  contactTitle: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  contactSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
});
