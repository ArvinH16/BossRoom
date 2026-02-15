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
├── terraform/             # GCP Cloud Run, Cloud SQL, Firebase, Vercel
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

## Environment Variables

Copy `.env.example` to `.env` and fill in values. See the example file for details on where to get each credential.

**For teammates:** You don't need to set these up yourself — get the `.env` file from the person who ran Terraform.

## Database

We use Cloud SQL (PostgreSQL 15) directly — no local database needed. The `DATABASE_URL` in your `.env` connects straight to it.

To update the schema, edit `apps/game-server/src/db/schema.ts` then run:

```bash
npm run db:push    # pushes schema changes to the DB (dev workflow)
npm run db:studio  # opens a visual DB browser at localhost:4983
```

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
