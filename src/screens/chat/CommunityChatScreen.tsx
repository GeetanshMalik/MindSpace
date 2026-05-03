import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../../components/Avatar';
import {
  ChatMessage,
  Community,
  subscribeToCommunityMessages,
  sendCommunityMessage,
  joinCommunity,
  leaveCommunity,
} from '../../services/firebase/firestore';
import { getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';

type RouteParams = {
  CommunityChatRoom: {
    communityId: string;
    communityName: string;
    communityEmoji: string;
    membersCount: number;
    isMember: boolean;
  };
};

export const CommunityChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'CommunityChatRoom'>>();
  const { communityId, communityName, communityEmoji, membersCount: initialCount, isMember: initialMember } = route.params;
  const C = useColors();
  const { user, profile } = useAuthStore();
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Anonymous');
  const currentPhotoURL = getProfilePhotoURL(profile, user?.photoURL);
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isMember, setIsMember] = useState(initialMember);
  const [membersCount, setMembersCount] = useState(initialCount);

  // Subscribe to messages
  useEffect(() => {
    const unsub = subscribeToCommunityMessages(communityId, setMessages);
    return unsub;
  }, [communityId]);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  const handleJoin = useCallback(async () => {
    if (!user) return;
    try {
      await joinCommunity(communityId, user.uid);
      setIsMember(true);
      setMembersCount((c) => c + 1);
    } catch (e) {
      Alert.alert('Error', 'Failed to join community. Please try again.');
    }
  }, [communityId, user]);

  const handleLeave = useCallback(async () => {
    if (!user) return;
    Alert.alert('Leave Community', `Are you sure you want to leave ${communityName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveCommunity(communityId, user.uid);
            setIsMember(false);
            setMembersCount((c) => Math.max(0, c - 1));
          } catch (e) {
            Alert.alert('Error', 'Failed to leave community.');
          }
        },
      },
    ]);
  }, [communityId, communityName, user]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');
    try {
      await sendCommunityMessage(communityId, {
        senderId: user.uid,
        senderName: currentDisplayName,
        senderPhotoURL: currentPhotoURL || null,
        text,
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to send message.');
    }
  }, [input, communityId, user]);

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <Avatar name={item.senderName} uri={item.senderPhotoURL || undefined} size={28} />
        )}
        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.bubbleMe, { backgroundColor: C.primary }]
              : [styles.bubbleOther, { backgroundColor: C.surfaceContainerHigh }],
          ]}
        >
          {!isMe && (
            <Text translate={false} style={[styles.senderName, { color: C.primary }]}>{item.senderName}</Text>
          )}
          <Text translate={false} style={[styles.bubbleText, { color: isMe ? C.onPrimary : C.onSurface }]}>
            {item.text}
          </Text>
          <Text translate={false} style={[styles.timeText, { color: isMe ? `${C.onPrimary}88` : C.onSurfaceVariant }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surfaceContainerLow }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={[styles.headerEmoji, { backgroundColor: C.primaryContainer }]}>
          <Text translate={false} style={{ fontSize: 20 }}>{communityEmoji}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text translate={false} style={[styles.headerName, { color: C.onSurface }]} numberOfLines={1}>
            {communityName}
          </Text>
          <Text style={[styles.headerMembers, { color: C.onSurfaceVariant }]}>
            {membersCount} {membersCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.joinLeaveBtn,
            {
              backgroundColor: isMember ? `${C.error}18` : C.primaryContainer,
            },
          ]}
          onPress={isMember ? handleLeave : handleJoin}
          activeOpacity={0.7}
        >
          <Text style={[styles.joinLeaveText, { color: isMember ? C.error : C.primary }]}>
            {isMember ? 'Leave' : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id || `${Math.random()}`}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyEmoji, { backgroundColor: C.primaryContainer }]}>
                <Text translate={false} style={{ fontSize: 40 }}>{communityEmoji}</Text>
              </View>
              <Text translate={false} style={[styles.emptyTitle, { color: C.onSurface }]}>{communityName}</Text>
              <Text style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                {isMember
                  ? 'No messages yet. Be the first to start the conversation!'
                  : 'Join this community to start chatting with others.'}
              </Text>
            </View>
          }
        />

        {/* Input bar — only if member */}
        {isMember ? (
          <View style={[styles.inputBar, { backgroundColor: C.surfaceContainerLow }]}>
            <TextInput
              style={[styles.textInput, { color: C.onSurface, backgroundColor: C.surfaceContainerHighest }]}
              placeholder="Type a message..."
              placeholderTextColor={C.onSurfaceVariant}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() ? C.primary : C.surfaceContainerHighest }]}
              onPress={handleSend}
              disabled={!input.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={18} color={input.trim() ? C.onPrimary : C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinBar, { backgroundColor: C.primary }]}
            onPress={handleJoin}
            activeOpacity={0.85}
          >
            <Ionicons name="people" size={20} color={C.onPrimary} />
            <Text translate={false} style={[styles.joinBarText, { color: C.onPrimary }]}>
              Join {communityName} to start chatting
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerEmoji: {
    width: 44, height: 44, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, gap: 2 },
  headerName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },
  headerMembers: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  joinLeaveBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  joinLeaveText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
  },

  // Messages
  messageList: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  emptyList: { flex: 1, justifyContent: 'center' },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing[2],
    maxWidth: '85%',
  },
  msgRowMe: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  msgAvatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  msgAvatarText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },
  bubble: {
    padding: Spacing[3],
    borderRadius: Radius.lg,
    maxWidth: '92%',
  },
  bubbleMe: { borderBottomRightRadius: Radius.xs },
  bubbleOther: { borderBottomLeftRadius: Radius.xs },
  senderName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    marginBottom: 2,
  },
  bubbleText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.5,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    gap: Spacing[3],
  },
  emptyEmoji: {
    width: 80, height: 80, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['2xl'],
  },
  emptyDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    gap: Spacing[2],
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  textInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    maxHeight: 120,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 2,
  },
  joinBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[4],
    marginHorizontal: Spacing[4],
    marginBottom: Spacing[3],
    borderRadius: Radius.xl,
  },
  joinBarText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
});
