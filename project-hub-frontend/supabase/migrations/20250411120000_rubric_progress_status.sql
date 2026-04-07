-- Three-state progress (same cycle as home tasks): NotStarted → InProgress → Completed → NotStarted
alter table public.rubric_requirements add column if not exists progress_status text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rubric_requirements'
      and column_name = 'is_completed'
  ) then
    update public.rubric_requirements
    set progress_status = case when is_completed then 'Completed' else 'NotStarted' end
    where progress_status is null;
  else
    update public.rubric_requirements set progress_status = 'NotStarted' where progress_status is null;
  end if;
end $$;

alter table public.rubric_requirements alter column progress_status set default 'NotStarted';
update public.rubric_requirements set progress_status = 'NotStarted' where progress_status is null;
alter table public.rubric_requirements alter column progress_status set not null;

alter table public.rubric_requirements drop column if exists is_completed;

alter table public.rubric_requirements drop constraint if exists rubric_requirements_progress_status_check;
alter table public.rubric_requirements
  add constraint rubric_requirements_progress_status_check
  check (progress_status in ('NotStarted', 'InProgress', 'Completed'));
