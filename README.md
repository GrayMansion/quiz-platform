<p align="center">
  <h1 align="center">Quiz Platform</h1>
  <p align="center">A real-time multiplayer quiz platform for classrooms, events, and team building.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Socket.IO-4-white?logo=socket.io" alt="Socket.IO">
  <img src="https://img.shields.io/badge/Prisma-5-indigo?logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss" alt="Tailwind CSS">
</p>

---

## Features

- **Real-time quiz sessions** — synchronized questions, countdown timers, and live leaderboards via Socket.IO
- **No account required to play** — participants join by entering a 6-character room code and display name
- **Organizer dashboard** — create, edit, publish, and launch quizzes with custom settings
- **Question types** — single-choice and multiple-choice with image support
- **Live scoring** — server-authoritative scoring with speed bonuses and tie-breakers
- **Auto-advance** — optional automatic question progression with configurable delays
- **Participant history** — track scores, ranks, and correct-answer rates over time
- **Dark mode** — automatic OS detection with manual toggle, persisted across visits
- **Session timeouts** — idle lobbies auto-close after 5 minutes

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, CSS custom properties |
| Realtime | Node.js + Socket.IO |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT with HTTP-only cookies |
| Validation | Zod |

## Architecture

```
Browser ── HTTP ──→ Next.js (Web + API)
    │                    │
    │                    ├── Prisma ──→ PostgreSQL
    │                    │
    └── WebSocket ──→ Node.js Socket.IO Server
                         ├── Session state machine
                         ├── Timer authority
                         └── Event broadcasting
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose (or a running PostgreSQL instance)

### Setup

```bash
# Clone the repository
git clone <repo-url> && cd quiz-platform

# Start PostgreSQL
docker compose up -d

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Initialize database
npx prisma generate
npx prisma db push

# Seed demo quizzes (optional)
npx prisma db seed

# Start both servers
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo account
- **Email:** `demo@quiz.platform`
- **Password:** `demo123`
- **Role:** Organizer (3 pre-made quizzes)

## Project Structure

```
quiz-platform/
├── apps/
│   ├── web/                  # Next.js app (pages, API routes, components)
│   │   └── src/
│   │       ├── app/          # App Router pages & API endpoints
│   │       ├── components/   # Shared UI (Navbar, ThemeProvider)
│   │       └── lib/          # Prisma client, auth, validators
│   └── realtime/             # Socket.IO server
│       └── src/index.ts      # Session lifecycle, scoring, event handlers
├── packages/
│   └── shared-types/         # Shared TypeScript enums & interfaces
├── prisma/
│   ├── schema.prisma         # Database model
│   └── seed.ts               # Demo data seeder
└── docker-compose.yml        # PostgreSQL
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web + realtime servers |
| `npm run build` | Production build |
| `npm run db:push` | Sync schema to database |
| `npm run db:seed` | Seed demo quizzes |
| `npm run db:studio` | Open Prisma Studio |

## License

MIT
