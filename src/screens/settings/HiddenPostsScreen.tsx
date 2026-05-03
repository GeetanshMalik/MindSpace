import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/authStore';
import { Post, getHiddenPostsForUser, unhidePostForUser } from '../../services/firebase/firestore';

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export const HiddenPostsScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getHiddenPostsForUser(user.uid);
      setPosts(data);
    } catch (e) {
      console.warn('Failed to load hidden posts:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPosts(); }, []);

  const handleUnhide = async (postId: string) => {
    if (!user) return;
    try {
      await unhidePostForUser(postId, user.uid);
      setPosts(prev => prev.filter(p => p.id !== postId));
    } catch (e) {
      Alert.alert('Error', 'Could not unhide post.');
    }
  };

  const openPost = (post: Post) => {
    if (!post.id) return;
    navigation.navigate('PostDetail', { postId: post.id });
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <View style={[styles.backCircle, { backgroundColor: C.surfaceContainerHigh }]}>
            <Ionicons name="chevron-back" size={22} color={C.onSurface} />
          </View>
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.onSurface }]}>Hidden Posts</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={item => item.id || ''}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: C.surfaceContainerLow }]}>
            <TouchableOpacity activeOpacity={0.82} onPress={() => openPost(item)} style={styles.postTapArea}>
              <View style={styles.row}>
                <Avatar name={item.authorName} uri={item.authorPhotoURL || undefined} size={36} />
                <View style={styles.meta}>
                  <Text translate={false} style={[styles.author, { color: C.onSurface }]}>{item.authorName}</Text>
                  <Text style={[styles.time, { color: C.onSurfaceVariant }]}>
                    {item.createdAt?.toDate ? timeAgo(item.createdAt.toDate()) : ''}
                  </Text>
                </View>
              </View>
              {item.content?.trim() ? (
                <Text translate={false} style={[styles.content, { color: C.onSurface }]} numberOfLines={3}>{item.content}</Text>
              ) : null}
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.unhideBtn, { backgroundColor: C.primaryContainer }]}
              onPress={() => handleUnhide(item.id!)}
            >
              <Ionicons name="eye-outline" size={16} color={C.onPrimaryContainer} />
              <Text style={[styles.unhideText, { color: C.onPrimaryContainer }]}>Unhide</Text>
            </TouchableOpacity>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="eye-outline" size={48} color={C.outlineVariant} />
            <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>
              {loading ? 'Loading...' : 'No hidden posts'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing[5], paddingTop: 60, paddingBottom: Spacing[3],
  },
  backBtn: {},
  backCircle: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  list: { padding: Spacing[5], gap: Spacing[3] },
  card: { borderRadius: 16, padding: Spacing[4], gap: Spacing[3] },
  postTapArea: { gap: Spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  meta: { flex: 1, gap: 2 },
  author: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  time: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },
  content: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.5 },
  postImage: { width: '100%', height: 200, borderRadius: 16 },
  unhideBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: Radius.full, paddingHorizontal: Spacing[4], paddingVertical: Spacing[2] },
  unhideText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: Spacing[3] },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
});
