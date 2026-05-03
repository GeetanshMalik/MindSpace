import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { useTranslation } from '../../i18n/useTranslation';
import {
  deleteReflectionEntry,
  Reflection,
  subscribeToUserReflection,
} from '../../services/firebase/firestore';

const toDate = (value: any) => {
  if (!value) return new Date();
  if (value.toDate) return value.toDate();
  if (typeof value === 'number') return new Date(value * 1000);
  return new Date(value);
};

const normalizeTags = (tags?: string[] | string) => {
  if (Array.isArray(tags)) return tags;
  return tags ? tags.split(',').filter(Boolean) : [];
};

export const ReflectionViewerScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const { locale, t } = useTranslation();
  const reflectionId = route.params?.reflectionId as string | undefined;
  const [reflection, setReflection] = useState<Reflection | null>(null);

  useEffect(() => {
    if (!user || !reflectionId) return;
    return subscribeToUserReflection(user.uid, reflectionId, setReflection);
  }, [user, reflectionId]);

  const entryDate = useMemo(
    () => toDate(reflection?.createdAt),
    [reflection?.createdAt]
  );

  const handleEdit = () => {
    if (!reflectionId) return;
    navigation.navigate('WriteReflection', { reflectionId });
  };

  const handleDelete = () => {
    if (!user || !reflectionId) return;
    Alert.alert(t('Delete Reflection'), t('Delete this diary entry?'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteReflectionEntry(user.uid, reflectionId);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <LinearGradient
        colors={[C.primaryContainer, C.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconBtn, { backgroundColor: `${C.surfaceContainerHighest}99` }]}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: C.onSurface }]}>Dear Diary</Text>
          <Text style={[styles.headerDate, { color: C.onSurfaceVariant }]}>
            {entryDate.toLocaleDateString(locale, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity onPress={handleEdit} style={[styles.iconBtn, { backgroundColor: C.primary }]}>
          <Ionicons name="pencil-outline" size={19} color={C.onPrimary} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!reflection ? (
          <View style={styles.empty}>
            <Ionicons name="book-outline" size={42} color={C.outlineVariant} />
            <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>Opening your diary...</Text>
          </View>
        ) : (
          <View style={[styles.paper, { backgroundColor: C.surfaceContainerLowest, ...Shadow.ambient }]}>
            <View style={[styles.paperMargin, { backgroundColor: `${C.error}55` }]} />
            <View style={styles.paperContent}>
              <Text style={[styles.dateLine, { color: C.onSurfaceVariant }]}>
                {entryDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </Text>
              <Text translate={false} style={[styles.title, { color: C.onSurface }]}>{reflection.title}</Text>
              {!!reflection.mood && (
                <View style={[styles.moodPill, { backgroundColor: C.primaryContainer }]}>
                  <Ionicons name="heart-outline" size={14} color={C.primary} />
                  <Text style={[styles.moodText, { color: C.onPrimaryContainer }]}>{reflection.mood}</Text>
                </View>
              )}
              <View style={styles.bodyLines}>
                {reflection.body.split('\n').map((paragraph, index) => (
                  <Text translate={false} key={`${index}-${paragraph.slice(0, 8)}`} style={[styles.bodyText, { color: C.onSurface }]}>
                    {paragraph || ' '}
                  </Text>
                ))}
              </View>
              {normalizeTags(reflection.tags).length > 0 && (
                <View style={styles.tags}>
                  {normalizeTags(reflection.tags).map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: `${C.primary}18` }]}>
                      <Text style={[styles.tagText, { color: C.primary }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {reflection && (
          <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: `${C.error}14` }]} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={18} color={C.error} />
            <Text style={[styles.deleteText, { color: C.error }]}>Delete Reflection</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 58,
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl, fontStyle: 'italic' },
  headerDate: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, textAlign: 'center' },
  content: { padding: Spacing[5], paddingBottom: 80, gap: Spacing[4] },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing[3] },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  paper: {
    borderRadius: Radius.lg,
    minHeight: 520,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  paperMargin: { width: 3, marginLeft: 34 },
  paperContent: { flex: 1, padding: Spacing[5], paddingLeft: Spacing[4], gap: Spacing[3] },
  dateLine: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'], letterSpacing: 0 },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
  },
  moodText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.xs },
  bodyLines: { gap: Spacing[2], paddingTop: Spacing[2] },
  bodyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.lg,
    lineHeight: Typography.fontSize.lg * 1.85,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(120,120,120,0.18)',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing[2], paddingTop: Spacing[3] },
  tag: { borderRadius: Radius.full, paddingHorizontal: Spacing[3], paddingVertical: Spacing[1] },
  tagText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: Radius.full,
    paddingVertical: Spacing[3],
  },
  deleteText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
});
