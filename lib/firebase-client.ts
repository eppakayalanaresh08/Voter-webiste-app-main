'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const firebaseAuth = getAuth(app);
const isBrowser = typeof window !== 'undefined';
const host = isBrowser ? window.location.hostname : '';
const isEmulatorLikeHost = host === '10.0.2.2' || host === 'localhost' || host === '127.0.0.1';
const explicitDisable = process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION === 'true';
const shouldDisableAppVerificationForTesting =
  explicitDisable || (process.env.NODE_ENV !== 'production' && isEmulatorLikeHost);

if (shouldDisableAppVerificationForTesting) {
  firebaseAuth.settings.appVerificationDisabledForTesting = true;
}

export { app, firebaseAuth, shouldDisableAppVerificationForTesting };
