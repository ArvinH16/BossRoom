import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['ERROR', 'WARN', 'INFO', 'DEBUG']).default('DEBUG'),
  ALLOWED_ORIGIN: z.string().default('*'),

  // Firebase Admin
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),

  // Vercel AI Gateway
  AI_GATEWAY_API_KEY: z.string().min(1),

  // Optional: Composio for agent tools
  COMPOSIO_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

// Parse once at startup — crash with clear error if invalid
export const env = envSchema.parse(process.env);
