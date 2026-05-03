import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from './config';
import { UserProfile } from '../../types/profile';
import { DEFAULT_LANGUAGE } from '../../i18n';

const DEFAULT_APP_SETTINGS = {
  mode: 'light',
  lowStimulation: false,
  notificationsEnabled: true,
  dailyReminder: true,
  emailNotifications: true,
  language: DEFAULT_LANGUAGE,
};

export const signUp = async (
  email: string,
  password: string,
  displayName: string
): Promise<User> => {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  // Create user document in Firestore
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    displayName,
    email,
    headline: '',
    bio: '',
    about: '',
    phoneNumber: '',
    dateOfBirth: '',
    location: '',
    pronouns: '',
    photoURL: credential.user.photoURL || '',
    avatarUrl: '',
    notificationSettings: {
      notificationsEnabled: true,
      dailyReminder: true,
      emailNotifications: true,
    },
    appSettings: DEFAULT_APP_SETTINGS,
    createdAt: Date.now(),
  } as UserProfile);
  await setDoc(doc(db, 'users', credential.user.uid, 'settings', 'preferences'), {
    ...DEFAULT_APP_SETTINGS,
    updatedAt: Date.now(),
  });
  return credential.user;
};

export const signIn = async (email: string, password: string): Promise<User> => {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
};

export const logout = async (): Promise<void> => {
  await signOut(auth);
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
};
