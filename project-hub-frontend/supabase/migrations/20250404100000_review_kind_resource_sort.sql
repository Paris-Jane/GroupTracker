-- Retrospective kind (well / improve) and manual sort for resources & quick links

alter table public.sprint_reviews
  add column if not exists review_kind text not null default 'well';

alter table public.resource_items
  add column if not exists sort_order int not null default 0;

alter table public.quick_links
  add column if not exists sort_order int not null default 0;
