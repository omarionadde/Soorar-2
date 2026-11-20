import { db } from './index.ts';
import { users } from './schema.ts';
import { eq, count } from 'drizzle-orm';

// Owner emails that are always Admin (comma separated env var).
export const OWNER_EMAILS = (process.env.ADMIN_EMAILS || 'samiiryare23@gmail.com,omarion.media@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Finds or creates the ERP profile for a Google (Firebase) sign-in.
 * Security: only owner emails (or the very first account) become Admin.
 * Any other Google account is created as Staff with status "Suspended"
 * until an Admin activates it in Settings.
 */
export async function getOrCreateUser(uid: string, email: string, name = '') {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid));
    if (existing[0]) return existing[0];
    if (!email) throw new Error('Email required');

    const cleanEmail = (email || '').toLowerCase();
    const byEmail = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (byEmail[0]) {
      const updated = await db.update(users).set({ uid }).where(eq(users.id, byEmail[0].id)).returning();
      return updated[0];
    }

    const total = await db.select({ value: count() }).from(users);
    const isOwner = OWNER_EMAILS.includes(cleanEmail) || (total[0]?.value ?? 0) === 0;

    const result = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: name || cleanEmail.split('@')[0],
        role: isOwner ? 'Admin' : 'Staff',
        status: isOwner ? 'Active' : 'Suspended',
      })
      .onConflictDoUpdate({ target: users.uid, set: { email: cleanEmail } })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user profile.', { cause: error });
  }
}

export const isOwnerEmail = (email?: string | null) => OWNER_EMAILS.includes(String(email || '').toLowerCase());

/** Owner accounts can never be locked out: keep them Admin + Active. */
export async function ensureOwnersActive() {
  const all = await db.select().from(users);
  for (const u of all) {
    if (isOwnerEmail(u.email) && (u.status !== 'Active' || u.role !== 'Admin')) {
      await db.update(users).set({ status: 'Active', role: 'Admin' }).where(eq(users.id, u.id));
    }
  }
}
