export interface UserProfile {
  uid: string;
  displayName: string;
  email: string | null;
  bio?: string;
  about?: string;
  headline?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  location?: string;
  pronouns?: string;
  photoURL?: string | null;
  avatarUrl?: string | null;
  pushToken?: string;
  createdAt?: any;
  updatedAt?: any;
}

export const DEFAULT_PROFILE_HEADLINE = 'Mindfulness Enthusiast & Community Member';

export const DEFAULT_PROFILE_ABOUT =
  'Finding peace in the small moments. Building a space where vulnerability is celebrated and collective growth is the norm.';

export const getProfileDisplayName = (
  profile?: Partial<UserProfile> | null,
  fallback?: string | null
) => profile?.displayName?.trim() || fallback?.trim() || 'Mindspace User';

export const getProfilePhotoURL = (
  profile?: Partial<UserProfile> | null,
  fallback?: string | null
) => profile?.photoURL || profile?.avatarUrl || fallback || undefined;

export const getProfileAbout = (profile?: Partial<UserProfile> | null) =>
  profile?.about?.trim() || profile?.bio?.trim() || DEFAULT_PROFILE_ABOUT;

export const getProfileHeadline = (profile?: Partial<UserProfile> | null) =>
  profile?.headline?.trim() || DEFAULT_PROFILE_HEADLINE;
