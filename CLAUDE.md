# CLAUDE.md

## Project Overview

BossRoom is an agent-first 3D workspace. Users walk around a virtual office and interact with AI agents that manage comms, calendar, and projects. NX monorepo with npm workspaces.

## Architecture

```
apps/game-frontend/   Next.js 16 + React 19 + Tailwind v4 + Three.js (R3F) + Zustand
apps/game-server/     Node.js + WebSocket (ws) + Drizzle ORM + PostgreSQL
libs/shared-types/    @bossroom/shared-types — shared TS types for messages, agents
terraform/            GCP Cloud Run, Cloud SQL, Firebase Auth, Vercel
scripts/              health-check.mjs, generate-env.mjs
```

## Key Technical Decisions

- **NX v22** uses TypeScript project references + `customConditions: ["@org/source"]` — NOT tsconfig paths
- **Shared types** imported via npm workspaces (`@bossroom/shared-types`), not path aliases
- **`module: "nodenext"`** requires `.js` extensions in all relative imports on the server
- **Tailwind v4** uses CSS-first config (`@import "tailwindcss"`), PostCSS plugin is `@tailwindcss/postcss`
- **AI Gateway**: Cloudflare AI Gateway in unauthenticated pass-through mode. Provider API keys go directly through the gateway. OpenAI SDK is the unified client for all providers (Claude, GPT-4o, Gemini).
- **Single source of truth for types**: `AgentStatus`, `AgentSkill`, `ClientMessage`, `ServerMessage` all live in `libs/shared-types/`. Frontend and server import from `@bossroom/shared-types`.

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

**Dev workflow:** Edit `schema.ts` then `npm run db:push` (syncs directly, no migration files).

**Production workflow:** Edit `schema.ts` then `npm run db:generate` (creates migration SQL) then commit then `npm run db:migrate` (applies it). Always use this for production so migration history is tracked.

## File Conventions

- All frontend components use `'use client'` directive
- Server files use `.js` extensions in imports (`./agents/AgentManager.js`)
- Status types (`AgentStatus`) come from `@bossroom/shared-types`, not redefined locally
- Status display maps (`statusColors`, `statusLabels`) live in `apps/game-frontend/src/data/agents.ts`
- Game constants live in `apps/game-frontend/src/data/gameConfig.ts`
- Server logging uses `log` from `apps/game-server/src/logger.ts` (not raw `console.log`)

## WebSocket Protocol

Messages are typed in `libs/shared-types/src/lib/websocket.ts`:

**Client -> Server:** `player:join`, `player:move`, `agent:interact`, `agent:message`, `agent:stopInteract`

**Server -> Client:** `world:state`, `player:joined`, `player:left`, `player:moved`, `agent:statusChanged`, `agent:chatMessage`, `agent:chatStream`, `agent:toolExecution`

## Common Gotchas

- Use `npx nx` (not `nx`) in npm scripts for cross-platform compatibility
- Run `npx nx sync` if builds fail with TS project reference errors
- `drizzle-kit` auto-loads `.env` — no need for dotenv wrapper in npm scripts
- The frontend WebSocket client (`lib/websocket.ts`) is a singleton; `initWebSocket` guards against double-init
- Zustand store actions that modify state inside async callbacks must use `get()` (not captured references) to avoid stale closures
