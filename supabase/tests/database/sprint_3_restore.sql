begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

-- Keadaan "hasil restore": A sudah dihapus setelah backup, B mengajukan setelah backup,
-- C membatalkan setelah backup, D masih menunggu jadwal.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',id::uuid,'authenticated','authenticated',email,now(),'{"provider":"email"}','{}',now(),now()
from (values
  ('b5000000-0000-4000-8000-00000000000a','restore-a@example.test'),
  ('b5000000-0000-4000-8000-00000000000b','restore-b@example.test'),
  ('b5000000-0000-4000-8000-00000000000c','restore-c@example.test'),
  ('b5000000-0000-4000-8000-00000000000d','restore-d@example.test')
) v(id,email);
update public.profiles set name='Synthetic Restore',birth_date='1970-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id::text like 'b5000000-%';
update public.profiles set account_status='deletion_pending'
where user_id in ('b5000000-0000-4000-8000-00000000000a','b5000000-0000-4000-8000-00000000000c','b5000000-0000-4000-8000-00000000000d');
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id::text like 'b5000000-%' and n.consent_type in ('age_and_region','legal_documents','health_data');
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
values ('b5000000-0000-4000-8000-00000000000a',110,'mg/dL',110,'random',now()-interval '1 hour');
insert into public.deletion_requests(user_id,requested_at,scheduled_for,previous_account_status)
values
  ('b5000000-0000-4000-8000-00000000000a',now()-interval '4 days',now()-interval '1 day','active'),
  ('b5000000-0000-4000-8000-00000000000c',now()-interval '1 day',now()+interval '2 days','active'),
  ('b5000000-0000-4000-8000-00000000000d',now()-interval '1 day',now()+interval '2 days','active');
create temp table request_a as
select id from public.deletion_requests where user_id = 'b5000000-0000-4000-8000-00000000000a';
insert into public.notification_jobs(user_id,type,channel,dedupe_key,due_at)
values ('b5000000-0000-4000-8000-00000000000b','reminder','email','uji-restore-b',now()+interval '1 day');

-- Ekspor dari database lama (sebelum restore).
create temp table old_export as select
  jsonb_build_array(jsonb_build_object(
    'subject_hash', encode(extensions.digest('b5000000-0000-4000-8000-00000000000a','sha256'),'hex'),
    'deleted_at', now(), 'backup_expiry_after', now()+interval '8 days')) as tombstones,
  jsonb_build_array(
    jsonb_build_object('user_id','b5000000-0000-4000-8000-00000000000b','requested_at',now()-interval '1 hour',
      'scheduled_for',now()+interval '3 days'-interval '1 hour','previous_account_status','active'),
    jsonb_build_object('user_id','b5000000-0000-4000-8000-00000000000d','requested_at',now()-interval '1 day',
      'scheduled_for',now()+interval '2 days','previous_account_status','active')) as active;

set local role authenticated;
select throws_ok($$select private.reconcile_deletions_after_restore('[]'::jsonb)$$,'42501',null,'users cannot run reconciliation');
reset role;

select is(
  private.reconcile_deletions_after_restore((select tombstones from old_export),(select active from old_export)),
  '{"removed": 1, "reinstated": 1, "cancelled": 1}'::jsonb,
  'reconciliation reports what changed');

select is((select count(*) from auth.users where id='b5000000-0000-4000-8000-00000000000a'),0::bigint,'tombstoned account deleted again');
select is((select count(*) from public.glucose_entries where user_id='b5000000-0000-4000-8000-00000000000a'),0::bigint,'its health data removed');
select is((select count(*) from public.deletion_tombstones where subject_hash=extensions.digest('b5000000-0000-4000-8000-00000000000a','sha256')),1::bigint,'tombstone kept');
select is((select state || ':' || (user_id is null) from public.deletion_requests where id = (select id from request_a)),'completed:true','its request closed as completed');

select is((select state from public.deletion_requests where user_id='b5000000-0000-4000-8000-00000000000b'),'pending','request made after backup reinstated');
select is((select account_status from public.profiles where user_id='b5000000-0000-4000-8000-00000000000b'),'deletion_pending','reinstated account back in grace period');
select is((select state from public.notification_jobs where dedupe_key='uji-restore-b'),'cancelled','reinstated account jobs cancelled');

select is((select state from public.deletion_requests where user_id='b5000000-0000-4000-8000-00000000000c'),'cancelled','request cancelled after backup cancelled again');
select isnt((select account_status from public.profiles where user_id='b5000000-0000-4000-8000-00000000000c'),'deletion_pending','cancelled account leaves grace period');

select is((select state from public.deletion_requests where user_id='b5000000-0000-4000-8000-00000000000d'),'pending','still pending request untouched');

select is(
  private.reconcile_deletions_after_restore((select tombstones from old_export),(select active from old_export)),
  '{"removed": 0, "reinstated": 0, "cancelled": 0}'::jsonb,
  'running again changes nothing');

select * from finish();
rollback;
