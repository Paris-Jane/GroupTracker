# ProjectHub — Student Group Project Manager

A web app to help a student group organize tasks, resources, and workload.

## Tech Stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Frontend | React + TypeScript (Vite)                       |
| Data     | Supabase (Postgres + Row Level Security)      |
| Routing  | React Router                                    |
| Client   | `@supabase/supabase-js`                         |

---

## Project Structure

```
intex2/
├── vercel.json              ← optional: monorepo build from repo root
└── project-hub-frontend/
    ├── supabase/migrations/   ← SQL schema for Supabase
    ├── src/
    │   ├── api/client.ts      ← Supabase data layer
    │   ├── lib/supabase.ts    ← Browser client
    │   ├── components/
    │   ├── pages/
    │   └── types/
    └── .env.example           ← VITE_SUPABASE_* vars
```

---

## Running Locally

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A [Supabase](https://supabase.com) project with the migration applied (see `project-hub-frontend/supabase/migrations/`)

### Setup

1. In Supabase **SQL Editor**, run the migration SQL file once.
2. Add at least one row in `group_members` (Table Editor or SQL).
3. Copy **Project URL** and **anon** key from **Project Settings → API**.

```bash
cd project-hub-frontend
cp .env.example .env
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
npm install
npm run dev
```

Open **http://localhost:5173**.

### Deploy (Vercel + Supabase)

This app is a **static Vite build** that talks to **Supabase from the browser** using the anon key. There is no server-side API in this repo.

1. **Environment variables (required)**  
   In Vercel → **Settings → Environment Variables**, add for **Production** (and **Preview** if you use previews):
   - `VITE_SUPABASE_URL` — Supabase **Project URL** (Project Settings → API)
   - `VITE_SUPABASE_ANON_KEY` — **anon public** key (same page)  
   `VITE_*` variables are embedded at **build time**. After adding or changing them, **redeploy** so the new build picks them up.

2. **Project layout** — **Either:**
   - Leave **Root Directory** empty (repository root). The root `vercel.json` installs/builds inside `project-hub-frontend` and sets **Output Directory** to `project-hub-frontend/dist`, **or**
   - Set **Root Directory** to `project-hub-frontend` and do not override output (uses `dist` via `project-hub-frontend/vercel.json`).

Do not point **Root Directory** at the repo root while **Output Directory** is only `dist` — that expects `./dist` at the repo root and causes a **404**.

3. **Supabase** — Run the SQL migration in your Supabase project once. The hosted app uses the same database as local dev when env vars match that project.

---

## Features

### Dashboard

- Summary cards (total / completed / in-progress / overdue)
- Overall progress bar
- My tasks (filtered to current user)
- Upcoming deadlines (next 7 days)
- Recent activity log (last 15 updates)
- Quick links preview
- This week's room reservations

### Tasks Page

- Create, edit, delete tasks
- Status: Not Started / Working On It / Completed
- Priority: High / Medium / Low
- Required / Optional flag
- Deadline, estimated time, tags
- Multi-person assignment
- Subtasks with checkboxes and progress bar
- Filters, sort, search
- Assign to self
- Bulk import via AI (JSON paste)

### Resources Page

- **Quick Links** — title, URL, category, notes
- **Materials** — resources with type, descriptions, links
- **Room Reservations** — calendar + list

### Play Game — Fair Task Assignment

- Members rate confidence (1–10) per task
- Results and assignment helpers

---

## Security Note

The included RLS policies are permissive for development. Before exposing the app broadly, tighten policies (e.g. Supabase Auth + `auth.uid()`).
