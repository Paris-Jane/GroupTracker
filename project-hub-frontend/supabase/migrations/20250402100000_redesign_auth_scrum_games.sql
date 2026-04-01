-- Redesign: login fields, scrum, schedule week, resources sections, planning poker & pick sessions
-- Safe to run after 20250401120000_project_hub.sql (uses IF NOT EXISTS / guards)

-- ── Group members: login (first name / last name demo auth) ───────────────
alter table public.group_members
  add column if not exists username text;
alter table public.group_members
  add column if not exists password text;

create unique index if not exists group_members_username_unique
  on public.group_members (lower(username))
  where username is not null;

-- ── Tasks: last editor ─────────────────────────────────────────────────────
alter table public.task_items
  add column if not exists last_edited_by_group_member_id bigint references public.group_members (id) on delete set null;

update public.task_items set status = 'InProgress' where status = 'WorkingOnIt';

-- ── Resources: section for UI grouping ─────────────────────────────────────
alter table public.resource_items
  add column if not exists section text not null default 'Other';

-- ── Project settings (single row) ──────────────────────────────────────────
create table if not exists public.project_settings (
  id int primary key default 1,
  product_goal text not null default '',
  website_url text,
  github_url text,
  constraint project_settings_singleton check (id = 1)
);

insert into public.project_settings (id, product_goal, website_url, github_url)
select 1,
  'Complete our group project with clear goals, steady delivery, and quality outcomes.',
  '',
  ''
where not exists (select 1 from public.project_settings where id = 1);

-- ── Sprint goals & reviews ─────────────────────────────────────────────────
create table if not exists public.sprint_goals (
  sprint_number int primary key,
  goal text not null default '',
  sprint_due_date date
);

create table if not exists public.sprint_reviews (
  id bigint generated always as identity primary key,
  sprint_number int not null,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists sprint_reviews_sprint_idx on public.sprint_reviews (sprint_number);

-- ── Schedule (dedicated items; April 6–10 2026 enforced in app) ───────────
create table if not exists public.schedule_items (
  id bigint generated always as identity primary key,
  title text not null,
  category text not null default 'Other',
  date date not null,
  start_time text not null,
  end_time text not null,
  owner_member_id bigint references public.group_members (id) on delete set null,
  location text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists schedule_items_date_idx on public.schedule_items (date);

-- ── Logins & freeform notes (resources page) ───────────────────────────────
create table if not exists public.login_items (
  id bigint generated always as identity primary key,
  label text not null,
  username text not null default '',
  password text not null default '',
  url text,
  notes text,
  sort_order int not null default 0
);

create table if not exists public.text_notes (
  id bigint generated always as identity primary key,
  title text not null default 'Note',
  body text not null default '',
  updated_at timestamptz not null default now()
);

-- ── Planning poker (shared session in Supabase) ────────────────────────────
create table if not exists public.poker_sessions (
  id bigint generated always as identity primary key,
  filter_all_tasks boolean not null default true,
  sprint_number int,
  task_queue jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  phase text not null default 'ready',
  created_at timestamptz not null default now()
);

create table if not exists public.poker_ready (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.poker_sessions (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  unique (session_id, group_member_id)
);

create table if not exists public.poker_votes (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.poker_sessions (id) on delete cascade,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  value int,
  unique (session_id, task_item_id, group_member_id)
);

-- ── Pick tasks (1–10 comfort) ────────────────────────────────────────────────
create table if not exists public.pick_sessions (
  id bigint generated always as identity primary key,
  filter_all_tasks boolean not null default true,
  sprint_number int,
  task_queue jsonb not null default '[]'::jsonb,
  current_index int not null default 0,
  phase text not null default 'ready',
  created_at timestamptz not null default now()
);

create table if not exists public.pick_ready (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.pick_sessions (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  unique (session_id, group_member_id)
);

create table if not exists public.pick_ratings (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.pick_sessions (id) on delete cascade,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  rating int,
  unique (session_id, task_item_id, group_member_id)
);

-- ── RLS (open policies — same as rest of project hub) ───────────────────────
alter table public.project_settings enable row level security;
alter table public.sprint_goals enable row level security;
alter table public.sprint_reviews enable row level security;
alter table public.schedule_items enable row level security;
alter table public.login_items enable row level security;
alter table public.text_notes enable row level security;
alter table public.poker_sessions enable row level security;
alter table public.poker_ready enable row level security;
alter table public.poker_votes enable row level security;
alter table public.pick_sessions enable row level security;
alter table public.pick_ready enable row level security;
alter table public.pick_ratings enable row level security;

create policy "project_hub_rw_project_settings" on public.project_settings for all using (true) with check (true);
create policy "project_hub_rw_sprint_goals" on public.sprint_goals for all using (true) with check (true);
create policy "project_hub_rw_sprint_reviews" on public.sprint_reviews for all using (true) with check (true);
create policy "project_hub_rw_schedule_items" on public.schedule_items for all using (true) with check (true);
create policy "project_hub_rw_login_items" on public.login_items for all using (true) with check (true);
create policy "project_hub_rw_text_notes" on public.text_notes for all using (true) with check (true);
create policy "project_hub_rw_poker_sessions" on public.poker_sessions for all using (true) with check (true);
create policy "project_hub_rw_poker_ready" on public.poker_ready for all using (true) with check (true);
create policy "project_hub_rw_poker_votes" on public.poker_votes for all using (true) with check (true);
create policy "project_hub_rw_pick_sessions" on public.pick_sessions for all using (true) with check (true);
create policy "project_hub_rw_pick_ready" on public.pick_ready for all using (true) with check (true);
create policy "project_hub_rw_pick_ratings" on public.pick_ratings for all using (true) with check (true);

-- ── Seed users (first name login / last name password) ──────────────────────
insert into public.group_members (name, username, password, avatar_initial, color)
select 'Ethan Wood', 'ethan', 'wood', 'E', '#1e3a8a'
where not exists (select 1 from public.group_members where lower(username) = 'ethan');

insert into public.group_members (name, username, password, avatar_initial, color)
select 'Luke Carr', 'luke', 'carr', 'L', '#0d9488'
where not exists (select 1 from public.group_members where lower(username) = 'luke');

insert into public.group_members (name, username, password, avatar_initial, color)
select 'Paris Ward', 'paris', 'ward', 'P', '#6d28d9'
where not exists (select 1 from public.group_members where lower(username) = 'paris');

-- Shared “active” game pointers for multi-browser sync (polled from the client)
alter table public.project_settings
  add column if not exists active_poker_session_id bigint references public.poker_sessions (id) on delete set null;
alter table public.project_settings
  add column if not exists active_pick_session_id bigint references public.pick_sessions (id) on delete set null;
