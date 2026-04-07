-- Shared checklist state: one completion flag per requirement for the whole team
alter table public.rubric_requirements
  add column if not exists is_completed boolean not null default false;

-- If anyone had checked under the old per-member model, treat the line as done for everyone
update public.rubric_requirements r
  set is_completed = true
  where exists (
    select 1 from public.rubric_completions c where c.requirement_id = r.id
  );

drop policy if exists "project_hub_rw_rubric_completions" on public.rubric_completions;
drop table if exists public.rubric_completions;

-- For live updates across browsers: Database → Replication → add `rubric_requirements` (or run:
-- alter publication supabase_realtime add table public.rubric_requirements; )
