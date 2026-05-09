import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TextInput, Image, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Keyboard, Alert, Modal, useWindowDimensions } from 'react-native';
import type { AlertButton } from 'react-native';
import { Text } from '../../components/TranslatedText';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
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
  deleteDirectMessageForEveryone,
  deleteAllDirectMessagesForUser,
  subscribeToUserProfile,
  createNotification,
  DMType,
  MessageReply,
  MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS,
} from '../../services/firebase/firestore';
import { uploadMedia, getMediaPath, getExtensionFromUri, MEDIA_LIMITS } from '../../services/firebase/storage';
import { uploadDocumentToSupabase } from '../../services/supabase/storage';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL, getProfileHeadline } from '../../types/profile';
import { VideoMessageBubble } from '../../components/chat/VideoMessageBubble';
import { ZoomableImageViewer } from '../../components/chat/ZoomableImageViewer';
import { DocumentMessageBubble } from '../../components/chat/DocumentMessageBubble';
import { ForwardModal } from '../../components/chat/ForwardModal';
import { useTranslation } from '../../i18n/useTranslation';

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

const getMessagePreviewText = (message: DirectMessage): string => {
  if (message.type === 'image') return 'Photo';
  if (message.type === 'video') return 'Video';
  if (message.type === 'document') return message.fileName || 'Document';
  return message.text || 'Message';
};

const getMessageShareText = (message: DirectMessage): string => {
  if (message.type === 'image' || message.type === 'video' || message.type === 'document') {
    const text = (message.text || '').trim();
    return message.mediaUrl ? text.split(message.mediaUrl).join('').trim() : text;
  }
  return message.text || '';
};

const getMessageCreatedAtMillis = (value: any) => {
  if (value?.toMillis) return value.toMillis();
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === 'number') return value;
  return 0;
};

const canDeleteDirectMessageForEveryone = (message: DirectMessage, userId?: string | null) => {
  if (!userId || message.senderId !== userId) return false;
  const createdAt = getMessageCreatedAtMillis(message.createdAt);
  return createdAt > 0 && Date.now() - createdAt <= MESSAGE_DELETE_FOR_EVERYONE_WINDOW_MS;
};

