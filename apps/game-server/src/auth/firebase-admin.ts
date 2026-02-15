import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { log } from '../logger.js';

const projectId = process.env['FIREBASE_PROJECT_ID'];
const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
const privateKey = process.env['FIREBASE_PRIVATE_KEY'];

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    'Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env'
  );
}

const serviceAccount: ServiceAccount = {
  projectId,
  clientEmail,
  privateKey: privateKey.replace(/\\n/g, '\n'),
};

initializeApp({ credential: cert(serviceAccount) });
log.info('Firebase Admin SDK initialized');

export async function verifyToken(token: string) {
  const decoded = await getAuth().verifyIdToken(token);
  return {
    uid: decoded.uid,
    email: decoded.email ?? '',
    displayName: decoded.name ?? null,
    photoURL: decoded.picture ?? null,
  };
}
