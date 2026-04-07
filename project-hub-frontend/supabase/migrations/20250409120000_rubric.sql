-- Course rubric checklist (shared requirements) + per-member completion
create table if not exists public.rubric_requirements (
  id bigint generated always as identity primary key,
  section text not null check (section in ('401', '413', '414', '455', 'presentation')),
  body text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rubric_requirements_section_sort_idx on public.rubric_requirements (section, sort_order);

create table if not exists public.rubric_completions (
  requirement_id bigint not null references public.rubric_requirements (id) on delete cascade,
  group_member_id bigint not null references public.group_members (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (requirement_id, group_member_id)
);

create index if not exists rubric_completions_member_idx on public.rubric_completions (group_member_id);

alter table public.rubric_requirements enable row level security;
alter table public.rubric_completions enable row level security;

create policy "project_hub_rw_rubric_requirements"
  on public.rubric_requirements for all using (true) with check (true);

create policy "project_hub_rw_rubric_completions"
  on public.rubric_completions for all using (true) with check (true);
