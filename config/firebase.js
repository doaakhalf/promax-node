import admin from 'firebase-admin';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let firebaseApp;

export const initializeFirebase = () => {
  try {
    let serviceAccount ;
        
    // Check if running on Railway (or production) with env variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
      // Local development - read from file
      const serviceAccountPath = path.join(__dirname, 'promax-f4953-firebase-adminsdk-fbsvc-599fe54fe4.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }
   
    firebaseApp = admin.initializeApp({
      credential: admin.cert(serviceAccount)
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
    return null;
  }
  return admin;
};

export const getFirebaseMessaging = () => {
  if (!firebaseApp) {
    console.warn('Firebase not initialized');
    return null;
  }
  return getMessaging(firebaseApp);
};

export default admin;