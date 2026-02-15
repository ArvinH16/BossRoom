import { eq, and } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/client.js';
import { conversations } from '../../db/schema.js';

export function createConversationRepository(db: DrizzleDB) {
  return {
    async findByUserAndAgent(userId: string, agentId: string) {
      const [row] = await db.select().from(conversations)
        .where(and(
          eq(conversations.userId, userId),
          eq(conversations.agentId, agentId),
        ))
        .limit(1);
      return row;
    },

    async create(data: {
      id: string;
      userId: string;
      agentId: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
      aiMessages: unknown[];
    }) {
      await db.insert(conversations).values({
        id: data.id,
        userId: data.userId,
        agentId: data.agentId,
        messages: data.messages,
        aiMessages: data.aiMessages,
      }).onConflictDoUpdate({
        target: [conversations.userId, conversations.agentId],
        set: {
          messages: data.messages,
          aiMessages: data.aiMessages,
          updatedAt: new Date(),
        },
      });
    },

    async updateMessages(
      id: string,
      messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>,
      aiMessages: unknown[],
    ) {
      await db.update(conversations).set({
        messages,
        aiMessages,
        updatedAt: new Date(),
      }).where(eq(conversations.id, id));
    },
  };
}

export type ConversationRepository = ReturnType<typeof createConversationRepository>;
