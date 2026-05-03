import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, Modal, TextInput, KeyboardAvoidingView, Platform, Share, ActivityIndicator } from 'react-native';
import { Text } from '../../components/TranslatedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Spacing, Typography, Radius } from '../../theme';
import { useColors } from '../../theme/useColors';
import { Avatar } from '../../components/Avatar';
import { AppHeaderActions } from '../../components/AppHeaderActions';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../services/firebase/auth';
import { useTranslation } from '../../i18n/useTranslation';
import { auth } from '../../services/firebase/config';
import { updateProfile } from 'firebase/auth';
import * as ImagePicker from 'expo-image-picker';
import {
  Post,
  Reflection,
  subscribeToUserPosts,
  subscribeToUserReflections,
  getAcceptedFriendIds,
  saveUserProfile,
  syncUserPublicProfileReferences,
} from '../../services/firebase/firestore';
import { useStreakStore } from '../../store/streakStore';
import { uploadMedia, getMediaPath, getExtensionFromUri } from '../../services/firebase/storage';
import {
  getProfileAbout,
  getProfileDisplayName,
  getProfileHeadline,
  getProfilePhotoURL,
} from '../../types/profile';

const timeAgo = (date: Date) => {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const formatDateOfBirth = (value?: string) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  if (year && month && day) return `${day}/${month}/${year}`;
  return value;
};

const normalizeTags = (tags?: string[] | string) => {
  if (Array.isArray(tags)) return tags;
  return tags ? tags.split(',').filter(Boolean) : [];
};

const CITY_OPTIONS = [
  'Ahmedabad, India',
  'Agra, India',
  'Amritsar, India',
  'Bangalore, India',
  'Bengaluru, India',
  'Bhopal, India',
  'Chandigarh, India',
  'Chennai, India',
  'Coimbatore, India',
  'Dehradun, India',
  'Delhi, India',
  'Faridabad, India',
  'Ghaziabad, India',
  'Gurugram, India',
  'Guwahati, India',
  'Hyderabad, India',
  'Indore, India',
  'Jaipur, India',
  'Kanpur, India',
  'Kochi, India',
  'Kolkata, India',
  'Lucknow, India',
  'Ludhiana, India',
  'Mumbai, India',
  'Mysuru, India',
  'Nagpur, India',
  'Noida, India',
  'Patna, India',
  'Pune, India',
  'Rajkot, India',
  'Surat, India',
  'Thiruvananthapuram, India',
  'Vadodara, India',
  'Varanasi, India',
  'Vijayawada, India',
  'Visakhapatnam, India',
  'London, United Kingdom',
  'New York, United States',
  'San Francisco, United States',
  'Toronto, Canada',
  'Sydney, Australia',
  'Singapore',
  'Dubai, United Arab Emirates',
];

const CALENDAR_WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MIN_DOB_YEAR = 1900;
const MAX_DOB_YEAR = new Date().getFullYear();
const DOB_YEAR_OPTIONS = Array.from(
  { length: MAX_DOB_YEAR - MIN_DOB_YEAR + 1 },
  (_, index) => MIN_DOB_YEAR + index
);

type GeoCityResult = {
  id?: number;
  name?: string;
  admin1?: string;
  country?: string;
};

type LocationOption = {
  label: string;
  value: string;
  isCustom?: boolean;
};

const formatGeoCity = (city: GeoCityResult) => {
  if (!city.name) return null;
  const parts = [city.name, city.admin1, city.country]
    .filter(Boolean)
    .filter((part, index, list) => list.findIndex((item) => item?.toLowerCase() === part?.toLowerCase()) === index);
  return parts.join(', ');
};

const formatDobValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDobValue = (value?: string) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const UserProfileScreen = () => {
  const navigation = useNavigation<any>();
  const C = useColors();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const { streak, hasLostStreak, lostStreak, restoreStreak } = useStreakStore();
  const isDark = C.surface === '#141412';
  const displayName = getProfileDisplayName(profile, user?.displayName);
  const profilePhotoURL = getProfilePhotoURL(profile, user?.photoURL);
  const profileHeadline = getProfileHeadline(profile);
  const profileAbout = getProfileAbout(profile);
  const profileEmail = profile?.email || user?.email || '';
  const profileDetails = [
    profileEmail ? { icon: 'mail-outline', label: profileEmail } : null,
    profile?.location ? { icon: 'location-outline', label: profile.location } : null,
    profile?.dateOfBirth ? { icon: 'calendar-outline', label: formatDateOfBirth(profile.dateOfBirth) } : null,
    profile?.phoneNumber ? { icon: 'call-outline', label: profile.phoneNumber } : null,
    profile?.pronouns ? { icon: 'person-outline', label: profile.pronouns } : null,
  ].filter(Boolean) as { icon: string; label: string }[];
  
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [activeSection, setActiveSection] = useState<'posts' | 'reflections'>('posts');

  // Edit Profile state
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editHeadline, setEditHeadline] = useState('');
  const [editAbout, setEditAbout] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPronouns, setEditPronouns] = useState('');
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [showLocationResults, setShowLocationResults] = useState(false);
  const [remoteLocationResults, setRemoteLocationResults] = useState<string[]>([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationSearchError, setLocationSearchError] = useState(false);
  const [showDobCalendar, setShowDobCalendar] = useState(false);
  const [showDobYearPicker, setShowDobYearPicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(2000, 0, 1));
  const [saving, setSaving] = useState(false);

  const localLocationResults = useMemo<LocationOption[]>(() => {
    const query = editLocation.trim().toLowerCase();
    if (query.length < 2) return [];
    return CITY_OPTIONS
      .filter((city) => city.toLowerCase().includes(query))
      .map((city) => ({ label: city, value: city }))
      .slice(0, 6);
  }, [editLocation]);

  const locationResults = useMemo<LocationOption[]>(() => {
    const query = editLocation.trim();
    if (query.length < 2) return [];

    const results: LocationOption[] = [];
    const seen = new Set<string>();
    const addOption = (option: LocationOption) => {
      const key = option.value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      results.push(option);
    };

    remoteLocationResults.forEach((city) => addOption({ label: city, value: city }));
    localLocationResults.forEach(addOption);

    if (query.length >= 3 && !seen.has(query.toLowerCase())) {
      addOption({ label: `Use "${query}"`, value: query, isCustom: true });
    }

    return results.slice(0, 8);
  }, [editLocation, localLocationResults, remoteLocationResults]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay }, () => null);
    const days = Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1));
    return [...blanks, ...days];
  }, [calendarMonth]);

  const selectedYear = calendarMonth.getFullYear();
  const yearPickerOffset = Math.max(0, Math.floor((selectedYear - MIN_DOB_YEAR) / 3) * 44 - 88);
  const today = new Date();
  const canMoveCalendarBack = selectedYear > MIN_DOB_YEAR || calendarMonth.getMonth() > 0;
  const canMoveCalendarForward =
    selectedYear < today.getFullYear() ||
    (selectedYear === today.getFullYear() && calendarMonth.getMonth() < today.getMonth());

  useEffect(() => {
    const query = editLocation.trim();

    if (!showLocationResults || query.length < 2) {
      setRemoteLocationResults([]);
      setLocationSearching(false);
      setLocationSearchError(false);
      return;
    }

    let active = true;
    setLocationSearchError(false);
    setLocationSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=en&format=json`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('City search failed');
        const data = await response.json();
        const cities = Array.isArray(data?.results)
          ? data.results.map(formatGeoCity).filter(Boolean) as string[]
          : [];

        if (active) {
          setRemoteLocationResults(cities);
          setLocationSearchError(false);
        }
      } catch {
        if (active) {
          setRemoteLocationResults([]);
          setLocationSearchError(true);
        }
      } finally {
        if (active) setLocationSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [editLocation, showLocationResults]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserPosts(user.uid, setPosts);
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) {
      setReflections([]);
      return;
    }
    return subscribeToUserReflections(user.uid, setReflections, 20);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    getAcceptedFriendIds(user.uid).then(ids => setFriendCount(ids.length)).catch(() => {});
  }, [user]);

  const handleLogout = async () => {
    Alert.alert(t('Sign Out'), t('Are you sure you want to sign out?'), [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Sign Out'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleShareJourney = async () => {
    try {
      await Share.share({
        message: `Check out my mindfulness journey on Mindspace! I've shared ${posts.length} posts and maintained a ${streak}-day streak. 🧘‍♀️`,
      });
    } catch {}
  };

  const openEditProfile = () => {
    setEditName(displayName);
    setEditHeadline(profile?.headline || '');
    setEditAbout(profile?.about || profile?.bio || '');
    setEditDob(profile?.dateOfBirth || '');
    setEditPhone(profile?.phoneNumber || '');
    setEditLocation(profile?.location || '');
    setEditPronouns(profile?.pronouns || '');
    setShowLocationResults(false);
    setRemoteLocationResults([]);
    setLocationSearchError(false);
    setShowDobCalendar(false);
    setShowDobYearPicker(false);
    setCalendarMonth(parseDobValue(profile?.dateOfBirth) || new Date(2000, 0, 1));
    setEditPhotoUri(null);
    setShowEditProfile(true);
  };

  const pickProfilePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setEditPhotoUri(result.assets[0].uri);
  };

  const moveCalendarMonth = (direction: -1 | 1) => {
    setShowDobYearPicker(false);
    setCalendarMonth((current) => {
      const next = new Date(current.getFullYear(), current.getMonth() + direction, 1);
      const now = new Date();

      if (next.getFullYear() < MIN_DOB_YEAR) return current;
      if (
        next.getFullYear() > now.getFullYear() ||
        (next.getFullYear() === now.getFullYear() && next.getMonth() > now.getMonth())
      ) return current;

      return next;
    });
  };

  const selectCalendarYear = (year: number) => {
    setCalendarMonth((current) => {
      const now = new Date();
      const nextMonth = year === now.getFullYear() && current.getMonth() > now.getMonth()
        ? now.getMonth()
        : current.getMonth();
      return new Date(year, nextMonth, 1);
    });
    setShowDobYearPicker(false);
  };

  const selectDob = (date: Date) => {
    setEditDob(formatDobValue(date));
    setShowDobCalendar(false);
    setShowDobYearPicker(false);
  };

  const saveProfile = async () => {
    if (!user || !editName.trim()) { Alert.alert(t('Name required')); return; }
    setSaving(true);
    try {
      const nextDisplayName = editName.trim();
      let nextPhotoURL = profilePhotoURL || undefined;
      if (editPhotoUri) {
        const ext = getExtensionFromUri(editPhotoUri);
        const path = getMediaPath('profile_photos', user.uid, ext);
        nextPhotoURL = await uploadMedia(editPhotoUri, path, 'image');
      }
      await updateProfile(auth.currentUser!, {
        displayName: nextDisplayName,
        ...(nextPhotoURL ? { photoURL: nextPhotoURL } : {}),
      });

      const nextProfile = {
        displayName: nextDisplayName,
        email: user.email,
        photoURL: nextPhotoURL || null,
        avatarUrl: nextPhotoURL || null,
        headline: editHeadline.trim(),
        about: editAbout.trim(),
        bio: editAbout.trim(),
        dateOfBirth: editDob.trim(),
        phoneNumber: editPhone.trim(),
        location: editLocation.trim(),
        pronouns: editPronouns.trim(),
      };

      await saveUserProfile(user.uid, nextProfile);

      try {
        await syncUserPublicProfileReferences(user.uid, nextDisplayName, nextPhotoURL || null);
      } catch (syncError) {
        console.warn('Profile saved, but some older content could not be resynced:', syncError);
      }

      useAuthStore.setState({
        user: { ...user, displayName: nextDisplayName, photoURL: nextPhotoURL || user.photoURL } as any,
        profile: { ...(profile || { uid: user.uid }), ...nextProfile } as any,
      });
      setShowEditProfile(false);
      Alert.alert(t('Success'), t('Profile updated!'));
    } catch (e: any) {
      Alert.alert(t('Error'), e.message || t('Could not update profile.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreStreak = () => {
    Alert.alert(t('Restore Streak'), `${t('Watch Ad')} – ${lostStreak} ${t('day streak!')}`, [
      { text: t('Cancel'), style: 'cancel' },
      { text: t('Watch Ad'), onPress: () => { setTimeout(() => { restoreStreak(); Alert.alert(t('Success'), t('Your streak has been restored!')); }, 1000); } },
    ]);
  };

  const openPost = (post: Post) => {
    if (!post.id) return;
    (navigation as any).navigate('PostDetail', { postId: post.id });
  };

  const stats = [
    { label: 'Posts', value: posts.length },
    { label: 'Friends', value: friendCount },
    { label: 'Reflections', value: reflections.length },
    { label: 'Streak', value: streak },
  ];

  return (
    <View style={[styles.container, { backgroundColor: C.surface }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ─── Hero Section (matches Stitch "Premium User Profile") ─── */}
        <LinearGradient
          colors={(isDark
            ? [C.surfaceContainerHigh, C.surfaceContainerLow, C.surface]
            : ['#C0ECDA', '#F8F4E5', C.surface]) as [string, string, string]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={styles.hero}
        >
          {/* Top bar */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Ionicons name="leaf" size={20} color={C.primary} />
              <Text style={[styles.appTitle, { color: C.onSurface }]}>Mindspace</Text>
            </View>
            <View style={styles.topBarActions}>
              <AppHeaderActions
                showProfile={false}
                buttonStyle={{ backgroundColor: `${C.surfaceContainerHighest}66` }}
              />
              <TouchableOpacity
                style={[styles.settingsBtn, { backgroundColor: `${C.surfaceContainerHighest}66` }]}
                onPress={() => (navigation as any).navigate('HomeTab', { screen: 'Settings' })}
              >
                <Ionicons name="settings-outline" size={20} color={C.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Large circular avatar */}
          <TouchableOpacity onPress={openEditProfile} activeOpacity={0.8} style={styles.avatarWrap}>
            <Avatar name={displayName} uri={profilePhotoURL} size={110} />
            <View style={[styles.cameraBadge, { backgroundColor: C.primary }]}>
              <Ionicons name="camera" size={14} color={C.onPrimary} />
            </View>
          </TouchableOpacity>

          {/* Name + subtitle */}
          <Text translate={false} style={[styles.displayName, { color: C.onSurface }]}>
            {displayName}
          </Text>
          <Text translate={false} style={[styles.subtitle, { color: C.primary }]}>
            {profileHeadline}
          </Text>
          <View style={styles.detailsWrap}>
            {profileDetails.map((detail) => (
              <View key={`${detail.icon}-${detail.label}`} style={[styles.detailPill, { backgroundColor: `${C.surfaceContainerHighest}99` }]}>
                <Ionicons name={detail.icon as any} size={13} color={C.onSurfaceVariant} />
                <Text translate={false} style={[styles.detailText, { color: C.onSurfaceVariant }]} numberOfLines={1}>
                  {detail.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Bio */}
          <Text translate={false} style={[styles.bioText, { color: C.onSurface }]}>
            {profileAbout}
          </Text>

          {/* Action Buttons — two side by side */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.editProfileBtn, { backgroundColor: C.primary }]}
              onPress={openEditProfile}
            >
              <Ionicons name="pencil-outline" size={14} color={C.onPrimary} />
              <Text style={[styles.editProfileText, { color: C.onPrimary }]}>Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.shareBtn, { borderColor: C.primary }]}
              onPress={handleShareJourney}
            >
              <Ionicons name="share-outline" size={14} color={C.primary} />
              <Text style={[styles.shareBtnText, { color: C.primary }]}>Share Journey</Text>
            </TouchableOpacity>
          </View>

          {/* Stats Card */}
          <View style={[styles.statsCard, { backgroundColor: C.surfaceContainerLowest }]}>
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={[styles.statDivider, { backgroundColor: C.outlineVariant + '33' }]} />}
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: C.primary }]}>
                    {s.value >= 1000 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: C.onSurfaceVariant }]}>{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {hasLostStreak && (
            <TouchableOpacity style={styles.restoreStreakBtn} onPress={handleRestoreStreak}>
              <Ionicons name="flame" size={16} color="#fff" />
              <Text style={styles.restoreStreakText}>Restore your {lostStreak} day streak!</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* ─── Section Tabs ─── */}
        <View style={[styles.sectionTabs, { backgroundColor: C.surface }]}>
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'posts' && [styles.activeTab, { borderBottomColor: C.primary }]]}
            onPress={() => setActiveSection('posts')}
          >
            <Ionicons name="grid-outline" size={16} color={activeSection === 'posts' ? C.primary : C.onSurfaceVariant} />
            <Text style={[styles.sectionTabText, { color: activeSection === 'posts' ? C.primary : C.onSurfaceVariant }]}>
              Recent Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sectionTab, activeSection === 'reflections' && [styles.activeTab, { borderBottomColor: C.primary }]]}
            onPress={() => setActiveSection('reflections')}
          >
            <Ionicons name="journal-outline" size={16} color={activeSection === 'reflections' ? C.primary : C.onSurfaceVariant} />
            <Text style={[styles.sectionTabText, { color: activeSection === 'reflections' ? C.primary : C.onSurfaceVariant }]}>
              Recent Reflections
            </Text>
          </TouchableOpacity>
        </View>

        {/* ─── Content Area ─── */}
        <View style={styles.content}>
          {activeSection === 'posts' ? (
            posts.length > 0 ? posts.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.postCard, { backgroundColor: C.surfaceContainerLow }]}
                activeOpacity={0.82}
                onPress={() => openPost(p)}
              >
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={styles.postImage} resizeMode="cover" />
                ) : null}
                <View style={styles.postBody}>
                  {p.content?.trim() ? (
                    <Text translate={false} style={[styles.postContent, { color: C.onSurface }]} numberOfLines={3}>{p.content}</Text>
                  ) : null}
                  <View style={styles.postFooter}>
                    <Text style={[styles.postTime, { color: C.onSurfaceVariant }]}>
                      {p.createdAt?.toDate ? timeAgo(p.createdAt.toDate()) : ''} • {p.category || 'General'}
                    </Text>
                    <View style={styles.postStats}>
                      <Ionicons name="heart" size={14} color="#e57373" />
                      <Text style={[styles.postStatNum, { color: C.onSurfaceVariant }]}>
                        {Array.isArray(p.likes) ? p.likes.length : 0}
                      </Text>
                      <Ionicons name="chatbubble-outline" size={13} color={C.primary} />
                      <Text style={[styles.postStatNum, { color: C.onSurfaceVariant }]}>
                        {p.commentsCount || 0}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="document-text-outline" size={44} color={C.outlineVariant} />
                <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>No posts yet.{'\n'}Share your first thought!</Text>
              </View>
            )
          ) : (
            reflections.length > 0 ? reflections.slice(0, 10).map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.postCard, { backgroundColor: C.surfaceContainerLow }]}
                activeOpacity={0.8}
                onPress={() => (navigation as any).navigate('HomeTab', { screen: 'ReflectionViewer', params: { reflectionId: r.id } })}
              >
                <View style={styles.postBody}>
                  <Text translate={false} style={[styles.reflectionTitle, { color: C.onSurface }]} numberOfLines={1}>{r.title}</Text>
                  <Text translate={false} style={[styles.postContent, { color: C.onSurfaceVariant }]} numberOfLines={3}>{r.body}</Text>
                  {r.tags ? <Text translate={false} style={[styles.tags, { color: '#446C5E' }]}># {r.tags.split(',').join(' · #')}</Text> : null}
                </View>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="journal-outline" size={44} color={C.outlineVariant} />
                <Text style={[styles.emptyText, { color: C.onSurfaceVariant }]}>No reflections yet.{'\n'}Write your first one!</Text>
              </View>
            )
          )}

          {/* Sign Out */}
          <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: '#f4433612' }]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#f44336" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ─── Edit Profile Modal ─── */}
      <Modal visible={showEditProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditProfile(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.editHeader, { borderBottomColor: C.outlineVariant + '22' }]}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text style={[styles.editCancel, { color: C.onSurfaceVariant }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.editModalTitle, { color: C.onSurface }]}>Edit Profile</Text>
            <TouchableOpacity
              style={[styles.editSaveBtn, { backgroundColor: C.primary }, saving && { opacity: 0.5 }]}
              onPress={saveProfile} disabled={saving}
            >
              <Text style={[styles.editSaveText, { color: C.onPrimary }]}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.editBody} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.editPhotoWrap} onPress={pickProfilePhoto}>
              <Avatar name={editName || displayName} uri={editPhotoUri || profilePhotoURL} size={100} previewable={false} />
              <View style={[styles.editPhotoBadge, { backgroundColor: C.primary }]}>
                <Ionicons name="camera" size={16} color={C.onPrimary} />
              </View>
            </TouchableOpacity>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Display Name</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editName} onChangeText={setEditName}
                placeholder={t('Your name')} placeholderTextColor={C.onSurfaceVariant} maxLength={30}
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Headline</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editHeadline}
                onChangeText={setEditHeadline}
                placeholder={t('Mindfulness Enthusiast & Community Member')}
                placeholderTextColor={C.onSurfaceVariant}
                maxLength={80}
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>About</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editAbout}
                onChangeText={setEditAbout}
                placeholder={t('Share a little about your journey')}
                placeholderTextColor={C.onSurfaceVariant}
                maxLength={240}
                multiline
                textAlignVertical="top"
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Date of Birth</Text>
              <TouchableOpacity
                style={[styles.editInput, styles.pickerInput, { backgroundColor: C.surfaceContainerLow }]}
                onPress={() => {
                  if (showDobCalendar) setShowDobYearPicker(false);
                  setShowDobCalendar((v) => !v);
                }}
                activeOpacity={0.75}
              >
                <Text style={[styles.pickerInputText, { color: editDob ? C.onSurface : C.onSurfaceVariant }]}>
                  {editDob || t('Select date')}
                </Text>
                <Ionicons name="calendar-outline" size={18} color={C.onSurfaceVariant} />
              </TouchableOpacity>
              {showDobCalendar && (
                <View style={[styles.calendarCard, { backgroundColor: C.surfaceContainerLow }]}>
                  <View style={styles.calendarHeader}>
                    <TouchableOpacity
                      onPress={() => moveCalendarMonth(-1)}
                      style={[styles.calendarIconBtn, !canMoveCalendarBack && styles.calendarIconBtnDisabled]}
                      disabled={!canMoveCalendarBack}
                    >
                      <Ionicons name="chevron-back" size={18} color={C.onSurface} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.calendarTitleBtn, { backgroundColor: `${C.surfaceContainerHighest}55` }]}
                      onPress={() => setShowDobYearPicker((v) => !v)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.calendarTitle, { color: C.onSurface }]}>
                        {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </Text>
                      <Ionicons
                        name={showDobYearPicker ? 'chevron-up' : 'chevron-down'}
                        size={15}
                        color={C.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveCalendarMonth(1)}
                      style={[styles.calendarIconBtn, !canMoveCalendarForward && styles.calendarIconBtnDisabled]}
                      disabled={!canMoveCalendarForward}
                    >
                      <Ionicons name="chevron-forward" size={18} color={C.onSurface} />
                    </TouchableOpacity>
                  </View>
                  {showDobYearPicker ? (
                    <ScrollView
                      style={styles.yearPickerScroll}
                      contentContainerStyle={styles.yearPickerContent}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                      contentOffset={{ x: 0, y: yearPickerOffset }}
                    >
                      {DOB_YEAR_OPTIONS.map((year) => {
                        const selected = year === selectedYear;
                        return (
                          <TouchableOpacity
                            key={year}
                            style={[styles.yearChip, selected && { backgroundColor: C.primary }]}
                            onPress={() => selectCalendarYear(year)}
                            activeOpacity={0.75}
                          >
                            <Text style={[styles.yearChipText, { color: selected ? C.onPrimary : C.onSurface }]}>
                              {year}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.calendarGrid}>
                      {CALENDAR_WEEKDAYS.map((day, index) => (
                        <Text key={`${day}-${index}`} style={[styles.calendarWeekday, { color: C.onSurfaceVariant }]}>
                          {day}
                        </Text>
                      ))}
                      {calendarDays.map((date, index) => {
                        const selected = date && editDob === formatDobValue(date);
                        const future = date ? date.getTime() > Date.now() : false;
                        return (
                          <TouchableOpacity
                            key={date ? formatDobValue(date) : `blank-${index}`}
                            style={[
                              styles.calendarDay,
                              selected && { backgroundColor: C.primary },
                              future && { opacity: 0.35 },
                            ]}
                            disabled={!date || future}
                            onPress={() => date && selectDob(date)}
                          >
                            <Text style={[
                              styles.calendarDayText,
                              { color: selected ? C.onPrimary : C.onSurface },
                            ]}>
                              {date ? date.getDate() : ''}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Phone Number</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder={t('Your phone number')}
                placeholderTextColor={C.onSurfaceVariant}
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Location</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editLocation}
                onChangeText={(value) => {
                  setEditLocation(value);
                  setShowLocationResults(true);
                }}
                onFocus={() => setShowLocationResults(true)}
                placeholder={t('Search city')}
                placeholderTextColor={C.onSurfaceVariant}
                maxLength={80}
              />
              {showLocationResults && (locationResults.length > 0 || locationSearching || locationSearchError) && (
                <View style={[styles.locationResults, { backgroundColor: C.surfaceContainerLow }]}>
                  {locationSearching && (
                    <View style={[styles.locationResult, { borderBottomColor: `${C.outlineVariant}55` }]}>
                      <ActivityIndicator size="small" color={C.primary} />
                      <Text style={[styles.locationResultText, { color: C.onSurfaceVariant }]}>{t('Searching cities...')}</Text>
                    </View>
                  )}
                  {locationResults.map((option) => (
                    <TouchableOpacity
                      key={`${option.value}-${option.isCustom ? 'custom' : 'city'}`}
                      style={[styles.locationResult, { borderBottomColor: `${C.outlineVariant}55` }]}
                      onPress={() => {
                        setEditLocation(option.value);
                        setShowLocationResults(false);
                      }}
                    >
                      <Ionicons
                        name={option.isCustom ? 'add-circle-outline' : 'location-outline'}
                        size={16}
                        color={C.primary}
                      />
                      <Text style={[styles.locationResultText, { color: C.onSurface }]}>{option.label}</Text>
                    </TouchableOpacity>
                  ))}
                  {locationSearchError && locationResults.length === 0 && (
                    <View style={[styles.locationResult, { borderBottomColor: `${C.outlineVariant}55` }]}>
                      <Ionicons name="cloud-offline-outline" size={16} color={C.onSurfaceVariant} />
                      <Text style={[styles.locationResultText, { color: C.onSurfaceVariant }]}>
                        {t('City search unavailable')}
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Pronouns</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: C.surfaceContainerLow, color: C.onSurface }]}
                value={editPronouns}
                onChangeText={setEditPronouns}
                placeholder={t('e.g. she/her')}
                placeholderTextColor={C.onSurfaceVariant}
                maxLength={30}
              />
            </View>
            <View style={styles.editField}>
              <Text style={[styles.editLabel, { color: C.onSurfaceVariant }]}>Email</Text>
              <Text translate={false} style={[styles.editEmailVal, { color: C.onSurface }]}>{profileEmail}</Text>
              <Text style={[styles.editHint, { color: C.onSurfaceVariant }]}>Email cannot be changed.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // ─── Hero ───
  hero: { alignItems: 'center', paddingBottom: 28, paddingHorizontal: 24, gap: 6 },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingTop: 52, marginBottom: 16,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  appTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 20 },
  settingsBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  avatarWrap: { position: 'relative', marginBottom: 8 },
  cameraBadge: {
    position: 'absolute', bottom: 4, right: 4,
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  displayName: { fontFamily: Typography.fontFamily.bold, fontSize: 26, letterSpacing: 0 },
  subtitle: { fontFamily: Typography.fontFamily.medium, fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 2 },
  detailsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  detailText: { fontFamily: Typography.fontFamily.regular, fontSize: 12, maxWidth: 260 },
  bioText: {
    fontFamily: Typography.fontFamily.regular, fontSize: 14, lineHeight: 22,
    textAlign: 'center', marginTop: 12, marginHorizontal: 8,
  },
  // ─── Action Buttons ───
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 18, width: '100%' },
  editProfileBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 999,
  },
  editProfileText: { fontFamily: Typography.fontFamily.bold, fontSize: 14, color: '#fff' },
  shareBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 999, borderWidth: 1.5,
  },
  shareBtnText: { fontFamily: Typography.fontFamily.bold, fontSize: 14 },
  // ─── Stats ───
  statsCard: {
    flexDirection: 'row', marginTop: 20, width: '100%',
    borderRadius: 24, paddingVertical: 18, paddingHorizontal: 8,
    justifyContent: 'space-around', elevation: 2,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  statDivider: { width: 1, height: '60%', alignSelf: 'center' },
  statItem: { alignItems: 'center', gap: 4, flex: 1 },
  statValue: { fontFamily: Typography.fontFamily.bold, fontSize: 24 },
  statLabel: { fontFamily: Typography.fontFamily.regular, fontSize: 12 },
  restoreStreakBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ff9800',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, marginTop: 16,
  },
  restoreStreakText: { fontFamily: Typography.fontFamily.bold, color: '#fff', fontSize: 13 },
  // ─── Tabs ───
  sectionTabs: { flexDirection: 'row', paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  sectionTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14, borderBottomWidth: 2.5, borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: '#446C5E' },
  sectionTabText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },
  // ─── Content ───
  content: { padding: 20, gap: 14 },
  postCard: { borderRadius: 20, overflow: 'hidden' },
  postImage: { width: '100%', height: 180 },
  postBody: { padding: 16, gap: 8 },
  postContent: { fontFamily: Typography.fontFamily.regular, fontSize: 15, lineHeight: 23 },
  reflectionTitle: { fontFamily: Typography.fontFamily.semiBold, fontSize: 16, marginBottom: 2 },
  tags: { fontFamily: Typography.fontFamily.regular, fontSize: 13 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  postTime: { fontFamily: Typography.fontFamily.regular, fontSize: 12 },
  postStats: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postStatNum: { fontFamily: Typography.fontFamily.medium, fontSize: 12 },
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontFamily: Typography.fontFamily.regular, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 20, paddingVertical: 16, borderRadius: 999,
  },
  logoutText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 16, color: '#f44336' },
  // ─── Edit Modal ───
  editHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, paddingTop: 56,
  },
  editCancel: { fontFamily: Typography.fontFamily.medium, fontSize: 15 },
  editModalTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 18 },
  editSaveBtn: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  editSaveText: { fontFamily: Typography.fontFamily.bold, fontSize: 13, color: '#fff' },
  editBody: { padding: 28, alignItems: 'center', gap: 24 },
  editPhotoWrap: { position: 'relative' },
  editPhotoBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  editField: { width: '100%', gap: 8 },
  editLabel: { fontFamily: Typography.fontFamily.semiBold, fontSize: 13 },
  editInput: {
    fontFamily: Typography.fontFamily.regular, fontSize: 15,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14,
  },
  editTextArea: { minHeight: 110 },
  pickerInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerInputText: { fontFamily: Typography.fontFamily.regular, fontSize: 15 },
  calendarCard: { borderRadius: 18, padding: 14, gap: 12 },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarIconBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center' },
  calendarIconBtnDisabled: { opacity: 0.35 },
  calendarTitleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  calendarTitle: { fontFamily: Typography.fontFamily.bold, fontSize: 15 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: Typography.fontFamily.semiBold,
    fontSize: 11,
    paddingVertical: 6,
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  calendarDayText: { fontFamily: Typography.fontFamily.medium, fontSize: 13 },
  yearPickerScroll: { maxHeight: 220 },
  yearPickerContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 2 },
  yearChip: {
    width: '31%',
    minHeight: 36,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearChipText: { fontFamily: Typography.fontFamily.semiBold, fontSize: 14 },
  locationResults: { borderRadius: 16, overflow: 'hidden' },
  locationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  locationResultText: { flex: 1, fontFamily: Typography.fontFamily.medium, fontSize: 14 },
  editEmailVal: { fontFamily: Typography.fontFamily.regular, fontSize: 15 },
  editHint: { fontFamily: Typography.fontFamily.regular, fontSize: 12 },
});
