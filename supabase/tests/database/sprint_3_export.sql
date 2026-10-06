begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','a3000000-0000-4000-8000-000000000001','authenticated','authenticated','ekspor-pemilik@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','a3000000-0000-4000-8000-000000000002','authenticated','authenticated','ekspor-lain@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Synthetic Export',birth_date='1970-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id in ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002');
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id in ('a3000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000002') and n.consent_type<>'cookie';
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at,note)
select 'a3000000-0000-4000-8000-000000000001',100+i,'mg/dL',100+i,'fasting',now()-interval '1 day'+i*interval '1 minute','catatan '||i from generate_series(1,3)i;
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
values ('a3000000-0000-4000-8000-000000000002',250,'mg/dL',250,'random',now()-interval '1 hour');

set local role authenticated;

-- Anonim ditolak.
select set_config('request.jwt.claim.sub','',true);
select throws_ok($$select public.export_my_data()$$,'P0001','authentication_required','anonymous cannot export');

-- Pemilik.
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
select is(jsonb_array_length(public.export_my_data()->'glucoseEntries'),3,'owner exports own entries');
select is(public.export_my_data()->'account'->>'email','ekspor-pemilik@example.test','export includes own account email');
select ok(not (public.export_my_data()::text like '%ekspor-lain%'),'export never includes another user');
select ok(not (public.export_my_data()::text like '%250%'),'export excludes other user health values');
select is(jsonb_array_length(public.export_my_data()->'consentReceipts'),3,'consent receipts included');
select is(public.export_my_data()->>'schemaVersion','2','schema version present');
select is((select count(*) from public.data_exports where user_id='a3000000-0000-4000-8000-000000000001'),6::bigint,'each export is recorded');
select is((select count(*) from public.data_exports where user_id='a3000000-0000-4000-8000-000000000001' and object_ref is not null),0::bigint,'no stored file reference');

-- Masa jeda penghapusan: tetap boleh ekspor walau RLS kesehatan tertutup.
reset role;
update public.profiles set account_status='deletion_pending' where user_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
select is((select count(*) from public.glucose_entries),0::bigint,'RLS hides health data during grace period');
select is(jsonb_array_length(public.export_my_data()->'glucoseEntries'),3,'export still works during grace period');

-- Dinonaktifkan admin: tetap boleh (UU PDP, keputusan 1 Okt 2026).
reset role;
update public.profiles set account_status='suspended' where user_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
select is(jsonb_array_length(public.export_my_data()->'glucoseEntries'),3,'suspended account can still export own data');

-- Sudah dihapus: ditolak.
reset role;
update public.profiles set account_status='deleted' where user_id='a3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','a3000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.export_my_data()$$,'P0001','export_not_allowed','deleted account cannot export');

select * from finish();
rollback;