export const DirectMessageScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { width: screenWidth } = useWindowDimensions();
  const C = useColors();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const { friendId, friendName } = route.params || {};

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<MessageReply | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const displayFriendName = getProfileDisplayName(friendProfile, friendName);
  const friendPhotoURL = getProfilePhotoURL(friendProfile);
  const friendHeadline = getProfileHeadline(friendProfile);
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

  useEffect(() => {
    setSelectedIds((ids) => ids.filter((id) => messages.some((message) => message.id === id)));
  }, [messages]);

  // ─── Send Text ─────────────────────────────────────────────────────
  const sendMessageWithNotification = useCallback(async (
    messageText: string,
    type: DMType = 'text',
    mediaUrl?: string,
    fileName?: string,
    replyPayload?: MessageReply | null
  ) => {
    if (!user || !friendId) return;
    const chatId = getChatId(user.uid, friendId);
    await sendDirectMessage(user.uid, friendId, messageText, type, mediaUrl, fileName, replyPayload || undefined);
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
    const activeReply = replyTo;
    setReplyTo(null);
    try {
      await sendMessageWithNotification(textMsg, 'text', undefined, undefined, activeReply);
    } catch (e) {
      console.error('Failed to send DM', e);
    }
  }, [text, user, friendId, replyTo, sendMessageWithNotification]);

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
      Alert.alert(t('Too many images'), `${t('Max')} ${MEDIA_LIMITS.maxImages} ${t('images at once.')}`);
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
      Alert.alert(t('Upload Error'), e.message || t('Failed to upload image.'));
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
      Alert.alert(t('Upload Error'), e.message || t('Failed to upload video.'));
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

  // ─── Message Actions ───────────────────────────────────────────────
  const sortedMessages = messages.slice().reverse();
  const selectedMessages = sortedMessages.filter((message) => message.id && selectedIds.includes(message.id));
  const selectionMode = selectedIds.length > 0;

  const clearSelection = () => setSelectedIds([]);

  const toggleMessageSelection = (msg: DirectMessage) => {
    if (!msg.id) return;
    setReplyTo(null);
    setSelectedIds((ids) => (
      ids.includes(msg.id!)
        ? ids.filter((id) => id !== msg.id)
        : [...ids, msg.id!]
    ));
  };

  const handleLongPress = (msg: DirectMessage) => {
    if (!msg.id) return;
    setReplyTo(null);
    setSelectedIds((ids) => (ids.includes(msg.id!) ? ids : [...ids, msg.id!]));
  };

  const handleMessagePress = (msg: DirectMessage) => {
    if (selectionMode) toggleMessageSelection(msg);
  };

  const createReplyPayload = (msg: DirectMessage): MessageReply | null => {
    if (!msg.id) return null;
    return {
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderId === user?.uid ? currentDisplayName : displayFriendName,
      text: getMessagePreviewText(msg),
      type: msg.type || 'text',
      ...(msg.fileName ? { fileName: msg.fileName } : {}),
    };
  };

  const handleReplyToMessage = (msg: DirectMessage) => {
    const payload = createReplyPayload(msg);
    if (!payload) return;
    clearSelection();
    setReplyTo(payload);
  };

  const scrollToMessage = (messageId: string) => {
    const index = sortedMessages.findIndex(m => m.id === messageId);
    if (index !== -1 && flatListRef.current) {
      flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 1500); // highlight duration
    }
  };

  const handleCopySelected = async () => {
    if (!selectedMessages.length) return;
    const shareText = selectedMessages
      .map(getMessageShareText)
      .filter(Boolean)
      .join('\n\n');
    await Clipboard.setStringAsync(shareText);
    clearSelection();
    Alert.alert(t('Copied'), t('Copied successfully.'));
  };

  const handleForwardSelected = () => {
    if (!selectedMessages.length) return;
    setShowForwardModal(true);
  };

  const handleForwardComplete = () => {
    setShowForwardModal(false);
    clearSelection();
  };

  const handleDeleteSelected = async () => {
    if (!selectedMessages.length || !user) return;
    const count = selectedMessages.length;
    const messageLabel = count === 1 ? 'message' : 'messages';
    const deleteForEveryoneAvailable = selectedMessages.every((message) =>
      canDeleteDirectMessageForEveryone(message, user.uid)
    );

    const deleteForMe = async () => {
      try {
        await Promise.all(
          selectedMessages
            .filter((message) => !!message.id)
            .map((message) => deleteDirectMessageForUser(message.id!, user.uid))
        );
        clearSelection();
      } catch {
        Alert.alert(t('Error'), t('Could not delete selected messages.'));
      }
    };

    const deleteForEveryone = async () => {
      try {
        await Promise.all(
          selectedMessages
            .filter((message) => !!message.id)
            .map((message) => deleteDirectMessageForEveryone(message.id!, user.uid))
        );
        clearSelection();
      } catch {
        Alert.alert(t('Error'), t('Delete for everyone is only available for your messages sent within 15 minutes.'));
      }
    };

    const buttons: AlertButton[] = [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete for Me'),
        style: 'destructive',
        onPress: deleteForMe,
      },
    ];

    if (deleteForEveryoneAvailable) {
      buttons.push({
        text: t('Delete for Everyone'),
        style: 'destructive',
        onPress: deleteForEveryone,
      });
    }

    Alert.alert(
      t('Delete Messages'),
      `${t('Choose how to delete')} ${count} ${t('selected')} ${t(messageLabel)}.`,
      buttons
    );
  };

  const handleDeleteAll = () => {
    if (!user || !friendId) return;
    Alert.alert(t('Delete Chat'), t('Delete this chat from your account? The other person will still keep their copy.'), [
      { text: t('Cancel'), style: 'cancel' },
      {
        text: t('Delete All'), style: 'destructive',
        onPress: async () => {
          try {
            const chatId = getChatId(user.uid, friendId);
            await deleteAllDirectMessagesForUser(chatId, user.uid);
          } catch { Alert.alert(t('Error'), t('Could not delete messages.')); }
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
    const hasMedia = msgType !== 'text' && !!item.mediaUrl;
    const selected = !!item.id && selectedIds.includes(item.id);
    const isHighlighted = item.id === highlightedMessageId;
    const bubbleColors = isMe
      ? {
          backgroundColor: isHighlighted ? C.primaryContainer : C.primary,
          foreground: isHighlighted ? C.onPrimaryContainer : C.onPrimary,
          replyBg: isHighlighted ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.18)',
          replyLine: isHighlighted ? C.primary : C.onPrimary,
        }
      : {
          backgroundColor: isHighlighted ? C.primaryContainer : C.surfaceContainerHigh,
          foreground: isHighlighted ? C.onPrimaryContainer : C.onSurface,
          replyBg: isHighlighted ? 'rgba(0,0,0,0.1)' : C.surfaceContainerHighest,
          replyLine: C.primary,
        };

    return (
      <SwipeableMessage
        message={item}
        enabled={!selectionMode}
        onReply={handleReplyToMessage}
      >
        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => handleMessagePress(item)}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={350}
          style={[
            styles.messageTouchTarget,
            (selected || isHighlighted) && { backgroundColor: C.primaryContainer },
          ]}
        >
          <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
            {selected && (
              <View style={[styles.selectedDot, { backgroundColor: C.primary }]}>
                <Ionicons name="checkmark" size={13} color={C.onPrimary} />
              </View>
            )}
            {!isMe && (
              <View style={styles.avatarWrap}>
                <Avatar name={displayFriendName || '?'} uri={friendPhotoURL} size={28} />
              </View>
            )}
            <View style={{ flexShrink: 1, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
              <View
                style={[
                  hasMedia
                    ? [styles.mediaBubble, isMe ? styles.bubbleMe : styles.bubbleThem, { backgroundColor: bubbleColors.backgroundColor }]
                    : [styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem, { backgroundColor: bubbleColors.backgroundColor }],
                ]}
              >
                {item.isForwarded && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing[1], paddingHorizontal: hasMedia ? Spacing[2] : 0, paddingTop: hasMedia ? Spacing[2] : 0 }}>
                    <Ionicons name="arrow-redo" size={12} color={bubbleColors.foreground} style={{ opacity: 0.7, marginRight: 4 }} />
                    <Text style={{ color: bubbleColors.foreground, fontSize: Typography.fontSize.xs, fontStyle: 'italic', opacity: 0.7 }}>
                      Forwarded
                    </Text>
                  </View>
                )}
                {item.replyTo && (
                  <TouchableOpacity
                    onPress={() => item.replyTo?.id && scrollToMessage(item.replyTo.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.replyInBubble,
                      { backgroundColor: bubbleColors.replyBg, maxWidth: screenWidth * 0.62 },
                    ]}
                  >
                    <View style={[styles.replyLine, { backgroundColor: bubbleColors.replyLine }]} />
                    <View style={styles.replyInBubbleTextWrap}>
                      <Text translate={false} style={[styles.replyInBubbleSender, { color: bubbleColors.foreground }]} numberOfLines={1}>
                        {item.replyTo.senderId === user?.uid ? 'You' : item.replyTo.senderName}
                      </Text>
                      <Text translate={false} style={[styles.replyInBubbleText, { color: bubbleColors.foreground }]} numberOfLines={1}>
                        {item.replyTo.text}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}

                {msgType === 'image' && item.mediaUrl && (
                  <TouchableOpacity onPress={() => (selectionMode ? handleMessagePress(item) : setViewingImage(item.mediaUrl!))}>
                    <Image
                      source={{ uri: item.mediaUrl }}
                      style={[
                        styles.mediaBubbleImage,
                        { width: screenWidth * 0.55, height: screenWidth * 0.55 },
                      ]}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
                {msgType === 'video' && item.mediaUrl && (
                  selectionMode ? (
                    <TouchableOpacity onPress={() => handleMessagePress(item)}>
                      <View style={styles.videoSelectionThumb}>
                        <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <VideoMessageBubble uri={item.mediaUrl} />
                  )
                )}
                {msgType === 'document' && item.mediaUrl && (
                  <DocumentMessageBubble
                    url={item.mediaUrl}
                    fileName={item.fileName}
                    isMe={isMe}
                  />
                )}

                {(msgType === 'text' || !item.mediaUrl) && (
                  <Text translate={false} style={[styles.bubbleText, { color: bubbleColors.foreground }]}>
                    {item.text}
                  </Text>
                )}
              </View>
              {!!item.createdAt && (
                <Text translate={false} style={[styles.timeText, { color: C.onSurfaceVariant }]}>
                  {formatTime(item.createdAt)}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </SwipeableMessage>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      {selectionMode ? (
        <View style={[styles.selectionHeader, { backgroundColor: C.surfaceContainerLow }]}>
          <TouchableOpacity style={styles.headerAction} onPress={clearSelection}>
            <Ionicons name="close" size={24} color={C.onSurface} />
          </TouchableOpacity>
          <Text translate={false} style={[styles.selectionCount, { color: C.onSurface }]}>
            {selectedIds.length}
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleCopySelected} style={styles.headerAction}>
              <Ionicons name="copy-outline" size={21} color={C.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleForwardSelected} style={styles.headerAction}>
              <Ionicons name="arrow-redo-outline" size={22} color={C.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteSelected} style={styles.headerAction}>
              <Ionicons name="trash-outline" size={22} color={C.error} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
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
                <Text translate={false} style={[styles.onlineLabel, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                  {friendHeadline}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAll} style={styles.headerAction}>
            <Ionicons name="trash-outline" size={20} color={C.onSurfaceVariant} />
          </TouchableOpacity>
        </LinearGradient>
      )}

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
          onScrollToIndexFailed={info => {
            const wait = new Promise(resolve => setTimeout(resolve, 100));
            wait.then(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            });
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.primaryContainer }]}>
                <Ionicons name="chatbubbles-outline" size={40} color={C.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: C.onSurface }]}>Start a conversation</Text>
              <Text translate={false} style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                {t('Say hi to')} {displayFriendName}! {t('Your messages are private.')}
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
        {replyTo && (
          <View style={[styles.replyComposer, { backgroundColor: C.surfaceContainerLow, borderTopColor: C.outlineVariant }]}>
            <View style={[styles.replyComposerLine, { backgroundColor: C.primary }]} />
            <View style={styles.replyComposerText}>
              <Text translate={false} style={[styles.replyComposerTitle, { color: C.primary }]} numberOfLines={1}>
                {t('Replying to')} {replyTo.senderId === user?.uid ? t('You') : replyTo.senderName}
              </Text>
              <Text translate={false} style={[styles.replyComposerBody, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyComposerClose}>
              <Ionicons name="close" size={18} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputBar, { backgroundColor: C.surfaceContainerLow }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.attachBtn}>
            <Ionicons name="attach" size={24} color={C.primary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, { backgroundColor: C.surfaceContainerHighest, color: C.onSurface }]}
            placeholder={`${t('Message')} ${displayFriendName}...`}
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
                { icon: 'image', label: 'Photos', color: '#4CAF50', onPress: pickImages, sub: `${t('Max')} ${MEDIA_LIMITS.maxImages}` },
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

      <ZoomableImageViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
      <ForwardModal
        visible={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        onForwarded={handleForwardComplete}
        messagesToForward={selectedMessages}
      />
    </View>
  );
};

interface SwipeableMessageProps {
  message: DirectMessage;
  enabled: boolean;
  onReply: (message: DirectMessage) => void;
  children: React.ReactNode;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ message, enabled, onReply, children }) => {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      enabled={enabled}
      friction={2}
      leftThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View style={styles.replySwipeAction}>
          <Ionicons name="return-up-forward" size={22} color="#fff" />
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') onReply(message);
        swipeRef.current?.close();
      }}
    >
      {children}
    </Swipeable>
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
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: Spacing[3],
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },
  selectionCount: {
    flex: 1,
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },
  selectionActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing[1] },

  // Messages
  messageList: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    gap: Spacing[3],
  },
  emptyList: { flex: 1, justifyContent: 'center' },
  messageTouchTarget: {
    width: '100%',
    paddingVertical: 2,
    paddingHorizontal: Spacing[2],
    borderRadius: Radius.md,
  },
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
  selectedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  replySwipeAction: {
    width: 56,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: '#4CAF50',
  },
  avatarWrap: {
    width: 28, height: 28, borderRadius: Radius.full,
    overflow: 'hidden',
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
  bubbleThem: { borderBottomLeftRadius: Radius.xs },
  replyInBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderRadius: Radius.md,
    padding: Spacing[2],
    marginBottom: Spacing[2],
    minWidth: 160,
  },
  replyLine: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: Radius.full,
  },
  replyInBubbleTextWrap: { flex: 1 },
  replyInBubbleSender: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 11,
  },
  replyInBubbleText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 11,
    opacity: 0.82,
  },
  bubbleText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    lineHeight: Typography.fontSize.md * 1.6,
  },
  timeText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 10,
    marginTop: 2,
  },
  mediaBubbleImage: {
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  videoSelectionThumb: {
    width: 220,
    height: 160,
    borderRadius: Radius.md,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
  replyComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyComposerLine: {
    width: 3,
    height: 38,
    borderRadius: Radius.full,
  },
  replyComposerText: { flex: 1 },
  replyComposerTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: 12,
  },
  replyComposerBody: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: 12,
    marginTop: 2,
  },
  replyComposerClose: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
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

});
