-- Group logins on the Resources page (Website / Supabase / Other)
alter table public.login_items add column if not exists login_category text;

update public.login_items set login_category = 'Other' where login_category is null;

alter table public.login_items alter column login_category set default 'Other';
alter table public.login_items alter column login_category set not null;

alter table public.login_items drop constraint if exists login_items_login_category_check;
alter table public.login_items add constraint login_items_login_category_check
  check (login_category in ('Website', 'Supabase', 'Other'));
