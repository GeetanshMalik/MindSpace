import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { ProfileAvatar, ProfileName } from '../../components/ProfileAvatar';
import { subscribeToMessages, sendMessage, ChatMessage } from '../../services/firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';

export const PostDiscussionScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const C = useColors();
  const { user, profile } = useAuthStore();
  const currentDisplayName = getProfileDisplayName(profile, user?.displayName || 'Anonymous');
  const currentPhotoURL = getProfilePhotoURL(profile, user?.photoURL);
  const postId = route.params?.postId || 'general';
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const unsub = subscribeToMessages(postId, setMessages);
    return unsub;
  }, [postId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    const msg = text.trim();
    setText('');
    await sendMessage(postId, {
      senderId: user.uid,
      senderName: currentDisplayName,
      senderPhotoURL: currentPhotoURL || null,
      text: msg,
    });
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 200);
  };

  const renderMsg = ({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.uid;
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && <ProfileAvatar userId={item.senderId} name={item.senderName} uri={item.senderPhotoURL} size={32} />}
        <View style={[styles.bubble, { backgroundColor: isMe ? C.primaryContainer : C.surfaceContainerHigh }, isMe ? styles.bubbleMeRadius : styles.bubbleThemRadius]}>
          {!isMe && <ProfileName userId={item.senderId} fallbackName={item.senderName} style={[styles.senderName, { color: C.primary }]} />}
          <Text translate={false} style={[styles.msgText, { color: isMe ? C.onPrimaryContainer : C.onSurface }]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.surface }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: C.onSurface }]}>Discussion</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={item => item.id || Math.random().toString()}
        renderItem={renderMsg}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>No comments yet. Start the discussion! 💬</Text>
        }
      />

      {/* Input */}
      <View style={[styles.inputRow, { backgroundColor: C.surfaceContainerLow }]}>
        <TextInput
          style={[styles.input, { backgroundColor: C.surfaceContainerHighest, color: C.onSurface }]}
          placeholder="Write a comment..."
          placeholderTextColor={C.onSurfaceVariant}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: C.primary }, !text.trim() && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={!text.trim()}
        >
          <Ionicons name="send" size={20} color={C.onPrimary} />
        </TouchableOpacity>
      </View>
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
  title: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.xl },
  list: { padding: Spacing[4], gap: Spacing[3], paddingBottom: Spacing[4] },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[2] },
  msgRowMe: { flexDirection: 'row-reverse' },
  bubble: {
    maxWidth: '75%', borderRadius: Radius.xl, padding: Spacing[3], gap: 3,
  },
  bubbleMeRadius: { borderBottomRightRadius: 4 },
  bubbleThemRadius: { borderBottomLeftRadius: 4 },
  senderName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.xs },
  msgText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  emptyText: { textAlign: 'center', fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md, marginTop: 60 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing[3],
    padding: Spacing[4],
  },
  input: {
    flex: 1,
    borderRadius: Radius.xl, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
});
