import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { createReflection, subscribeToUserReflection, updateReflectionEntry } from '../../services/firebase/firestore';
import { getMoodByLabel, getMoodByScore, MOOD_OPTIONS } from '../../utils/mood';
import { useTranslation } from '../../i18n/useTranslation';

const TAGS = ['Gratitude', 'Growth', 'Anxiety', 'Family', 'Work', 'Health', 'Joy', 'Grief', 'Love', 'Hope'];
export const WriteReflectionScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const { locale, t } = useTranslation();
  const isEditing = !!route.params?.reflectionId;
  const reflectionId = route.params?.reflectionId as string | undefined;

  const today = new Date();
  const dateStr = today.toLocaleDateString(locale, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selectedMoodScore, setSelectedMoodScore] = useState<number | null>(
    typeof route.params?.moodScore === 'number' ? route.params.moodScore : null
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !reflectionId) return;
    return subscribeToUserReflection(user.uid, reflectionId, (reflection) => {
      if (!reflection) return;
      setTitle(reflection.title || '');
      setBody(reflection.body || '');
      setSelectedMoodScore(reflection.moodScore || getMoodByLabel(reflection.mood)?.score || null);
      const tags = Array.isArray(reflection.tags)
        ? reflection.tags
        : reflection.tags
          ? reflection.tags.split(',').filter(Boolean)
          : [];
      setSelectedTags(tags);
    });
  }, [user, reflectionId]);

  useEffect(() => {
    if (isEditing) return;
    if (typeof route.params?.moodScore === 'number') setSelectedMoodScore(route.params.moodScore);
  }, [isEditing, route.params?.moodScore]);

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const handleSave = async () => {
    if (!body.trim()) {
      Alert.alert(t('Empty entry'), t('Write something in your diary first.'));
      return;
    }
    if (!selectedMoodScore) {
      Alert.alert(t('Mood required'), t('Select how you feel before saving this diary entry.'));
      return;
    }
    if (!user) {
      Alert.alert(t('Sign in required'), t('Please sign in to save your reflection.'));
      return;
    }
    const tagsStr = selectedTags.join(',');
    const entryTitle = title.trim() || `${t('Dear Diary')}, ${today.toLocaleDateString(locale, { month: 'short', day: 'numeric' })}`;
    const selectedMood = getMoodByScore(selectedMoodScore);
    setSaving(true);
    try {
      if (isEditing && reflectionId) {
        await updateReflectionEntry(user.uid, reflectionId, {
          title: entryTitle,
          body: body.trim(),
          tags: tagsStr,
          mood: selectedMood?.label || null,
          moodScore: selectedMood?.score || null,
          moodEmoji: selectedMood?.emoji || null,
        });
      } else {
        await createReflection(user.uid, {
          title: entryTitle,
          body: body.trim(),
          tags: tagsStr,
          mood: selectedMood?.label || null,
          moodScore: selectedMood?.score || null,
          moodEmoji: selectedMood?.emoji || null,
        });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t('Error'), e.message || t('Could not save this reflection.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: C.onSurface }]}>Dear Diary</Text>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>
        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: C.primary }, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          <Text style={[styles.saveBtnText, { color: C.onPrimary }]}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Date */}
        <Text style={[styles.dateText, { color: C.onSurfaceVariant }]}>{dateStr}</Text>

        {/* Dear Diary salutation */}
        <Text style={[styles.salutation, { color: C.onSurface }]}>Dear Diary,</Text>

        {/* Optional title */}
        <TextInput
          style={[styles.titleInput, { color: C.onSurface, borderBottomColor: C.outlineVariant + '44' }]}
          placeholder={t('Give this entry a title (optional)...')}
          placeholderTextColor={C.onSurfaceVariant + '88'}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />

        {/* Body */}
        <View style={[styles.bodyWrapper, { backgroundColor: C.surfaceContainerLow }]}>
          <TextInput
            style={[styles.bodyInput, { color: C.onSurface }]}
            placeholder={t('Today I want to write about...\n\nRemember: this diary is private to your account. Write freely without judgement.')}
            placeholderTextColor={C.onSurfaceVariant + '77'}
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            autoFocus={!isEditing}
          />
        </View>

        {/* Privacy notice */}
        <View style={[styles.privacyNote, { backgroundColor: C.primaryContainer + '55' }]}>
          <Ionicons name="lock-closed-outline" size={14} color={C.primary} />
          <Text style={[styles.privacyText, { color: C.onPrimaryContainer }]}>This entry is saved privately to your account and never shared.</Text>
        </View>

        {/* Mood tracker */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: C.onSurfaceVariant }]}>How are you feeling?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moodRow}>
            {MOOD_OPTIONS.map(m => (
              <TouchableOpacity
                key={m.label}
                style={[styles.moodBtn, { backgroundColor: C.surfaceContainerHighest }, selectedMoodScore === m.score && { backgroundColor: m.color, borderWidth: 1.5, borderColor: C.primary }]}
                onPress={() => setSelectedMoodScore(m.score)}
                activeOpacity={0.8}
              >
                <Text style={styles.moodEmoji}>{m.emoji}</Text>
                <Text style={[styles.moodLabel, { color: C.onSurfaceVariant }]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tags */}
        <View style={styles.sectionBlock}>
          <Text style={[styles.sectionLabel, { color: C.onSurfaceVariant }]}>Tag this entry</Text>
          <View style={styles.tagsWrap}>
            {TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, { backgroundColor: C.surfaceContainerHighest }, selectedTags.includes(tag) && { backgroundColor: C.primaryContainer }]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={[styles.tagText, { color: C.onSurfaceVariant }, selectedTags.includes(tag) && { color: C.onPrimaryContainer }]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Writing prompt */}
        <View style={[styles.promptCard, { backgroundColor: C.secondaryContainer + '66' }]}>
          <Ionicons name="sparkles-outline" size={18} color={C.secondary} />
          <Text style={[styles.promptText, { color: C.onSurface }]}>
            Writing prompt: What is one thing that happened today that you want to remember five years from now?
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingTop: 60, paddingBottom: Spacing[4],
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  headerTitle: {
    fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl,
    fontStyle: 'italic',
  },
  lockIcon: { fontSize: 16 },
  saveBtn: {
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4], paddingVertical: Spacing[2],
  },
  saveBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },

  content: { padding: Spacing[5], paddingTop: Spacing[3], gap: Spacing[4], paddingBottom: 60 },
  dateText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  salutation: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, fontStyle: 'italic' },
  titleInput: {
    fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize['2xl'],
    letterSpacing: 0,
    borderBottomWidth: 1,
    paddingBottom: Spacing[2],
  },
  bodyWrapper: {
    borderRadius: Radius.xl, padding: Spacing[4], minHeight: 220,
  },
  bodyInput: {
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.lg,
    lineHeight: Typography.fontSize.lg * 1.8, minHeight: 200,
  },
  privacyNote: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2], borderRadius: Radius.md, padding: Spacing[3] },
  privacyText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },

  sectionBlock: { gap: Spacing[3] },
  sectionLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  moodRow: { gap: Spacing[3] },
  moodBtn: { alignItems: 'center', gap: 4, padding: Spacing[3], borderRadius: Radius.xl, minWidth: 60 },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 10 },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2] },
  tag: { borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  tagText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },

  promptCard: { flexDirection: 'row', gap: Spacing[3], borderRadius: Radius.xl, padding: Spacing[4], alignItems: 'flex-start' },
  promptText: { flex: 1, fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm, lineHeight: Typography.fontSize.sm * 1.6, fontStyle: 'italic' },
});
