import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { getProfileDisplayName } from '../../types/profile';
import { useTranslation } from '../../i18n/useTranslation';
import {
  subscribeToNotifications, AppNotification,
  markNotificationRead, markAllNotificationsRead,
  markAllNotificationsSeenInBell,
  acceptFriendRequest, deleteNotification, deleteAllNotifications,
  createNotification,
} from '../../services/firebase/firestore';

const FILTER_TABS = ['All', 'Requests', 'Messages', 'Likes', 'Solidarity', 'Comments', 'Streaks'];

const ICON_MAP: Record<string, { icon: string; color: string }> = {
  like: { icon: 'heart', color: '#e57373' },
  solidarity: { icon: 'hand-left', color: '#4db6ac' },
  comment: { icon: 'chatbubble', color: '#64b5f6' },
  message: { icon: 'mail', color: '#5b6287' },
  friend_request: { icon: 'person-add', color: '#446C5E' },
  friend_accepted: { icon: 'people', color: '#446C5E' },
  streak: { icon: 'flame', color: '#ff8f00' },
  reminder: { icon: 'notifications', color: '#4db6ac' },
  community: { icon: 'people-circle', color: '#4db6ac' },
};

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const isToday = (date: Date) => {
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
};

export const NotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Someone');

  // Smart notification text translation: separates user name from translatable template
  const translateNotifText = (text: string): string => {
    // Patterns: "UserName liked your post", "UserName commented: \"text\"", etc.
    const patterns = [
      { regex: /^(.+?) (liked your post)$/, parts: 2 },
      { regex: /^(.+?) (sent solidarity on your post)$/, parts: 2 },
      { regex: /^(.+?) (commented: \".+\")$/, parts: 2 },
      { regex: /^(.+?) (sent you a friend request)$/, parts: 2 },
      { regex: /^(.+?) (accepted your friend request!)$/, parts: 2 },
      { regex: /^(.+?) (sent you a message)$/, parts: 2 },
      { regex: /^(.+?) (sent you a photo)$/, parts: 2 },
      { regex: /^(.+?) (sent you a video)$/, parts: 2 },
      { regex: /^(.+?) (sent you a document)$/, parts: 2 },
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const name = match[1];
        const action = match[2];
        // Handle commented with quoted text specially
        if (action.startsWith('commented:')) {
          const commentMatch = action.match(/^commented: (\".*\")$/);
          if (commentMatch) {
            return `${name} ${t('commented:')} ${commentMatch[1]}`;
          }
        }
        return `${name} ${t(action)}`;
      }
    }
    return t(text);
  };
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setLoading(false);
    });
    return unsub;
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return undefined;
      markAllNotificationsSeenInBell(user.uid).catch(() => {});
      return undefined;
    }, [user?.uid])
  );

  const filteredNotifications = useMemo(() => notifications.filter(n => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Requests') return n.type === 'friend_request' || n.type === 'friend_accepted';
    if (activeFilter === 'Messages') return n.type === 'message';
    if (activeFilter === 'Likes') return n.type === 'like';
    if (activeFilter === 'Solidarity') return n.type === 'solidarity';
    if (activeFilter === 'Comments') return n.type === 'comment';
    if (activeFilter === 'Streaks') return n.type === 'streak' || n.type === 'reminder';
    return true;
  }), [activeFilter, notifications]);

  const todayNotifs = filteredNotifications.filter(n => {
    try { return n.createdAt?.toDate && isToday(n.createdAt.toDate()); } catch { return false; }
  });
  const earlierNotifs = filteredNotifications.filter(n => {
    try { return !n.createdAt?.toDate || !isToday(n.createdAt.toDate()); } catch { return true; }
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    if (!user) return;
    try { await markAllNotificationsRead(user.uid); }
    catch { Alert.alert('Error', 'Could not mark notifications as read.'); }
  };

  const handleDeleteAll = () => {
    if (!user || notifications.length === 0) return;
    Alert.alert('Delete Notifications', 'Delete all notifications from your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try { await deleteAllNotifications(user.uid); }
          catch { Alert.alert('Error', 'Could not delete notifications.'); }
        },
      },
    ]);
  };

  const handleNotifPress = async (notif: AppNotification) => {
    if (!user) return;
    if (!notif.read && notif.id) {
      markNotificationRead(user.uid, notif.id).catch(() => {});
    }

    if (notif.type === 'message' && notif.fromUserId) {
      navigation.navigate('ChatTab', {
        screen: 'DirectMessage',
        params: { friendId: notif.fromUserId, friendName: notif.fromUserName || 'Friend' },
      });
      return;
    }

    if (notif.postId) {
      navigation.navigate('PostDetail', {
        postId: notif.postId,
        highlightCommentId: notif.type === 'comment' ? notif.commentId : undefined,
      });
      return;
    }

    if (notif.fromUserId) {
      navigation.navigate('CommunityTab', {
        screen: 'ViewProfile',
        params: { userId: notif.fromUserId, userName: notif.fromUserName || 'Mindspace user' },
      });
    }
  };

  const handleAcceptFriend = async (notif: AppNotification) => {
    if (!notif.friendshipId || !user) {
      Alert.alert('Info', 'Navigate to their profile to accept the request.');
      return;
    }
    try {
      await acceptFriendRequest(notif.friendshipId);
      if (notif.fromUserId) {
        createNotification(notif.fromUserId, {
          type: 'friend_accepted',
          text: `${currentDisplayName} accepted your friend request!`,
          fromUserId: user.uid,
          fromUserName: currentDisplayName,
        }).catch(() => {});
      }
      if (notif.id) await deleteNotification(user.uid, notif.id);
      Alert.alert('Friend Added!', `You and ${notif.fromUserName || 'this user'} are now friends.`);
    } catch {
      Alert.alert('Error', 'Could not accept request.');
    }
  };

  const handleDeclineFriend = async (notif: AppNotification) => {
    if (!notif.id || !user) return;
    try { await deleteNotification(user.uid, notif.id); }
    catch { Alert.alert('Error', 'Could not decline request.'); }
  };

  const handleDeleteSelected = async () => {
    if (!selectedNotification?.id || !user) return;
    const notificationId = selectedNotification.id;
    setSelectedNotification(null);
    try { await deleteNotification(user.uid, notificationId); }
    catch { Alert.alert('Error', 'Could not delete notification.'); }
  };

  const renderNotification = ({ item }: { item: AppNotification }) => {
    const iconInfo = ICON_MAP[item.type] || ICON_MAP.reminder;
    let time = 'just now';
    try { if (item.createdAt?.toDate) time = timeAgo(item.createdAt.toDate()); } catch {}

    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          { backgroundColor: item.read ? C.surfaceContainerLow : C.primaryContainer + '55' },
          !item.read && { borderColor: C.primary + '55' },
        ]}
        onPress={() => handleNotifPress(item)}
        onLongPress={() => setSelectedNotification(item)}
        delayLongPress={350}
        activeOpacity={0.78}
      >
        <View style={[styles.iconCircle, { backgroundColor: `${iconInfo.color}20` }]}>
          <Ionicons name={iconInfo.icon as any} size={20} color={iconInfo.color} />
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: C.primary }]} />}
        </View>

        <View style={styles.notifContent}>
          <Text
            translate={false}
            style={[
              styles.notifText,
              { color: C.onSurface },
              !item.read && { fontFamily: Typography.fontFamily.semiBold },
            ]}
            numberOfLines={3}
          >
            {translateNotifText(item.text)}
          </Text>
          <Text style={[styles.notifTime, { color: C.onSurfaceVariant }]}>{time}</Text>

          {item.type === 'friend_request' && (
            <View style={styles.friendActions}>
              <TouchableOpacity
                style={[styles.acceptBtn, { backgroundColor: C.primary }]}
                onPress={() => handleAcceptFriend(item)}
              >
                <Ionicons name="checkmark" size={14} color={C.onPrimary} />
                <Text style={[styles.actionBtnText, { color: C.onPrimary }]}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.declineBtn, { backgroundColor: C.surfaceContainerHighest }]}
                onPress={() => handleDeclineFriend(item)}
              >
                <Ionicons name="close" size={14} color={C.onSurfaceVariant} />
                <Text style={[styles.actionBtnText, { color: C.onSurfaceVariant }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={17} color={C.onSurfaceVariant} />
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: C.onSurfaceVariant }]}>{title}</Text>
    </View>
  );

  const allData: { type: 'header' | 'item'; data?: AppNotification; title?: string }[] = [];
  if (todayNotifs.length > 0) {
    allData.push({ type: 'header', title: 'Today' });
    todayNotifs.forEach(n => allData.push({ type: 'item', data: n }));
  }
  if (earlierNotifs.length > 0) {
    allData.push({ type: 'header', title: 'Earlier' });
    earlierNotifs.forEach(n => allData.push({ type: 'item', data: n }));
  }

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: C.surfaceContainerLow }]}>
          <Ionicons name="chevron-back" size={22} color={C.onSurface} />
        </TouchableOpacity>
        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: C.onSurface }]}>Notifications</Text>
          <Text style={[styles.subtitle, { color: C.onSurfaceVariant }]}>
            {unreadCount > 0 ? `${unreadCount} unread` : `${notifications.length} total`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={[styles.headerIconBtn, { backgroundColor: C.surfaceContainerLow, opacity: unreadCount > 0 ? 1 : 0.45 }]}
            disabled={unreadCount === 0}
          >
            <Ionicons name="checkmark-done-outline" size={19} color={C.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteAll}
            style={[styles.headerIconBtn, { backgroundColor: C.surfaceContainerLow, opacity: notifications.length > 0 ? 1 : 0.45 }]}
            disabled={notifications.length === 0}
          >
            <Ionicons name="trash-outline" size={18} color={C.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.filterScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.filterTab,
              {
                backgroundColor: activeFilter === tab ? C.primary : C.surfaceContainerLow,
                borderColor: activeFilter === tab ? C.primary : C.outlineVariant + '55',
              },
            ]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[
              styles.filterText,
              { color: activeFilter === tab ? C.onPrimary : C.onSurfaceVariant },
            ]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
      ) : allData.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: `${C.outlineVariant}15` }]}>
            <Ionicons name="notifications-off-outline" size={44} color={C.outlineVariant} />
          </View>
          <Text style={[styles.emptyTitle, { color: C.onSurface }]}>No notifications</Text>
          <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>
            Likes, comments, messages, and friend activity will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allData}
          keyExtractor={(item, i) => item.data?.id || `header-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            if (item.type === 'header') return renderSectionHeader(item.title!);
            return renderNotification({ item: item.data! });
          }}
        />
      )}

      <Modal visible={!!selectedNotification} transparent animationType="fade" onRequestClose={() => setSelectedNotification(null)}>
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setSelectedNotification(null)}>
          <View style={[styles.actionSheet, { backgroundColor: C.surface }]}>
            <View style={styles.actionHandle} />
            <Text style={[styles.actionTitle, { color: C.onSurface }]}>Notification Options</Text>
            {selectedNotification && (
              <View style={[styles.previewBox, { backgroundColor: C.surfaceContainerLow }]}>
                <Text translate={false} style={[styles.previewText, { color: C.onSurface }]} numberOfLines={2}>
                  {selectedNotification.text}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.sheetAction} onPress={handleDeleteSelected}>
              <Ionicons name="trash-outline" size={20} color={C.error} />
              <Text style={[styles.sheetActionText, { color: C.error }]}>Delete Notification</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingTop: 56,
    paddingBottom: Spacing[3],
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: { flex: 1 },
  title: { fontFamily: Typography.fontFamily.bold, fontSize: 26 },
  subtitle: { fontFamily: Typography.fontFamily.regular, fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },

  filterScroll: { maxHeight: 52, flexGrow: 0 },
  filterRow: { paddingHorizontal: Spacing[5], gap: Spacing[2], paddingBottom: Spacing[3] },
  filterTab: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  filterText: { fontFamily: Typography.fontFamily.medium, fontSize: 13 },

  list: { paddingBottom: 40 },
  sectionHeader: { paddingHorizontal: Spacing[5], paddingTop: Spacing[4], paddingBottom: Spacing[2] },
  sectionTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    marginHorizontal: Spacing[5],
    marginBottom: Spacing[3],
    padding: Spacing[4],
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadow.subtle,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  notifContent: { flex: 1, gap: 4 },
  notifText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  notifTime: { fontFamily: Typography.fontFamily.regular, fontSize: 12 },

  friendActions: { flexDirection: 'row', gap: Spacing[2], marginTop: Spacing[2] },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  actionBtnText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing[3], paddingHorizontal: Spacing[8] },
  emptyIcon: { width: 86, height: 86, borderRadius: 43, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing[1] },
  emptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },

  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  actionSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    paddingBottom: 40,
  },
  actionHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: Spacing[3],
  },
  actionTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, marginBottom: Spacing[3] },
  previewBox: { borderRadius: 14, padding: Spacing[3], marginBottom: Spacing[2] },
  previewText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[4],
  },
  sheetActionText: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
});
