begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','ba000000-0000-4000-8000-00000000000a','authenticated','authenticated','cabut-a@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','ba000000-0000-4000-8000-00000000000d','authenticated','authenticated','cabut-d@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Pak Joko',birth_date='1955-01-01',sex='male',timezone_code='WIB',account_status='active'
where user_id::text like 'ba000000-%';
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id::text like 'ba000000-%' and n.consent_type in ('age_and_region','legal_documents','health_data','contact_share');

create function pg_temp.h(p text) returns bytea language sql as $$ select extensions.digest(p, 'sha256') $$;
create function pg_temp.blob() returns bytea language sql as $$ select extensions.gen_random_bytes(64) $$;
create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create function pg_temp.state(p text) returns text language sql as $$
  select c.state from public.emergency_contacts c join ids on ids.id = c.id where ids.name = p $$;
create function pg_temp.v() returns text language sql as $$
  select document_version from public.notice_versions where consent_type = 'contact_accept' $$;

set local role authenticated;
select pg_temp.as_user('ba000000-0000-4000-8000-00000000000a');
insert into ids select 'andi', public.invite_emergency_contact('Andi', pg_temp.blob(), pg_temp.h('andi@x.test'), pg_temp.h('inv-andi'));
insert into ids select 'budi', public.invite_emergency_contact('Budi', pg_temp.blob(), pg_temp.h('budi@x.test'), pg_temp.h('inv-budi'));
reset role;
select public.decide_contact_invitation(pg_temp.h('inv-andi'), 'accept', pg_temp.v());

-- Token berhenti hanya untuk kontak aktif.
select lives_ok(format('select public.issue_contact_stop_token(%L, pg_temp.h(''stop-andi''))', (select id from ids where name='andi')), 'stop token for active contact');
select throws_ok(format('select public.issue_contact_stop_token(%L, pg_temp.h(''stop-budi''))', (select id from ids where name='budi')),
  'P0001', 'contact_not_active', 'no stop token for pending contact');
select is((select status from public.get_contact_invitation(pg_temp.h('stop-andi'))), null, 'stop token is not an invitation');

-- Penjaga job: hanya kontak aktif milik pengguna yang sama.
insert into public.glucose_entries(id,user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
values ('ba000000-0000-4000-8000-0000000000e1','ba000000-0000-4000-8000-00000000000a',300,'mg/dL',300,'random',now());
insert into public.notification_jobs (id, user_id, contact_id, type, channel, dedupe_key, due_at, payload_ref)
values ('ba000000-0000-4000-8000-0000000000f1','ba000000-0000-4000-8000-00000000000a',(select id from ids where name='andi'),
  'value_alert','email','alert:andi:1',now(),'ba000000-0000-4000-8000-0000000000e1');
select throws_ok(format($$insert into public.notification_jobs (user_id, contact_id, type, channel, dedupe_key, due_at)
  values ('ba000000-0000-4000-8000-00000000000a', %L, 'value_alert', 'email', 'alert:budi:1', now())$$, (select id from ids where name='budi')),
  '23514', 'contact_not_active', 'no job for pending contact');
select throws_ok(format($$insert into public.notification_jobs (user_id, contact_id, type, channel, dedupe_key, due_at)
  values ('ba000000-0000-4000-8000-00000000000d', %L, 'value_alert', 'email', 'alert:x:1', now())$$, (select id from ids where name='andi')),
  '23514', 'contact_not_active', 'no job to another user''s contact');

-- Cek ulang sebelum kirim.
select is(private.contact_job_block_reason('ba000000-0000-4000-8000-0000000000f1'), 'feature_pending', 'alerts stay off while pending');
update public.glucose_entries set status='invalid', invalidated_at=now(), invalidation_reason='salah ketik' where id='ba000000-0000-4000-8000-0000000000e1';
select is(private.contact_job_block_reason('ba000000-0000-4000-8000-0000000000f1'), 'entry_invalidated', 'invalidated entry blocks alert');
update public.profiles set account_status='suspended' where user_id='ba000000-0000-4000-8000-00000000000a';
select is(private.contact_job_block_reason('ba000000-0000-4000-8000-0000000000f1'), 'account_inactive', 'inactive account blocks alert');
update public.profiles set account_status='active' where user_id='ba000000-0000-4000-8000-00000000000a';
select is(private.contact_job_block_reason(gen_random_uuid()), 'job_missing', 'unknown job blocked');

-- Kontak berhenti lewat tautan aman.
set local role authenticated;
select throws_ok($$select public.stop_contact(pg_temp.h('stop-andi'))$$, '42501', null, 'users cannot call stop');
reset role;
select is((select status || '/' || inviter_name from public.get_contact_stop(pg_temp.h('stop-andi'))), 'valid/Pak Joko', 'stop page shows inviter');
select is(public.stop_contact(pg_temp.h('stop-andi')), 'revoked', 'contact stops');
select is(pg_temp.state('andi'), 'revoked', 'contact revoked');
select is((select state from public.notification_jobs where id='ba000000-0000-4000-8000-0000000000f1'), 'suppressed', 'unsent job suppressed');
select is((select error_class from public.notification_attempts where job_id='ba000000-0000-4000-8000-0000000000f1'), 'contact_revoked', 'suppression reason logged');
select is((select actor || ':' || decision from public.contact_consents where contact_id=(select id from ids where name='andi') and decision='revoke'),
  'contact:revoke', 'revocation receipt kept');
select is(public.stop_contact(pg_temp.h('stop-andi')), 'revoked', 'stopping again is idempotent');
select is((select status from public.get_contact_stop(pg_temp.h('stop-andi'))), 'done', 'stop link reports done');
select is(private.contact_job_block_reason('ba000000-0000-4000-8000-0000000000f1'), 'job_closed', 'suppressed job never sends');
select throws_ok($$select public.stop_contact(pg_temp.h('stop-unknown'))$$, 'P0001', 'invitation_not_found', 'unknown stop token rejected');

-- Kontak yang berhenti sendiri tidak bisa diundang ulang; pencabutan oleh pengguna bisa.
set local role authenticated;
select pg_temp.as_user('ba000000-0000-4000-8000-00000000000a');
select throws_ok($$select public.invite_emergency_contact('Andi', pg_temp.blob(), pg_temp.h('andi@x.test'), pg_temp.h('inv-andi2'))$$,
  'P0001', 'contact_opted_out', 'opted-out contact cannot be re-invited');
select pg_temp.as_user('ba000000-0000-4000-8000-00000000000d');
select throws_ok(format('select public.revoke_emergency_contact(%L)', (select id from ids where name='budi')),
  'P0001', 'contact_not_found', 'other users cannot revoke');
select pg_temp.as_user('ba000000-0000-4000-8000-00000000000a');
select lives_ok(format('select public.revoke_emergency_contact(%L)', (select id from ids where name='budi')), 'user revokes pending contact');
select is((select count(*) from public.my_emergency_contacts()), 0::bigint, 'revoked contacts hidden from list');
reset role;
select is((select status from public.get_contact_invitation(pg_temp.h('inv-budi'))), 'used', 'pending invitation link dies on revoke');
select is((select actor from public.contact_consents where contact_id=(select id from ids where name='budi')), 'user', 'user revocation receipt');
set local role authenticated;
select pg_temp.as_user('ba000000-0000-4000-8000-00000000000a');
select lives_ok($$select public.invite_emergency_contact('Budi', pg_temp.blob(), pg_temp.h('budi@x.test'), pg_temp.h('inv-budi2'))$$,
  'contact revoked by the user can be invited again');
reset role;

select * from finish();
rollback;
