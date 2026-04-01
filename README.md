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

### Deploy (Vercel)

1. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Production + Preview).
2. **Either:**
   - Leave **Root Directory** empty (repo root). The root `vercel.json` builds `project-hub-frontend` and uses `project-hub-frontend/dist`, **or**
   - Set **Root Directory** to `project-hub-frontend` and clear any custom **Output Directory** in the dashboard so it stays `dist` (uses `project-hub-frontend/vercel.json`).

Do not set Root Directory to the repo root *and* leave Output Directory as `dist` only — that looks for `./dist` at the repo root and yields a 404.

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
