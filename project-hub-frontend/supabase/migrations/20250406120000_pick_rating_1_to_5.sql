-- Tighten pick ratings to 1–5. Safe if the table already used 1–5 (idempotent).

-- Remove old CHECK so we can fix rows that used 6–10 from an earlier schema.
alter table public.sprint_pick_ratings drop constraint if exists sprint_pick_ratings_rating_check;

-- Map anything outside 1–5 into range (legacy 6–10 → 5).
update public.sprint_pick_ratings
set rating = least(5, greatest(1, rating))
where rating < 1 or rating > 5;

alter table public.sprint_pick_ratings drop constraint if exists sprint_pick_ratings_rating_check;

alter table public.sprint_pick_ratings
  add constraint sprint_pick_ratings_rating_check check (rating >= 1 and rating <= 5);
