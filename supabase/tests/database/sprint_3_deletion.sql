begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','b4000000-0000-4000-8000-000000000001','authenticated','authenticated','hapus-aktif@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b4000000-0000-4000-8000-000000000002','authenticated','authenticated','hapus-nonaktif@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Synthetic Delete',birth_date='1970-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id in ('b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002');
update public.profiles set account_status='suspended' where user_id='b4000000-0000-4000-8000-000000000002';
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id in ('b4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000002') and n.consent_type<>'cookie';
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
values ('b4000000-0000-4000-8000-000000000001',120,'mg/dL',120,'random',now()-interval '1 hour');
insert into public.notification_jobs(user_id,type,channel,dedupe_key,due_at)
values ('b4000000-0000-4000-8000-000000000001','reminder','email','uji-hapus-1',now()+interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.request_account_deletion()$$,'P0001','authentication_required','anonymous cannot request deletion');

-- Pengajuan.
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000001',true);
select is((public.request_account_deletion()->>'scheduledFor')::timestamptz - now(), interval '3 days','scheduled exactly three days after request');
select is((select account_status from public.profiles where user_id='b4000000-0000-4000-8000-000000000001'),'deletion_pending','account enters deletion_pending');
select is((select count(*) from public.glucose_entries),0::bigint,'health data closed during grace period');
select is(jsonb_array_length(public.export_my_data()->'glucoseEntries'),1,'export still available during grace period');
select is(public.get_my_deletion_request()->>'state','pending','owner can read own pending request');
select throws_ok($$select public.request_account_deletion()$$,'P0001','deletion_not_allowed','cannot request twice');
reset role;
select is((select state from public.notification_jobs where dedupe_key='uji-hapus-1'),'cancelled','queued jobs are cancelled');
set local role authenticated;
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000001',true);

-- Pembatalan: kembali aktif, job lama tidak dihidupkan lagi.
select is(public.cancel_account_deletion(),'active','cancellation restores active status');
reset role;
select is((select state from public.notification_jobs where dedupe_key='uji-hapus-1'),'cancelled','old jobs stay cancelled after cancellation');
set local role authenticated;
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.cancel_account_deletion()$$,'P0001','no_pending_deletion','nothing to cancel twice');

-- Akun nonaktif boleh mengajukan; pembatalan tidak mengaktifkannya.
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000002',true);
select ok(public.request_account_deletion() ? 'scheduledFor','suspended account can request deletion');
select is(public.cancel_account_deletion(),'suspended','cancellation keeps admin suspension');

-- Eksekusi setelah tenggat.
select set_config('request.jwt.claim.sub','b4000000-0000-4000-8000-000000000001',true);
select ok(public.request_account_deletion() ? 'id','owner requests again');
reset role;
update public.deletion_requests set requested_at = now() - interval '4 days', scheduled_for = now() - interval '1 day'
where user_id = 'b4000000-0000-4000-8000-000000000001' and state = 'pending';
select is(private.execute_due_deletions(),1,'one due account executed');
select is((select count(*) from auth.users where id='b4000000-0000-4000-8000-000000000001'),0::bigint,'auth user removed');
select is((select count(*) from public.glucose_entries where user_id='b4000000-0000-4000-8000-000000000001'),0::bigint,'health data removed by cascade');
select is((select count(*) from public.deletion_tombstones where subject_hash = extensions.digest('b4000000-0000-4000-8000-000000000001','sha256')),1::bigint,'tombstone created');
select is((select state from public.deletion_requests where executed_at is not null and user_id is null),'completed','request kept as anonymous completed record');
select is(private.execute_due_deletions(),0,'running again is idempotent');
select is((select count(*) from public.consent_receipts where user_id='b4000000-0000-4000-8000-000000000001'),0::bigint,'consent receipts removed with account');

-- Di luar eksekusi, tabel append-only tetap menolak penghapusan.
select throws_ok($$delete from public.consent_receipts where user_id='b4000000-0000-4000-8000-000000000002'$$,'55000','append_only_record','receipts stay append-only outside deletion');

select * from finish();
rollback;
