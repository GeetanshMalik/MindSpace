import React, { useState, useEffect, useMemo } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../TranslatedText';
import { Avatar } from '../Avatar';
import { useColors } from '../../theme/useColors';
import { Typography, Spacing, Radius } from '../../theme';
import { useAuthStore } from '../../store/authStore';
import {
  DirectMessage, 
  DMConversation, 
  subscribeToUserDMConversations, 
  sendDirectMessage,
  subscribeToUserProfile,
  searchUserProfiles
} from '../../services/firebase/firestore';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';
import { useTranslation } from '../../i18n/useTranslation';

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onForwarded?: () => void;
  messagesToForward: DirectMessage[];
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ visible, onClose, onForwarded, messagesToForward }) => {
  const C = useColors();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile | null>>({});
  const [searchedProfiles, setSearchedProfiles] = useState<UserProfile[]>([]);
  const [searchingPeople, setSearchingPeople] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSearchQuery('');
      setSearchedProfiles([]);
      setSearchingPeople(false);
      setSelectedIds(new Set());
    }
  }, [visible]);

  // Subscribe to active chats
  useEffect(() => {
    if (!visible || !user) return;
    const unsub = subscribeToUserDMConversations(user.uid, setDmConversations);
    return unsub;
  }, [user, visible]);

  // Subscribe to profiles for those active chats
  const dmFriendIds = useMemo(() => Array.from(new Set(dmConversations.map(c => c.friendId))), [dmConversations]);
  useEffect(() => {
    if (!visible || !dmFriendIds.length) return;
    const unsubs = dmFriendIds.map(id => 
      subscribeToUserProfile(id, (profile) => setFriendProfiles(prev => ({ ...prev, [id]: profile })))
    );
    return () => unsubs.forEach(u => u());
  }, [dmFriendIds.join('|'), visible]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!visible || !user || !q) {
      setSearchedProfiles([]);
      setSearchingPeople(false);
      return;
    }

    let cancelled = false;
    setSearchingPeople(true);
    const timer = setTimeout(() => {
      searchUserProfiles(q, user.uid, 20)
        .then((profiles) => {
          if (!cancelled) setSearchedProfiles(profiles);
        })
        .finally(() => {
          if (!cancelled) setSearchingPeople(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, user?.uid, visible]);

  // Prepare List Data
  const listData = useMemo(() => {
    const data: { type: 'header' | 'user'; id: string; friendId?: string; name?: string; photo?: string; sub?: string }[] = [];
    const q = searchQuery.toLowerCase().trim();
    const activeIds = new Set(dmConversations.map(convo => convo.friendId));

    const activeMatches = dmConversations.map(convo => {
      const profile = friendProfiles[convo.friendId];
      const name = getProfileDisplayName(profile, convo.friendName);
      return {
        friendId: convo.friendId,
        name,
        photo: getProfilePhotoURL(profile),
        sub: convo.lastMessage
      };
    }).filter(c => !q || c.name.toLowerCase().includes(q));

    if (activeMatches.length > 0) {
      data.push({ type: 'header', id: 'header-recent', name: q ? t('Matching Chats') : t('Recent Chats') });
      activeMatches.forEach(m => data.push({ type: 'user', id: m.friendId, friendId: m.friendId, name: m.name, photo: m.photo, sub: m.sub }));
    } else if (!q) {
      data.push({ type: 'header', id: 'header-no-results', name: t('No recent chats') });
    }

    if (q) {
      const newChatMatches = searchedProfiles
        .filter((profile) => !!profile.uid && !activeIds.has(profile.uid))
        .map((profile) => {
          const name = getProfileDisplayName(profile);
          return {
            friendId: profile.uid,
            name,
            photo: getProfilePhotoURL(profile),
            sub: `${t('Start chat with')} ${name}`,
          };
        });

      if (newChatMatches.length > 0) {
        data.push({ type: 'header', id: 'header-start-chat', name: t('Start Chat With') });
        newChatMatches.forEach(m => data.push({ type: 'user', id: `start-${m.friendId}`, friendId: m.friendId, name: m.name, photo: m.photo, sub: m.sub }));
      } else if (!activeMatches.length && !searchingPeople) {
        data.push({ type: 'header', id: 'header-no-results', name: t('No matching people') });
      }
    }

    return data;
  }, [dmConversations, friendProfiles, searchQuery, searchedProfiles, searchingPeople, t]);

  const toggleSelect = (friendId: string) => {
    const next = new Set(selectedIds);
    if (next.has(friendId)) next.delete(friendId);
    else next.add(friendId);
    setSelectedIds(next);
  };

  const handleForward = async () => {
    if (!user || selectedIds.size === 0 || messagesToForward.length === 0) return;
    
    setSending(true);
    try {
      const receivers = Array.from(selectedIds);
      
      // We want to send all selected messages to each receiver sequentially
      for (const receiverId of receivers) {
        for (const msg of messagesToForward) {
          // Preserve forwarded status and mark messages that came from someone else.
          const isForwarded = !!msg.isForwarded || msg.senderId !== user.uid;
          
          await sendDirectMessage(
            user.uid,
            receiverId,
            msg.text,
            msg.type || 'text',
            msg.mediaUrl,
            msg.fileName,
            undefined, // We don't preserve reply context when forwarding
            isForwarded
          );
        }
      }
      Alert.alert(t('Forwarded'), t('Messages forwarded successfully.'));
      setSelectedIds(new Set());
      if (onForwarded) {
        onForwarded();
      } else {
        onClose();
      }
    } catch (e) {
      Alert.alert(t('Error'), t('Failed to forward messages.'));
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (item.type === 'header') {
      return (
        <Text style={[styles.headerText, { color: C.onSurfaceVariant }]}>{item.name}</Text>
      );
    }

    const isSelected = selectedIds.has(item.friendId);

    return (
      <TouchableOpacity 
        style={[styles.userRow, { borderBottomColor: C.outlineVariant }]} 
        onPress={() => toggleSelect(item.friendId)}
        activeOpacity={0.7}
      >
        <Avatar name={item.name} uri={item.photo} size={44} />
        <View style={styles.userInfo}>
          <Text translate={false} style={[styles.userName, { color: C.onSurface }]} numberOfLines={1}>{item.name}</Text>
          <Text translate={false} style={[styles.userSub, { color: C.onSurfaceVariant }]} numberOfLines={1}>{item.sub}</Text>
        </View>
        <View style={[
          styles.checkbox, 
          { borderColor: isSelected ? C.primary : C.onSurfaceVariant },
          isSelected && { backgroundColor: C.primary }
        ]}>
          {isSelected && <Ionicons name="checkmark" size={16} color={C.onPrimary} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: C.surface }]}>
        <View style={[styles.header, { borderBottomColor: C.outlineVariant }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={C.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: C.onSurface }]}>Forward to...</Text>
        </View>
        
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: C.surfaceContainerHigh }]}>
            <Ionicons name="search" size={20} color={C.onSurfaceVariant} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: C.onSurface }]}
              placeholder={t('Search chats or people...')}
              placeholderTextColor={C.onSurfaceVariant}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <FlatList
          data={listData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
        />

        {selectedIds.size > 0 && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.footer, { backgroundColor: C.surfaceContainer, borderTopColor: C.outlineVariant }]}>
              <Text style={[styles.selectedCount, { color: C.onSurface }]}>
                {selectedIds.size} {t('selected')}
              </Text>
              <TouchableOpacity 
                style={[styles.sendBtn, { backgroundColor: C.primary }]}
                onPress={handleForward}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={C.onPrimary} />
                ) : (
                  <>
                    <Text style={[styles.sendText, { color: C.onPrimary }]}>Send</Text>
                    <Ionicons name="send" size={16} color={C.onPrimary} style={{ marginLeft: 4 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[2],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    padding: Spacing[2],
  },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
    marginLeft: Spacing[2],
  },
  searchContainer: {
    padding: Spacing[3],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[3],
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing[2],
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    height: '100%',
  },
  listContent: {
    paddingBottom: Spacing[10],
  },
  headerText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.sm,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: {
    flex: 1,
    marginLeft: Spacing[3],
  },
  userName: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  userSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  selectedCount: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.md,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2],
    borderRadius: Radius.full,
  },
  sendText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
  },
});
