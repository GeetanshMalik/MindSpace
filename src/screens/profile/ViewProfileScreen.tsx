import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/authStore';
import { 
  Post, 
  subscribeToUserPosts, 
  subscribeToFriendshipStatus, 
  sendFriendRequest, 
  acceptFriendRequest, 
  Friendship,
  createNotification,
  subscribeToUserProfile,
} from '../../services/firebase/firestore';
import {
  UserProfile,
  getProfileAbout,
  getProfileDisplayName,
  getProfileHeadline,
  getProfilePhotoURL,
} from '../../types/profile';

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatDateOfBirth = (value?: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
};

export const ViewProfileScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { userId, userName } = route.params || {};
  const { user: currentUser, profile: currentProfile } = useAuthStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const currentDisplayName = getProfileDisplayName(currentProfile, currentUser?.displayName || 'Someone');
  const displayName = getProfileDisplayName(viewedProfile, userName);
  const profilePhotoURL = getProfilePhotoURL(viewedProfile);
  const profileHeadline = getProfileHeadline(viewedProfile);
  const profileAbout = getProfileAbout(viewedProfile);
  const profileDetails = [
    viewedProfile?.email ? { icon: 'mail-outline', label: viewedProfile.email } : null,
    viewedProfile?.location ? { icon: 'location-outline', label: viewedProfile.location } : null,
    viewedProfile?.dateOfBirth ? { icon: 'calendar-outline', label: formatDateOfBirth(viewedProfile.dateOfBirth) } : null,
    viewedProfile?.phoneNumber ? { icon: 'call-outline', label: viewedProfile.phoneNumber } : null,
    viewedProfile?.pronouns ? { icon: 'person-outline', label: viewedProfile.pronouns } : null,
  ].filter(Boolean) as { icon: string; label: string }[];

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToUserPosts(userId, setPosts);
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToUserProfile(userId, setViewedProfile);
  }, [userId]);

  useEffect(() => {
    if (!currentUser || !userId) return;
    return subscribeToFriendshipStatus(currentUser.uid, userId, setFriendship);
  }, [currentUser, userId]);

  const handleAddFriend = async () => {
    if (!currentUser || !userId) return;
    if (friendship?.status === 'pending' && friendship.receiverId === currentUser.uid) {
      await acceptFriendRequest(friendship.id!);
      // Notify requester that request was accepted
      createNotification(friendship.requesterId, {
        type: 'friend_accepted',
        text: `${currentDisplayName} accepted your friend request!`,
        fromUserId: currentUser.uid,
        fromUserName: currentDisplayName,
      }).catch(() => {});
    } else if (!friendship) {
      const friendshipId = await sendFriendRequest(currentUser.uid, userId);
      // Notify target user of friend request with friendshipId for in-app accept
      createNotification(userId, {
        type: 'friend_request',
        text: `${currentDisplayName} sent you a friend request`,
        fromUserId: currentUser.uid,
        fromUserName: currentDisplayName,
        friendshipId,
      }).catch(() => {});
    }
  };

  const handleMessage = () => {
    navigation.navigate('ChatTab', { screen: 'DirectMessage', params: { friendId: userId, friendName: displayName } });
  };

  const openPost = (post: Post) => {
    if (!post.id) return;
    navigation.navigate('PostDetail', { postId: post.id });
  };

  const renderPost = ({ item }: { item: Post }) => (
    <TouchableOpacity
      style={[styles.postCard, { backgroundColor: C.surfaceContainerLow }]}
      activeOpacity={0.82}
      onPress={() => openPost(item)}
    >
      {item.content?.trim() ? (
        <Text translate={false} style={[styles.postContent, { color: C.onSurface }]} numberOfLines={3}>
          {item.content}
        </Text>
      ) : null}
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} resizeMode="cover" />
      ) : null}
      <Text style={[styles.postTime, { color: C.onSurfaceVariant }]}>
        {item.createdAt?.toDate ? timeAgo(item.createdAt.toDate()) : ''} • {item.category || 'General'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <FlatList
        data={posts}
        keyExtractor={item => item.id || ''}
        renderItem={renderPost}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Profile Header */}
            <LinearGradient
              colors={[C.primaryContainer, C.surface]}
              start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }}
              style={styles.hero}
            >
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <View style={[styles.backCircle, { backgroundColor: `${C.surfaceContainerHigh}CC` }]}>
                  <Ionicons name="chevron-back" size={22} color={C.onSurface} />
                </View>
              </TouchableOpacity>

              <Avatar name={displayName || '?'} uri={profilePhotoURL} size={96} />
              <Text translate={false} style={[styles.displayName, { color: C.onSurface }]}>{displayName}</Text>
              <Text translate={false} style={[styles.subtitle, { color: C.primary }]}>{profileHeadline}</Text>
              <Text translate={false} style={[styles.bioText, { color: C.onSurface }]}>{profileAbout}</Text>
              {profileDetails.length > 0 && (
                <View style={styles.detailsWrap}>
                  {profileDetails.map((detail) => (
                    <View key={`${detail.icon}-${detail.label}`} style={[styles.detailPill, { backgroundColor: `${C.surfaceContainerHighest}99` }]}>
                      <Ionicons name={detail.icon as any} size={13} color={C.onSurfaceVariant} />
                      <Text translate={false} style={[styles.detailText, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                        {detail.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={[styles.statsRow, { backgroundColor: C.surfaceContainerLow }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: C.primary }]}>{posts.length}</Text>
                  <Text style={[styles.statLabel, { color: C.onSurfaceVariant }]}>Posts</Text>
                </View>
              </View>

              {currentUser && currentUser.uid !== userId && (
                <View style={styles.actionRow}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: C.primary, flex: 1, opacity: friendship?.status === 'accepted' ? 0.6 : 1 }]}
                    onPress={handleAddFriend}
                    disabled={friendship?.status === 'accepted' || (friendship?.status === 'pending' && friendship.requesterId === currentUser.uid)}
                  >
                    <Ionicons 
                      name={friendship?.status === 'accepted' ? 'checkmark-circle' : friendship?.status === 'pending' && friendship.receiverId === currentUser.uid ? 'person-add' : friendship?.status === 'pending' ? 'time' : 'person-add'} 
                      size={18} color={C.onPrimary} 
                    />
                    <Text style={[styles.actionBtnText, { color: C.onPrimary }]}>
                      {friendship?.status === 'accepted' ? 'Friends' : 
                       friendship?.status === 'pending' && friendship.receiverId === currentUser.uid ? 'Accept Request' : 
                       friendship?.status === 'pending' ? 'Request Sent' : 'Add Friend'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                     style={[styles.actionBtn, { backgroundColor: C.surfaceContainerHighest, marginLeft: 10 }]}
                     onPress={handleMessage}
                  >
                    <Ionicons name="chatbubble-ellipses" size={18} color={C.onSurface} />
                    <Text style={[styles.actionBtnText, { color: C.onSurface }]}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>

            {/* Section title */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: C.onSurface }]}>Recent Posts</Text>
            </View>
          </View>
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={40} color={C.outlineVariant} />
            <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>No posts yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    alignItems: 'center', paddingTop: 60, paddingBottom: Spacing[6],
    paddingHorizontal: Spacing[5], gap: Spacing[2],
  },
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing[3] },
  backCircle: { width: 44, height: 44, borderRadius: Radius.full, justifyContent: 'center', alignItems: 'center' },
  displayName: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'], letterSpacing: 0 },
  subtitle: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  bioText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    lineHeight: Typography.fontSize.sm * 1.6,
    textAlign: 'center',
    marginTop: Spacing[1],
  },
  detailsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing[2],
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  detailText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs, maxWidth: 240 },
  statsRow: {
    flexDirection: 'row', gap: Spacing[6], marginTop: Spacing[3],
    borderRadius: Radius.xl, paddingVertical: Spacing[4], paddingHorizontal: Spacing[6],
  },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'] },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  actionRow: { flexDirection: 'row', width: '100%', marginTop: Spacing[4], paddingHorizontal: Spacing[2] },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing[3], paddingHorizontal: Spacing[4], borderRadius: Radius.full },
  actionBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },
  sectionHeader: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[2] },
  sectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.xl },
  list: { paddingBottom: 100 },
  postCard: { marginHorizontal: Spacing[5], marginBottom: Spacing[3], borderRadius: 16, padding: Spacing[4], gap: Spacing[2] },
  postContent: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, lineHeight: Typography.fontSize.md * 1.5 },
  postImage: { width: '100%', height: 160, borderRadius: 12 },
  postTime: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },
  empty: { alignItems: 'center', paddingVertical: 40, gap: Spacing[3] },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
});
