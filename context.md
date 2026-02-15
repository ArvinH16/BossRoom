🏗️ Product Requirements Document: Agent-First 3D Workspace Builder
TreeHacks 2026 | Team: Parsa Khazaeepoul, Arvin Hakkakian, Vidit Jain
Date: February 14, 2026

---

## Implementation Status (Updated Feb 14, 2026)

### ~75% MVP Complete — Foundation + 3D World + Agent Interaction + Auth

**All builds passing** — `npx nx run-many -t build` succeeds for all 3 projects.

#### What's Working
- [x] NX monorepo (v22.5.0) with npm workspaces — `npm install && npx nx serve game-frontend` works
- [x] `game-frontend` — Next.js 16 + Tailwind v4 (CSS-first) + App Router, builds and serves on :3000
- [x] `game-server` — Node.js + HTTP/WebSocket server skeleton (ws), builds and serves on :8080
- [x] `@bossroom/shared-types` — WebSocket message protocol types + Agent skill types, shared across apps
- [x] Drizzle ORM — Schema (agent_skills, conversations, task_history), client, config. NX targets: db:push/generate/migrate/studio
- [x] Cloudflare AI Gateway — OpenAI SDK client routed through CF gateway, supports Claude/GPT-4o/Gemini via `GATEWAY_MODEL_MAP`
- [x] Terraform — Cloud Run (WebSocket-ready, http1, 3600s timeout), Cloud SQL (Postgres 15), Firebase Auth (Google Sign-In), Vercel project + env vars
- [x] Scripts — `generate-env.mjs` reads terraform outputs → writes .env.production files
- [x] Cross-platform — All npm scripts use `npx nx`, no bash dependencies
- [x] 3D office world — R3F + Rapier physics, 3 zones (comms, ops, calendar) with color plates, procedural walls, 13 Kenney furniture GLBs (desks, chairs, monitors, etc.)
- [x] Third-person player — ecctrl character controller (WASD + camera orbit), Kenney Minifig GLB with animations (idle, walk, sprint, jump)
- [x] 3 agent characters — Mailbot (blue/GPT-4o), Taskmaster (red/Claude), Clockwork (green/Gemini) with unique GLB models + color tints
- [x] Agent interaction — Proximity detection, "Press E" overlay, chat panel slide-in with streaming text + suggested prompts
- [x] Agent visual states — 5 statuses (idle/listening/thinking/working/error) with sparkle particles + status orbs
- [x] GTA-style onboarding — 5-step tutorial (welcome → discovery → delegation → execution → exploration) with auto-progression
- [x] HUD — Top-left logo + connection status indicator; top-right agent roster with status dots
- [x] Tool execution toasts — Floating notifications showing agent tool calls (started/completed/failed)
- [x] Zustand state management — Connection state, agents, chat messages, streaming, tool execution, onboarding
- [x] WebSocket client — Singleton with reconnection logic, typed message handling
- [x] ESLint — Configured across all apps, zero warnings
- [x] Visual polish — Bloom + Vignette post-processing, ambient/directional/point lighting, fog, infinite grid floor
- [x] Firebase Auth — Full end-to-end: Google Sign-In on frontend (LoginPage gate), Firebase Admin SDK on server, WebSocket token verification on `player:join`, user upsert in DB, personalized agent greetings, sign-out with state cleanup
- [x] Auth infrastructure — Terraform provisions Firebase service account + credentials, Identity Platform config with authorized domains, Google IDP
- [x] Users table — Drizzle schema with Firebase UID (text PK), email, displayName, photoURL, createdAt, lastLoginAt; FK constraints on conversations and taskHistory
- [x] Health check — Validates DB, AI Gateway, and Firebase Admin SDK initialization with live `listUsers` call

#### Quick Start
```bash
git clone <repo> && cd BossRoom
npm install
npx nx serve game-frontend   # Next.js on :3000
npx nx serve game-server     # WebSocket server on :8080
```

