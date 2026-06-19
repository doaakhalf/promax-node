import admin from 'firebase-admin';
import serviceAccount from "./promax-f4953-firebase-adminsdk-fbsvc-599fe54fe4.json" with { type: "json" };

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp;

export const initializeFirebase = () => {
  try {
    // You need to download your Firebase service account JSON file
    // from Firebase Console > Project Settings > Service Accounts
    // const serviceAccount = path.join(__dirname, 'promax-f4953-firebase-adminsdk-fbsvc-599fe54fe4.json');
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin initialized ✅');
    return firebaseApp;
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    console.log('Push notifications will not work without Firebase configuration');
    return null;
  }
};

export const getFirebaseAdmin = () => {
  if (!firebaseApp) {
    console.warn('Firebase not initialized');
  }
  return admin;
};

export default admin;