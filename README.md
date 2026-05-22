# ZindagiCare

Production-grade healthcare marketplace for Pakistan — doctor booking, Sunday free consult, home visits, and more.

## Stack

- **apps/web** — Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **packages/shared** — enums, utils, errors
- **packages/database** — Mongoose models + connection
- **packages/validators** — Zod schemas

## Getting started

```bash
# From repo root
npm install
cp .env.example apps/web/.env.local
# Set AUTH_SECRET, MONGODB_URI, NEXTAUTH_URL in apps/web/.env.local

npm run dev
```

**Important:** Next.js reads environment variables from `apps/web/.env.local`, not only the repo root.

Open [http://localhost:3000](http://localhost:3000).

## Monorepo scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web app |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Project structure

See architecture plan in `.cursor/plans` or docs for feature-based layout under `apps/web/src/features` and domain packages under `packages/`.
