import React, { useEffect, useState } from 'react';
import { TextProps } from 'react-native';
import { Avatar } from './Avatar';
import { Text } from './TranslatedText';
import { subscribeToUserProfile } from '../services/firebase/firestore';
import { UserProfile, getProfileDisplayName, getProfilePhotoURL } from '../types/profile';

type ProfileSubscriber = (profile: UserProfile | null) => void;
type ProfileRecord = {
  profile: UserProfile | null;
  subscribers: Set<ProfileSubscriber>;
  unsubscribe: () => void;
};

const profileCache = new Map<string, UserProfile | null>();
const profileRecords = new Map<string, ProfileRecord>();

const subscribeToCachedProfile = (userId: string, subscriber: ProfileSubscriber) => {
  let record = profileRecords.get(userId);

  if (!record) {
    record = {
      profile: profileCache.has(userId) ? profileCache.get(userId)! : null,
      subscribers: new Set<ProfileSubscriber>(),
      unsubscribe: () => {},
    };

    record.unsubscribe = subscribeToUserProfile(userId, (profile) => {
      record!.profile = profile;
      profileCache.set(userId, profile);
      record!.subscribers.forEach((listener) => listener(profile));
    });

    profileRecords.set(userId, record);
  }

  record.subscribers.add(subscriber);
  subscriber(record.profile);

  return () => {
    const activeRecord = profileRecords.get(userId);
    if (!activeRecord) return;
    activeRecord.subscribers.delete(subscriber);
    if (activeRecord.subscribers.size === 0) {
      activeRecord.unsubscribe();
      profileRecords.delete(userId);
    }
  };
};

type ProfileAvatarProps = {
  userId?: string | null;
  name?: string;
  uri?: string | null;
  size?: number;
  previewable?: boolean;
};

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  userId,
  name,
  uri,
  size,
  previewable,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    return subscribeToCachedProfile(userId, setProfile);
  }, [userId]);

  const displayName = getProfileDisplayName(profile, name);
  const photoURL = getProfilePhotoURL(profile, uri || undefined);

  return <Avatar name={displayName} uri={photoURL} size={size} previewable={previewable} />;
};

type ProfileNameProps = TextProps & {
  userId?: string | null;
  fallbackName?: string;
};

export const ProfileName: React.FC<ProfileNameProps> = ({
  userId,
  fallbackName,
  children,
  ...props
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }

    return subscribeToCachedProfile(userId, setProfile);
  }, [userId]);

  return (
    <Text {...props} translate={false}>
      {getProfileDisplayName(profile, fallbackName || (typeof children === 'string' ? children : undefined))}
    </Text>
  );
};
