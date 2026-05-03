import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TextInput, Image, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Keyboard, Alert, Modal, ActionSheetIOS, Dimensions } from 'react-native';
import { Text } from '../../components/TranslatedText';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { Avatar } from '../../components/Avatar';
import { useAuthStore } from '../../store/authStore';
import {
  DirectMessage,
  subscribeToDirectMessages,
  sendDirectMessage,
  getChatId,
  deleteDirectMessageForUser,
  deleteAllDirectMessagesForUser,
  subscribeToUserProfile,
  createNotification,
  DMType,
} from '../../services/firebase/firestore';
import { uploadMedia, getMediaPath, getExtensionFromUri, MEDIA_LIMITS } from '../../services/firebase/storage';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const DirectMessageScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { user, profile } = useAuthStore();
  const { friendId, friendName } = route.params || {};

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<DirectMessage | null>(null);
  const [showMsgActions, setShowMsgActions] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const displayFriendName = getProfileDisplayName(friendProfile, friendName);
  const friendPhotoURL = getProfilePhotoURL(friendProfile);
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Someone');

  useEffect(() => {
    if (!user || !friendId) return;
    const chatId = getChatId(user.uid, friendId);
    const unsub = subscribeToDirectMessages(chatId, user.uid, setMessages);
    return unsub;
  }, [user, friendId]);

  useEffect(() => {
    if (!friendId) return;
    return subscribeToUserProfile(friendId, setFriendProfile);
  }, [friendId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    }
  }, [messages.length]);

  // ─── Send Text ─────────────────────────────────────────────────────
  const sendMessageWithNotification = useCallback(async (
    messageText: string,
    type: DMType = 'text',
    mediaUrl?: string,
    fileName?: string
  ) => {
    if (!user || !friendId) return;
    const chatId = getChatId(user.uid, friendId);
    await sendDirectMessage(user.uid, friendId, messageText, type, mediaUrl, fileName);
    const label = type === 'image' ? 'a photo'
      : type === 'video' ? 'a video'
      : type === 'document' ? 'a document'
      : 'a message';
    createNotification(friendId, {
      type: 'message',
      text: `${currentDisplayName} sent you ${label}`,
      fromUserId: user.uid,
      fromUserName: currentDisplayName,
      chatId,
    }).catch(() => {});
  }, [user, friendId, currentDisplayName]);

  const handleSend = useCallback(async () => {
    const textMsg = text.trim();
    if (!textMsg || !user || !friendId) return;
    Keyboard.dismiss();
    setText('');
    try {
      await sendMessageWithNotification(textMsg);
    } catch (e) {
      console.error('Failed to send DM', e);
    }
  }, [text, user, friendId, sendMessageWithNotification]);

  // ─── Media Pickers ─────────────────────────────────────────────────
  const pickImages = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MEDIA_LIMITS.maxImages,
      quality: 0.8,
    });
    if (result.canceled || !result.assets.length) return;
    if (result.assets.length > MEDIA_LIMITS.maxImages) {
      Alert.alert('Too many images', `Max ${MEDIA_LIMITS.maxImages} images at once.`);
      return;
    }
    setUploading(true);
    try {
      for (const asset of result.assets) {
        const ext = getExtensionFromUri(asset.uri);
        const path = getMediaPath('chat_images', user!.uid, ext);
        const url = await uploadMedia(asset.uri, path, 'image');
        await sendMessageWithNotification('Photo', 'image', url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
    }
  };

  const pickVideo = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const ext = getExtensionFromUri(result.assets[0].uri);
      const path = getMediaPath('chat_videos', user!.uid, ext);
      const url = await uploadMedia(result.assets[0].uri, path, 'video');
      await sendMessageWithNotification('Video', 'video', url);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload video.');
    } finally {
      setUploading(false);
    }
  };

  const pickDocument = async () => {
    setShowAttach(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      const ext = getExtensionFromUri(file.uri);
      const path = getMediaPath('chat_docs', user!.uid, ext);
      const url = await uploadMedia(file.uri, path, 'document');
      await sendMessageWithNotification(file.name || 'Document', 'document', url, file.name);
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  // ─── Message Actions ───────────────────────────────────────────────
  const handleLongPress = (msg: DirectMessage) => {
    setSelectedMsg(msg);
    setShowMsgActions(true);
  };

  const handleCopy = () => {
    if (selectedMsg) Clipboard.setStringAsync(selectedMsg.text);
    setShowMsgActions(false);
    setSelectedMsg(null);
  };

  const handleDeleteMsg = async () => {
    if (!selectedMsg?.id || !user) return;
    setShowMsgActions(false);
    Alert.alert('Delete Message', 'Delete this message from your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try { await deleteDirectMessageForUser(selectedMsg.id!, user.uid); } catch { Alert.alert('Error', 'Could not delete.'); }
          setSelectedMsg(null);
        },
      },
    ]);
  };

  const handleForward = () => {
    if (!selectedMsg) return;
    setShowMsgActions(false);
    Alert.alert('Forward', `Message copied to clipboard. Open another chat to paste.\n\n"${selectedMsg.text}"`);
    Clipboard.setStringAsync(selectedMsg.text);
    setSelectedMsg(null);
  };

  const handleDeleteAll = () => {
    if (!user || !friendId) return;
    Alert.alert('Delete Chat', 'Delete this chat from your account? The other person will still keep their copy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive',
        onPress: async () => {
          try {
            const chatId = getChatId(user.uid, friendId);
            await deleteAllDirectMessagesForUser(chatId, user.uid);
          } catch { Alert.alert('Error', 'Could not delete messages.'); }
        },
      },
    ]);
  };

  // ─── Profile Navigation ────────────────────────────────────────────
  const goToProfile = () => {
    navigation.navigate('CommunityTab', { screen: 'ViewProfile', params: { userId: friendId, userName: displayFriendName } });
  };

  // ─── Time Formatting ──────────────────────────────────────────────
  const formatTime = (ts: any) => {
    if (!ts?.toMillis) return '';
    const d = new Date(ts.toMillis());
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ─── Render Message ────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isMe = item.senderId === user?.uid;
    const msgType = item.type || 'text';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
          {!isMe && (
            <View style={styles.avatarWrap}>
              <Avatar name={displayFriendName || '?'} uri={friendPhotoURL} size={28} />
            </View>
          )}
          <View
            style={[
              styles.bubble,
              isMe
                ? [styles.bubbleMe, { backgroundColor: C.primary }]
                : [styles.bubbleThem, { backgroundColor: C.surfaceContainerHigh }],
            ]}
          >
            {/* Media content */}
            {msgType === 'image' && item.mediaUrl && (
              <TouchableOpacity onPress={() => setViewingImage(item.mediaUrl!)}>
                <Image source={{ uri: item.mediaUrl }} style={styles.mediaBubbleImage} resizeMode="cover" />
              </TouchableOpacity>
            )}
            {msgType === 'video' && item.mediaUrl && (
              <TouchableOpacity onPress={() => Alert.alert('Video', 'Tap to play in browser.')}>
                <View style={[styles.mediaBubbleImage, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="play-circle" size={48} color="#fff" />
                </View>
              </TouchableOpacity>
            )}
            {msgType === 'document' && (
              <View style={styles.docBubble}>
                <Ionicons name="document-outline" size={24} color={isMe ? C.onPrimary : C.primary} />
                <Text translate={false} style={[styles.docName, { color: isMe ? C.onPrimary : C.onSurface }]} numberOfLines={1}>
                  {item.fileName || 'Document'}
                </Text>
              </View>
            )}

            {/* Text */}
            {(msgType === 'text' || !item.mediaUrl) && (
              <Text translate={false} style={[styles.bubbleText, { color: isMe ? C.onPrimary : C.onSurface }]}>
                {item.text}
              </Text>
            )}
            {!!item.createdAt && (
            <Text translate={false} style={[styles.timeText, { color: isMe ? `${C.onPrimary}88` : C.onSurfaceVariant }]}>
                {formatTime(item.createdAt)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const sortedMessages = messages.slice().reverse();

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <LinearGradient
        colors={[C.primaryContainer, C.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <View style={[styles.backCircle, { backgroundColor: C.surfaceContainer }]}>
            <Ionicons name="chevron-back" size={24} color={C.onSurface} />
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerProfile} onPress={goToProfile} activeOpacity={0.7}>
          <Avatar name={displayFriendName || '?'} uri={friendPhotoURL} size={40} />
          <View style={styles.headerInfo}>
            <Text translate={false} style={[styles.headerName, { color: C.onSurface }]} numberOfLines={1}>
              {displayFriendName}
            </Text>
            <View style={styles.onlineRow}>
              <View style={[styles.onlineDot, { backgroundColor: '#4caf50' }]} />
              <Text style={[styles.onlineLabel, { color: C.onSurfaceVariant }]}>Online</Text>
            </View>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteAll} style={styles.headerAction}>
          <Ionicons name="trash-outline" size={20} color={C.onSurfaceVariant} />
        </TouchableOpacity>
      </LinearGradient>

      {/* Messages + Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={sortedMessages}
          keyExtractor={item => item.id || Math.random().toString()}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messageList,
            sortedMessages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.primaryContainer }]}>
                <Ionicons name="chatbubbles-outline" size={40} color={C.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.onSurface }]}>Start a conversation</Text>
              <Text translate={false} style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                Say hi to {displayFriendName}! Your messages are private.
              </Text>
            </View>
          }
        />

        {/* Upload indicator */}
        {uploading && (
          <View style={[styles.uploadBar, { backgroundColor: C.primaryContainer }]}>
            <Text style={[styles.uploadText, { color: C.onPrimaryContainer }]}>Uploading media...</Text>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: C.surfaceContainerLow }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.attachBtn}>
            <Ionicons name="attach" size={24} color={C.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: C.surfaceContainerHighest, color: C.onSurface }]}
            placeholder={`Message ${displayFriendName}...`}
            placeholderTextColor={C.onSurfaceVariant}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: text.trim() ? C.primary : C.surfaceContainerHighest }]}
            onPress={handleSend}
            disabled={!text.trim()}
            activeOpacity={0.8}
          >
            <Ionicons name="send" size={18} color={text.trim() ? C.onPrimary : C.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Picker Modal */}
      <Modal visible={showAttach} transparent animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <View style={[styles.attachSheet, { backgroundColor: C.surface }]}>
            <View style={styles.attachHandle} />
            <Text style={[styles.attachTitle, { color: C.onSurface }]}>Share Media</Text>
            <View style={styles.attachGrid}>
              {[
                { icon: 'image', label: 'Photos', color: '#4CAF50', onPress: pickImages, sub: `Max ${MEDIA_LIMITS.maxImages}` },
                { icon: 'videocam', label: 'Video', color: '#2196F3', onPress: pickVideo, sub: `≤${MEDIA_LIMITS.video}MB` },
                { icon: 'document', label: 'Document', color: '#FF9800', onPress: pickDocument, sub: `≤${MEDIA_LIMITS.document}MB` },
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

      {/* Message Action Sheet */}
      <Modal visible={showMsgActions} transparent animationType="fade" onRequestClose={() => setShowMsgActions(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowMsgActions(false)}>
          <View style={[styles.attachSheet, { backgroundColor: C.surface }]}>
            <View style={styles.attachHandle} />
            {selectedMsg && (
              <View style={[styles.previewBubble, { backgroundColor: C.surfaceContainerLow }]}>
                <Text translate={false} style={[styles.previewText, { color: C.onSurface }]} numberOfLines={2}>{selectedMsg.text}</Text>
              </View>
            )}
            {[
              { icon: 'copy-outline', label: 'Copy Message', onPress: handleCopy, color: C.onSurface },
              { icon: 'arrow-redo-outline', label: 'Forward', onPress: handleForward, color: C.onSurface },
              { icon: 'trash-outline', label: 'Delete for Me', onPress: handleDeleteMsg, color: '#e57373' },
            ].map((action) => (
              <TouchableOpacity key={action.label} style={styles.actionRow} onPress={action.onPress} activeOpacity={0.7}>
                <Ionicons name={action.icon as any} size={22} color={action.color} />
                <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full-Screen Image Viewer */}
      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.imageViewer}>
          <TouchableOpacity style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.imageViewerImg} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  backBtn: { padding: Spacing[1] },
  backCircle: {
    width: 36, height: 36, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerProfile: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing[3] },
  headerInfo: { flex: 1, gap: 2 },
  headerName: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineLabel: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  headerAction: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

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
  avatarWrap: {
    width: 28, height: 28, borderRadius: Radius.full,
    overflow: 'hidden',
  },
  bubble: {
    padding: Spacing[3],
    borderRadius: Radius.lg,
    maxWidth: '92%',
  },
  bubbleMe: { borderBottomRightRadius: Radius.xs },
  bubbleThem: { borderBottomLeftRadius: Radius.xs },
  bubbleText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.6,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  mediaBubbleImage: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.55,
    borderRadius: Radius.md,
    marginBottom: Spacing[1],
    overflow: 'hidden',
  },
  docBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingVertical: Spacing[1],
  },
  docName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
    flex: 1,
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing[6], gap: Spacing[3] },
  emptyIcon: {
    width: 80, height: 80, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize['2xl'] },
  emptyDesc: {
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md,
    textAlign: 'center', lineHeight: Typography.fontSize.md * 1.6,
  },

  // Upload bar
  uploadBar: {
    paddingVertical: Spacing[2],
    alignItems: 'center',
  },
  uploadText: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.sm },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[2],
    gap: Spacing[1],
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  attachBtn: {
    width: 42, height: 42, justifyContent: 'center', alignItems: 'center',
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

  // Attach sheet
  attachOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  attachSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing[5], paddingBottom: 40, paddingTop: Spacing[3],
  },
  attachHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#ccc', alignSelf: 'center', marginBottom: Spacing[3],
  },
  attachTitle: {
    fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg,
    marginBottom: Spacing[4],
  },
  attachGrid: { flexDirection: 'row', gap: Spacing[4], justifyContent: 'center' },
  attachItem: { alignItems: 'center', gap: Spacing[2], width: 80 },
  attachIconBg: {
    width: 60, height: 60, borderRadius: 30,
    justifyContent: 'center', alignItems: 'center',
  },
  attachLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  attachSub: { fontFamily: Typography.fontFamily.regular, fontSize: 11 },

  // Message actions
  previewBubble: { borderRadius: 12, padding: Spacing[3], marginBottom: Spacing[3] },
  previewText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing[3],
    paddingVertical: Spacing[4], borderBottomWidth: 0.5, borderBottomColor: '#eee',
  },
  actionLabel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },

  // Image viewer
  imageViewer: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  imageViewerImg: { width: SCREEN_WIDTH - 20, height: '70%' },
});
