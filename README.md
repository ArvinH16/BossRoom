# BossRoom

Agent-first 3D workspace — walk around a virtual office and interact with AI agents that manage your comms, calendar, projects, and more. Built for TreeHacks 2026.

Instead of chatting with AI through a boring text box, you navigate a 3D office, approach agent characters at their desks, and delegate real work to them — they actually send emails, create tasks, and schedule meetings through live Composio integrations.

## Quick Start

1. **Get the `.env` file** from the team lead (ask in the group chat)
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Verify everything works:**
   ```bash
   npm run health
   ```
4. **Start developing:**
   ```bash
   npm run dev
   ```

- **3D World:** http://localhost:3000 — sign in with Google, walk around, press E near an agent
- **Test Chat:** http://localhost:3000/test-chat — 3-column chat with all 3 agents (no 3D, for testing AI responses)

## Agents

| Agent | Zone | Model | Composio Integrations |
|-------|------|-------|-----------------------|
| **Mailbot** | Communications | Gemini 3 Flash | Gmail |
| **Taskmaster** | Project Ops | Gemini 3 Flash | Google Tasks, Linear |
| **Clockwork** | Calendar | Gemini 3 Flash | Google Calendar |

All agents use **Vercel AI SDK** (`streamText` with multi-step tool calling) routed through **Vercel AI Gateway**. **Composio** handles OAuth tool integrations per-user. **MCP** support for external tool servers. Agent definitions live in `libs/shared-utils/src/lib/agent-defs.ts`.

## Features

- **Multiplayer** — See other players moving around the office in real time with smooth interpolation
- **Avatar selection** — Choose from 13 character models (settings panel in HUD)
- **Roblox-style camera** — Third-person follow cam with right-click orbit and scroll zoom
- **Agent microinteractions** — Agents wander around their zones, show thought bubbles, and return to their desks when you approach
- **Decorated office** — Furniture, zone labels, neon strips, whiteboards
- **Streaming AI chat** — Real-time streamed responses with inline tool execution display

## Project Structure

```
BossRoom/
├── apps/
│   ├── game-frontend/     # Next.js 16 + Tailwind v4 + Three.js (R3F) + shadcn/ui
│   └── game-server/       # Node.js + WebSocket + AI SDK + Composio + Drizzle ORM
├── libs/
│   ├── shared-types/      # @bossroom/shared-types (WS protocol + agent types)
│   └── shared-utils/      # @bossroom/shared-utils (agent defs, constants, logger)
├── terraform/             # GCP Cloud Run, Cloud SQL, Firebase Auth, Cloudflare Pages
└── scripts/
    ├── health-check.mjs   # Infrastructure health check
    └── generate-env.mjs   # Terraform outputs → .env files
```

**NX monorepo** (v22.5.0) with npm workspaces. TypeScript project references, not tsconfig paths.

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start both frontend + server |
| `npm run dev:frontend` | Frontend only (Next.js, port 3000) |
| `npm run dev:server` | Server only (WebSocket, port 8080) |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all apps |
| `npm run health` | Validate all connections (DB, AI Gateway, Firebase) |
| `npm run db:push` | Sync Drizzle schema to database (dev) |
| `npm run db:studio` | Open visual database browser |
| `npm run db:generate` | Generate migration files (prod) |
| `npm run db:migrate` | Run migrations (prod) |
| `npm run generate:env` | Generate `.env.production` from Terraform outputs |

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, Three.js (React Three Fiber), Zustand, shadcn/ui, Lucide Icons
- **Backend:** Node.js, WebSocket (ws), Vercel AI SDK, Composio, MCP, Drizzle ORM, PostgreSQL
- **AI:** Vercel AI Gateway (unified proxy) → Gemini 3 Flash (all agents)
- **Auth:** Firebase Authentication (Google Sign-In)
- **Infra:** GCP Cloud Run, Cloud SQL, Cloudflare Pages, Terraform

## Authentication

Firebase Auth with Google Sign-In gates the entire app:

1. User lands on app → sees "Sign in with Google" button
2. Google OAuth popup → Firebase creates/retrieves user
3. App gets Firebase ID token → opens WebSocket with token
4. Game server verifies token via Admin SDK → upserts user in DB → user enters 3D world
5. Composio tools are scoped to the authenticated user's OAuth connections (keyed by Firebase UID)

**OAuth consent screen is in testing mode** — only approved test users can sign in.

## Environment Variables

Copy `.env.example` to `.env` and fill in values. Key vars:

```bash
# Vercel AI Gateway
AI_GATEWAY_API_KEY=        # Single key — provider keys configured as BYOK in Vercel dashboard

# Firebase Auth
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
NEXT_PUBLIC_FIREBASE_*=    # Client SDK config

# Database
DATABASE_URL=              # PostgreSQL (Cloud SQL)

# Composio (optional — agent tools won't work without it)
COMPOSIO_API_KEY=
```

## Database

Cloud SQL (PostgreSQL 15). Schema: `apps/game-server/src/db/schema.ts`. Tables: `users`, `agent_skills`, `conversations`, `task_history`.

```bash
npm run db:push     # Dev: sync schema directly (no migration files)
npm run db:studio   # Browse database visually
npm run db:generate # Prod: generate migration SQL
npm run db:migrate  # Prod: apply migrations
```

## Known Issues / Next Steps

- **Multi-agent handoff** — Agents don't coordinate or walk to each other yet.
- **Agent skills from DB** — Agents are hardcoded in `agent-defs.ts`, not loaded from the `agent_skills` table.

## Infrastructure (one-time setup, already done)

Only the team lead needs to do this:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
cd ..
npm run generate:env
```
