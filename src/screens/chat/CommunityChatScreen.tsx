import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Image, ActivityIndicator, ActionSheetIOS, Modal } from 'react-native';
import type { AlertButton } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import type { ThemeColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { ProfileAvatar, ProfileName } from '../../components/ProfileAvatar';
import {
  ChatMessage,
  Community,
  subscribeToCommunity,
  subscribeToCommunityMessages,
  sendCommunityMessage,
  joinCommunity,
  leaveCommunity,
  deleteCommunity,
  deleteCommunityMessageForUser,
  deleteCommunityMessageForEveryone,
  MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS,
} from '../../services/firebase/firestore';
import { useTranslation } from '../../i18n/useTranslation';
import { getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { uploadMedia, getMediaPath, getExtensionFromUri, MEDIA_LIMITS } from '../../services/firebase/storage';
import { uploadDocumentToSupabase } from '../../services/supabase/storage';
import { VideoMessageBubble } from '../../components/chat/VideoMessageBubble';
import { ZoomableImageViewer } from '../../components/chat/ZoomableImageViewer';
import { DocumentMessageBubble } from '../../components/chat/DocumentMessageBubble';
import { openDocument } from '../../utils/fileOpener';

const getDocumentMimeType = (fileName?: string, fallback?: string | null): string => {
  if (fallback) return fallback;
  const ext = fileName?.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    zip: 'application/zip',
  };
  return map[ext] || 'application/octet-stream';
};

const getMessageCreatedAtMillis = (value: any) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const canDeleteCommunityMessageForEveryone = (message: ChatMessage, userId?: string | null) => {
  if (!userId || message.senderId !== userId) return false;
  const createdAt = getMessageCreatedAtMillis(message.createdAt);
  return createdAt > 0 && Date.now() - createdAt <= MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS;
};

type CommunityMessageRowProps = {
  item: ChatMessage;
  isMe: boolean;
  colors: ThemeColors;
  onDeleteMessage: (message: ChatMessage) => void;
  onViewImage: (uri: string) => void;
};

const formatTime = (ts: any) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const CommunityMessageRow = React.memo(({
  item,
  isMe,
  colors: C,
  onDeleteMessage,
  onViewImage,
}: CommunityMessageRowProps) => {
  const hasMedia = (item.type === 'image' || item.type === 'video') && item.mediaUrl;

  return (
    <TouchableOpacity
      style={[styles.msgRow, isMe && styles.msgRowMe]}
      activeOpacity={0.9}
      onLongPress={() => onDeleteMessage(item)}
      delayLongPress={350}
    >
      {!isMe && (
        <ProfileAvatar userId={item.senderId} name={item.senderName} uri={item.senderPhotoURL} size={28} />
      )}
      <View style={{ flexShrink: 1, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
        <View
          style={[
            hasMedia ? styles.mediaBubble : styles.bubble,
            isMe
              ? [styles.bubbleMe, { backgroundColor: C.primary }]
              : [styles.bubbleOther, { backgroundColor: C.surfaceContainerHigh }],
          ]}
        >
          {!isMe && (
            <ProfileName
              userId={item.senderId}
              fallbackName={item.senderName}
              style={[styles.senderName, { color: C.primary }, hasMedia && { paddingHorizontal: Spacing[2], paddingTop: Spacing[1] }]}
            />
          )}

          {item.type === 'image' && item.mediaUrl ? (
            <TouchableOpacity onPress={() => onViewImage(item.mediaUrl!)} activeOpacity={0.85}>
              <Image source={{ uri: item.mediaUrl }} style={styles.msgImage} resizeMode="cover" />
            </TouchableOpacity>
          ) : item.type === 'video' && item.mediaUrl ? (
            <VideoMessageBubble uri={item.mediaUrl} />
          ) : item.type === 'document' && item.mediaUrl ? (
            <DocumentMessageBubble
              url={item.mediaUrl}
              fileName={item.fileName}
              isMe={isMe}
            />
          ) : (
            <Text translate={false} style={[styles.bubbleText, { color: isMe ? C.onPrimary : C.onSurface }]}>
              {item.text}
            </Text>
          )}
        </View>
        <Text translate={false} style={[styles.timeText, { color: C.onSurfaceVariant }]}>
          {formatTime(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

CommunityMessageRow.displayName = 'CommunityMessageRow';

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
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Anonymous');
  const currentPhotoURL = getProfilePhotoURL(profile, user?.photoURL);
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isMember, setIsMember] = useState(initialMember);
  const [membersCount, setMembersCount] = useState(initialCount);
  const [communitySnapshot, setCommunitySnapshot] = useState<Community | null>(null);
  const [communityDeleted, setCommunityDeleted] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const deletionAlertShown = useRef(false);

  const displayCommunityName = communitySnapshot?.name || communityName;
  const displayCommunityEmoji = communitySnapshot?.emoji || communityEmoji;
  const isCommunityOwner = !!user?.uid && communitySnapshot?.creatorId === user.uid && !communitySnapshot?.isDefault;

  const closeCommunityRoom = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('CommunityTab');
  }, [navigation]);

  // Subscribe to live community state
  useEffect(() => {
    deletionAlertShown.current = false;
    setCommunityDeleted(false);

    const unsub = subscribeToCommunity(
      communityId,
      (community) => {
        if (!community) {
          setCommunityDeleted(true);
          setCommunitySnapshot(null);
          setMessages([]);
          setIsMember(false);
          setMembersCount(0);
          setShowAttach(false);

          if (!deletionAlertShown.current) {
            deletionAlertShown.current = true;
            Alert.alert(
              t('Community Deleted'),
              t('This community has been deleted by its creator.'),
              [{ text: t('OK'), onPress: closeCommunityRoom }],
              { cancelable: false }
            );
          }
          return;
        }

        setCommunitySnapshot(community);
        setCommunityDeleted(false);
        setMembersCount(
          typeof community.membersCount === 'number'
            ? community.membersCount
            : Array.isArray(community.members)
              ? community.members.length
              : 0
        );
        setIsMember(!!user?.uid && Array.isArray(community.members) && community.members.includes(user.uid));
      },
      (error) => console.warn('Community subscription failed:', error)
    );

    return unsub;
  }, [closeCommunityRoom, communityId, t, user?.uid]);

  // Subscribe to messages
  useEffect(() => {
    if (!isMember) {
      setMessages([]);
      return;
    }
    const unsub = subscribeToCommunityMessages(communityId, setMessages, user?.uid);
    return unsub;
  }, [communityId, isMember, user?.uid]);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  const handleJoin = useCallback(async () => {
    if (!user || communityDeleted) return;
    try {
      await joinCommunity(communityId, user.uid);
    } catch (e) {
      Alert.alert(t('Error'), t('Failed to join community. Please try again.'));
    }
  }, [communityDeleted, communityId, user]);

  const handleLeave = useCallback(async () => {
    if (!user || communityDeleted) return;
    Alert.alert(t('Leave Community'), `${t('Are you sure you want to leave')} ${displayCommunityName}?`, [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Leave'),
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveCommunity(communityId, user.uid);
          } catch (e) {
            Alert.alert(t('Error'), t('Failed to leave community.'));
          }
        },
      },
    ]);
  }, [communityDeleted, communityId, displayCommunityName, t, user]);

  const handleDeleteCommunity = useCallback(() => {
    if (!user || !isCommunityOwner) return;

    Alert.alert(
      t('Delete Community'),
      `${t('Delete')} ${displayCommunityName} ${t('permanently? This removes it for everyone and deletes its community chat.')}`,
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              deletionAlertShown.current = true;
              await deleteCommunity(communityId, user.uid);
              closeCommunityRoom();
            } catch {
              deletionAlertShown.current = false;
              Alert.alert(t('Error'), t('Only the creator can delete this community.'));
            }
          },
        },
      ]
    );
  }, [closeCommunityRoom, communityId, displayCommunityName, isCommunityOwner, t, user]);

  const sendMessageWithNotification = useCallback(
    async (textMsg: string, type?: string, mediaUrl?: string, fileName?: string) => {
      if (!user || communityDeleted) return false;
      try {
        await sendCommunityMessage(communityId, {
          senderId: user.uid,
          senderName: currentDisplayName,
          senderPhotoURL: currentPhotoURL || null,
          text: textMsg,
          type,
          mediaUrl,
          fileName,
        });
        return true;
      } catch (e) {
        Alert.alert(t('Error'), t('Failed to send message.'));
        return false;
      }
    },
    [communityDeleted, communityId, user, currentDisplayName, currentPhotoURL, t]
  );

  const handleSend = useCallback(async () => {
    const textMsg = input.trim();
    if (!textMsg || !user || sending || communityDeleted) return;
    setInput('');
    setSending(true);
    const sent = await sendMessageWithNotification(textMsg);
    if (!sent) setInput(textMsg);
    setSending(false);
  }, [communityDeleted, input, user, sending, sendMessageWithNotification]);

  // ─── Media Pickers ─────────────────────────────────────────────────
  const pickImages = async () => {
    setShowAttach(false);
    if (communityDeleted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMITS.maxImages,
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;
    if (result.assets.length > MEDIA_LIMITS.maxImages) {
      Alert.alert(t('Too many images'), `${t('Max')} ${MEDIA_LIMITS.maxImages} ${t('images at once.')}`);
      return;
    }
    setUploading(true);
    try {
      for (const asset of result.assets) {
        const ext = getExtensionFromUri(asset.uri);
        const path = getMediaPath('community_images', user!.uid, ext);
        const url = await uploadMedia(asset.uri, path, 'image');
        await sendMessageWithNotification('Photo', 'image', url);
      }
    } catch (e: any) {
      Alert.alert(t('Upload Error'), e.message || t('Failed to upload image.'));
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async () => {
    setShowAttach(false);
    if (communityDeleted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = getExtensionFromUri(asset.uri);
      const path = getMediaPath('community_videos', user!.uid, ext);
      const url = await uploadMedia(asset.uri, path, 'video');
      await sendMessageWithNotification('Video', 'video', url);
    } catch (e: any) {
      Alert.alert(t('Upload Error'), e.message || t('Failed to upload video.'));
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    if (communityDeleted) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      const url = await uploadDocumentToSupabase(
        file.uri,
        user!.uid,
        getDocumentMimeType(file.name, file.mimeType),
        file.name
      );
      await sendMessageWithNotification(file.name || 'Document', 'document', url, file.name);
    } catch (e: any) {
      Alert.alert(t('Upload Error'), e.message || t('Failed to upload document.'));
    } finally {
      setUploading(false);
    }
  };

  const handleAttachment = () => {
    if (communityDeleted) return;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('Cancel'), `${t('Photos')} (${t('Max')} ${MEDIA_LIMITS.maxImages})`, t('Video'), t('Document')],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImages();
          else if (buttonIndex === 2) pickVideo();
          else if (buttonIndex === 3) pickDocument();
        }
      );
    } else {
      setShowAttach(true);
    }
  };

  const handleDeleteMessage = useCallback((message: ChatMessage) => {
    if (!user || !message.id) return;

    const deleteForEveryoneAvailable = canDeleteCommunityMessageForEveryone(message, user.uid);

    const deleteForMe = async () => {
      try {
        await deleteCommunityMessageForUser(communityId, message.id!, user.uid);
      } catch {
        Alert.alert(t('Error'), t('Could not delete this message.'));
      }
    };

    const deleteForEveryone = async () => {
      try {
        await deleteCommunityMessageForEveryone(communityId, message.id!, user.uid);
      } catch {
        Alert.alert(t('Error'), t('Delete for everyone is only available for your messages sent within 15 minutes.'));
      }
    };

    const buttons: AlertButton[] = [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Delete for Me'), style: 'destructive', onPress: deleteForMe },
    ];

    if (deleteForEveryoneAvailable) {
      buttons.push({
        text: t('Delete for Everyone'),
        style: 'destructive',
        onPress: deleteForEveryone,
      });
    }

    Alert.alert(t('Delete Message'), t('Choose how to delete this message.'), buttons);
  }, [communityId, t, user]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <CommunityMessageRow
      item={item}
      isMe={item.senderId === user?.uid}
      colors={C}
      onDeleteMessage={handleDeleteMessage}
      onViewImage={setViewingImage}
    />
  ), [C, handleDeleteMessage, user?.uid]);

  const keyExtractor = useCallback((item: ChatMessage, index: number) => (
    item.id || `${item.senderId}-${getMessageCreatedAtMillis(item.createdAt)}-${index}`
  ), []);

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surfaceContainerLow }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={[styles.headerEmoji, { backgroundColor: C.primaryContainer }]}>
          <Text translate={false} style={{ fontSize: 20 }}>{displayCommunityEmoji}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text translate={false} style={[styles.headerName, { color: C.onSurface }]} numberOfLines={1}>
            {displayCommunityName}
          </Text>
          <Text style={[styles.headerMembers, { color: C.onSurfaceVariant }]}>
            {membersCount} {membersCount === 1 ? 'member' : 'members'}
          </Text>
        </View>
        {!communityDeleted && (
          <View style={styles.headerActions}>
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
            {isCommunityOwner && (
              <TouchableOpacity
                style={[styles.deleteCommunityBtn, { backgroundColor: `${C.error}18` }]}
                onPress={handleDeleteCommunity}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={16} color={C.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={keyExtractor}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={18}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyEmoji, { backgroundColor: C.primaryContainer }]}>
                <Text translate={false} style={{ fontSize: 40 }}>{displayCommunityEmoji}</Text>
              </View>
              <Text translate={false} style={[styles.emptyTitle, { color: C.onSurface }]}>{displayCommunityName}</Text>
              <Text style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                {isMember
                  ? 'No messages yet. Be the first to start the conversation!'
                  : 'Join this community to start chatting with others.'}
              </Text>
            </View>
          }
        />

        {/* Input bar — only if member */}
        {communityDeleted ? null : isMember ? (
          <View style={[styles.inputBar, { backgroundColor: C.surfaceContainerLow }]}>
            <TouchableOpacity onPress={handleAttachment} style={styles.attachBtn}>
              <Ionicons name="add" size={24} color={C.primary} />
            </TouchableOpacity>
            <TextInput
              style={[styles.textInput, { color: C.onSurface, backgroundColor: C.surfaceContainerHighest }]}
              placeholder={t('Type a message...')}
              placeholderTextColor={C.onSurfaceVariant}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={1000}
              onSubmitEditing={handleSend}
              blurOnSubmit
              editable={!sending}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() || sending ? C.primary : C.surfaceContainerHighest }]}
              onPress={handleSend}
              disabled={!input.trim() || sending}
              activeOpacity={0.8}
            >
              {sending ? (
                <ActivityIndicator size="small" color={C.onPrimary} />
              ) : (
                <Ionicons name="send" size={18} color={input.trim() ? C.onPrimary : C.onSurfaceVariant} />
              )}
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
              {t('Join')} {displayCommunityName} {t('to start chatting')}
            </Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>

      {/* Attachment Picker Modal */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachSheet, { backgroundColor: C.surface }]}>
            <View style={styles.attachHandle} />
            <Text style={[styles.attachTitle, { color: C.onSurface }]}>Share Media</Text>
            <View style={styles.attachGrid}>
              {[
                { icon: 'image', label: 'Photos', color: '#4CAF50', onPress: pickImages, sub: `${t('Max')} ${MEDIA_LIMITS.maxImages}` },
                { icon: 'videocam', label: 'Video', color: '#2196F3', onPress: pickVideo, sub: `≤${MEDIA_LIMITS.video}MB` },
                { icon: 'document', label: 'Document', color: '#FF9800', onPress: pickDocument, sub: `Any file` },
              ].map((item) => (
                <TouchableOpacity key={item.label} style={styles.attachItem} onPress={item.onPress} activeOpacity={0.7}>
                  <View style={[styles.attachIconBg, { backgroundColor: item.color + '20' }]}>
                    <Ionicons name={item.icon as any} size={28} color={item.color} />
                  </View>
                  <Text style={[styles.attachLabel, { color: C.onSurface }]}>{item.label}</Text>
                  <Text style={[styles.attachSub, { color: C.onSurfaceVariant }]}>{item.sub}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Uploading Overlay */}
      {uploading && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.uploadText}>Uploading...</Text>
        </View>
      )}

      <ZoomableImageViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  joinLeaveBtn: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  deleteCommunityBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  mediaBubble: {
    padding: 3,
    borderRadius: Radius.lg,
    overflow: 'hidden',
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
    marginTop: 2,
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

  // Media
  msgImage: { width: 220, height: 220, borderRadius: 8, marginBottom: 4 },
  msgVideo: { width: 220, height: 220, borderRadius: 8, marginBottom: 4, overflow: 'hidden' },
  attachBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  attachSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, alignItems: 'center' },
  attachHandle: { width: 40, height: 4, backgroundColor: '#ddd', borderRadius: 2, marginBottom: 16 },
  attachTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg, marginBottom: 24 },
  attachGrid: { flexDirection: 'row', justifyContent: 'center', gap: 32, width: '100%' },
  attachItem: { alignItems: 'center', gap: 8 },
  attachIconBg: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  attachLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  attachSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.xs },
  uploadOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  uploadText: { fontFamily: Typography.fontFamily.semiBold, color: '#fff', marginTop: 12 },
});
