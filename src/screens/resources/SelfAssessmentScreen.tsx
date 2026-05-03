import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useTranslation } from '../../i18n/useTranslation';

type Option = { label: string; score: number };
type Question = { id: string; text: string; options: Option[] };
type AssessmentMode = {
  key: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  questions: Question[];
};

const RESPONSE_OPTIONS: Option[] = [
  { label: 'Not at all', score: 0 },
  { label: 'A little', score: 1 },
  { label: 'Often', score: 2 },
  { label: 'Very often', score: 3 },
];

const SUPPORT_RESPONSE_OPTIONS: Option[] = [
  { label: 'Not at all', score: 3 },
  { label: 'A little', score: 2 },
  { label: 'Often', score: 1 },
  { label: 'Very often', score: 0 },
];

const ASSESSMENTS: AssessmentMode[] = [
  {
    key: 'sage',
    title: 'Sage Guided Check-In',
    subtitle: 'A short bot-style assessment with a personal report',
    icon: 'chatbubble-ellipses-outline',
    color: '#9fd8cb',
    questions: [
      { id: 'overwhelm', text: 'In the last 7 days, how often did your mind feel overloaded?', options: RESPONSE_OPTIONS },
      { id: 'calm', text: 'How often did you find a moment of calm when you needed one?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'connection', text: 'How often did you feel connected to someone supportive?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'focus', text: 'How often was it hard to focus because of stress?', options: RESPONSE_OPTIONS },
      { id: 'kindness', text: 'How often did you speak to yourself with kindness?', options: SUPPORT_RESPONSE_OPTIONS },
    ],
  },
  {
    key: 'stress',
    title: 'Stress Thermometer',
    subtitle: 'Spot pressure points and get a short action plan',
    icon: 'thermometer-outline',
    color: '#f1c98d',
    questions: [
      { id: 'body', text: 'How often did stress show up in your body?', options: RESPONSE_OPTIONS },
      { id: 'racing', text: 'How often did thoughts race or repeat?', options: RESPONSE_OPTIONS },
      { id: 'rest', text: 'How often did you get real recovery time?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'control', text: 'How often did things feel outside your control?', options: RESPONSE_OPTIONS },
    ],
  },
  {
    key: 'sleep',
    title: 'Sleep and Energy Review',
    subtitle: 'Check rest, energy, and evening habits',
    icon: 'moon-outline',
    color: '#b7c8f2',
    questions: [
      { id: 'falling', text: 'How often was it hard to fall asleep?', options: RESPONSE_OPTIONS },
      { id: 'waking', text: 'How often did you wake up tired?', options: RESPONSE_OPTIONS },
      { id: 'screen', text: 'How often did screens or scrolling delay sleep?', options: RESPONSE_OPTIONS },
      { id: 'energy', text: 'How often did you have enough energy for the day?', options: SUPPORT_RESPONSE_OPTIONS },
    ],
  },
  {
    key: 'habits',
    title: 'Mindful Habits Builder',
    subtitle: 'Choose tiny habits that fit your current capacity',
    icon: 'sparkles-outline',
    color: '#d4b5ea',
    questions: [
      { id: 'pause', text: 'How often did you pause before reacting?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'movement', text: 'How often did you move your body, even briefly?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'journal', text: 'How often did you write or name your feelings?', options: SUPPORT_RESPONSE_OPTIONS },
      { id: 'breath', text: 'How often did you use breathing to settle yourself?', options: SUPPORT_RESPONSE_OPTIONS },
    ],
  },
];

const getLevel = (score: number, maxScore: number) => {
  const ratio = maxScore === 0 ? 0 : score / maxScore;
  if (ratio < 0.34) return { label: 'Steady', color: '#8fcf9a' };
  if (ratio < 0.67) return { label: 'Needs care', color: '#f1c98d' };
  return { label: 'High load', color: '#ef9f9f' };
};

const buildReport = (mode: AssessmentMode, answers: Record<string, Option>) => {
  const score = mode.questions.reduce((sum, question) => sum + (answers[question.id]?.score || 0), 0);
  const maxScore = mode.questions.length * 3;
  const level = getLevel(score, maxScore);
  const ratio = Math.round((score / maxScore) * 100);
  const focus =
    level.label === 'Steady'
      ? 'Your answers suggest you have some grounding resources available right now.'
      : level.label === 'Needs care'
        ? 'Your answers suggest moderate pressure. A small routine could help reduce load.'
        : 'Your answers suggest a heavy week. Prioritize support, rest, and one simple next step.';

  const actions =
    level.label === 'Steady'
      ? ['Keep the habit that is already working.', 'Write one sentence about what helped this week.', 'Schedule one quiet reset before you need it.']
      : level.label === 'Needs care'
        ? ['Try a 3-minute breathing exercise today.', 'Choose one worry to write down instead of carrying it.', 'Message or call one safe person.']
        : ['Use the Calm Room for one guided exercise.', 'Reduce today to one essential task.', 'Reach out to someone trusted or a professional if this feels unmanageable.'];

  return { score, maxScore, ratio, level, focus, actions };
};

export const SelfAssessmentScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState<AssessmentMode | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Option>>({});
  const [reportVisible, setReportVisible] = useState(false);
  const [sageInput, setSageInput] = useState('');
  const [sageNotes, setSageNotes] = useState<string[]>([]);
  const pulse = useRef(new Animated.Value(0)).current;

  const currentQuestion = activeMode?.questions[questionIndex];
  const report = useMemo(() => (activeMode ? buildReport(activeMode, answers) : null), [activeMode, answers]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1100, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const startMode = (mode: AssessmentMode) => {
    setActiveMode(mode);
    setQuestionIndex(0);
    setAnswers({});
    setReportVisible(false);
    setSageNotes([]);
  };

  const selectOption = (option: Option) => {
    if (!activeMode || !currentQuestion) return;
    const nextAnswers = { ...answers, [currentQuestion.id]: option };
    setAnswers(nextAnswers);
    if (questionIndex + 1 >= activeMode.questions.length) {
      setReportVisible(true);
    } else {
      setQuestionIndex((value) => value + 1);
    }
  };

  const addSageNote = () => {
    const value = sageInput.trim();
    if (!value) return;
    setSageNotes((prev) => [...prev, value]);
    setSageInput('');
  };

  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <LinearGradient
        colors={[C.primaryContainer, `${C.primary}18`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.heroText}>
          <Animated.View style={[styles.heroOrb, { backgroundColor: C.primary, transform: [{ scale: orbScale }] }]}>
            <Ionicons name="clipboard-outline" size={28} color={C.onPrimary} />
          </Animated.View>
          <Text style={[styles.heroTitle, { color: C.onSurface }]}>Self Assessment</Text>
          <Text style={[styles.heroSub, { color: C.onSurfaceVariant }]}>Private check-ins that turn your answers into a simple care report.</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!activeMode ? (
          <>
            <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Choose a Check-In</Text>
            {ASSESSMENTS.map((mode) => (
              <TouchableOpacity key={mode.key} onPress={() => startMode(mode)} activeOpacity={0.86}>
                <View style={[styles.modeCard, { backgroundColor: C.surfaceContainerLow }]}>
                  <View style={[styles.modeIcon, { backgroundColor: mode.color }]}>
                    <Ionicons name={mode.icon as any} size={24} color="#1e1e1a" />
                  </View>
                  <View style={styles.modeText}>
                    <Text style={[styles.modeTitle, { color: C.onSurface }]}>{mode.title}</Text>
                    <Text style={[styles.modeSub, { color: C.onSurfaceVariant }]}>{mode.subtitle}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.onSurfaceVariant} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <View style={styles.assessmentHeader}>
              <TouchableOpacity onPress={() => setActiveMode(null)} style={[styles.smallBtn, { backgroundColor: C.surfaceContainerLow }]}>
                <Ionicons name="grid-outline" size={16} color={C.onSurface} />
                <Text style={[styles.smallBtnText, { color: C.onSurface }]}>Options</Text>
              </TouchableOpacity>
              <Text style={[styles.progressText, { color: C.onSurfaceVariant }]}>
                {Math.min(questionIndex + 1, activeMode.questions.length)} / {activeMode.questions.length}
              </Text>
            </View>

            <View style={[styles.sageCard, { backgroundColor: C.surfaceContainerLow }]}>
              <View style={styles.sageRow}>
                <View style={[styles.sageAvatar, { backgroundColor: activeMode.color }]}>
                  <Text style={styles.sageEmoji}>S</Text>
                </View>
                <View style={[styles.sageBubble, { backgroundColor: C.surfaceContainerHighest }]}>
                  <Text style={[styles.sageName, { color: C.primary }]}>Sage</Text>
                  <Text style={[styles.questionText, { color: C.onSurface }]}>{currentQuestion?.text}</Text>
                </View>
              </View>

              <View style={styles.optionsGrid}>
                {currentQuestion?.options.map((option) => (
                  <TouchableOpacity
                    key={`${currentQuestion.id}-${option.label}`}
                    style={[styles.answerBtn, { backgroundColor: C.surface }]}
                    onPress={() => selectOption(option)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.answerText, { color: C.onSurface }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={[styles.noteCard, { backgroundColor: C.surfaceContainerLow }]}>
              <Text style={[styles.noteTitle, { color: C.onSurface }]}>Tell Sage anything extra</Text>
              <View style={[styles.noteInputRow, { backgroundColor: C.surface }]}>
                <TextInput
                  value={sageInput}
                  onChangeText={setSageInput}
                  placeholder={t('One thing I want the report to remember...')}
                  placeholderTextColor={C.onSurfaceVariant + '88'}
                  style={[styles.noteInput, { color: C.onSurface }]}
                />
                <TouchableOpacity onPress={addSageNote} style={[styles.sendBtn, { backgroundColor: C.primary }]}>
                  <Ionicons name="add" size={20} color={C.onPrimary} />
                </TouchableOpacity>
              </View>
              {sageNotes.map((note, index) => (
                <Text key={`${note}-${index}`} translate={false} style={[styles.noteItem, { color: C.onSurfaceVariant }]}>
                  {index + 1}. {note}
                </Text>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={reportVisible && !!report && !!activeMode} transparent animationType="fade" onRequestClose={() => setReportVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.reportCard, { backgroundColor: C.surface }]}>
            {report && activeMode ? (
              <>
                <View style={[styles.reportBadge, { backgroundColor: report.level.color }]}>
                  <Text style={styles.reportBadgeText}>{report.level.label}</Text>
                </View>
                <Text style={[styles.reportTitle, { color: C.onSurface }]}>{t(activeMode.title)} {t('Report')}</Text>
                <Text style={[styles.reportScore, { color: C.primary }]}>{report.ratio}% {t('load signal')}</Text>
                <Text style={[styles.reportFocus, { color: C.onSurfaceVariant }]}>{report.focus}</Text>
                {sageNotes.length ? (
                  <View style={[styles.reportNotes, { backgroundColor: C.surfaceContainerLow }]}>
                    <Text style={[styles.reportNotesTitle, { color: C.onSurface }]}>Your notes</Text>
                    {sageNotes.map((note, index) => (
                      <Text key={`${note}-${index}`} translate={false} style={[styles.reportNoteText, { color: C.onSurfaceVariant }]}>
                        {note}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionList}>
                  {report.actions.map((action) => (
                    <View key={action} style={styles.actionRow}>
                      <Ionicons name="checkmark-circle-outline" size={18} color={C.primary} />
                      <Text style={[styles.actionText, { color: C.onSurface }]}>{action}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={[styles.closeReportBtn, { backgroundColor: C.primary }]}
                  onPress={() => {
                    setReportVisible(false);
                    setActiveMode(null);
                  }}
                >
                  <Text style={[styles.closeReportText, { color: C.onPrimary }]}>Done</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingTop: 60, paddingBottom: Spacing[7], paddingHorizontal: Spacing[5] },
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing[4] },
  heroText: { alignItems: 'center', gap: Spacing[2] },
  heroOrb: { width: 62, height: 62, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize['3xl'] },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, textAlign: 'center', lineHeight: Typography.fontSize.md * 1.5 },
  content: { padding: Spacing[5], gap: Spacing[3], paddingBottom: 50 },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, marginBottom: Spacing[1] },
  modeCard: { borderRadius: 20, padding: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  modeIcon: { width: 52, height: 52, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  modeText: { flex: 1, gap: 2 },
  modeTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  modeSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.4 },
  assessmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  smallBtn: { borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2], flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  smallBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  progressText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  sageCard: { borderRadius: 22, padding: Spacing[4], gap: Spacing[4] },
  sageRow: { flexDirection: 'row', gap: Spacing[3], alignItems: 'flex-start' },
  sageAvatar: { width: 42, height: 42, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  sageEmoji: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, color: '#1e1e1a' },
  sageBubble: { flex: 1, borderRadius: 18, padding: Spacing[4], gap: Spacing[1] },
  sageName: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },
  questionText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.lg, lineHeight: Typography.fontSize.lg * 1.35 },
  optionsGrid: { gap: Spacing[2] },
  answerBtn: { borderRadius: 16, padding: Spacing[4] },
  answerText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  noteCard: { borderRadius: 20, padding: Spacing[4], gap: Spacing[3] },
  noteTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  noteInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.full, paddingLeft: Spacing[4], paddingRight: Spacing[2] },
  noteInput: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, minHeight: 48 },
  sendBtn: { width: 36, height: 36, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  noteItem: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  modalOverlay: { flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: Spacing[5] },
  reportCard: { borderRadius: 24, padding: Spacing[5], gap: Spacing[3] },
  reportBadge: { alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  reportBadgeText: { fontFamily: Typography.fontFamily.bold, color: '#1e1e1a', fontSize: Typography.fontSize.sm },
  reportTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'] },
  reportScore: { fontFamily: Typography.fontFamily.extraBold, fontSize: Typography.fontSize.xl },
  reportFocus: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.5 },
  reportNotes: { borderRadius: 16, padding: Spacing[3], gap: Spacing[2] },
  reportNotesTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  reportNoteText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  actionList: { gap: Spacing[2] },
  actionRow: { flexDirection: 'row', gap: Spacing[2], alignItems: 'flex-start' },
  actionText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.5 },
  closeReportBtn: { borderRadius: Radius.full, alignItems: 'center', paddingVertical: Spacing[3], marginTop: Spacing[2] },
  closeReportText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
});
