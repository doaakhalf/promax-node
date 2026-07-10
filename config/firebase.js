import pkg from 'firebase-admin';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const admin = pkg;
let firebaseApp;

export const initializeFirebase = () => {
  try {
    const serviceAccountPath = path.join(__dirname, 'promax-f4953-firebase-adminsdk-fbsvc-599fe54fe4.json');
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
   
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
  }
  return admin;
};

export default admin;