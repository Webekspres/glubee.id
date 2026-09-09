begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

select has_table('public', 'profiles', 'profiles exists');
select has_table('public', 'glucose_entries', 'glucose entries exist');
select has_table('public', 'schedules', 'schedules exist');
select has_table('public', 'emergency_contacts', 'contacts exist');
select has_table('public', 'notification_jobs', 'notification queue exists');
select has_table('public', 'deletion_requests', 'deletion requests exist');
select has_table('public', 'admin_audit_events', 'admin audit exists');
select has_table('public', 'data_exports', 'exports exist');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'other@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '30000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'admin@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"app_role":"admin"}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '40000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'unverified@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), null, '{"provider":"email","providers":["email"]}', '{}', now(), now());

update public.profiles
set name = 'Synthetic User', birth_date = '1990-01-01', sex = 'female', timezone_code = 'WIB'
where user_id in (
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '30000000-0000-0000-0000-000000000003',
  '40000000-0000-0000-0000-000000000004'
);

insert into public.consent_receipts (user_id, consent_type, document_version, decision, method)
select users.user_id, versions.consent_type, versions.document_version, 'accept', 'database_test'
from (
  values
    ('10000000-0000-0000-0000-000000000001'::uuid),
    ('20000000-0000-0000-0000-000000000002'::uuid),
    ('30000000-0000-0000-0000-000000000003'::uuid),
    ('40000000-0000-0000-0000-000000000004'::uuid)
) users(user_id)
cross join public.notice_versions versions
where versions.consent_type <> 'cookie';

update public.profiles set account_status = 'active';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.user_can_access_health(), 'verified owner with consent can use health features');
select lives_ok(
  $$select public.create_glucose_entry('create-key-0001', 7.2, 'mmol/L', 'random', now() - interval '1 day', 'synthetic')$$,
  'owner creates an entry'
);
select is((select count(*) from public.glucose_entries), 1::bigint, 'owner sees one entry');
select is((select normalized_mg_dl from public.glucose_entries limit 1), 129.600::numeric, 'unit conversion is stable');
select lives_ok(
  $$select public.create_glucose_entry('create-key-0001', 7.2, 'mmol/L', 'random', now() - interval '1 day', 'synthetic')$$,
  'repeating an idempotency key succeeds'
);
select is((select count(*) from public.glucose_entries), 1::bigint, 'duplicate request creates no second entry');
select throws_ok(
  $$update public.glucose_entries set original_value = 8 where true$$,
  '42501',
  'permission denied for table glucose_entries',
  'direct clinical value update is denied'
);
select lives_ok(
  $$select public.invalidate_glucose_entry((select id from public.glucose_entries limit 1), 'invalidate-key-0001', 'synthetic correction')$$,
  'owner can invalidate through the audited mutation'
);
select is((select count(*) from public.glucose_entries where status = 'valid'), 0::bigint, 'invalid entry is excluded from valid data');
select lives_ok(
  $$select public.create_glucose_entry('replacement-key-0001', 130, 'mg/dL', 'random', now() - interval '1 day', null, (select id from public.glucose_entries limit 1))$$,
  'owner creates one linked replacement'
);
select throws_ok(
  $$update public.profiles set account_status = 'suspended' where user_id = auth.uid()$$,
  '42501',
  'permission denied for table profiles',
  'owner cannot change account status directly'
);
select throws_ok(
  $$select public.consume_rate_limit('glucose.create', 1000, 1)$$,
  'P0001',
  'invalid_rate_limit_configuration',
  'client cannot weaken the rate limit configuration'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.glucose_entries), 0::bigint, 'another user cannot read owner entries');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
select is(public.user_can_access_health(), false, 'unverified account cannot use health features');
select is((select count(*) from public.glucose_entries), 0::bigint, 'unverified account cannot read health entries');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select count(*) from public.glucose_entries$$,
  '42501',
  'permission denied for table glucose_entries',
  'anonymous user cannot read health entries'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","app_metadata":{"app_role":"admin"}}', true);
select is((select count(*) from public.glucose_entries), 0::bigint, 'application admin cannot read health entries');

reset role;
select lives_ok(
  $$insert into public.emergency_contacts (user_id, name, email_ciphertext, email_hash) values
    ('10000000-0000-0000-0000-000000000001', 'Contact One', decode('01','hex'), decode('11','hex')),
    ('10000000-0000-0000-0000-000000000001', 'Contact Two', decode('02','hex'), decode('22','hex'))$$,
  'two contacts are allowed'
);
select throws_ok(
  $$insert into public.emergency_contacts (user_id, name, email_ciphertext, email_hash) values ('10000000-0000-0000-0000-000000000001', 'Contact Three', decode('03','hex'), decode('33','hex'))$$,
  '23514',
  'emergency_contact_limit_reached',
  'third active or pending contact is rejected'
);
select lives_ok(
  $$insert into public.deletion_requests (user_id, scheduled_for) values ('10000000-0000-0000-0000-000000000001', now() + interval '7 days')$$,
  'first active deletion request is allowed'
);
select throws_ok(
  $$insert into public.deletion_requests (user_id, scheduled_for) values ('10000000-0000-0000-0000-000000000001', now() + interval '7 days')$$,
  '23505',
  'duplicate key value violates unique constraint "deletion_requests_one_active_idx"',
  'second active deletion request is rejected'
);
select throws_ok(
  $$insert into public.schedules (user_id, category, title, local_time, timezone_code, recurrence_rule) values ('10000000-0000-0000-0000-000000000001', 'glucose_check', 'Pending recurrence', '08:00', 'WIB', 'weekly')$$,
  '23514',
  'new row for relation "schedules" violates check constraint "schedules_pending_recurrence_check"',
  'pending recurrence remains disabled'
);

select * from finish();
rollback;
