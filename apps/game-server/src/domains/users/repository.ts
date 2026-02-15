import type { DrizzleDB } from '../../db/client.js';
import { users } from '../../db/schema.js';

export function createUserRepository(db: DrizzleDB) {
  return {
    async upsert(userData: {
      id: string;
      email: string;
      displayName: string | null;
      photoURL: string | null;
    }): Promise<void> {
      await db.insert(users).values({
        id: userData.id,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        lastLoginAt: new Date(),
      }).onConflictDoUpdate({
        target: users.id,
        set: {
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          lastLoginAt: new Date(),
        },
      });
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
