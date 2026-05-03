import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Radius, Shadow, Spacing, Typography } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { translateText } from '../../i18n';
import { sendUserFeedback } from '../../services/firebase/firestore';

const FAQ_KEYS = [
  {
    question: 'How do I change my password?',
    answer: 'Open Settings, tap Change Password, enter your current password, then save a new password.',
  },
  {
    question: 'Why did my notification badge disappear?',
    answer: 'Opening the Notifications page clears only the bell badge. A notification becomes read only when you open it or use mark all as read.',
  },
  {
    question: 'Does language change my personal journal text?',
    answer: 'No. Mindspace translates built-in app labels and guidance, but your journals, messages, and profile text stay exactly as you wrote them.',
  },
  {
    question: 'How do I hide or restore a community post?',
    answer: 'Use the post menu to hide a post. Hidden posts can be restored from Settings under Hidden Posts.',
  },
  {
    question: 'What happens when push notifications are off?',
    answer: 'Mindspace stops creating new app notifications for your account and cancels scheduled local reminders on this device.',
  },
  {
    question: 'How do I clear local journal data?',
    answer: 'Go to Settings, choose Clear Local Journal Data, and confirm. This removes local journal and mood entries from this device.',
  },
];

export const FeedbackSupportScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const language = useThemeStore((state) => state.language);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const t = (value: string) => translateText(value, language);

  const faqs = useMemo(() => FAQ_KEYS.map((faq) => ({
    question: t(faq.question),
    answer: t(faq.answer),
  })), [language]);

  const filteredFaqs = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return faqs;
    return faqs.filter((faq) =>
      `${faq.question} ${faq.answer}`.toLowerCase().includes(needle)
    );
  }, [query, faqs]);

  const submitFeedback = async () => {
    const message = feedback.trim();
    if (message.length < 10) {
      Alert.alert(t('Send Feedback'), t('Please write at least 10 characters so the support team has enough context.'));
      return;
    }

    setSending(true);
    try {
      await sendUserFeedback(user?.uid || null, user?.email, message);
      setFeedback('');
      Alert.alert(t('Send Feedback'), t('Thank you. Your feedback has been sent to the support team.'));
    } catch {
      Alert.alert(t('Send Feedback'), t('Could not send feedback right now. Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerIcon, { backgroundColor: C.surfaceContainerHigh }]}
        >
          <Ionicons name="chevron-back" size={22} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: C.onSurface }]}>{t('Feedback & Support')}</Text>
          <Text style={[styles.subtitle, { color: C.onSurfaceVariant }]}>
            {t('Search common answers or send a note to the support team.')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.searchBox, { backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant + '55' }]}>
          <Ionicons name="search-outline" size={18} color={C.onSurfaceVariant} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('Search FAQs')}
            placeholderTextColor={C.onSurfaceVariant}
            style={[styles.searchInput, { color: C.onSurface }]}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: C.onSurface }]}>{t('Frequently Asked Questions')}</Text>
        {filteredFaqs.length > 0 ? filteredFaqs.map((faq) => (
          <View key={faq.question} style={[styles.faqCard, { backgroundColor: C.surfaceContainerLowest, ...Shadow.subtle }]}>
            <Text style={[styles.faqQuestion, { color: C.onSurface }]}>{faq.question}</Text>
            <Text style={[styles.faqAnswer, { color: C.onSurfaceVariant }]}>{faq.answer}</Text>
          </View>
        )) : (
          <View style={[styles.emptyCard, { backgroundColor: C.surfaceContainerLow }]}>
            <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>{t('No FAQ matches')}</Text>
          </View>
        )}

        <View style={[styles.feedbackCard, { backgroundColor: C.surfaceContainerLowest, ...Shadow.ambient }]}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>{t('Send Feedback')}</Text>
          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder={t('Tell us what happened or what you would like improved.')}
            placeholderTextColor={C.onSurfaceVariant}
            multiline
            textAlignVertical="top"
            style={[styles.feedbackInput, { color: C.onSurface, backgroundColor: C.surfaceContainerLow, borderColor: C.outlineVariant + '55' }]}
          />
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: C.primary, opacity: sending ? 0.7 : 1 }]}
            onPress={submitFeedback}
            disabled={sending}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator color={C.onPrimary} />
            ) : (
              <>
                <Text style={[styles.submitText, { color: C.onPrimary }]}>{t('Send to Support')}</Text>
                <Ionicons name="send-outline" size={17} color={C.onPrimary} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingTop: 58,
    paddingBottom: Spacing[4],
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 4 },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
  },
  subtitle: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.45,
  },
  content: {
    padding: Spacing[5],
    gap: Spacing[3],
    paddingBottom: 44,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
  },
  sectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },
  faqCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[2],
  },
  faqQuestion: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  faqAnswer: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.55,
  },
  emptyCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  feedbackCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
    gap: Spacing[3],
    marginTop: Spacing[3],
  },
  feedbackInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing[4],
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.5,
  },
  submitBtn: {
    minHeight: 50,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
  },
  submitText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
});
