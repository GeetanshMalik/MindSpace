// Firebase configuration
// 
// INSTRUCTIONS:
// 1. Copy this file to config.ts
// 2. Replace the placeholder values with your Firebase project credentials
// 3. Never commit config.ts to version control

import { initializeApp } from 'firebase/app';
// @ts-expect-error - TS cannot find getReactNativePersistence in web types, but Metro resolves it correctly for RN
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export default app;
