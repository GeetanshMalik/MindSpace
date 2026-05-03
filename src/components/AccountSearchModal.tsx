import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Text } from './TranslatedText';
import { Avatar } from './Avatar';
import { Spacing, Typography, Radius } from '../theme';
import { useColors } from '../theme/useColors';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { translateText } from '../i18n';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL, getProfileHeadline } from '../types/profile';
import { searchUserProfiles } from '../services/firebase/firestore';

type AccountSearchModalProps = {
  visible: boolean;
  onClose: () => void;
};

export const AccountSearchModal: React.FC<AccountSearchModalProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const language = useThemeStore((state) => state.language);
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const trimmedQuery = query.trim();
  const t = useMemo(() => (value: string) => translateText(value, language), [language]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setLoading(false);
      return;
    }

    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchUserProfiles(trimmedQuery, user?.uid, 30)
        .then((profiles) => {
          if (!cancelled) setResults(profiles);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmedQuery, user?.uid, visible]);

  const openProfile = (profile: UserProfile) => {
    onClose();
    navigation.navigate('CommunityTab', {
      screen: 'ViewProfile',
      params: {
        userId: profile.uid,
        userName: getProfileDisplayName(profile),
      },
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: C.surface }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={26} color={C.onSurface} />
          </TouchableOpacity>
          <View style={[styles.searchBar, { backgroundColor: C.surfaceContainerHighest }]}>
            <Ionicons name="search" size={18} color={C.onSurfaceVariant} />
            <TextInput
              style={[styles.searchInput, { color: C.onSurface }]}
              placeholder={t('Search accounts')}
              placeholderTextColor={C.onSurfaceVariant}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={C.onSurfaceVariant} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="small" color={C.primary} />
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.uid}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.centerState}>
                <Ionicons name={trimmedQuery ? 'person-outline' : 'search-outline'} size={32} color={C.onSurfaceVariant} />
                <Text style={[styles.emptyTitle, { color: C.onSurface }]}>
                  {trimmedQuery ? 'No accounts found' : 'Search accounts'}
                </Text>
                <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>
                  {trimmedQuery ? 'Try a name, username, or profile detail.' : 'Find people by name or profile details.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const displayName = getProfileDisplayName(item);
              return (
                <TouchableOpacity
                  style={[styles.accountRow, { backgroundColor: C.surfaceContainerLow }]}
                  onPress={() => openProfile(item)}
                  activeOpacity={0.78}
                >
                  <Avatar name={displayName} uri={getProfilePhotoURL(item)} size={48} />
                  <View style={styles.accountInfo}>
                    <Text translate={false} style={[styles.accountName, { color: C.onSurface }]} numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text translate={false} style={[styles.accountSub, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                      {getProfileHeadline(item)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.onSurfaceVariant} />
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingTop: 58,
    paddingBottom: Spacing[3],
  },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    flex: 1,
    height: 46,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.md,
  },
  list: { padding: Spacing[5], gap: Spacing[2], flexGrow: 1 },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: Radius.lg,
    padding: Spacing[3],
    marginBottom: Spacing[2],
  },
  accountInfo: { flex: 1, gap: 2 },
  accountName: { fontFamily: Typography.fontFamily.semiBold, fontSize: Typography.fontSize.md },
  accountSub: { fontFamily: Typography.fontFamily.regular, fontSize: Typography.fontSize.sm },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[8],
    gap: Spacing[2],
  },
  emptyTitle: { fontFamily: Typography.fontFamily.bold, fontSize: Typography.fontSize.lg },
  emptyText: {
    fontFamily: Typography.fontFamily.regular,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
    lineHeight: Typography.fontSize.sm * 1.5,
  },
});
