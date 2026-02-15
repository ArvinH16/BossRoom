# CLAUDE.md

## Project Overview

BossRoom is an agent-first 3D workspace. Users walk around a virtual office and interact with AI agents that manage comms, calendar, and projects. NX monorepo with npm workspaces.

## Architecture

```
apps/game-frontend/   Next.js 16 + React 19 + Tailwind v4 + Three.js (R3F) + Zustand
apps/game-server/     Node.js + WebSocket (ws) + Drizzle ORM + PostgreSQL
libs/shared-types/    @bossroom/shared-types — shared TS types for messages, agents
libs/shared-utils/    @bossroom/shared-utils — agent definitions, constants, shared logger
terraform/            GCP Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages
scripts/              health-check.mjs, generate-env.mjs
```

## Key Technical Decisions

- **NX v22** uses TypeScript project references + `customConditions: ["@org/source"]` — NOT tsconfig paths
- **Shared types** imported via npm workspaces (`@bossroom/shared-types`), not path aliases
- **`module: "nodenext"`** requires `.js` extensions in all relative imports on the server
- **Tailwind v4** uses CSS-first config (`@import "tailwindcss"`), PostCSS plugin is `@tailwindcss/postcss`
- **AI Gateway**: Vercel AI Gateway at `https://ai-gateway.vercel.sh/v1`. Single `AI_GATEWAY_API_KEY` env var. Provider API keys configured as BYOK in Vercel dashboard (not in code). Uses `@ai-sdk/openai` (`createOpenAI`) with model strings like `google/gemini-3-flash`, `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`.
- **Frontend hosting**: Cloudflare Pages with static export (`output: 'export'` in next.config.js). No API routes allowed.
- **Single source of truth for types**: `AgentStatus`, `AgentSkill`, `ClientMessage`, `ServerMessage` all live in `libs/shared-types/`. Frontend and server import from `@bossroom/shared-types`.
- **Agent definitions**: All agent configs (system prompts, models, zones, positions, personalities) live in `libs/shared-utils/src/lib/agent-defs.ts`. Currently all agents use `google/gemini-3-flash`.

## NPM Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start frontend (port 3000) + server (port 8080) in parallel |
| `npm run build` | Build all apps via NX |
| `npm run lint` | ESLint across all apps |
| `npm run health` | Validate DB, AI Gateway, Firebase connections |
| `npm run db:push` | Push schema to DB directly (dev only, no migration history) |
| `npm run db:generate` | Generate SQL migration from schema diff (production workflow) |
| `npm run db:migrate` | Apply pending migrations to DB (production workflow) |
| `npm run db:studio` | Open Drizzle visual DB browser |

## Database / Drizzle

- Schema: `apps/game-server/src/db/schema.ts`
- Config: `apps/game-server/src/db/drizzle.config.ts`
- Migrations output: `apps/game-server/drizzle/`
- Client: `apps/game-server/src/db/client.ts`
- Tables: `users` (with jsonb `settings`), `agentSkills`, `conversations` (unique per user+agent), `taskHistory`

**Dev workflow:** Edit `schema.ts` then `npm run db:push` (syncs directly, no migration files).

**Production workflow:** Edit `schema.ts` then `npm run db:generate` (creates migration SQL) then commit then `npm run db:migrate` (applies it). Always use this for production so migration history is tracked.

## File Conventions

- All frontend components use `'use client'` directive
- Server files use `.js` extensions in imports (`./agents/AgentManager.js`)
- Status types (`AgentStatus`) come from `@bossroom/shared-types`, not redefined locally
- Status display maps (`statusColors`, `statusLabels`) live in `apps/game-frontend/src/data/agents.ts`
- Game constants live in `apps/game-frontend/src/data/gameConfig.ts`
- Avatar data (model URLs, labels) live in `apps/game-frontend/src/data/avatars.ts`
- Agent thought bubble text lives in `apps/game-frontend/src/data/agentThoughts.ts`
- Server logging uses `log` from `apps/game-server/src/logger.ts` (not raw `console.log`)
- Auth store: `apps/game-frontend/src/stores/authStore.ts` — Zustand + module-level `onAuthStateChanged`
- Settings store: `apps/game-frontend/src/stores/settingsStore.ts` — avatar selection + settings panel visibility
- Agent behavior store: `apps/game-frontend/src/stores/agentBehaviorStore.ts` — runtime agent positions for proximity detection
- World store: `apps/game-frontend/src/stores/worldStore.ts` — remote players state
- Firebase client SDK: `apps/game-frontend/src/lib/firebase.ts` — singleton init with HMR guard
- Firebase Admin SDK: `apps/game-server/src/auth/firebase-admin.ts` — `verifyToken()` helper
- Login page: `apps/game-frontend/src/components/auth/LoginPage.tsx` — Google Sign-In gate
- Auth gating lives in `page.tsx` (client component), not `layout.tsx` (server component)
- Camera: `apps/game-frontend/src/components/game/CameraRig.tsx` — Roblox-style third-person follow cam
- WebSocket `player:join` sends Firebase ID token; server verifies and upserts user in DB
- Player IDs are Firebase UIDs (text), tracked via `wsToUid` Map in `main.ts`

## WebSocket Protocol

Messages are typed in `libs/shared-types/src/lib/websocket.ts`:

**Client -> Server:** `player:join`, `player:move`, `player:updateSettings`, `agent:interact`, `agent:message`, `agent:stopInteract`

**Server -> Client:** `world:state`, `player:joined`, `player:left`, `player:moved`, `player:avatarChanged`, `agent:statusChanged`, `agent:chatMessage`, `agent:chatStream`, `agent:toolExecution`, `agent:conversationHistory`, `auth:error`

## Common Gotchas

- Use `npx nx` (not `nx`) in npm scripts for cross-platform compatibility
- Run `npx nx sync` if builds fail with TS project reference errors
- `drizzle-kit` auto-loads `.env` — no need for dotenv wrapper in npm scripts
- The frontend WebSocket client (`lib/websocket.ts`) is a singleton; `initWebSocket` guards against double-init
- Zustand store actions that modify state inside async callbacks must use `get()` (not captured references) to avoid stale closures
- Firebase Identity Platform `authorized_domains` must include `localhost` for local dev
- Google IDP config needs explicit `enabled = true` in Terraform — updates to Identity Platform config can reset it
- Firebase Admin credentials come from Terraform-managed service account (env vars: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
- Vercel AI Gateway is OpenAI-compatible ONLY — must use `@ai-sdk/openai` (`createOpenAI`), NOT native provider packages (`@ai-sdk/google`, `@ai-sdk/anthropic`). Native packages send provider-specific API formats that the gateway rejects.
- Next.js static export (`output: 'export'`) cannot have API routes — delete any `app/api/` routes before building
