begin;
select plan(19);
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000001','authenticated','authenticated','sprint2-owner@example.test',now(),'{"provider":"email"}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-4000-8000-000000000002','authenticated','authenticated','sprint2-other@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Synthetic Sprint 2',birth_date='1990-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002');
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id in ('91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002') and n.consent_type<>'cookie';
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
select '91000000-0000-4000-8000-000000000001',90,'mg/dL',90,'random',now()-interval '2 days'+i*interval '1 second' from generate_series(1,1100)i;

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is(jsonb_array_length(public.get_my_glucose_range(now()-interval '3 days',now())->'entries'),1100,'range is not truncated at 1000');
select public.invalidate_glucose_entry((select id from public.glucose_entries limit 1),'s2-invalidate','synthetic');
select is(jsonb_array_length(public.get_my_glucose_range(now()-interval '3 days',now())->'entries'),1099,'invalid records excluded from report data');
select is(jsonb_array_length(public.get_my_glucose_range(now()-interval '10 days',now()-interval '9 days')->'entries'),0,'empty report is empty');
select throws_ok($$select public.get_my_glucose_range(now(),now()-interval '1 day')$$,'P0001','invalid_range','invalid ranges rejected');
select is((select count(*) from generate_series(1,6) i where public.consume_report_rate_limit()),5::bigint,'report rate capped at five');
select throws_ok($$select public.record_cookie_preference('92000000-0000-4000-8000-000000000001','reject')$$,'42501','permission denied for function record_cookie_preference','cookie writer not exposed to authenticated clients');

select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select is(jsonb_array_length(public.get_my_glucose_range(now()-interval '3 days',now())->'entries'),0,'other user cannot see owner report data');
select set_config('request.jwt.claims','{"app_metadata":{"app_role":"admin"}}',true);
select is(jsonb_array_length(public.get_my_glucose_range(now()-interval '3 days',now())->'entries'),0,'admin cannot see owner report data');

reset role;
insert into public.glucose_entries(user_id,original_value,original_unit,normalized_mg_dl,measurement_context,measured_at)
select '91000000-0000-4000-8000-000000000001',90,'mg/dL',90,'random',now()-interval '1 day'+i*interval '1 second' from generate_series(1,4000)i;
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000001',true);
select is(public.get_my_glucose_range(now()-interval '3 days',now())->>'tooLarge','true','large ranges rejected instead of partial report');
reset role;
update public.profiles set account_status='suspended' where user_id='91000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.get_my_glucose_range(now()-interval '3 days',now())$$,'P0001','health_access_required','suspended account cannot generate report');

reset role;
set local role anon;
select throws_ok($$select public.get_my_glucose_range(now()-interval '3 days',now())$$,'42501','permission denied for function get_my_glucose_range','anon cannot generate report');
reset role;
select lives_ok($$select public.record_cookie_preference('92000000-0000-4000-8000-000000000001','reject')$$,'service can record cookie rejection');
select is((select preferences_json->>'analytics' from public.cookie_consent_receipts where anonymous_subject_id='92000000-0000-4000-8000-000000000001'),'false','analytics stays off');
select lives_ok($$select public.record_cookie_preference('92000000-0000-4000-8000-000000000001','withdraw')$$,'withdrawal adds receipt');
select is((select count(*) from public.cookie_consent_receipts where anonymous_subject_id='92000000-0000-4000-8000-000000000001'),2::bigint,'cookie decisions append only');
select throws_ok($$update public.cookie_consent_receipts set decision_source='accept_all' where anonymous_subject_id='92000000-0000-4000-8000-000000000001'$$,'55000','append_only_record','receipt cannot be overwritten');
select is((select document_version from public.notice_versions where consent_type='legal_documents'),'CNT-LEGAL-001@0.2-draft-2026-09-15','new legal consent version active');
select public.create_registration_intent('93000000-0000-4000-8000-000000000001','sprint2-other@example.test','1990-01-01');
update public.notice_versions set document_version='synthetic-newer-notice' where consent_type='legal_documents';
set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-4000-8000-000000000002',true);
select public.consume_registration_intent('93000000-0000-4000-8000-000000000001');
select is((select document_version from public.consent_receipts where user_id=auth.uid() and consent_type='legal_documents' and method='email_registration'),'CNT-LEGAL-001@0.2-draft-2026-09-15','email confirmation preserves notice shown at registration');
select is(public.user_can_access_health(),false,'new legal version needs explicit consent, not retroactive acceptance');
select * from finish();
rollback;
