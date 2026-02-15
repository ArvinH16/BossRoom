import { z } from 'zod';

export const DEFAULT_AVATAR_ID = 'default';

export const VALID_AVATAR_IDS = [
  'default',
  'female-a',
  'female-b',
  'female-c',
  'female-d',
  'female-e',
  'female-f',
  'male-a',
  'male-b',
  'male-c',
  'male-d',
  'male-e',
  'male-f',
] as const;

export const avatarIdSchema = z.enum(VALID_AVATAR_IDS);

export const userSettingsSchema = z.object({
  avatarId: z.string().optional(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;
