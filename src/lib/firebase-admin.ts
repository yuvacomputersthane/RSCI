
import admin from 'firebase-admin';
import { getApps, initializeApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';

interface FirebaseAdminServices {
  app: App;
  auth: Auth;
  db: Firestore;
  storage: Storage;
  error?: string;
}

// This function initializes and returns the Admin SDK services, or an error if it fails.
function initializeFirebaseAdmin(): FirebaseAdminServices {
  // If the app is already initialized, return the existing services.
  if (getApps().length > 0) {
    const app = getApps()[0];
    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  }

  // Check for the service account key in environment variables.
  const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (!serviceAccountJsonString || serviceAccountJsonString.trim() === "") {
    const errorMsg = "FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set. Please ensure it's added to your .env.local file (and .env for deployment) and the server is restarted.";
    console.error(`[FIREBASE_ADMIN_INIT_ERROR] ${errorMsg}`);
    return { app: null!, auth: null!, db: null!, storage: null!, error: errorMsg };
  }

  // Parse the key.
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJsonString);
  } catch (jsonError: any) {
    const errorMsg = `FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON: ${jsonError.message}. Please check the format of the service account key in your .env.local file. It should be the complete JSON object, enclosed in single quotes (e.g., FIREBASE_SERVICE_ACCOUNT_KEY='{...}').`;
    console.error(`[FIREBASE_ADMIN_INIT_ERROR] ${errorMsg}`);
    return { app: null!, auth: null!, db: null!, storage: null!, error: errorMsg };
  }

  // Initialize the app with the credentials.
  try {
    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    console.log("[FIREBASE_ADMIN_INIT_SUCCESS] Firebase Admin SDK initialized successfully.");
    return {
      app,
      auth: getAuth(app),
      db: getFirestore(app),
      storage: getStorage(app),
    };
  } catch (e: any) {
    const errorMsg = `Firebase Admin SDK initialization failed: ${e.message}. This could be due to an invalid service account key or other configuration issues.`;
    console.error("[FIREBASE_ADMIN_INIT_ERROR]", e);
    return { app: null!, auth: null!, db: null!, storage: null!, error: errorMsg };
  }
}

// Initialize and export the services.
const { app, auth, db, storage, error } = initializeFirebaseAdmin();

export { app, auth, db, storage, error as adminSDKInitializationError };
