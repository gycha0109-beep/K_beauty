begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
) values
  (
    '30000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner-review-import@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'viewer-review-import@example.test',
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now(),
    false,
    false
  );

select public.bootstrap_first_admin_owner(
  '30000000-0000-4000-8000-000000000001'::uuid
);

insert into public.admin_memberships (
  user_id,
  role,
  is_active,
  granted_by
) values (
  '30000000-0000-4000-8000-000000000003',
  'admin_viewer',
  true,
  '30000000-0000-4000-8000-000000000001'
);

commit;
