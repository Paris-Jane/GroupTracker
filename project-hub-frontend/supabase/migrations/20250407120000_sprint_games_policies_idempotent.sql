-- Idempotent: safe to re-run if policy creation failed or was duplicated.
drop policy if exists "project_hub_rw_sprint_pick_ratings" on public.sprint_pick_ratings;
create policy "project_hub_rw_sprint_pick_ratings" on public.sprint_pick_ratings for all using (true) with check (true);

drop policy if exists "project_hub_rw_sprint_poker_votes" on public.sprint_poker_votes;
create policy "project_hub_rw_sprint_poker_votes" on public.sprint_poker_votes for all using (true) with check (true);