#### What's NOT Built Yet
- [ ] LLM ↔ Composio agent orchestrator — agent `composioTools` field defined but no actual Composio SDK calls
- [x] Firebase Auth frontend flow — Google Sign-In, LoginPage gate, WebSocket token auth, user upsert
- [ ] Multi-agent handoff logic — agents don't coordinate or walk to each other
- [ ] Agent skills from DB — agents are hardcoded in AgentManager.ts, not pulled from DB
- [ ] Real tool execution — status messages sent but no actual email/calendar/Linear operations
- [ ] Conversation persistence — chats stored in-memory only, lost on server restart
- [ ] Agent collaboration animations — no walk-to-each-other or brainstorming visuals
- [ ] Agent stuck/passing out state — error status exists but no overheat/recovery flow
- [ ] Task progress board in 3D — not rendered in office
- [ ] Celebration microinteractions — no completion confetti/dance
- [ ] Voice interaction (stretch) — phone booth concept not implemented

#### Architecture (Implemented)
```
apps/game-frontend/     Next.js 16 + Tailwind v4 + R3F + ecctrl + Zustand
apps/game-server/       Node.js + ws + Drizzle ORM + AI Gateway
libs/shared-types/      @bossroom/shared-types (WS protocol + Agent types)
terraform/              Cloud Run + Cloud SQL + Firebase + Vercel
scripts/                generate-env.mjs, health-check.mjs
```

---

1. Vision & Core Thesis
   We are building a gamified, 3D agent-first workspace — a fully interactive virtual office rendered in the browser where users navigate a third-person 3D world, interact with AI agent characters, and delegate real work to them. Agents don't just chat — they execute actual tasks (send emails, create tickets, schedule meetings, pull data) through live integrations.
   The analogy: What Windows did for computing (terminal → visual UI), we're doing for agent delegation (prompt engineering → intuitive 3D interaction). We're making AI delegation fun, memorable, and accessible to non-technical users.
   This is not a chatbot. This is not a dashboard. This is a living, breathing virtual office where AI workers do your bidding — and you can watch them do it.
2. End-to-End User Experience
   2.1 First Launch — GTA-Style Onboarding
   • User opens the web app and enters a 3D virtual office environment (rendered in Three.js)
   • A GTA-style onboarding sequence begins: a text box at the bottom of the screen provides instructions, and arrows point to the next location the user should navigate to
   • Step 1: "Welcome to your workspace. Walk over to your first agent" → arrow points to a character sitting at a desk
   • Step 2: "Click on them to start a conversation" → user left-clicks the agent
   • Step 3: "Type a task and hit send" → user types a natural language prompt
   • Step 4: Agent visually reacts, does the work, and reports back
   • The onboarding teaches users the core loop: navigate → click → delegate → watch results
   2.2 The Office World — CPU Plaza Concept
   Inspired by Astrobot PS5's CPU Plaza, the virtual office is divided into themed sections/rooms, each housing agents specialized in different domains. The zones include:
   • Communications Hub — Email, Slack, messaging agents (e.g. "Email Arvin about next week's meeting")
   • Project Ops Center — Linear, GitHub, task management agents (e.g. "Create a ticket for the auth bug")
   • Research Lab — Web research, data analysis agents (e.g. "Research competitors in the AI workspace space")
   • Creative Studio — Content, docs, design agents (e.g. "Draft a blog post about our launch")
   • Calendar Lounge — Scheduling, meetings agents (e.g. "Find a time for all three of us next Tuesday")
   • Command Center — Orchestration, multi-agent tasks (Complex workflows spanning multiple agents)
   Users walk between zones in third person, discovering agents and their capabilities organically — like exploring a game world.
   2.3 Agent Interaction Flow
