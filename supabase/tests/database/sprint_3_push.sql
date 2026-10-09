begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

-- A punya subscription push, D tidak; keduanya email terverifikasi, WIB.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','b8000000-0000-4000-8000-00000000000a','authenticated','authenticated','push-a@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b8000000-0000-4000-8000-00000000000d','authenticated','authenticated','push-d@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Pak Budi',birth_date='1960-01-01',sex='male',timezone_code='WIB',account_status='active'
where user_id::text like 'b8000000-%';
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id::text like 'b8000000-%' and n.consent_type in ('age_and_region','legal_documents','health_data');

create function pg_temp.hash(p text) returns bytea language sql as $$ select extensions.digest(p, 'sha256') $$;

-- Subscription lewat RPC milik pengguna sendiri.
set local role authenticated;
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-00000000000a","role":"authenticated"}';
select ok(public.save_push_subscription(pg_temp.hash('https://push.example/a1'), extensions.gen_random_bytes(64)) is not null, 'user saves own subscription');
select ok(public.save_push_subscription(pg_temp.hash('https://push.example/a1'), extensions.gen_random_bytes(64)) is not null, 'saving same endpoint again is an upsert');
select is((select count(*) from public.push_subscriptions), 1::bigint, 'one row per endpoint, visible to owner');
select throws_ok($$select public.save_push_subscription('\x00'::bytea, '\x00'::bytea)$$, 'P0001', 'invalid_subscription', 'malformed subscription rejected');
select throws_ok($$insert into public.push_subscriptions (user_id, endpoint_hash, subscription_ciphertext)
  values ('b8000000-0000-4000-8000-00000000000a', '\x01', '\x01')$$, '42501', null, 'no direct insert');
select is(public.remove_push_subscription(pg_temp.hash('https://push.example/zz')), false, 'removing unknown endpoint is a no-op');
set local request.jwt.claims to '{"sub":"b8000000-0000-4000-8000-00000000000d","role":"authenticated"}';
select is((select count(*) from public.push_subscriptions), 0::bigint, 'other users cannot see the subscription');
select is(public.remove_push_subscription(pg_temp.hash('https://push.example/a1')), false, 'other users cannot remove it');
reset role;

create temp table occ (name text primary key, schedule_id uuid, occurrence_id uuid);
create function pg_temp.add(p_name text, p_user uuid, p_due interval) returns void language plpgsql as $$
declare s uuid; o uuid;
begin
  insert into public.schedules (user_id, category, title, local_date, local_time, timezone_code, active)
  values (p_user, 'glucose_check', 'Cek ' || p_name, current_date, '08:00', 'WIB', true) returning id into s;
  insert into public.schedule_occurrences (schedule_id, due_at) values (s, now() + p_due) returning id into o;
  insert into occ values (p_name, s, o);
end $$;
create function pg_temp.job(p_name text, p_channel text) returns public.notification_jobs language sql as $$
  select j.* from public.notification_jobs j join occ on occ.occurrence_id = j.occurrence_id
  where occ.name = p_name and j.channel = p_channel $$;

-- Producer memilih kanal: push bila ada subscription aktif, selain itu email.
select pg_temp.add('a-push', 'b8000000-0000-4000-8000-00000000000a', interval '-3 minutes');
select pg_temp.add('d-email', 'b8000000-0000-4000-8000-00000000000d', interval '-3 minutes');
select is(private.enqueue_due_reminders(), 2, 'one job per due occurrence');
select is((pg_temp.job('a-push', 'push')).dedupe_key, 'reminder:push:' || (select occurrence_id from occ where name = 'a-push'), 'subscriber gets push');
select ok((pg_temp.job('a-push', 'email')).id is null, 'subscriber gets no email up front');
select ok((pg_temp.job('d-email', 'email')).id is not null, 'non-subscriber gets email');

-- Subscription dicabut setelah job push dibuat: producer tidak membuat email duplikat.
update public.push_subscriptions set active = false;
select is(private.enqueue_due_reminders(), 0, 'channel change does not add a second job');

-- Saat klaim, push tanpa subscription aktif disuppress dan diteruskan ke email.
select is((select count(*) from public.claim_reminder_jobs('push', 10)), 0::bigint, 'push without subscription not claimed');
select is((select error_class from public.notification_attempts where job_id = (pg_temp.job('a-push', 'push')).id), 'no_subscription', 'suppressed as no_subscription');
select ok((pg_temp.job('a-push', 'email')).id is not null, 'email fallback queued');

-- Push gagal permanen → email fallback; retry push tidak membuat fallback.
update public.push_subscriptions set active = true;
select pg_temp.add('a-fail', 'b8000000-0000-4000-8000-00000000000a', interval '-2 minutes');
select private.enqueue_due_reminders();
select is((select title from public.claim_reminder_jobs('push', 10)), 'Cek a-fail', 'push job claimed with schedule title');
select is(public.complete_reminder_job((pg_temp.job('a-fail', 'push')).id, 'retry', null, 'push_429'), 'queued', 'transient push error requeued');
select ok((pg_temp.job('a-fail', 'email')).id is null, 'no fallback while push may still succeed');
update public.notification_jobs set next_attempt_at = now() - interval '1 second' where id = (pg_temp.job('a-fail', 'push')).id;
select is((select count(*) from public.claim_reminder_jobs('push', 10)), 1::bigint, 'push retried');
select is(public.complete_reminder_job((pg_temp.job('a-fail', 'push')).id, 'failed', null, 'push_gone'), 'failed', 'permanent push failure');
select is((select provider from public.notification_attempts where job_id = (pg_temp.job('a-fail', 'push')).id order by attempted_at desc limit 1),
  'webpush', 'push attempts logged under webpush');
select ok((pg_temp.job('a-fail', 'email')).id is not null, 'failed push falls back to email');

select * from finish();
rollback;
