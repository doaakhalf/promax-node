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
    // Check if already initialized
    if (firebaseApp) {
      console.log('Firebase already initialized, skipping...');
      return firebaseApp;
    }

    let serviceAccount;
        
    // Check if running on Railway (or production) with env variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log('Loading Firebase credentials from environment variable...');
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        
        // Fix private key formatting - replace literal \n with actual newlines
        if (serviceAccount.private_key) {
          const originalKey = serviceAccount.private_key;
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          console.log('Private key transformation:', {
            originalLength: originalKey.length,
            newLength: serviceAccount.private_key.length,
            hadLiteralNewlines: originalKey.includes('\\n'),
            startsCorrectly: serviceAccount.private_key.startsWith('-----BEGIN PRIVATE KEY-----'),
            first50Chars: serviceAccount.private_key.substring(0, 50)
          });
        }
        
        console.log('Service account loaded:', {
          project_id: serviceAccount.project_id,
          client_email: serviceAccount.client_email,
          hasPrivateKey: !!serviceAccount.private_key,
          privateKeyLength: serviceAccount.private_key?.length
        });
      } catch (parseError) {
        console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', parseError.message);
        throw parseError;
      }
    } else {
      // Local development - read from file
      console.log('Loading Firebase credentials from file...');
      const serviceAccountPath = path.join(__dirname, 'promax-f4953-firebase-adminsdk-fbsvc-599fe54fe4.json');
      serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    }

    if (!serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Service account is missing required fields (private_key or client_email)');
    }
   
    firebaseApp = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId: serviceAccount.project_id
    });
    
    console.log('Firebase Admin initialized ✅');
    return firebaseApp;
  } catch (error) {
    console.error('Firebase initialization error:', error.message);
    console.error('Error stack:', error.stack);
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