import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Modal, Alert } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { sendToAI, AIMessage } from '../../services/ai/aiService';
import { AI_CONFIG } from '../../services/ai/aiConfig';
import { useAuthStore } from '../../store/authStore';
import { getSageChatStorageKey, LEGACY_SAGE_CHAT_STORAGE_KEY } from '../../services/ai/sageStorage';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export const AIChatScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const flatListRef = useRef<FlatList>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<DisplayMessage | null>(null);
  const storageKey = getSageChatStorageKey(user?.uid);

  // Load chat history
  useEffect(() => {
    let active = true;
    setLoaded(false);
    setMessages([]);

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        await AsyncStorage.removeItem(LEGACY_SAGE_CHAT_STORAGE_KEY);
        if (raw && active) {
          setMessages(JSON.parse(raw));
        }
      } catch (e) {
        console.warn('Failed to load chat history:', e);
      }
      if (active) setLoaded(true);
    })();
    return () => { active = false; };
  }, [storageKey]);

  // Save after each message update
  useEffect(() => {
    if (!loaded) return;
    const action = messages.length > 0
      ? AsyncStorage.setItem(storageKey, JSON.stringify(messages))
      : AsyncStorage.removeItem(storageKey);
    action.catch(console.warn);
  }, [messages, loaded, storageKey]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length, isTyping]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    Keyboard.dismiss();
    setInput('');

    const userMsg: DisplayMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setIsTyping(true);

    // Build conversation for AI (last 20 messages for context)
    const history: AIMessage[] = updatedMessages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const response = await sendToAI(history);
      const aiMsg: DisplayMessage = {
        id: `sage_${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error('AI error:', e);
    } finally {
      setIsTyping(false);
    }
  }, [input, messages, isTyping]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Delete Sage Chat', 'Delete your Sage chat history from this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setMessages([]);
          AsyncStorage.removeItem(storageKey).catch(console.warn);
        },
      },
    ]);
  }, [storageKey]);

  const handleDeleteSelectedMessage = () => {
    if (!selectedMessage) return;
    setMessages((prev) => prev.filter((message) => message.id !== selectedMessage.id));
    setSelectedMessage(null);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: DisplayMessage }) => {
    const isUser = item.role === 'user';
    return (
      <TouchableOpacity
        style={[styles.msgRow, isUser && styles.msgRowUser]}
        onLongPress={() => setSelectedMessage(item)}
        delayLongPress={350}
        activeOpacity={0.85}
      >
        {!isUser && (
          <View style={[styles.sageAvatar, { backgroundColor: C.primaryContainer }]}>
            <Text style={{ fontSize: 16 }}>{AI_CONFIG.COMPANION_AVATAR_EMOJI}</Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: C.primary }]
              : [styles.bubbleSage, { backgroundColor: C.surfaceContainerHigh }],
          ]}
        >
          <Text
            translate={false}
            style={[
              styles.bubbleText,
              { color: isUser ? C.onPrimary : C.onSurface },
            ]}
          >
            {item.content}
          </Text>
          <Text
            translate={false}
            style={[
              styles.timeText,
              { color: isUser ? `${C.onPrimary}88` : C.onSurfaceVariant },
            ]}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* Header */}
      <LinearGradient
        colors={[C.primaryContainer, `${C.surface}`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={C.onSurface} />
        </TouchableOpacity>
        <View style={[styles.headerAvatar, { backgroundColor: C.primary }]}>
          <Text style={{ fontSize: 20 }}>{AI_CONFIG.COMPANION_AVATAR_EMOJI}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: C.onSurface }]}>{AI_CONFIG.COMPANION_NAME}</Text>
          <View style={styles.onlineRow}>
            <View style={[styles.onlineDot, { backgroundColor: '#4caf50' }]} />
            <Text style={[styles.onlineText, { color: C.onSurfaceVariant }]}>Always here for you</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleClearChat} style={styles.moreBtn}>
          <Ionicons name="trash-outline" size={20} color={C.onSurfaceVariant} />
        </TouchableOpacity>
      </LinearGradient>

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
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            messages.length === 0 && styles.emptyList,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: C.primaryContainer }]}>
                <Text style={{ fontSize: 40 }}>{AI_CONFIG.COMPANION_AVATAR_EMOJI}</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: C.onSurface }]}>
                Meet {AI_CONFIG.COMPANION_NAME}
              </Text>
              <Text style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                {AI_CONFIG.COMPANION_TAGLINE}{'\n\n'}
                Share what's on your mind — no judgment, just genuine care. 💚
              </Text>
              {/* Quick starters */}
              <View style={styles.starters}>
                {[
                  "I'm feeling anxious today",
                  "I need someone to talk to",
                  "Help me with a breathing exercise",
                  "I want to practice gratitude",
                ].map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.starter, { backgroundColor: C.surfaceContainerLow }]}
                    onPress={() => { setInput(s); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.starterText, { color: C.primary }]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
        />

        {/* Typing indicator */}
        {isTyping && (
          <View style={[styles.typingRow]}>
            <View style={[styles.sageAvatar, { backgroundColor: C.primaryContainer }]}>
              <Text style={{ fontSize: 14 }}>{AI_CONFIG.COMPANION_AVATAR_EMOJI}</Text>
            </View>
            <View style={[styles.typingBubble, { backgroundColor: C.surfaceContainerHigh }]}>
              <ActivityIndicator size="small" color={C.primary} />
              <Text style={[styles.typingText, { color: C.onSurfaceVariant }]}>
                {AI_CONFIG.COMPANION_NAME} is thinking...
              </Text>
            </View>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: C.surfaceContainerLow }]}>
          <TextInput
            style={[styles.textInput, { color: C.onSurface, backgroundColor: C.surfaceContainerHighest }]}
            placeholder={`Message ${AI_CONFIG.COMPANION_NAME}...`}
            placeholderTextColor={C.onSurfaceVariant}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            onSubmitEditing={handleSend}
            blurOnSubmit
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() ? C.primary : C.surfaceContainerHighest },
            ]}
            onPress={handleSend}
            disabled={!input.trim() || isTyping}
            activeOpacity={0.8}
          >
            <Ionicons
              name="send"
              size={18}
              color={input.trim() ? C.onPrimary : C.onSurfaceVariant}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
        <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={() => setSelectedMessage(null)}>
          <View style={[styles.actionSheet, { backgroundColor: C.surface }]}>
            <View style={styles.actionHandle} />
            {selectedMessage && (
              <View style={[styles.previewBubble, { backgroundColor: C.surfaceContainerLow }]}>
                <Text translate={false} style={[styles.previewText, { color: C.onSurface }]} numberOfLines={3}>
                  {selectedMessage.content}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.actionRow} onPress={handleDeleteSelectedMessage}>
              <Ionicons name="trash-outline" size={22} color={C.error} />
              <Text style={[styles.actionLabel, { color: C.error }]}>Delete Message</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  headerAvatar: {
    width: 44, height: 44, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  headerInfo: { flex: 1, gap: 2 },
  headerName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  moreBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

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
  msgRowUser: {
    flexDirection: 'row-reverse',
    alignSelf: 'flex-end',
  },
  sageAvatar: {
    width: 28, height: 28, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  bubble: {
    padding: Spacing[3],
    borderRadius: Radius.lg,
    maxWidth: '92%',
  },
  bubbleUser: {
    borderBottomRightRadius: Radius.xs,
  },
  bubbleSage: {
    borderBottomLeftRadius: Radius.xs,
  },
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

  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    paddingBottom: Spacing[2],
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2],
    borderRadius: Radius.lg,
  },
  typingText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing[6],
    gap: Spacing[3],
  },
  emptyIcon: {
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
  starters: { gap: Spacing[2], width: '100%', marginTop: Spacing[2] },
  starter: {
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    alignItems: 'center',
  },
  starterText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
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

  // Message actions
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
  previewBubble: { borderRadius: 14, padding: Spacing[3], marginBottom: Spacing[2] },
  previewText: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingVertical: Spacing[4],
  },
  actionLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
});
