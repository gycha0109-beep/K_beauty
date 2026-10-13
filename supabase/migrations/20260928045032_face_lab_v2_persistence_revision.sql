alter table public.saved_reports
  add column if not exists face_lab_revision bigint not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'saved_reports_face_lab_revision_nonnegative'
      and conrelid = 'public.saved_reports'::regclass
  ) then
    alter table public.saved_reports
      add constraint saved_reports_face_lab_revision_nonnegative
      check (face_lab_revision >= 0);
  end if;
end
$$;
