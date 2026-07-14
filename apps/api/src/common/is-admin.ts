import { eq } from 'drizzle-orm';
import { Db } from '../db/db.module';
import { users } from '../db/schema';

/**
 * The single source of truth for privilege. Reads users.role straight from the
 * DB so revoking admin takes effect immediately, rather than trusting the role
 * claim baked into a still-valid access token.
 */
export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.role === 'admin';
}
