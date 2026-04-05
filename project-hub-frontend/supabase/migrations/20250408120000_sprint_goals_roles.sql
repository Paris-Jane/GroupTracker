-- Product owner / scrum master on sprint_goals (per sprint), optional display on sprint page
alter table public.sprint_goals
  add column if not exists product_owner text not null default '';

alter table public.sprint_goals
  add column if not exists scrum_master text not null default '';

alter table public.sprint_goals
  add column if not exists show_roles_on_sprint_page boolean not null default false;
