import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    content:
      'By downloading, installing, or using Mindspace, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you should not use the application.',
  },
  {
    title: 'Use of the Service',
    content:
      'Mindspace is a mental wellness companion designed for self-reflection, community support, and mindfulness practice. It is not a substitute for professional medical advice, diagnosis, or treatment. Always seek the guidance of qualified health professionals for mental health concerns.',
  },
  {
    title: 'User Accounts',
    content:
      'You are responsible for maintaining the confidentiality of your account credentials. You must provide accurate, current, and complete information during registration. You agree to notify us immediately of any unauthorized use of your account.',
  },
  {
    title: 'Community Guidelines',
    content:
      'When participating in community features, you agree to treat others with respect and compassion. Harassment, hate speech, bullying, explicit content, and spam are strictly prohibited. We reserve the right to moderate, remove content, or suspend accounts that violate these guidelines.',
  },
  {
    title: 'Intellectual Property',
    content:
      'All content, features, and functionality of Mindspace, including but not limited to text, graphics, logos, icons, sounds, and software, are the property of Mindspace or its licensors. You may not copy, modify, distribute, or create derivative works without prior written consent.',
  },
  {
    title: 'User-Generated Content',
    content:
      'By posting content to Mindspace community features, you grant us a non-exclusive, royalty-free license to use, display, and distribute your content within the app. You retain ownership of your content and can delete it at any time. Journal entries remain fully private.',
  },
  {
    title: 'Limitation of Liability',
    content:
      'Mindspace and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service. The app is provided "as is" without warranties of any kind, express or implied.',
  },
  {
    title: 'Modifications to Terms',
    content:
      'We reserve the right to modify these Terms and Conditions at any time. Continued use of the service after changes are posted constitutes acceptance of the revised terms. We will provide reasonable notice of material changes via in-app notification.',
  },
  {
    title: 'Termination',
    content:
      'We may terminate or suspend your access to the service immediately, without prior notice, if you breach these Terms and Conditions. Upon termination, your right to use the service will cease immediately. You may also delete your account at any time from Settings.',
  },
  {
    title: 'Governing Law',
    content:
      'These Terms and Conditions shall be governed and construed in accordance with applicable laws, without regard to conflict of law provisions. Any disputes arising from these terms shall be resolved through binding arbitration.',
  },
];

export const TermsScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.onSurface }]}>Terms & Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={[styles.headerCard, { backgroundColor: C.secondaryContainer }]}>
          <View style={[styles.headerIconCircle, { backgroundColor: `${C.secondary}33` }]}>
            <Ionicons name="document-text" size={28} color={C.secondary} />
          </View>
          <Text style={[styles.headerCardTitle, { color: C.onSecondaryContainer }]}>
            Terms of Service
          </Text>
          <Text style={[styles.headerCardSub, { color: C.onSecondaryContainer }]}>
            Please read these terms carefully before using Mindspace. By using our services, you agree to these terms.
          </Text>
          <Text style={[styles.lastUpdated, { color: C.onSecondaryContainer }]}>
            Effective Date: January 1, 2026
          </Text>
        </View>

        {/* Sections */}
        {SECTIONS.map((section, i) => (
          <View key={i} style={[styles.sectionCard, { backgroundColor: C.surfaceContainerLowest }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionNum, { backgroundColor: C.secondaryContainer }]}>
                <Text style={[styles.sectionNumText, { color: C.secondary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.sectionTitle, { color: C.onSurface }]}>{section.title}</Text>
            </View>
            <Text style={[styles.sectionContent, { color: C.onSurfaceVariant }]}>
              {section.content}
            </Text>
          </View>
        ))}

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
    fontSize: Typography.fontSize.xl,
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
});
