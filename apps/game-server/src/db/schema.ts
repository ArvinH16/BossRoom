import { pgTable, uuid, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const agentModelEnum = pgEnum('agent_model', ['claude', 'gpt-4o', 'gemini']);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  photoURL: text('photo_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

export const agentSkills = pgTable('agent_skills', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  model: agentModelEnum('model').notNull(),
  zone: text('zone').notNull(),
  personality: text('personality').notNull(),
  avatarConfig: jsonb('avatar_config').$type<{ color: string; position: [number, number, number] }>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  agentId: uuid('agent_id').references(() => agentSkills.id).notNull(),
  messages: jsonb('messages').$type<Array<{ role: string; content: string; timestamp: string }>>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const taskHistory = pgTable('task_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  agentId: uuid('agent_id').references(() => agentSkills.id).notNull(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  task: text('task').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  toolsUsed: jsonb('tools_used').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});
