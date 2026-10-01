begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '51000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'pasien@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '52000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin-uji@example.test', extensions.crypt('test-password', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"],"app_role":"admin"}', '{}', now(), now());

update public.profiles
set name = 'Synthetic User', birth_date = '1990-01-01', sex = 'female', timezone_code = 'WIB', account_status = 'active'
where user_id = '51000000-0000-0000-0000-000000000001';

set local role authenticated;

-- Pengguna biasa ditolak.
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated","app_metadata":{}}', true);
select throws_ok($$select * from public.admin_search_accounts('example.test')$$, 'P0001', 'admin_required', 'non-admin cannot search accounts');
select throws_ok($$select public.admin_set_account_status('52000000-0000-0000-0000-000000000002', 'suspended', 'uji tanpa hak', gen_random_uuid())$$, 'P0001', 'admin_required', 'non-admin cannot change status');
select throws_ok($$select * from public.admin_recent_audit()$$, 'P0001', 'admin_required', 'non-admin cannot read audit');
select throws_ok($$select public.admin_record_event(null, null, 'x', 'y', gen_random_uuid())$$, '42501', null, 'authenticated cannot write audit directly');

-- Admin.
select set_config('request.jwt.claims', '{"sub":"52000000-0000-0000-0000-000000000002","role":"authenticated","app_metadata":{"app_role":"admin"}}', true);
select is((select count(*) from public.admin_search_accounts('pasien@')), 1::bigint, 'admin finds account by email');
select is((select account_status from public.admin_search_accounts('pasien@')), 'active', 'search returns status');
select throws_ok($$select * from public.admin_search_accounts('ab')$$, 'P0001', 'query_too_short', 'search needs at least 3 characters');
select throws_ok($$select public.admin_set_account_status('51000000-0000-0000-0000-000000000001', 'suspended', '', gen_random_uuid())$$, 'P0001', 'reason_required', 'reason is required');
select throws_ok($$select public.admin_set_account_status('52000000-0000-0000-0000-000000000002', 'suspended', 'uji akun sendiri', gen_random_uuid())$$, 'P0001', 'cannot_change_own_account', 'admin cannot change own account');
select is(public.admin_set_account_status('51000000-0000-0000-0000-000000000001', 'suspended', 'Laporan penyalahgunaan (uji)', gen_random_uuid()), 'suspended', 'admin suspends account');
select is(public.admin_set_account_status('51000000-0000-0000-0000-000000000001', 'active', 'Klarifikasi selesai (uji)', gen_random_uuid()), 'onboarding', 'reactivation follows account completeness (no consent receipts yet)');
select is((select count(*) from public.admin_recent_audit() where subject_email = 'pasien@example.test'), 2::bigint, 'both changes are audited with subject');
select throws_ok($$select public.admin_set_account_status('51000000-0000-0000-0000-000000000001', 'active', 'Tidak ada perubahan', gen_random_uuid())$$, 'P0001', 'no_change', 'no-op change rejected');
select is((select count(*) from public.glucose_entries), 0::bigint, 'admin still cannot read health entries');

select * from finish();
rollback;
