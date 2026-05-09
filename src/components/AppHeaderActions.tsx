import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Text } from './TranslatedText';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Radius, Typography } from '../theme';
import { useColors } from '../theme/useColors';
import { useAuthStore } from '../store/authStore';
import { subscribeToUnreadNotificationsCount } from '../services/firebase/firestore';
import { getProfileDisplayName, getProfilePhotoURL } from '../types/profile';
import { Avatar } from './Avatar';
import { AccountSearchModal } from './AccountSearchModal';
import { logout } from '../services/firebase/auth';
import { useTranslation } from '../i18n/useTranslation';

interface AppHeaderActionsProps {
  containerStyle?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  avatarSize?: number;
  bellSize?: number;
  showProfile?: boolean;
  showSearch?: boolean;
}

export const AppHeaderActions: React.FC<AppHeaderActionsProps> = ({
  containerStyle,
  buttonStyle,
  avatarSize = 36,
  bellSize = 20,
  showProfile = true,
  showSearch = false,
}) => {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const C = useColors();
  const { t } = useTranslation();
  const { user, profile } = useAuthStore();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [showAccountSearch, setShowAccountSearch] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const menuSlide = useRef(new Animated.Value(300)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const photoScale = useRef(new Animated.Value(0.8)).current;
  const photoOpacity = useRef(new Animated.Value(0)).current;
  const displayName = getProfileDisplayName(profile, user?.displayName);
  const photoURL = getProfilePhotoURL(profile, user?.photoURL);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }

    return subscribeToUnreadNotificationsCount(user.uid, setUnreadNotifications);
  }, [user?.uid]);

  const openNotifications = () => {
    navigation.navigate('HomeTab', { screen: 'Notifications' });
  };

  /* ─── profile menu helpers ─── */
  const openMenu = useCallback(() => {
    setShowProfileMenu(true);
    Animated.parallel([
      Animated.spring(menuSlide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const closeMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(menuSlide, { toValue: 300, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setShowProfileMenu(false));
  }, []);

  const handleViewPhoto = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      setShowPhotoViewer(true);
      Animated.parallel([
        Animated.spring(photoScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
        Animated.timing(photoOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, 280);
  }, []);

  const closePhotoViewer = useCallback(() => {
    Animated.parallel([
      Animated.timing(photoScale, { toValue: 0.8, duration: 200, useNativeDriver: true }),
      Animated.timing(photoOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setShowPhotoViewer(false);
      photoScale.setValue(0.8);
      photoOpacity.setValue(0);
    });
  }, []);

  const handleOpenProfile = useCallback(() => {
    closeMenu();
    setTimeout(() => navigation.navigate('ProfileTab'), 280);
  }, []);

  const handleLogout = useCallback(() => {
    closeMenu();
    setTimeout(() => {
      Alert.alert(
        t('Sign Out'),
        t('Are you sure you want to sign out?'),
        [
          { text: t('Cancel'), style: 'cancel' },
          {
            text: t('Sign Out'),
            style: 'destructive',
            onPress: () => logout(),
          },
        ],
      );
    }, 300);
  }, [t]);

  const menuItems = [
    { icon: 'image-outline' as const, label: t('View Profile Picture'), onPress: handleViewPhoto },
    { icon: 'person-outline' as const, label: t('Open Profile'), onPress: handleOpenProfile },
    { icon: 'log-out-outline' as const, label: t('Logout'), onPress: handleLogout, danger: true },
  ];

  return (
    <View style={[styles.container, containerStyle]}>
      {showSearch && (
        <TouchableOpacity
          onPress={() => setShowAccountSearch(true)}
          style={[styles.iconBtn, { backgroundColor: C.surfaceContainerHighest }, buttonStyle]}
          activeOpacity={0.75}
        >
          <Ionicons name="search" size={bellSize} color={C.onSurface} />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={openNotifications}
        style={[styles.iconBtn, { backgroundColor: C.surfaceContainerHighest }, buttonStyle]}
        activeOpacity={0.75}
      >
        <Ionicons name="notifications-outline" size={bellSize} color={C.onSurface} />
        {unreadNotifications > 0 && (
          <View style={[styles.badge, { backgroundColor: C.error, borderColor: C.surface }]}>
            <Text style={[styles.badgeText, { color: C.onError }]}>
              {unreadNotifications > 99 ? '99+' : unreadNotifications}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      {showProfile && (
        <TouchableOpacity onPress={openMenu} activeOpacity={0.75}>
          <Avatar name={displayName || '?'} uri={photoURL} size={avatarSize} previewable={false} />
        </TouchableOpacity>
      )}

      {/* ─── Profile Menu Bottom Sheet ─── */}
      <Modal visible={showProfileMenu} transparent animationType="none" onRequestClose={closeMenu}>
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
          </Animated.View>
          <Animated.View
            style={[
              styles.menuSheet,
              {
                backgroundColor: C.surfaceContainer,
                transform: [{ translateY: menuSlide }],
              },
            ]}
          >
            {/* header */}
            <View style={styles.menuHeader}>
              <Avatar name={displayName || '?'} uri={photoURL} size={48} />
              <View style={styles.menuHeaderInfo}>
                <Text style={[styles.menuName, { color: C.onSurface }]}>{displayName || 'User'}</Text>
                <Text style={[styles.menuEmail, { color: C.onSurfaceVariant }]}>
                  {user?.email || ''}
                </Text>
              </View>
            </View>
            <View style={[styles.menuDivider, { backgroundColor: C.outlineVariant }]} />
            {/* options */}
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.65}
              >
                <Ionicons
                  name={item.icon}
                  size={22}
                  color={item.danger ? C.error : C.onSurface}
                />
                <Text
                  style={[
                    styles.menuLabel,
                    { color: item.danger ? C.error : C.onSurface },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
            <View style={{ height: 16 }} />
          </Animated.View>
        </View>
      </Modal>

      {/* ─── Photo Viewer Modal ─── */}
      <Modal visible={showPhotoViewer} transparent animationType="none" onRequestClose={closePhotoViewer}>
        <Animated.View style={[styles.photoViewerOverlay, { opacity: photoOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePhotoViewer} />
          <Animated.View style={{ transform: [{ scale: photoScale }] }}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={[styles.fullPhoto, { width: screenWidth * 0.82, height: screenWidth * 0.82 }]} />
            ) : (
              <View style={[styles.fullPhotoFallback, { width: screenWidth * 0.6, height: screenWidth * 0.6, backgroundColor: C.primary }]}>
                <Text style={[styles.fullPhotoInitial, { color: C.onPrimary }]}>
                  {(displayName || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </Animated.View>
          <TouchableOpacity style={styles.photoCloseBtn} onPress={closePhotoViewer} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={36} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      <AccountSearchModal visible={showAccountSearch} onClose={() => setShowAccountSearch(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeText: { fontFamily: Typography.fontFamily.bold, fontSize: 10, lineHeight: 12 },

  /* ── modal ── */
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  menuSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  menuHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  menuHeaderInfo: { marginLeft: 14, flex: 1 },
  menuName: { fontFamily: Typography.fontFamily.semiBold, fontSize: 17 },
  menuEmail: { fontFamily: Typography.fontFamily.regular, fontSize: 13, marginTop: 2 },
  menuDivider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 16,
  },
  menuLabel: { fontFamily: Typography.fontFamily.medium, fontSize: 15 },

  /* ── photo viewer ── */
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: { borderRadius: 16 },
  fullPhotoFallback: { borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  fullPhotoInitial: { fontFamily: Typography.fontFamily.bold, fontSize: 96 },
  photoCloseBtn: { position: 'absolute', top: 52, right: 20 },
});
