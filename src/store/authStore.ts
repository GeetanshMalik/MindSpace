import { create } from 'zustand';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { UserProfile } from '../types/profile';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: false,
  isInitialized: false,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
}));

// Subscribe to Firebase auth state
export const initAuthListener = () => {
  let unsubscribeProfile: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }

    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setProfile(null);
    useAuthStore.getState().setInitialized(true);

    if (user) {
      unsubscribeProfile = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          if (snap.exists()) {
            useAuthStore.getState().setProfile({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Mindspace User',
              ...snap.data(),
            } as UserProfile);
          } else {
            useAuthStore.getState().setProfile({
              uid: user.uid,
              displayName: user.displayName || 'Mindspace User',
              email: user.email,
              photoURL: user.photoURL,
            });
          }
        },
        () => {
          useAuthStore.getState().setProfile({
            uid: user.uid,
            displayName: user.displayName || 'Mindspace User',
            email: user.email,
            photoURL: user.photoURL,
          });
        }
      );
    }
  });

  return () => {
    if (unsubscribeProfile) unsubscribeProfile();
    unsubscribeAuth();
  };
};
