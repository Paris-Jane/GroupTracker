-- Project Hub schema for Supabase (Postgres)
-- Run via Supabase Dashboard → SQL → New query, or: supabase db push / MCP apply_migration

-- ── Tables ─────────────────────────────────────────────────────────────────

create table public.group_members (
  id bigint generated always as identity primary key,
  name text not null,
  email text,
  avatar_initial text,
  color text,
  created_at timestamptz not null default now()
);

create table public.task_items (
  id bigint generated always as identity primary key,
  name text not null,
  description text,
  estimated_time text,
  deadline timestamptz,
  priority text not null default 'Medium',
  is_required boolean not null default true,
  status text not null default 'NotStarted',
  tags text,
  sprint_number int,
  category text not null default 'ProductBacklog',
  evaluation int,
  definition_of_done text,
  accepted_by_po boolean not null default false,
  is_blocked boolean not null default false,
  blocked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subtasks (
  id bigint generated always as identity primary key,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  name text not null,
  is_completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.task_assignments (
  id bigint generated always as identity primary key,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique (task_item_id, group_member_id)
);

create table public.task_updates (
  id bigint generated always as identity primary key,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint references public.group_members (id) on delete set null,
  action_type text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table public.quick_links (
  id bigint generated always as identity primary key,
  title text not null,
  url text not null,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resource_items (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  type text not null default 'Other',
  category text,
  class_category text,
  url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_reservations (
  id bigint generated always as identity primary key,
  room_name text not null,
  date date not null,
  start_time text not null,
  end_time text not null,
  group_member_id bigint references public.group_members (id) on delete set null,
  reserved_by text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.task_ratings (
  id bigint generated always as identity primary key,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  rating_value int not null check (rating_value >= 1 and rating_value <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_item_id, group_member_id)
);

create index task_assignments_member_idx on public.task_assignments (group_member_id);
create index task_updates_created_idx on public.task_updates (created_at desc);
create index subtasks_task_idx on public.subtasks (task_item_id);

-- ── Row Level Security (open policies — tighten before real production) ───

alter table public.group_members enable row level security;
alter table public.task_items enable row level security;
alter table public.subtasks enable row level security;
alter table public.task_assignments enable row level security;
alter table public.task_updates enable row level security;
alter table public.quick_links enable row level security;
alter table public.resource_items enable row level security;
alter table public.room_reservations enable row level security;
alter table public.task_ratings enable row level security;

create policy "project_hub_rw_group_members"
  on public.group_members for all using (true) with check (true);

create policy "project_hub_rw_task_items"
  on public.task_items for all using (true) with check (true);

create policy "project_hub_rw_subtasks"
  on public.subtasks for all using (true) with check (true);

create policy "project_hub_rw_task_assignments"
  on public.task_assignments for all using (true) with check (true);

create policy "project_hub_rw_task_updates"
  on public.task_updates for all using (true) with check (true);

create policy "project_hub_rw_quick_links"
  on public.quick_links for all using (true) with check (true);

create policy "project_hub_rw_resource_items"
  on public.resource_items for all using (true) with check (true);

create policy "project_hub_rw_room_reservations"
  on public.room_reservations for all using (true) with check (true);

create policy "project_hub_rw_task_ratings"
  on public.task_ratings for all using (true) with check (true);
