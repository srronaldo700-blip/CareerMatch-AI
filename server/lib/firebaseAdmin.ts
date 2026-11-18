import { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const adminApp = getApps().length
  ? getApps()[0]
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(adminApp);

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  idToken?: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing Bearer token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    req.idToken = token;
    next();
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }
}
