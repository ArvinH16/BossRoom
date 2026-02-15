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

## Agents

| Agent | Zone | Model | Role |
|-------|------|-------|------|
| **Receptionist** | Command | Gemini 3 Flash | Office concierge — builds custom teams of dynamic AI agents via `setup_workspace` |
| **Shopkeeper** | Shop | Gemini 3 Flash | In-game merchant — product search, comparison, and purchase via Visa MCP + Composio |

All other agents are **created dynamically at runtime** by the Receptionist. When you describe a task, the Receptionist assembles a team of specialized agents with unique names, personalities, skills, and zone names — all persisted to the database.

Agents use **Vercel AI SDK** (`streamText` with multi-step tool calling) routed through **Vercel AI Gateway**. **Composio** handles OAuth tool integrations per-user. **Visa MCP** enables the Shopkeeper's commerce features. Pre-built agent definitions live in `libs/shared-utils/src/lib/agent-defs.ts`.

## Features

- **Dynamic agent teams** — Describe a task to the Receptionist and watch it assemble a custom team of specialized AI agents
- **DB-backed persistent workspaces** — Workspaces persist across sessions with tab switching and archive
- **Shopkeeper agent** — Browse real products, compare prices, and purchase via Visa MCP + Composio Stripe
- **Scratchpad feed** — Collaborative workspace scratchpad where agents and users post updates
- **Embed viewer** — Agents can surface documents, boards, and presentations inline
- **Product cards** — Rich visual product cards rendered in the Shopkeeper's chat
- **Speech bubbles** — HTML-based speech bubbles above agents in the 3D world
- **Multiplayer** — See other players moving around the office in real time with smooth interpolation
- **Avatar selection** — Choose from 13 character models with live 3D previews and personality names
- **Roblox-style camera** — Third-person follow cam with right-click orbit, scroll zoom, and V-key view toggle
- **Agent microinteractions** — Agents wander around their zones and return to their desks when you approach
- **Streaming AI chat** — Real-time streamed responses with inline tool execution display
- **Personalized prompt pills** — Suggested prompts personalized with user name and email
- **Voice input (STT)** — Talk to agents via microphone using Deepgram speech-to-text (Nova 3)
- **Voice output (TTS)** — Agents speak responses aloud via Inworld text-to-speech (per-user voice selection)
- **Proximity voice chat** — Peer-to-peer audio between nearby players via PeerJS (push-to-talk)
- **Background music** — Track selector with volume control
- **Floating workspace bar** — Bottom-right workspace bar with keyboard shortcuts (Cmd/Ctrl+1-9)
- **Agent skills** — Agents learn and create reusable skills over time
- **HUD agent roster** — Clickable agent cards with pulsing notifications for unseen links

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
- **Commerce:** Visa Intelligent Commerce MCP (product search, payments), Composio Stripe
- **Voice:** Deepgram (speech-to-text, Nova 3), Inworld (text-to-speech), PeerJS (P2P proximity chat)
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
# Database
DATABASE_URL=              # PostgreSQL (Cloud SQL)

# Firebase Auth (server)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Firebase Auth (frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# AI
AI_GATEWAY_API_KEY=        # Vercel AI Gateway — provider keys configured as BYOK in Vercel dashboard
GOOGLE_AI_API_KEY=         # Google AI API key (for Gemini models)

# Voice
DEEPGRAM_API_KEY=          # Deepgram speech-to-text (server mints tokens for client)
INWORLD_API_KEY=           # Inworld text-to-speech
INWORLD_VOICE_ID=Dominus   # Inworld voice preset (Dominus=robotic, Pixie=cartoonish)
INWORLD_TTS_MODEL_ID=inworld-tts-1.5-mini
NEXT_PUBLIC_VOICE_ENABLED=true  # Toggle voice features on frontend

# Composio (optional — agent tools won't work without it)
COMPOSIO_API_KEY=

# Visa Intelligent Commerce MCP (optional — Shopkeeper payments)
VISA_VIC_API_KEY=
VISA_VIC_API_KEY_SS=
VISA_EXTERNAL_CLIENT_ID=
VISA_EXTERNAL_APP_ID=

# Frontend
NEXT_PUBLIC_WS_URL=ws://localhost:8080          # WebSocket URL (Terraform manages prod)
NEXT_PUBLIC_SERVER_HTTP_URL=http://localhost:8080 # HTTP URL for Deepgram token endpoint
```

## Database

Cloud SQL (PostgreSQL 15). Schema: `apps/game-server/src/db/schema.ts`. Tables: `users`, `workspaces`, `workspace_agents`, `skills`, `conversations`, `task_history`, `scratchpad_entries`.

```bash
npm run db:push     # Dev: sync schema directly (no migration files)
npm run db:studio   # Browse database visually
npm run db:generate # Prod: generate migration SQL
npm run db:migrate  # Prod: apply migrations
```

## Voice Architecture

```
┌─ Frontend ─────────────────────────────────────┐
│  useVoiceInput.ts                              │
│    ↓ mic audio via WebSocket                   │
│    → wss://api.deepgram.com/v1/listen          │
│    ← transcript → sent as agent:message        │
│                                                │
│  voiceStore.ts                                 │
│    ← agent:ttsAudio (base64 MP3 from server)   │
│    → Audio() playback queue                    │
│                                                │
│  useProximityVoice.ts                          │
│    ↔ PeerJS P2P audio (nearby players)         │
│    ← voice:playerTalking (who is talking)      │
└────────────────────────────────────────────────┘

┌─ Server ───────────────────────────────────────┐
│  GET /api/deepgram/token → returns API key     │
│  tts.ts → POST https://api.inworld.ai/tts/v1  │
│    → sends agent:ttsAudio to client            │
└────────────────────────────────────────────────┘
```

## Known Issues / Next Steps

- **Deepgram token** — `/api/deepgram/token` returns raw API key (hackathon shortcut, not production-safe).
- **Visa MCP sandbox** — Shopkeeper payments run against Visa sandbox, not live transactions.
- **PeerJS cloud server** — Proximity voice uses default PeerJS cloud; may need self-hosted for scale.

## Infrastructure (one-time setup, already done)

Only the team lead needs to do this:

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply
cd ..
npm run generate:env
```
