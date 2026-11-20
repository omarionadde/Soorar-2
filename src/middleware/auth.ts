import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { getOrCreateUser } from '../db/users.ts';
import { verifyStaffToken, tokenMatchesPassword } from '../lib/security.ts';

export interface AuthRequest extends Request {
  user?: {
    id?: number;
    uid: string;
    email?: string;
    name?: string;
    role?: string;
    status?: string;
  };
}

export const NOT_APPROVED_MSG = 'Akoonkaaga lama ogolaan. Admin-ka SOORAR ha kuu fasaxo.';

/**
 * Every /api/admin route goes through here.
 * Accepts either a signed SOORAR staff session token or a Firebase ID token.
 * The account must exist in `users` with status "Active"; anything else gets 403.
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  const token = authHeader.slice(7).trim();

  let dbUser: typeof users.$inferSelect | undefined;

  try {
    if (token.startsWith('SRS1.')) {
      const payload = verifyStaffToken(token);
      if (!payload) return res.status(401).json({ error: 'Session-kii wuu dhacay. Fadlan mar kale gal.' });
      const found = await db.select().from(users).where(eq(users.uid, payload.uid));
      if (!found[0] || !tokenMatchesPassword(payload.pf, found[0].passwordHash)) {
        return res.status(401).json({ error: 'Session-kii wuu dhacay. Fadlan mar kale gal.' });
      }
      dbUser = found[0];
    } else if (token.startsWith('SR-STAFF:')) {
      // Old insecure format (contained the password) is no longer accepted.
      return res.status(401).json({ error: 'Session-kii wuu dhacay. Fadlan mar kale gal.' });
    } else {
      let decoded;
      try {
        decoded = await adminAuth.verifyIdToken(token);
      } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
      if (!decoded.email || decoded.email_verified === false) {
        return res.status(403).json({ error: NOT_APPROVED_MSG, code: 'NOT_APPROVED' });
      }
      dbUser = await getOrCreateUser(decoded.uid, decoded.email, (decoded as any).name || '');
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    return res.status(500).json({ error: 'Auth check failed' });
  }

  if (!dbUser || dbUser.status !== 'Active') {
    return res.status(403).json({ error: NOT_APPROVED_MSG, code: 'NOT_APPROVED' });
  }

  req.user = {
    id: dbUser.id,
    uid: dbUser.uid,
    email: dbUser.email,
    name: dbUser.name || dbUser.email,
    role: dbUser.role,
    status: dbUser.status,
  };
  next();
};

/** Only Admin accounts (user management, destructive settings). Use after requireAuth. */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'Admin') {
    return res.status(403).json({ error: 'Admin kaliya ayaa samayn kara tallaabadan.' });
  }
  next();
};

/** Restrict a route to some roles (Admin always allowed). Use after requireAuth. */
export const requireRoles =
  (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    const role = req.user?.role || '';
    if (role === 'Admin' || roles.includes(role)) return next();
    return res.status(403).json({ error: 'Doorkaagu ma oggola tallaabadan.' });
  };
