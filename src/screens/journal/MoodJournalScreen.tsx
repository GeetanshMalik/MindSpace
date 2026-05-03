import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { Reflection, subscribeToUserReflections } from '../../services/firebase/firestore';
import { HomeStackParamList } from '../../navigation/MainTabNavigator';
import {
  buildMoodWeek,
  formatMoodWeekRange,
  getMoodByScore,
  getReflectionMoodEmoji,
  getReflectionMoodScore,
  MOOD_OPTIONS,
  toDate,
} from '../../utils/mood';
import { useTranslation } from '../../i18n/useTranslation';

type NavProp = StackNavigationProp<HomeStackParamList, 'MoodJournal'>;
const { width } = Dimensions.get('window');

const PROMPTS = [
  'What made you smile today?',
  'What are you grateful for right now?',
  'What was the most challenging moment today?',
  'What did you learn about yourself this week?',
  'What would you tell your past self one year ago?',
];

const normalizeTags = (tags?: string[] | string) => {
  if (Array.isArray(tags)) return tags;
  return tags ? tags.split(',').filter(Boolean) : [];
};

export const MoodJournalScreen = () => {
  const navigation = useNavigation<NavProp>();
  const C = useColors();
  const { user } = useAuthStore();
  const { locale, t } = useTranslation();
  const isDark = C.surface === '#141412';
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const graphAnim = useRef(new Animated.Value(0)).current;

  const weeklyMood = useMemo(() => buildMoodWeek(reflections), [reflections]);
  const weekRange = useMemo(() => formatMoodWeekRange(weeklyMood, locale), [locale, weeklyMood]);
  const chartWidth = width - Spacing[5] * 2 - Spacing[4] * 2;
  const chartHeight = 150;
  const stepWidth = chartWidth / 6;
  const points = weeklyMood.map((day, index) => {
    const y = day.score ? chartHeight - 18 - ((day.score - 1) / 4) * (chartHeight - 44) : chartHeight - 18;
    return { ...day, x: index * stepWidth, y };
  });

  useEffect(() => {
    if (!user) {
      setReflections([]);
      return;
    }
    return subscribeToUserReflections(user.uid, setReflections);
  }, [user]);

  useEffect(() => {
    graphAnim.setValue(0);
    Animated.timing(graphAnim, {
      toValue: 1,
      duration: 750,
      useNativeDriver: true,
    }).start();
  }, [graphAnim, reflections.length]);

  const handleMoodSelect = (score: number) => {
    const mood = getMoodByScore(score);
    navigation.navigate('WriteReflection', {
      moodScore: score,
      moodLabel: mood?.label,
      moodEmoji: mood?.emoji,
    });
  };

  const todayPrompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <LinearGradient
          colors={[C.primaryContainer, `${C.primary}15`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
          pointerEvents="box-none"
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={C.onSurface} />
          </TouchableOpacity>
          <View style={styles.heroText}>
            <Text style={[styles.heroTitle, { color: C.onSurface }]}>Your Inner Landscape</Text>
            <Text style={[styles.heroSub, { color: C.onSurfaceVariant }]}>
              Track your emotional rhythm through private diary entries. Pick a mood before writing so your weekly resonance stays meaningful.
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Weekly Resonance</Text>
              <Text style={[styles.sectionSub, { color: C.onSurfaceVariant }]}>{weekRange}</Text>
            </View>
            <View style={[styles.scoreLegend, { backgroundColor: C.surfaceContainerLow }]}>
              <Text style={[styles.scoreLegendText, { color: C.onSurfaceVariant }]}>Low</Text>
              <Text style={[styles.scoreLegendText, { color: C.onSurfaceVariant }]}>Great</Text>
            </View>
          </View>

          <View style={[styles.chartCard, { backgroundColor: C.surfaceContainerLow }]}>
            <View style={[styles.lineChart, { width: chartWidth, height: chartHeight }]}>
              {[1, 2, 3].map((line) => (
                <View
                  key={line}
                  style={[
                    styles.gridLine,
                    {
                      top: (chartHeight / 4) * line,
                      backgroundColor: C.outlineVariant + '55',
                    },
                  ]}
                />
              ))}

              {points.slice(0, -1).map((point, index) => {
                const next = points[index + 1];
                if (!point.score || !next.score) return null;
                const length = Math.hypot(next.x - point.x, next.y - point.y);
                const angle = Math.atan2(next.y - point.y, next.x - point.x);
                const mood = getMoodByScore(next.score);
                return (
                  <Animated.View
                    key={`${point.key}-${next.key}`}
                    style={[
                      styles.chartSegment,
                      {
                        left: (point.x + next.x) / 2 - length / 2,
                        top: (point.y + next.y) / 2,
                        width: length,
                        backgroundColor: mood?.color || C.primary,
                        opacity: graphAnim,
                        transform: [{ rotate: `${angle}rad` }, { scaleX: graphAnim }],
                      },
                    ]}
                  />
                );
              })}

              {points.map((point) => {
                const mood = point.score ? getMoodByScore(point.score) : null;
                return (
                  <Animated.View
                    key={point.key}
                    style={[
                      styles.chartDot,
                      {
                        left: point.x - 13,
                        top: point.y - 13,
                        backgroundColor: mood?.color || C.surfaceContainerHighest,
                        borderColor: C.surface,
                        transform: [{ scale: graphAnim }],
                      },
                    ]}
                  >
                    <Text style={styles.chartEmoji}>{mood?.emoji || ''}</Text>
                  </Animated.View>
                );
              })}
            </View>

            <View style={styles.dayLabels}>
              {weeklyMood.map((day) => (
                <View key={day.key} style={styles.dayLabelCol}>
                  <Text style={[styles.dayLabel, { color: C.onSurfaceVariant }]}>
                    {day.date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 1)}
                  </Text>
                  <Text style={[styles.dayDate, { color: C.onSurfaceVariant }]}>{day.date.getDate()}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Start Today's Entry</Text>
          <Text style={[styles.sectionSub, { color: C.onSurfaceVariant }]}>A mood is required before saving your diary entry.</Text>
          <View style={styles.moodPicker}>
            {MOOD_OPTIONS.map((mood) => (
              <TouchableOpacity
                key={mood.score}
                style={[styles.moodBtn, { backgroundColor: mood.color + '88' }]}
                onPress={() => handleMoodSelect(mood.score)}
                activeOpacity={0.8}
              >
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={[styles.moodLabel, { color: C.onSurface }]}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={styles.promptCard}
          onPress={() => navigation.navigate('WriteReflection', {})}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[C.secondaryContainer, `${C.secondary}30`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promptGradient}
          >
            <Ionicons name="pencil-outline" size={20} color={C.onSecondaryContainer} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.promptLabel, { color: C.onSecondaryContainer }]}>Today's Prompt</Text>
              <Text style={[styles.promptText, { color: C.onSurface }]}>"{todayPrompt}"</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.onSecondaryContainer} />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Past Reflections</Text>
            <Text style={[styles.entryCount, { color: C.primary }]}>{reflections.length} {t(reflections.length === 1 ? 'entry' : 'entries')}</Text>
          </View>

          {reflections.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>📖</Text>
              <Text style={[styles.emptyTitle, { color: C.onSurface }]}>Your diary awaits</Text>
              <Text style={[styles.emptySub, { color: C.onSurfaceVariant }]}>Start with a mood, then write freely. Your first entry will appear here.</Text>
            </View>
          ) : (
            reflections.map((entry) => {
              const moodEmoji = getReflectionMoodEmoji(entry);
              const moodScore = getReflectionMoodScore(entry);
              const mood = getMoodByScore(moodScore);
              return (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.entryCard, { backgroundColor: C.surfaceContainerLow }]}
                  onPress={() => navigation.navigate('ReflectionViewer', { reflectionId: entry.id! })}
                  activeOpacity={0.8}
                >
                  <View style={[styles.entryDateBox, { backgroundColor: mood?.color || C.primaryContainer }]}>
                    <Text style={styles.entryMood}>{moodEmoji || '•'}</Text>
                    <Text style={[styles.entryMonth, { color: C.onSurface }]}>
                      {toDate(entry.createdAt).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <View style={styles.entryContent}>
                    <Text translate={false} style={[styles.entryTitle, { color: C.onSurface }]} numberOfLines={1}>
                      {entry.title}
                    </Text>
                    <Text translate={false} style={[styles.entrySnippet, { color: C.onSurfaceVariant }]} numberOfLines={2}>
                      {entry.body}
                    </Text>
                    {normalizeTags(entry.tags).length ? (
                      <View style={styles.entryTagsRow}>
                        {normalizeTags(entry.tags).slice(0, 3).map((tag) => (
                          <View key={tag} style={[styles.entryTag, { backgroundColor: C.primaryContainer }]}>
                            <Text style={[styles.entryTagText, { color: C.onPrimaryContainer }]}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { gap: Spacing[5] },
  heroGradient: { paddingTop: 60, paddingBottom: Spacing[6], paddingHorizontal: Spacing[5], gap: Spacing[4] },
  backBtn: { alignSelf: 'flex-start' },
  heroText: { gap: Spacing[2] },
  heroTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'] },
  heroSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.6 },
  section: { paddingHorizontal: Spacing[5], gap: Spacing[3] },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing[3] },
  sectionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  sectionSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  scoreLegend: { flexDirection: 'row', gap: Spacing[2], borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[2] },
  scoreLegendText: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  chartCard: { borderRadius: 22, padding: Spacing[4], gap: Spacing[3] },
  lineChart: { alignSelf: 'center', position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1 },
  chartSegment: { position: 'absolute', height: 4, borderRadius: Radius.full },
  chartDot: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: Radius.full,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmoji: { fontSize: 11 },
  dayLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  dayLabelCol: { width: 32, alignItems: 'center', gap: 2 },
  dayLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 11 },
  dayDate: { fontFamily: Typography.fontFamily.regular, fontSize: 10 },
  moodPicker: { flexDirection: 'row', gap: Spacing[2] },
  moodBtn: { flex: 1, alignItems: 'center', paddingVertical: Spacing[3], borderRadius: Radius.xl, gap: 4 },
  moodEmoji: { fontSize: 22 },
  moodLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 9 },
  promptCard: { marginHorizontal: Spacing[5] },
  promptGradient: { borderRadius: 20, padding: Spacing[4], flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  promptLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0 },
  promptText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, fontStyle: 'italic', marginTop: 4 },
  entryCount: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  entryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3], borderRadius: 20, padding: Spacing[4] },
  entryDateBox: { width: 58, height: 58, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  entryMood: { fontSize: 19 },
  entryMonth: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  entryContent: { flex: 1, gap: 3 },
  entryTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  entrySnippet: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.5 },
  entryTagsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 3 },
  entryTag: { borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  entryTagText: { fontFamily: Typography.fontFamily.medium, fontSize: 10 },
  emptyState: { alignItems: 'center', padding: Spacing[6], gap: Spacing[3] },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  emptySub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, textAlign: 'center', lineHeight: Typography.fontSize.md * 1.5 },
});
