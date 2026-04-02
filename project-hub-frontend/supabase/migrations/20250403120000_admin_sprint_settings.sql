-- Admin sprint configuration + admin login user
alter table public.project_settings
  add column if not exists sprint_count int not null default 6;

alter table public.project_settings
  add column if not exists sprint_deadlines jsonb not null default '[]'::jsonb;

-- Demo admin account (username / password both "admin", case-insensitive match in app)
insert into public.group_members (name, username, password, avatar_initial, color)
select 'Admin', 'admin', 'admin', 'A', '#374151'
where not exists (select 1 from public.group_members where lower(username) = 'admin');