3. Approach — User walks up to an agent character in the 3D world
4. Engage — Left-click opens a prompt interface (text box overlay)
5. Delegate — User types a natural language task and hits send
6. Visual Feedback — The agent visually reacts: stands up from desk, walks to a workstation; a thought bubble or task board appears showing reasoning steps; progress indicators show what's happening ("Checking calendar..." "Drafting email...")
7. Execution — Agent performs real actions via Composio integrations (actually sends the email, creates the ticket, etc.)
8. Report — Agent returns to the user with results ("Done! I sent Arvin 3 time options for next week")
9. Multi-Agent Handoff — If a task requires multiple skills, the first agent physically walks over to another agent, they "brainstorm" together (visible in 3D), and the second agent picks up its portion
   2.4 Agent Behaviors & Microinteractions
   Inspired by Eat Venture and Papa's Pizzeria game logic:
   • Idle agents sit at desks, lean back, or sleep (head on desk, Z's floating)
   • Working agents move to workstations, type furiously, papers fly around
   • Stuck agents overheat — face turns red, steam comes off head — then they pass out and fall to the ground. A notification pops: "This agent needs your help!" User provides clarifying info, agent recovers
   • Collaborating agents walk to each other, speech bubbles appear, they gesture and nod — visually showing inter-agent reasoning
   • Completed tasks trigger a celebration — confetti, a little dance, a thumbs up
   • Every action has a microinteraction — small fun animations that make the experience feel alive and memorable (Papa's Pizzeria philosophy)
   2.5 Stretch Goal: Voice Interaction
   • A phone booth sits in the corner of the office
   • When user triggers a voice call (via Twilio integration), the phone rings in the 3D world
   • An agent walks over, picks up the phone, and greets the user via ElevenLabs TTS or ChatGPT Realtime
   • User speaks their task, agent executes, and reports back by voice
   • Backend powered by Pipecat (team has template code from YC Hackathon)
   • Arvin's voice AI experience (Bimbo) is leveraged here
10. Technical Architecture
    3.1 Hard Requirements (Non-Negotiable)
    • TypeScript — entire codebase
    • Tailwind CSS — all styling
    • Next.js — application framework
    • NX — monorepo structure
    3.2 System Architecture
    CLIENT (Browser)

- Three.js 3D Renderer + Controls
- WebSocket Client
- Next.js UI/UX
  ⬇️ WebSocket Connection ⬇️
  AUTHORITATIVE GAME SERVER (Cloud Run)
- World State Simulation (In-Memory): Agent positions, states, animations; User position & interactions; Real-time event broadcasting
- Agent Orchestrator: Routes tasks to appropriate agent; Manages multi-agent handoffs; Triggers visual state changes
  ⬇️ Connects To ⬇️
  LLM APIs — Claude (Anthropic Agent SDK), GPT-4o (OpenAI), Gemini (Google)
  Composio — 500+ OAuth Integrations (Gmail, Slack, Linear, GitHub, Calendar, etc.)
  Database (Persistence Only) — Agent skills/instructions, User preferences, Task history. NOT real-time movement data.
  3.3 Key Architecture Decisions
  • Real-time layer: WebSockets (NOT Convex) — Convex rejected as primary real-time layer; need raw WebSocket control for game state
  • Deployment: Cloud Run — Vercel doesn't support WebSockets; Cloud Run supports persistent connections with Next.js
  • Agent architecture: DB-driven skills (NOT containers) — Spinning up containers too slow/complex; new agent = new row in DB with system prompt
  • World simulation: Authoritative server — Server simulates world in memory, broadcasts state; clients interpolate/predict locally
  • Database role: Persistence only — DB stores skills, history, preferences — NOT movement or real-time interaction data
  • LLM strategy: Model-agnostic per agent — Each agent skill row includes a model field (Claude/GPT-4o/Gemini) — maximizes prize eligibility
  • Integrations: Composio — Handles all OAuth flows — no API key management. 500+ app connections
  • Monorepo: NX — Clean developer experience, shared code between client and server
  3.4 Agent Skills System
  Each agent is defined by a skill — a row in the database with the following fields:
  • id — Unique identifier
  • name — e.g. "Email Agent", "Calendar Agent"
  • description — What this agent does
  • systemPrompt — Natural language instructions for the LLM
  • model — Which LLM powers this agent: claude, gpt-4o, or gemini
  • composioTools — Which Composio integrations it can use (array of tool names)
  • zone — Which office zone it belongs to
  • personality — How it behaves in the 3D world
  • avatarConfig — 3D character appearance configuration
  Key principles:
- New agent = new DB row. No container spin-up, no deployment.
- Source 50-100 starter skills from skills marketplaces or mass-generate them
- Each agent has a unique personality that affects its 3D animations and dialogue style

4. Prize Alignment Strategy
   Below is how each feature maps to specific prizes, ensuring every implementation decision pulls double or triple duty.
   4.1 Auto-Eligible Prizes
   Most Creative

- What wins it: The entire concept — nobody is building a 3D game world for agent delegation. The phone booth, agents passing out, the brainstorming animations — it's all wildly original
- Demo moment: Show agents sleeping → user sends task → agent wakes up, walks to workstation → completes task → does a little celebration dance
  Most Technically Complex
- What wins it: Stack depth — Three.js 3D rendering + authoritative game server + WebSocket real-time sync + multi-model LLM orchestration (Claude + GPT-4o + Gemini) + Composio OAuth integrations + DB-driven skill system + client-side interpolation/prediction
- Demo moment: Show the architecture diagram, explain the authoritative server pattern, demonstrate real-time state sync between multiple browser tabs
  Most Impactful
- What wins it: "We're democratizing agent delegation — you don't need to know prompt engineering, you just walk up and talk to an agent like you'd talk to a coworker"
- Demo moment: Have a "non-technical user" (one teammate) use it for the first time during the demo — show how intuitive the GTA-style onboarding is
  4.2 Opt-In Prizes
  Greylock – Best Multi-Turn Agent ($10k Warriors tickets)
- Feature: Multi-step task execution with visible reasoning
- Implementation: When a user says "Schedule a meeting with Arvin next week and prep an agenda based on our last conversation," the agent: (1) Queries calendar via Composio → Google Calendar, (2) Finds available slots, (3) Searches recent messages/docs for context via Composio → Gmail/Slack, (4) Drafts an agenda, (5) Sends invite with agenda attached. Each step is visualized on a task board in the 3D world
- Feedback adaptation: If the user says "Actually, make it a 30-min meeting, not an hour" — agent adjusts mid-workflow without restarting
- Demo moment: Show the full multi-step workflow with the agent visually moving between workstations for each step
  Anthropic – Human Flourishing
- Feature: The gamification layer itself IS the human flourishing argument
- Implementation: Claude-powered agents that teach users to delegate effectively through play. The GTA onboarding, the celebratory microinteractions, the collaborative brainstorming animations — all designed to make AI collaboration joyful
- Demo moment: "We're not just building a tool, we're building a training ground for the AI-augmented workforce. People learn to delegate by playing."
  Anthropic – Best Use of Claude Agent SDK
- Feature: Claude as the primary agent brain
- Implementation: Use Claude Agent SDK for the majority of agents. Leverage extended thinking for complex tasks — when Claude is "thinking," the 3D agent visually ponders (hand on chin, thought bubbles with gears). Multi-turn conversations maintain context via Claude's conversation memory
- Demo moment: Show Claude's extended thinking mapped to the agent's visual state — the more complex the reasoning, the more animated the agent's thinking behavior
  OpenAI – AI Track (Most Creative Use)
- Feature: GPT-4o for specific fast-response agents
- Implementation: The "quick action" agents (send a message, look something up, set a reminder) run on GPT-4o for speed. If voice stretch goal is reached: ChatGPT Realtime API powers the phone booth interaction
- Demo moment: Show the speed difference — quick agents snap to action instantly (GPT-4o), while deep-thinking agents take a visible moment to reason (Claude). The 3D world makes this speed differential a feature, not a bug
  Google – Cloud AI Track
- Feature: Gemini-powered research/analysis agents + Cloud Run deployment
- Implementation: The "Research Lab" zone agents run on Gemini. Cloud Run hosts the authoritative game server with WebSocket support. Optionally use Firestore for the agent skills database
- Demo moment: "Our entire infrastructure runs on Google Cloud — Cloud Run for our real-time game server, Gemini for our research agents, deployed globally"
  Y Combinator – Build an Iconic YC Company
- Target company to reimagine: Asana (founded 2008, pre-ChatGPT)
- Pitch: "What if Asana were founded in 2026? Instead of humans managing tickets on a kanban board, AI agents in a 3D world execute the work itself. You don't manage tasks — you delegate them to agents who actually do the work."
- Implementation: Deploy on Vercel (frontend) + Cloud Run (game server). Include README with 2-paragraph description. Record 1-2 min Loom walking through the reimagined concept
- Demo moment: Side-by-side: Asana's task board (boring) vs. your 3D office where agents are actively completing those same tasks (alive)
  Decagon – Best Conversational Assistant
- Feature: Humanlike conversational interaction in 3D context
- Implementation: Agents remember previous conversations (persisted in DB). They have personalities — one might be enthusiastic, another dry and efficient. They reference past interactions: "Last time you asked me about the Q3 deadline, here's an update..."
- Demo moment: Have a conversation with an agent, walk away, come back later, and show it remembering the context. The 3D embodiment makes it feel like talking to a real coworker
  Neo – Most Likely to Become a Product
- Feature: Complete user journey from onboarding to daily use
- Implementation: Show the full loop: sign up → enter world → onboarding → first task → ongoing usage patterns. Discuss market positioning: "Every company will have agent fleets. Current interfaces are boring dashboards. We're building the UX people actually enjoy using."
- Demo moment: Walk through the user journey end-to-end. Reference CodeLayer, Conductor as proof the agentic interface market is real and growing
  Human Capital Fellowship ($50k/person)
- Feature: Team credibility + long-term vision
- Implementation: Parsa's existing agent infrastructure (Doozy, Ghostwork PR, scheduled tasks). Arvin's voice AI production experience (Bimbo). Frame this as a company, not a hack: "We're building the operating system for agent-augmented work"
- Demo moment: Less about the demo, more about the conversation with HC judges. Show you've thought about the business: market size, go-to-market, competitive landscape

5. MVP Scope for 36 Hours
   Must-Have (Demo-Ready)
   • [ ] 3D office world with at least 3-4 zones (Three.js)
   • [ ] Third-person character navigation (WASD + mouse)
   • [ ] 5-6 functional agents with unique skills and personalities
   • [ ] Click-to-interact prompt interface
   • [ ] At least 3 real Composio integrations working end-to-end (Gmail, Calendar, Linear)
   • [ ] Multi-model support (Claude, GPT-4o, Gemini — one agent each minimum)
   • [ ] Visible agent state changes (idle, working, done)
   • [ ] GTA-style onboarding arrows for first-time users
   • [ ] Authoritative game server with WebSocket sync
   • [ ] Deployed on Cloud Run + Vercel
   Should-Have (Polish)
   • [ ] Agent collaboration animations (walking to each other, brainstorming)
   • [ ] Agent passing out when stuck + recovery flow
   • [ ] Task progress board visible in 3D world
   • [ ] Celebration microinteractions on task completion
   • [ ] Multi-step task demonstration (Greylock prize)
   • [ ] Conversation memory across sessions (Decagon prize)
   Stretch Goals
   • [ ] Voice interaction via phone booth (Twilio + Pipecat + ElevenLabs)
   • [ ] HeyGen avatar faces on 3D agents
   • [ ] More than 6 agents / additional office zones
6. Team Responsibilities
   Parsa Khazaeepoul — Infrastructure & Coordination

- NX monorepo setup
- Cloud Run deployment
- API keys distribution
- DB schema design
- Composio integration setup
- Vercel frontend deploy
  Arvin Hakkakian — Backend + Agent System
- LLM ↔ Composio connection
- Agent orchestrator
- WebSocket server
- Multi-model routing
- Voice stretch goal (leveraging Bimbo experience)
  Vidit Jain — Backend + Agent System
- Agent skills DB implementation
- System prompt engineering
- Multi-agent handoff logic
- Task execution pipeline
  Collaborative — 3D World (Three.js)
- Office environment design
- Character models
- Navigation system
- Interaction system
- Animations & microinteractions

7. Demo Script (2-Minute Pitch)
1. Open (10s): "What if working with AI agents felt like playing a game?"
1. Show the world (15s): Pan around the 3D office — agents at desks, different zones, one agent sleeping
1. First interaction (20s): Walk up to Email Agent, click, type "Email Arvin about meeting next week with some time options." Agent stands up, walks to workstation, thought bubbles appear showing reasoning
1. Real execution (15s): Show the actual email sent in Gmail — it's real, not a mock
1. Multi-agent (20s): Ask Calendar Agent to "prep for my meeting with Arvin" — it walks over to Research Agent, they brainstorm together, come back with agenda + context from past conversations
1. Stuck agent (15s): Show an agent trying a task, overheating, passing out — user provides clarification — agent recovers and completes
1. Architecture flash (10s): Quick architecture slide — Three.js + Cloud Run + WebSocket + Claude/GPT-4o/Gemini + Composio
1. Close (15s): "We're doing for AI delegation what Windows did for computing. This is the future of how people work with agents — and it's fun."
   Key Insight: Multi-Model Strategy
   You can hit OpenAI, Google, AND Anthropic tracks simultaneously by making the agent skills system model-agnostic. Each agent skill row in the DB includes a model field. Some agents run on Claude (Agent SDK), some on GPT-4o, some on Gemini. All connected to Composio for tool execution. This is architecturally clean AND maximizes prize eligibility across three major AI company tracks.
1. Implementation Details (from Build Plan)
   8.1 Expanded Tech Stack
   Building on the non-negotiable foundation (TypeScript, Tailwind, Next.js 15 App Router, NX monorepo), the full library set:
   3D Rendering:

- React Three Fiber (@react-three/fiber) — React renderer for Three.js
- drei (@react-three/drei) — helpers: Billboard, Text, Html overlays, Stars, Grid, Sparkles
- rapier (@react-three/rapier) — physics engine (RigidBody for floor/walls/agents)
- ecctrl — third-person character controller (handles WASD movement, camera orbit, physics, animation state machine)
- @react-three/postprocessing — Bloom + Vignette effects
  Frontend State:
- Zustand — lightweight state management for connection state, player/agent maps, active conversations, chat messages, streaming state
  Backend:
- ws — WebSocket server (raw, not Socket.io — more control for game state)
- @anthropic-ai/sdk — Claude Agent SDK
- openai — GPT-4o for fast-response agents
- @google/generative-ai — Gemini for research agents
- composio-core — Composio integration for real tool execution
- Drizzle ORM — type-safe SQL toolkit
- PostgreSQL on Cloud SQL (or RDS) — production-grade persistence for agent skills, conversations, task history. Provisioned via Terraform. Qualifies for Google Cloud AI Track if using Cloud SQL
- uuid, zod — ID generation and runtime validation
  8.2 Demo Agent Roster
  Three agents ship for MVP, each in their own zone, each on a different LLM to maximize prize eligibility:
  Mailbot (Communications Hub)
- Color: Blue
- Position: (-5, 0, -5)
- Model: GPT-4o (fast responses — hits OpenAI AI Track)
- Composio Tools: GMAIL_SEND_EMAIL, GMAIL_FETCH_EMAILS
- Personality: Cheerful, efficient, uses emoji
- Suggested prompts: "Send an email to Arvin about our meeting", "Check my latest emails", "Draft a follow-up to my last thread"
  Taskmaster (Project Ops Center)
- Color: Red
- Position: (5, 0, -5)
- Model: Claude via Agent SDK (complex reasoning — hits Anthropic tracks)
- Composio Tools: LINEAR_CREATE_ISSUE, LINEAR_LIST_ISSUES, LINEAR_UPDATE_ISSUE
- Personality: Direct, no-nonsense, military metaphors
- Suggested prompts: "Create a bug ticket for the auth flow", "What issues are assigned to me?", "Update the homepage ticket to in-progress"
- Note: Linear chosen over GitHub Issues — free tier has unlimited users, all features, better API + Composio support
  Clockwork (Calendar Lounge)
- Color: Green
- Position: (0, 0, -8)
- Model: Gemini (hits Google Cloud AI Track)
- Composio Tools: GOOGLECALENDAR_CREATE_EVENT, GOOGLECALENDAR_FIND_EVENTS
- Personality: Calm, time-obsessed, speaks in scheduling metaphors
- Suggested prompts: "What's on my schedule today?", "Book a meeting with the team for Tuesday", "Find a free slot this afternoon"
  8.3 WebSocket Message Protocol
  Client → Server Messages:
- player:join — { username } → server responds with world:state (all players, all agents)
- player:move — { position, rotation, animation } → server broadcasts to all other players
- agent:interact — { agentId } → server starts interaction session, agent sends greeting
- agent:message — { agentId, conversationId, content } → server routes to AgentManager for LLM processing
- agent:stopInteract — { agentId } → server cleans up interaction state
  Server → Client Messages:
- world:state — full snapshot: all player positions, all agent definitions + statuses
- player:joined / player:left / player:moved — individual player state updates
- agent:statusChanged — { agentId, status: idle/listening/thinking/working/error } → triggers 3D animation changes
- agent:chatMessage — { agentId, role, content } → complete message (after streaming finishes)
- agent:chatStream — { agentId, delta } → streaming text chunks for real-time typing effect
- agent:toolExecution — { agentId, toolName, status: started/completed/failed, result } → triggers tool execution toast + agent working animation
  8.4 3D Asset Pipeline
  Character Models:
- Source base models from Kenney.nl (Minifig Characters pack — free, low-poly, game-ready)
- Animations from Mixamo (free): Idle, Walk, Run, Wave, Typing/Working
- Export as GLB format (binary glTF — smaller, faster loading)
- Run npx gltfjsx to auto-generate typed React Three Fiber components from GLB files
- Store in apps/game-frontend/public/models/ — player.glb, agent-blue.glb, agent-red.glb, agent-green.glb
  Environment Assets:
- Furniture from Kenney.nl Furniture Kit (desks, chairs, monitors)
- Desk stations positioned for each agent zone
- Props to differentiate zones: mailbox for Communications Hub, kanban board for Ops Center, globe for Calendar Lounge
  8.5 Visual Design Direction
  • Night environment preset — gives a moody, digital workspace feel
  • Purple/blue ambient lighting — "digital workspace" atmosphere
  • Stars background (drei) — immersive space feel
  • Grid infinite floor (drei) — clean, futuristic aesthetic
  • Fog for depth perception and atmosphere
  • Post-processing pipeline: Bloom (makes emissive elements glow — status indicators, particles) + Vignette (darkened edges, focuses attention to center)
  • Agent visual states: Sparkles particles from drei — thinking = slow subtle particles, working = fast bright particles. Only renders when status is not idle/listening
  • Interaction radius ring — subtle glow circle on floor around each agent showing interact range
  8.6 Onboarding Flow (GTA-Style)
  First-time users experience a guided tutorial that teaches the core interaction loop:
  Step 1 — Welcome
- User spawns in the center of the office
- Bottom-of-screen text box: "Welcome to your workspace! Use WASD to walk around."
- Subtle arrow on floor pointing toward the nearest agent (Mailbot)
- User learns: movement controls
  Step 2 — Discovery
- As player approaches Mailbot within interact radius, proximity prompt appears: "Press E to talk to Mailbot"
- Text box updates: "Walk up to an agent and press E to start a conversation."
- Arrow disappears once within range
- User learns: agent discovery + interaction trigger
  Step 3 — Delegation
- Chat panel slides in from the right
- Agent sends a greeting: "Hey! I'm Mailbot. I can send emails, check your inbox, and draft messages. What do you need?"
- Suggested prompts appear as clickable chips below the chat
- Text box: "Type a task or click a suggestion to delegate work."
- User learns: how to give tasks to agents
  Step 4 — Execution
- After user sends first message, agent visually reacts (stands up, walks to workstation)
- Text box: "Watch your agent work! They'll execute real actions on your behalf."
- Tool execution toast appears showing the real action being taken
- User learns: agents do real work, not just chat
  Step 5 — Exploration
- After first task completes, celebration animation plays
- Text box: "Nice! You've got more agents to meet. Explore the office and find them all."
- Arrows appear pointing to the other 2 agent zones
- Onboarding flag saved — never shows again
- User learns: there's more to discover
  Implementation Notes:
- Onboarding state tracked in Zustand store (currentStep, completed flag)
- Arrow components: 3D arrow meshes on floor with pulse animation (emissive material + sine wave scale)
- Text box: fixed HTML overlay at bottom center, styled like game dialogue (dark bg, rounded, slight transparency)
- Proximity detection: useFrame hook checks distance to target agent each frame
- Skip button available for returning users
  8.7 Authentication — Firebase Auth
  Why Firebase Auth:
- Strengthens Google Cloud AI Track submission (Cloud Run + Cloud SQL + Firebase Auth = full Google stack)
- Dead simple to implement — Google Sign-In with one click, email/password as fallback
- Free tier more than covers hackathon needs (unlimited auth, 10K phone verifications)
- Terraform supported via google_identity_platform_config resource in the Google provider
- Firebase Admin SDK on the game server for token verification
- Works seamlessly with Next.js frontend via firebase/auth client SDK
  Implementation:
  Frontend (Next.js):
- Install firebase SDK
- FirebaseProvider wraps the app — initializes Firebase with project config
- Google Sign-In button on landing page (before entering 3D world)
- On successful auth, store Firebase ID token in Zustand store
- Pass token as query param or first message when opening WebSocket connection
- User's display name + photo URL become the player's name + avatar in the 3D world
  Backend (Game Server):
- Install firebase-admin SDK
- Initialize with service account credentials (stored as env var)
- On WebSocket player:join, verify the Firebase ID token via admin.auth().verifyIdToken(token)
- Extract uid, email, displayName from decoded token
- Reject connection if token is invalid or expired
- Associate uid with player session for the duration of the WebSocket connection
- Use uid as the Composio entity ID so each user's integrations are scoped to them
  Terraform Setup:
- google_project resource for the Firebase project
- google_identity_platform_config to enable Identity Platform (Firebase Auth)
- google_identity_platform_default_supported_idp_config for Google Sign-In provider
- All in the same Terraform config as Cloud Run + Cloud SQL — one terraform apply spins up everything
  Auth Flow:

1. User lands on the app → sees "Sign in with Google" button
2. Clicks → Google OAuth popup → Firebase creates/retrieves user
3. App gets Firebase ID token → opens WebSocket with token
4. Game server verifies token → creates player session → user enters 3D world
5. Agent tool calls (Composio) are scoped to the authenticated user's OAuth connections
   Prize Alignment:

- Adds another Google Cloud service to the stack → stronger Google Cloud AI Track case
- Shows production-readiness → helps Neo (Most Likely to Become a Product) and Human Capital Fellowship
- Scoped user sessions → each user gets their own agent interactions, strengthening the Decagon conversational assistant pitch
