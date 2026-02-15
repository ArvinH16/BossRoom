# BossRoom

Agent-first 3D workspace — walk around a virtual office and interact with AI agents that manage your comms, calendar, projects, and more.

## Quick Start (for teammates)

Infrastructure is already set up. You just need:

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

That's it. Frontend runs on `http://localhost:3000`, server on `ws://localhost:8080`.

You'll see a **Sign in with Google** screen — sign in and you'll enter the 3D world.

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
| `npm run db:generate` | Generate migration files |
| `npm run db:migrate` | Run migrations (prod) |
| `npm run generate:env` | Generate `.env.production` from Terraform outputs |

## Project Structure

```
BossRoom/
├── apps/
│   ├── game-frontend/     # Next.js 16 + Tailwind v4 + Three.js
│   └── game-server/       # Node.js + WebSocket + Drizzle ORM
├── libs/
│   └── shared-types/      # @bossroom/shared-types (shared TS types)
├── terraform/             # GCP Cloud Run, Cloud SQL, Firebase Auth, Vercel
└── scripts/
    ├── health-check.mjs   # Infrastructure health check
    └── generate-env.mjs   # Terraform outputs → .env files
```

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind v4, Three.js (React Three Fiber), Zustand
- **Backend:** Node.js, WebSocket (ws), Drizzle ORM, PostgreSQL
- **AI:** Cloudflare AI Gateway → Claude, GPT-4o, Gemini
- **Auth:** Firebase Authentication (email + Google Sign-In)
- **Infra:** GCP Cloud Run, Cloud SQL, Vercel, Terraform

## Authentication

Firebase Auth with Google Sign-In gates the entire app. The flow:

1. User lands on app → sees "Sign in with Google" button
2. Google OAuth popup → Firebase creates/retrieves user
3. App gets Firebase ID token → opens WebSocket with token
4. Game server verifies token via Admin SDK → upserts user in DB → user enters 3D world

**OAuth consent screen is in testing mode** — only approved test users can sign in. To add testers: GCP Console → APIs & Services → OAuth consent screen → Test users.

## Environment Variables

Copy `.env.example` to `.env` and fill in values. See the example file for details on where to get each credential.

**For teammates:** You don't need to set these up yourself — get the `.env` file from the person who ran Terraform.

Key env vars for auth:
- `NEXT_PUBLIC_FIREBASE_*` — Client SDK config (API key, auth domain, project ID, app ID)
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` — Admin SDK credentials (server-side token verification)

## Database

We use Cloud SQL (PostgreSQL 15) directly — no local database needed. The `DATABASE_URL` in your `.env` connects straight to it.

Schema lives in `apps/game-server/src/db/schema.ts`. Drizzle ORM handles migrations.

### Dev workflow (quick iteration)

```bash
# Edit schema.ts, then push directly to the dev DB (no migration files):
npm run db:push

# Browse the database visually:
npm run db:studio
```

### Production workflow (tracked migrations)

```bash
# 1. Edit schema.ts with your changes
# 2. Generate a migration SQL file (creates apps/game-server/drizzle/*.sql):
npm run db:generate

# 3. Review the generated SQL, then commit it
# 4. Apply the migration to the production DB:
npm run db:migrate
```

Always use `db:generate` + `db:migrate` for production. `db:push` is dev-only — it syncs schema directly without migration history.

## Infrastructure (one-time setup, already done)

Only the team lead needs to do this. Everyone else just uses the `.env` file.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# fill in values
terraform init
terraform apply
cd ..
npm run generate:env
```

This provisions: Cloud SQL, Cloud Run, Firebase Auth, and Vercel project.
