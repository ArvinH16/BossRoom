import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { users, agentSkills, conversations, taskHistory } from './schema.js';

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);

export const insertAgentSkillSchema = createInsertSchema(agentSkills);
export const selectAgentSkillSchema = createSelectSchema(agentSkills);

export const insertConversationSchema = createInsertSchema(conversations);
export const selectConversationSchema = createSelectSchema(conversations);

export const insertTaskHistorySchema = createInsertSchema(taskHistory);
export const selectTaskHistorySchema = createSelectSchema(taskHistory);
