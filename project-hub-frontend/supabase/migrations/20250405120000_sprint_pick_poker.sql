-- Per-sprint, per-member pick (1–10 comfort) and poker (deck values), independent of shared sessions.

create table if not exists public.sprint_pick_ratings (
  id bigint generated always as identity primary key,
  sprint_number int not null,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 10),
  updated_at timestamptz not null default now(),
  unique (sprint_number, task_item_id, group_member_id)
);

create table if not exists public.sprint_poker_votes (
  id bigint generated always as identity primary key,
  sprint_number int not null,
  task_item_id bigint not null references public.task_items (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  value int not null check (value in (0, 1, 2, 3, 5, 8, 13)),
  updated_at timestamptz not null default now(),
  unique (sprint_number, task_item_id, group_member_id)
);

create index if not exists sprint_pick_ratings_sprint_idx on public.sprint_pick_ratings (sprint_number);
create index if not exists sprint_poker_votes_sprint_idx on public.sprint_poker_votes (sprint_number);

alter table public.sprint_pick_ratings enable row level security;
alter table public.sprint_poker_votes enable row level security;

create policy "project_hub_rw_sprint_pick_ratings" on public.sprint_pick_ratings for all using (true) with check (true);
create policy "project_hub_rw_sprint_poker_votes" on public.sprint_poker_votes for all using (true) with check (true);
