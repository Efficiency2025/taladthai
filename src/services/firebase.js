/**
 * Firebase app initialization and Firestore instance.
 *
 * All Firebase configuration is read from VITE_FIREBASE_* env vars.
 * In mock mode (VITE_USE_MOCK_DATA=true), this module is never imported
 * because api.js short-circuits to mock-data.js.
 */
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

/**
 * Firestore instance with offline persistence enabled.
 * Uses IndexedDB for multi-tab offline support so the app
 * works reliably even with poor WiFi at the event venue.
 */
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
