## Inspiration

Using AI agents today feels like using a computer before GUIs existed. You're stuck typing prompts into chat boxes, configuring API keys, and managing tools through dashboards. It's powerful, but it's the command line era of AI — and it locks out most people. We asked ourselves: what if we built the GUI for AI agents? What if interacting with them was as intuitive as walking up to a coworker and asking for help? That question led us to BossRoom.

We drew inspiration from games like Astro Bot's CPU Plaza, Papa's Pizzeria, and GTA's onboarding — environments where interaction is spatial, intuitive, and fun. We wanted that same feeling, but for getting real work done.

## What it does

BossRoom is a 3D virtual office where AI agents are your coworkers. You navigate a third-person world, walk up to agents at their desks, and delegate real tasks — by typing or using push-to-talk voice input. These agents don't just chat — they execute. They can send actual emails through Gmail, create real tickets in Linear, and book real meetings on Google Calendar.

Each agent has a unique personality and visual presence. When an agent works, you can see it: sparkle particles swirl around them as they think, thought bubbles show their personality, and a glowing status orb shifts color to reflect their state — blue for listening, yellow for thinking, orange for working, red if something goes wrong. You can even hear them respond with spatialized voice audio that gets louder as you walk closer. Players can also voice chat with each other using proximity-based spatial audio — hold T near another player and your voice fades in with distance, just like real life.

The workspace itself is dynamic — a receptionist agent greets you, understands your task, and spins up a custom team of specialized agents on the fly. A lead agent can delegate subtasks to worker agents, creating a real multi-agent collaboration pipeline. Agents even learn on the job — they can create reusable skills for themselves, getting better at their specialization over time.

The office sits on procedurally generated Minecraft-style terrain that stretches in every direction, and if you walk far enough past the office walls, you'll discover a hidden Stanford campus surrounding the building.

## How we built it

The frontend is built with React Three Fiber, drei, and Rapier for 3D physics — all running inside a Next.js 16 app with TypeScript and Tailwind v4. We built a Roblox-style third-person camera with physics-based character controls and used Kenney.nl assets for low-poly characters and furniture. The world features procedurally generated chunked terrain using simplex noise with Minecraft-style quantized heights, flowers, and grass. Agent visual states (idle, listening, thinking, working, error) are driven by Zustand stores that sync with the server over WebSocket. Bloom and vignette post-processing make status orbs and neon strips glow. A GTA-style onboarding tutorial walks new players through movement, interaction, and messaging.

On the backend, we built a WebSocket game server deployed on Google Cloud Run with a PostgreSQL database managed by Drizzle ORM. Each agent's skills are defined as rows in the database with step-by-step instructions and required tools — and agents can create new skills for themselves at runtime. AI calls run through the Vercel AI SDK, routed through Vercel's AI Gateway which gives us a unified interface to multiple LLM providers — Gemini, Claude, and GPT-4o are all mapped and swappable per agent. Real-world actions (Gmail, Google Calendar, Linear) go through Composio's OAuth integrations, giving each user scoped access to their own accounts. We also built MCP (Model Context Protocol) support so any external tool server can be plugged in.

For voice, we use Deepgram's Nova-3 for real-time speech-to-text transcription and Inworld's TTS API for agent voice responses, played back with HRTF spatial audio panning tied to each agent's 3D position in the world. Player-to-player voice chat runs over PeerJS WebRTC with its own spatial audio pipeline — each remote player's voice is routed through an HRTF panner node positioned at their 3D location, so conversations fade naturally with distance.

## Challenges we ran into

Getting the 3D interaction loop to feel right was harder than expected — tuning click detection, camera angles, and the chat panel overlay to not fight with the 3D controls took many iterations. WebSocket state sync between the game server and client required careful architecture to keep agent states consistent. Composio OAuth flows for multiple services had to be set up and scoped per user. Wiring up two separate spatial audio pipelines — one for agent TTS and one for player-to-player WebRTC voice — on a shared AudioContext without them fighting was tricky. And honestly, scoping a 36-hour vision down to what we could actually ship was a challenge in itself — we had to ruthlessly prioritize the demo-critical path.

## Accomplishments that we're proud of

The moment you walk up to an agent, speak a request out loud, and hear it respond in spatialized 3D audio while sparkles swirl around it as it works — and then a real email shows up in your actual inbox — that's the moment it clicks. We're proud that this isn't a mock or a simulation. Real emails get sent. Real tickets get created. Real meetings get booked. We're also proud of the dynamic workspace system — the receptionist analyzes your request and spawns a custom team of agents with the right skills, complete with a lead who can delegate subtasks to workers. The whole thing assembles itself in real time. And the proximity voice chat between players makes it feel like you're actually in a shared space — you can hear someone's voice get louder as they walk toward you.

## What we learned

We learned that the interface layer for AI agents matters just as much as the models themselves. A great model behind a chat box still feels like a chat box. But put that same model behind a character that reacts, glows, and speaks — and suddenly delegation feels natural. We also learned a ton about real-time 3D web architecture, WebSocket game patterns, WebRTC peer-to-peer audio, dual spatial audio pipelines in the browser, and how to wire up multi-model LLM systems with live tool integrations under extreme time pressure.

## What's next for BossRoom

Smarter agents, deeper collaboration, bigger world. We already have a wide range of integrations through Composio — Gmail, Google Calendar, Linear, and more — with multi-model routing through Vercel's AI Gateway (Gemini, Claude, GPT-4o). Next we want to make model selection automatic, routing different task types to the best model for the job. Agents already wander and return to their desks when you approach, and we want to push that further — agents physically walking to each other to brainstorm on complex tasks. We want to expand the skill system into a marketplace where agents share learned skills across workspaces. And with MCP support already built in, we want to plug into every tool ecosystem out there. Long term, we believe every company will have fleets of AI agents — and BossRoom is the operating system for working with them.
