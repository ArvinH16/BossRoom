## Inspiration

Using AI agents today feels like using a computer before GUIs existed. You're stuck typing prompts into chat boxes, configuring API keys, and managing tools through dashboards. It's powerful, but it's the command line era of AI — and it locks out most people. We asked ourselves: what if we built the GUI for AI agents? What if interacting with them was as intuitive as walking up to a coworker and asking for help? That question led us to BossRoom.

We drew inspiration from games like Astro Bot's CPU Plaza, Papa's Pizzeria, and GTA's onboarding — environments where interaction is spatial, intuitive, and fun. We wanted that same feeling, but for getting real work done.

## What it does

BossRoom is a 3D virtual office where AI agents are your coworkers. You navigate a third-person world, walk up to agents at their desks, and delegate real tasks — by typing or using push-to-talk voice input. These agents don't just chat — they execute. They can send actual emails through Gmail, create real tickets in Linear, and book real meetings on Google Calendar.

Each agent has a unique personality and visual presence. When an agent works, you can see it: sparkle particles swirl around them as they think, thought bubbles show their personality, and a glowing status orb shifts color to reflect their state — blue for listening, yellow for thinking, green for working, red if something goes wrong. You can even hear them respond with spatialized voice audio that gets louder as you walk closer.

The workspace itself is dynamic — a receptionist agent greets you, understands your task, and spins up a custom team of specialized agents on the fly. A lead agent can delegate subtasks to worker agents, creating a real multi-agent collaboration pipeline.

## How we built it

The frontend is built with React Three Fiber, drei, and Rapier for 3D physics — all running inside a Next.js 16 app with TypeScript and Tailwind v4. We built custom third-person character controls with physics-based movement and used Kenney.nl assets for low-poly characters and furniture. Agent visual states (idle, listening, thinking, working, error) are driven by Zustand stores that sync with the server over WebSocket.

On the backend, we built a WebSocket game server deployed on Google Cloud Run with a PostgreSQL database managed by Drizzle ORM. Each agent's skills are defined as rows in the database with instructions and required tools. AI calls run through the Vercel AI SDK, routed through Vercel's AI Gateway which gives us a unified interface to multiple LLM providers — Gemini, Claude, and GPT-4o are all mapped and swappable per agent. Real-world actions (Gmail, Google Calendar, Linear) go through Composio's OAuth integrations, giving each user scoped access to their own accounts.

For voice, we use Deepgram's Nova-3 for real-time speech-to-text transcription and Inworld's TTS API for agent voice responses, played back with HRTF spatial audio panning tied to each agent's 3D position in the world.

## Challenges we ran into

Getting the 3D interaction loop to feel right was harder than expected — tuning click detection, camera angles, and the chat panel overlay to not fight with the 3D controls took many iterations. WebSocket state sync between the game server and client required careful architecture to keep agent states consistent. Composio OAuth flows for multiple services had to be set up and scoped per user. And honestly, scoping a 36-hour vision down to what we could actually ship in 12 hours was a challenge in itself — we had to ruthlessly prioritize the demo-critical path.

## Accomplishments that we're proud of

The moment you walk up to an agent, speak a request out loud, and hear it respond in spatialized 3D audio while sparkles swirl around it as it works — and then a real email shows up in your actual inbox — that's the moment it clicks. We're proud that this isn't a mock or a simulation. Real emails get sent. Real tickets get created. Real meetings get booked. We're also proud of the dynamic workspace system — the receptionist analyzes your request and spawns a custom team of agents with the right skills, complete with a lead who can delegate subtasks to workers. The whole thing assembles itself in real time.

## What we learned

We learned that the interface layer for AI agents matters just as much as the models themselves. A great model behind a chat box still feels like a chat box. But put that same model behind a character that reacts, glows, and speaks — and suddenly delegation feels natural. We also learned a ton about real-time 3D web architecture, WebSocket game patterns, spatial audio in the browser, and how to wire up multi-model LLM systems with live tool integrations under extreme time pressure.

## What's next for BossRoom

More agents, more integrations, more zones. We want to add multi-model role assignment — routing different task types to the best model for the job. We want multi-agent collaboration to be visible — agents physically walking to each other to brainstorm on complex tasks. And we want a skill marketplace where anyone can add new agents by simply defining a system prompt and tool set. Long term, we believe every company will have fleets of AI agents — and BossRoom is the operating system for working with them.
