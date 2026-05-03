import React, { useState, useEffect, useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { Text } from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Typography, Radius, Shadow } from '../../theme';
import { useColors } from '../../theme/useColors';
import { useAuthStore } from '../../store/authStore';
import { AI_CONFIG } from '../../services/ai/aiConfig';
import {
  Community,
  DirectMessageSearchResult,
  subscribeToCommunities,
  initializeCommunities,
  createCustomCommunity,
  DMConversation,
  subscribeToUserDMConversations,
  subscribeToUserProfile,
  deleteAllDirectMessagesForUser,
  searchUserDirectMessages,
  searchUserProfiles,
} from '../../services/firebase/firestore';
import { Avatar } from '../../components/Avatar';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL } from '../../types/profile';
import { getSageChatStorageKey } from '../../services/ai/sageStorage';
import { useThemeStore } from '../../store/themeStore';
import { translateText } from '../../i18n';

const SAGE_AVATAR = require('../../../assets/logo_sage.png');

type Tab = 'chats' | 'communities';
type SearchMessageRow = {
  id: string;
  type: 'dm' | 'community';
  title: string;
  subtitle: string;
  avatarUri?: string;
  emoji?: string;
  onPress: () => void;
};

const normalizeForSearch = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export const ChatCommunitiesScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { user } = useAuthStore();
  const language = useThemeStore((state) => state.language);
  const t = useMemo(() => (value: string) => translateText(value, language), [language]);
  const [activeTab, setActiveTab] = useState<Tab>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [dmConversations, setDmConversations] = useState<DMConversation[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile | null>>({});
  const [communities, setCommunities] = useState<Community[]>([]);
  const [accountResults, setAccountResults] = useState<UserProfile[]>([]);
  const [messageSearchResults, setMessageSearchResults] = useState<DirectMessageSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAllMessageResults, setShowAllMessageResults] = useState(false);
  const [showAllAccountResults, setShowAllAccountResults] = useState(false);
  const trimmedSearchQuery = searchQuery.trim();
  const isSearchActive = trimmedSearchQuery.length > 0;
  const dmFriendIds = useMemo(
    () => Array.from(new Set(dmConversations.map((c) => c.friendId))).sort(),
    [dmConversations]
  );
  
  // Create Community Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommEmoji, setNewCommEmoji] = useState('🌟');
  const [creatingComm, setCreatingComm] = useState(false);

  // Initialize communities & subscribe
  useEffect(() => {
    initializeCommunities();
    const unsub = subscribeToCommunities(setCommunities);
    return unsub;
  }, []);

  // Subscribe to DM conversations
  useEffect(() => {
    if (!user) {
      setDmConversations([]);
      return;
    }
    const unsub = subscribeToUserDMConversations(user.uid, setDmConversations);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!dmFriendIds.length) {
      setFriendProfiles({});
      return;
    }

    const unsubs = dmFriendIds.map((friendId) =>
      subscribeToUserProfile(friendId, (profile) => {
        setFriendProfiles((prev) => ({ ...prev, [friendId]: profile }));
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [dmFriendIds.join('|')]);

  useEffect(() => {
    setShowAllMessageResults(false);
    setShowAllAccountResults(false);
  }, [trimmedSearchQuery]);

  useEffect(() => {
    if (!trimmedSearchQuery) {
      setAccountResults([]);
      setMessageSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.all([
        searchUserProfiles(trimmedSearchQuery, user?.uid, 30),
        user ? searchUserDirectMessages(user.uid, trimmedSearchQuery, 30) : Promise.resolve([]),
      ])
        .then(([profiles, messages]) => {
          if (cancelled) return;
          setAccountResults(profiles);
          setMessageSearchResults(messages);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedSearchQuery, user?.uid]);

  // Filter communities by search
  const filteredCommunities = useMemo(() => {
    if (!searchQuery.trim()) return communities;
    const q = searchQuery.toLowerCase();
    return communities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [communities, searchQuery]);

  const isMember = (community: Community) =>
    user ? community.members?.includes(user.uid) : false;

  const searchMessageRows = useMemo<SearchMessageRow[]>(() => {
    if (!trimmedSearchQuery) return [];

    const q = normalizeForSearch(trimmedSearchQuery);
    const rows = new Map<string, SearchMessageRow>();
    const conversationByChatId = new Map(dmConversations.map((convo) => [convo.chatId, convo]));

    messageSearchResults.forEach((result) => {
      const convo = conversationByChatId.get(result.chatId);
      const friendProfile = friendProfiles[result.friendId];
      const friendName = getProfileDisplayName(friendProfile, convo?.friendName);
      const friendPhotoURL = getProfilePhotoURL(friendProfile);
      rows.set(result.chatId, {
        id: result.chatId,
        type: 'dm',
        title: friendName,
        subtitle: result.matchedCount > 1 ? `${result.matchedCount} matched messages` : result.snippet,
        avatarUri: friendPhotoURL,
        onPress: () => navigation.navigate('DirectMessage', { friendId: result.friendId, friendName }),
      });
    });

    dmConversations.forEach((convo) => {
      if (rows.has(convo.chatId)) return;
      const friendProfile = friendProfiles[convo.friendId];
      const friendName = getProfileDisplayName(friendProfile, convo.friendName);
      const combined = normalizeForSearch(`${friendName} ${convo.lastMessage}`);
      if (!combined.includes(q)) return;
      rows.set(convo.chatId, {
        id: convo.chatId,
        type: 'dm',
        title: friendName,
        subtitle: convo.lastMessage || 'Direct message',
        avatarUri: getProfilePhotoURL(friendProfile),
        onPress: () => navigation.navigate('DirectMessage', { friendId: convo.friendId, friendName }),
      });
    });

    communities.forEach((community) => {
      const combined = normalizeForSearch(`${community.name} ${community.description}`);
      if (!combined.includes(q)) return;
      rows.set(`community:${community.id}`, {
        id: `community:${community.id}`,
        type: 'community',
        title: community.name,
        subtitle: 'Community chat',
        emoji: community.emoji,
        onPress: () =>
          navigation.navigate('CommunityChatRoom', {
            communityId: community.id,
            communityName: community.name,
            communityEmoji: community.emoji,
            membersCount: community.membersCount || 0,
            isMember: isMember(community),
          }),
      });
    });

    return Array.from(rows.values());
  }, [communities, dmConversations, friendProfiles, messageSearchResults, navigation, trimmedSearchQuery, user?.uid]);

  const visibleMessageRows = showAllMessageResults ? searchMessageRows : searchMessageRows.slice(0, 3);
  const visibleAccountRows = showAllAccountResults ? accountResults : accountResults.slice(0, 3);

  const handleCreateCommunity = async () => {
    if (!user) { Alert.alert('Error', 'Please sign in to create a community.'); return; }
    if (!newCommName.trim() || !newCommDesc.trim()) { Alert.alert('Error', 'Name and description are required.'); return; }
    
    setCreatingComm(true);
    try {
      await createCustomCommunity({
        name: newCommName.trim(),
        description: newCommDesc.trim(),
        emoji: newCommEmoji || '🌟',
        category: 'User Created',
      }, user.uid);
      setNewCommName('');
      setNewCommDesc('');
      setNewCommEmoji('🌟');
      setShowCreateModal(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to create community.');
    } finally {
      setCreatingComm(false);
    }
  };

  const handleDeleteConversation = (convo: DMConversation, friendName: string) => {
    if (!user) return;
    Alert.alert('Delete Chat', `Delete your chat with ${friendName}? It will stay in their account.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for Me',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllDirectMessagesForUser(convo.chatId, user.uid);
          } catch {
            Alert.alert('Error', 'Could not delete this chat.');
          }
        },
      },
    ]);
  };

  const handleDeleteSageChat = () => {
    if (!user) return;
    Alert.alert('Delete Sage Chat', 'Delete your Sage chat history from this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => AsyncStorage.removeItem(getSageChatStorageKey(user.uid)).catch(() => {
          Alert.alert('Error', 'Could not delete Sage chat.');
        }),
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={[styles.logoMark, { backgroundColor: C.primary }]}>
              <Text style={[styles.logoMarkText, { color: C.onPrimary }]}>M</Text>
            </View>
            <Text style={[styles.logoText, { color: C.primary }]}>mindspace</Text>
          </View>
          <AppHeaderActions />
        </View>
        <Text style={[styles.title, { color: C.onSurface }]}>Conversations</Text>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: C.surfaceContainerHighest + '80' }]}>
          <Ionicons name="search" size={18} color={C.onSurfaceVariant} />
          <TextInput
            style={[styles.searchInput, { color: C.onSurface }]}
            placeholder={t('Search chats and accounts')}
            placeholderTextColor={C.onSurfaceVariant}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={C.onSurfaceVariant} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isSearchActive && (
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'chats' && [styles.tabActive, { backgroundColor: C.primaryContainer }],
            ]}
            onPress={() => setActiveTab('chats')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="chatbubble-ellipses"
              size={16}
              color={activeTab === 'chats' ? C.primary : C.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'chats' ? C.primary : C.onSurfaceVariant },
              ]}
            >
              Direct Messages
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'communities' && [styles.tabActive, { backgroundColor: C.primaryContainer }],
            ]}
            onPress={() => setActiveTab('communities')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="people"
              size={16}
              color={activeTab === 'communities' ? C.primary : C.onSurfaceVariant}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'communities' ? C.primary : C.onSurfaceVariant },
              ]}
            >
              Communities
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Content ── */}
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isSearchActive ? (
          <View style={styles.searchResultsWrap}>
            {searching ? (
              <View style={styles.searchLoadingRow}>
                <ActivityIndicator size="small" color={C.primary} />
                <Text style={[styles.searchLoadingText, { color: C.onSurfaceVariant }]}>Searching...</Text>
              </View>
            ) : null}

            <View style={styles.searchSection}>
              <View style={styles.searchSectionHeader}>
                <Text style={[styles.searchSectionTitle, { color: C.onSurface }]}>Messages</Text>
                {searchMessageRows.length > 3 ? (
                  <TouchableOpacity onPress={() => setShowAllMessageResults((value) => !value)}>
                    <Text style={[styles.seeAllText, { color: C.primary }]}>
                      {showAllMessageResults ? 'Show less' : 'See all'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {visibleMessageRows.length > 0 ? visibleMessageRows.map((row) => (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.searchResultRow, { backgroundColor: C.surfaceContainerLow }]}
                  onPress={row.onPress}
                  activeOpacity={0.78}
                >
                  {row.type === 'community' ? (
                    <View style={[styles.searchEmojiAvatar, { backgroundColor: C.primaryContainer }]}>
                      <Text translate={false} style={styles.searchEmoji}>{row.emoji}</Text>
                    </View>
                  ) : (
                    <Avatar name={row.title || '?'} uri={row.avatarUri} size={48} />
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text translate={false} style={[styles.searchResultTitle, { color: C.onSurface }]} numberOfLines={1}>
                      {row.title}
                    </Text>
                    <Text translate={false} style={[styles.searchResultSub, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                      {row.subtitle}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                </TouchableOpacity>
              )) : (
                <Text style={[styles.searchEmptyText, { color: C.onSurfaceVariant }]}>No matched messages yet.</Text>
              )}
            </View>

            <View style={styles.searchSection}>
              <View style={styles.searchSectionHeader}>
                <Text style={[styles.searchSectionTitle, { color: C.onSurface }]}>Accounts</Text>
                {accountResults.length > 3 ? (
                  <TouchableOpacity onPress={() => setShowAllAccountResults((value) => !value)}>
                    <Text style={[styles.seeAllText, { color: C.primary }]}>
                      {showAllAccountResults ? 'Show less' : 'See all'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {visibleAccountRows.length > 0 ? visibleAccountRows.map((profile) => {
                const displayName = getProfileDisplayName(profile);
                return (
                  <TouchableOpacity
                    key={profile.uid}
                    style={[styles.searchResultRow, { backgroundColor: C.surfaceContainerLow }]}
                    onPress={() =>
                      navigation.navigate('CommunityTab', {
                        screen: 'ViewProfile',
                        params: { userId: profile.uid, userName: displayName },
                      })
                    }
                    activeOpacity={0.78}
                  >
                    <Avatar name={displayName} uri={getProfilePhotoURL(profile)} size={48} />
                    <View style={styles.searchResultInfo}>
                      <Text translate={false} style={[styles.searchResultTitle, { color: C.onSurface }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text translate={false} style={[styles.searchResultSub, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                        {profile.headline || profile.bio || profile.email || 'Mindspace member'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                  </TouchableOpacity>
                );
              }) : (
                <Text style={[styles.searchEmptyText, { color: C.onSurfaceVariant }]}>No accounts found.</Text>
              )}
            </View>
          </View>
        ) : activeTab === 'chats' ? (
          <>
            {/* ── Pinned: Sage AI Chat ── */}
            <TouchableOpacity
              onPress={() => navigation.navigate('AIChatRoom')}
              onLongPress={handleDeleteSageChat}
              delayLongPress={350}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[C.primaryContainer, `${C.tertiaryContainer}88`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sageCard}
              >
                <View style={styles.pinnedBadge}>
                  <Ionicons name="pin" size={10} color={C.primary} />
                  <Text style={[styles.pinnedText, { color: C.primary }]}>PINNED</Text>
                </View>
                <View style={styles.sageRow}>
                  <View style={[styles.sageAvatar, { backgroundColor: C.primary }]}>
                    <Image source={SAGE_AVATAR} style={styles.sageAvatarImg} />
                    <View style={[styles.sageOnline, { borderColor: C.primaryContainer }]} />
                  </View>
                  <View style={styles.sageInfo}>
                    <View style={styles.sageNameRow}>
                      <Text style={[styles.sageName, { color: C.onPrimaryContainer }]}>
                        {AI_CONFIG.COMPANION_NAME}
                      </Text>
                      <View style={[styles.aiBadge, { backgroundColor: `${C.primary}22` }]}>
                        <Ionicons name="sparkles" size={10} color={C.primary} />
                        <Text style={[styles.aiBadgeText, { color: C.primary }]}>AI</Text>
                      </View>
                    </View>
                    <Text style={[styles.sageTagline, { color: C.onPrimaryContainer }]} numberOfLines={1}>
                      {AI_CONFIG.COMPANION_TAGLINE}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={C.onPrimaryContainer} />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* ── Direct Messages ── */}
            {dmConversations.length > 0 ? (
              <View style={{ gap: Spacing[2] }}>
                <Text style={[styles.sectionLabel, { color: C.onSurfaceVariant }]}>Recent Conversations</Text>
                {dmConversations.map((convo) => {
                  const friendProfile = friendProfiles[convo.friendId];
                  const friendName = getProfileDisplayName(friendProfile, convo.friendName);
                  const friendPhotoURL = getProfilePhotoURL(friendProfile);
                  const timeStr = convo.lastMessageTime?.toDate
                    ? (() => {
                        const mins = Math.floor((Date.now() - convo.lastMessageTime.toDate().getTime()) / 60000);
                        if (mins < 1) return 'now';
                        if (mins < 60) return `${mins}m`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h`;
                        return `${Math.floor(hrs / 24)}d`;
                      })()
                    : '';
                  return (
                    <TouchableOpacity
                      key={convo.chatId}
                      style={[styles.dmCard, { backgroundColor: C.surfaceContainerLow }]}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('DirectMessage', { friendId: convo.friendId, friendName })}
                      onLongPress={() => handleDeleteConversation(convo, friendName)}
                      delayLongPress={350}
                    >
                      <Avatar name={friendName || '?'} uri={friendPhotoURL} size={48} />
                      <View style={styles.dmInfo}>
                        <View style={styles.dmTopRow}>
                          <Text translate={false} style={[styles.dmName, { color: C.onSurface }]} numberOfLines={1}>
                            {friendName}
                          </Text>
                          <Text translate={false} style={[styles.dmTime, { color: C.onSurfaceVariant }]}>{timeStr}</Text>
                        </View>
                        <Text translate={false} style={[styles.dmPreview, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                          {convo.lastMessage}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={[styles.emptySection, { backgroundColor: C.surfaceContainerLowest }]}>
                <View style={[styles.emptyIcon, { backgroundColor: C.surfaceContainerHigh }]}>
                  <Ionicons name="chatbubbles-outline" size={32} color={C.onSurfaceVariant} />
                </View>
                <Text style={[styles.emptyTitle, { color: C.onSurface }]}>No Direct Messages</Text>
                <Text style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                  Your conversations with other Mindspace members will appear here.
                  Start by engaging in community discussions!
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* ── Create Community Button ── */}
            <TouchableOpacity 
              style={[styles.createCommBtn, { backgroundColor: C.primary }]}
              onPress={() => setShowCreateModal(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color={C.onPrimary} />
              <Text style={[styles.createCommBtnText, { color: C.onPrimary }]}>Create New Community</Text>
            </TouchableOpacity>

            {/* ── Communities List ── */}
            {filteredCommunities.length > 0 ? (
              filteredCommunities.map((community) => {
                const joined = isMember(community);
                return (
                  <TouchableOpacity
                    key={community.id}
                    onPress={() =>
                      navigation.navigate('CommunityChatRoom', {
                        communityId: community.id,
                        communityName: community.name,
                        communityEmoji: community.emoji,
                        membersCount: community.membersCount || 0,
                        isMember: joined,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.communityCard,
                        { backgroundColor: C.surfaceContainerLowest, ...Shadow.subtle },
                      ]}
                    >
                      <View style={styles.communityRow}>
                        <View style={[styles.communityEmojiBg, { backgroundColor: C.primaryContainer }]}>
                          <Text style={{ fontSize: 24 }}>{community.emoji}</Text>
                        </View>
                        <View style={styles.communityInfo}>
                          <Text translate={false} style={[styles.communityName, { color: C.onSurface }]}>
                            {community.name}
                          </Text>
                          <Text translate={false} style={[styles.communityDesc, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                            {community.description}
                          </Text>
                          <View style={styles.communityMeta}>
                            <Ionicons name="people-outline" size={12} color={C.onSurfaceVariant} />
                            <Text style={[styles.communityMembers, { color: C.onSurfaceVariant }]}>
                              {community.membersCount || 0} joined
                            </Text>
                            {joined && (
                              <View style={[styles.joinedBadge, { backgroundColor: `${C.primary}18` }]}>
                                <Text style={[styles.joinedText, { color: C.primary }]}>Joined</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.emptySection, { backgroundColor: C.surfaceContainerLowest }]}>
                <Ionicons name="search-outline" size={32} color={C.onSurfaceVariant} />
                <Text style={[styles.emptyTitle, { color: C.onSurface }]}>No Results</Text>
                <Text style={[styles.emptyDesc, { color: C.onSurfaceVariant }]}>
                  No communities match "{searchQuery}"
                </Text>
              </View>
            )}

            {/* ── Find Your Tribe CTA ── */}
            {!searchQuery && (
              <LinearGradient
                colors={[`${C.secondaryContainer}CC`, `${C.tertiaryContainer}99`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaCard}
              >
                <Text style={[styles.ctaTitle, { color: C.onSecondaryContainer }]}>
                  Find Your Tribe
                </Text>
                <Text style={[styles.ctaDesc, { color: C.onSecondaryContainer }]}>
                  Join specialized communities tailored to your journey toward mindfulness and healing.
                </Text>
              </LinearGradient>
            )}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ── Create Community Modal ── */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalHeader, { borderBottomColor: C.outlineVariant + '33' }]}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={[styles.modalCancel, { color: C.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: C.onSurface }]}>New Community</Text>
            <TouchableOpacity 
              style={[styles.modalCreateBtn, { backgroundColor: C.primary }, creatingComm && { opacity: 0.6 }]}
              onPress={handleCreateCommunity}
              disabled={creatingComm}
            >
              <Text style={[styles.modalCreateBtnText, { color: C.onPrimary }]}>{creatingComm ? 'Creating...' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: C.onSurface }]}>Emoji</Text>
              <TextInput
                style={[styles.emojiInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={newCommEmoji}
                onChangeText={setNewCommEmoji}
                maxLength={2}
                placeholder="🌟"
                placeholderTextColor={C.onSurfaceVariant}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: C.onSurface }]}>Community Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={newCommName}
                onChangeText={setNewCommName}
                placeholder="e.g. Mindful Readers"
                placeholderTextColor={C.onSurfaceVariant}
                maxLength={40}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: C.onSurface }]}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.textArea, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={newCommDesc}
                onChangeText={setNewCommDesc}
                placeholder="What is this community about?"
                placeholderTextColor={C.onSurfaceVariant}
                multiline
                maxLength={150}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    paddingHorizontal: Spacing[5],
    paddingTop: 56,
    gap: Spacing[2],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  logoMark: {
    width: 28, height: 28, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  logoMarkText: { fontFamily: Typography.fontFamily.bold, fontSize: 13 },
  logoText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md },
  title: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize['3xl'],
    letterSpacing: -0.5,
  },

  // Search
  searchContainer: {
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[3],
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    paddingHorizontal: Spacing[4],
    height: 44,
    borderRadius: Radius.full,
  },
  searchInput: {
    flex: 1,
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    height: '100%',
  },
  searchResultsWrap: {
    gap: Spacing[5],
  },
  searchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    alignSelf: 'flex-start',
  },
  searchLoadingText: {
    fontFamily: Typography.fontFamily.medium,
    fontSize: Typography.fontSize.sm,
  },
  searchSection: {
    gap: Spacing[2],
  },
  searchSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[1],
  },
  searchSectionTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  seeAllText: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.md,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: Radius.lg,
  },
  searchResultInfo: { flex: 1, gap: 2 },
  searchResultTitle: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
  },
  searchResultSub: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  searchEmojiAvatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchEmoji: { fontSize: 24 },
  searchEmptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    paddingVertical: Spacing[2],
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing[5],
    gap: Spacing[2],
    marginBottom: Spacing[2],
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[2] + 2,
    borderRadius: Radius.full,
  },
  tabActive: {},
  tabText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
  },

  // Content
  content: {
    padding: Spacing[5],
    paddingTop: Spacing[2],
    gap: Spacing[3],
  },

  // Sage AI Card
  sageCard: {
    borderRadius: Radius.xl,
    padding: Spacing[4],
    gap: Spacing[3],
  },
  pinnedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  pinnedText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 1,
  },
  sageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  sageAvatar: {
    width: 52, height: 52, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sageAvatarImg: {
    width: 48, height: 48, borderRadius: Radius.full,
  },
  sageOnline: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 14, height: 14,
    borderRadius: 7,
    backgroundColor: '#4caf50',
    borderWidth: 2,
  },
  sageInfo: { flex: 1, gap: 4 },
  sageNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing[2] },
  sageName: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.lg,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  aiBadgeText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },
  sageTagline: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    opacity: 0.8,
  },

  // Empty
  emptySection: {
    borderRadius: Radius.lg,
    padding: Spacing[6],
    alignItems: 'center',
    gap: Spacing[3],
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  emptyDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
  },

  // Create Community UI
  createCommBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing[3], borderRadius: Radius.full, marginBottom: Spacing[2],
  },
  createCommBtnText: {
    fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.md,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: Spacing[5], borderBottomWidth: 1,
  },
  modalCancel: { fontFamily: Typography.fontFamily.medium, fontSize: Typography.fontSize.md },
  modalTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  modalCreateBtn: { paddingHorizontal: Spacing[4], paddingVertical: Spacing[2], borderRadius: Radius.full },
  modalCreateBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.sm },
  modalBody: { padding: Spacing[5], gap: Spacing[4] },
  inputGroup: { gap: Spacing[2] },
  inputLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.sm },
  emojiInput: { fontSize: 32, textAlign: 'center', width: 72, height: 72, borderRadius: 36 },
  textInput: {
    fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.md,
    borderRadius: Radius.lg, paddingHorizontal: Spacing[4], paddingVertical: Spacing[3],
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  // Community cards
  communityCard: {
    borderRadius: Radius.lg,
    padding: Spacing[4],
  },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  communityEmojiBg: {
    width: 52, height: 52, borderRadius: Radius.full,
    justifyContent: 'center', alignItems: 'center',
  },
  communityInfo: { flex: 1, gap: 3 },
  communityName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.lg,
  },
  communityDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
  communityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  communityMembers: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
  },
  joinedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    marginLeft: 4,
  },
  joinedText: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 10,
  },

  // CTA
  ctaCard: {
    borderRadius: Radius.xl,
    padding: Spacing[5],
    gap: Spacing[2],
    alignItems: 'center',
  },
  ctaTitle: {
    fontFamily: Typography.fontFamily.bold,
    fontSize: Typography.fontSize.xl,
  },
  ctaDesc: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
    textAlign: 'center',
    lineHeight: Typography.fontSize.md * 1.6,
    opacity: 0.85,
  },

  // DM conversation cards
  sectionLabel: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing[1],
  },
  dmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.lg,
  },
  dmInfo: { flex: 1, gap: 3 },
  dmTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dmName: {
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: Typography.fontSize.md,
    flex: 1,
  },
  dmTime: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.xs,
    marginLeft: Spacing[2],
  },
  dmPreview: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
  },
});
