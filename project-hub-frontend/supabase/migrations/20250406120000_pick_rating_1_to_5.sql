-- Narrow pick comfort scale to 1–5 (matches UI cards).
alter table public.sprint_pick_ratings drop constraint if exists sprint_pick_ratings_rating_check;
alter table public.sprint_pick_ratings
  add constraint sprint_pick_ratings_rating_check check (rating >= 1 and rating <= 5);
