begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

-- Job lain di database lokal (data demo/e2e) tidak boleh ikut terklaim; dibatalkan dalam transaksi ini saja.
update public.notification_jobs set state = 'cancelled' where state in ('queued', 'processing');

-- A aktif, B nonaktif admin, C email belum terverifikasi; semua WIB.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','b7000000-0000-4000-8000-00000000000a','authenticated','authenticated','ingat-a@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b7000000-0000-4000-8000-00000000000b','authenticated','authenticated','ingat-b@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b7000000-0000-4000-8000-00000000000c','authenticated','authenticated','ingat-c@example.test',null,'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Bu Ani',birth_date='1960-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id::text like 'b7000000-%';
update public.profiles set account_status='suspended' where user_id='b7000000-0000-4000-8000-00000000000b';

-- Jadwal + occurrence langsung (fungsi pembuat jadwal menolak waktu lampau).
create temp table occ (name text primary key, schedule_id uuid, occurrence_id uuid);
create function pg_temp.add(p_name text, p_user uuid, p_due interval, p_active boolean default true) returns void language plpgsql as $$
declare s uuid; o uuid;
begin
  insert into public.schedules (user_id, category, title, local_date, local_time, timezone_code, active)
  values (p_user, 'medicine', 'Obat ' || p_name, current_date, '08:00', 'WIB', p_active) returning id into s;
  insert into public.schedule_occurrences (schedule_id, due_at) values (s, now() + p_due) returning id into o;
  insert into occ values (p_name, s, o);
end $$;
select pg_temp.add('due', 'b7000000-0000-4000-8000-00000000000a', interval '-5 minutes');
select pg_temp.add('due2', 'b7000000-0000-4000-8000-00000000000a', interval '-1 minute');
select pg_temp.add('future', 'b7000000-0000-4000-8000-00000000000a', interval '1 hour');
select pg_temp.add('old', 'b7000000-0000-4000-8000-00000000000a', interval '-3 hours');
select pg_temp.add('paused', 'b7000000-0000-4000-8000-00000000000a', interval '-5 minutes', false);
select pg_temp.add('suspended', 'b7000000-0000-4000-8000-00000000000b', interval '-5 minutes');
select pg_temp.add('unverified', 'b7000000-0000-4000-8000-00000000000c', interval '-5 minutes');
create function pg_temp.job(p_name text) returns public.notification_jobs language sql as $$
  select j.* from public.notification_jobs j join occ on occ.occurrence_id = j.occurrence_id where occ.name = p_name $$;

-- Producer.
select is(private.enqueue_due_reminders(), 2, 'only due, active, verified, unpaused reminders enqueued');
select is(private.enqueue_due_reminders(), 0, 'running again creates no duplicates');
select is((pg_temp.job('due')).dedupe_key, 'reminder:email:' || (select occurrence_id from occ where name='due'), 'dedupe key per occurrence and channel');
select is((select count(*) from public.notification_jobs j join occ on occ.occurrence_id=j.occurrence_id
  where occ.name in ('future','old','paused','suspended','unverified')), 0::bigint, 'future, stale, paused, suspended, unverified skipped');

-- Endpoint memakai service role; pengguna biasa tidak bisa mengklaim.
set local role authenticated;
select throws_ok($$select * from public.claim_reminder_jobs('email')$$, '42501', null, 'users cannot claim jobs');
reset role;

-- Klaim atomik dengan lease.
create temp table claimed as select * from public.claim_reminder_jobs('email', 1);
select is((select count(*) from claimed), 1::bigint, 'batch limit respected');
select is((select email from claimed), 'ingat-a@example.test', 'claim carries recipient');
select is((pg_temp.job('due')).state, 'processing', 'oldest due job claimed first');
select is((select count(*) from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('due')).id), 0::bigint,
  'leased job not claimed twice');

-- Retry terbatas dengan jeda.
select is(public.complete_reminder_job((pg_temp.job('due')).id, 'retry', null, 'ETIMEDOUT'), 'queued', 'transient error requeued');
select ok((pg_temp.job('due')).next_attempt_at between now() + interval '50 seconds' and now() + interval '70 seconds', 'first retry after one minute');
select is((select count(*) from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('due')).id), 0::bigint,
  'not retried before its time');
update public.notification_jobs set next_attempt_at = now() - interval '1 second' where id = (pg_temp.job('due')).id;
select is((select attempt from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('due')).id), 2, 'second attempt claimed');
select is(public.complete_reminder_job((pg_temp.job('due')).id, 'sent', 'msg-1'), 'sent', 'sent recorded');
select is((select array_agg(outcome order by attempted_at) from public.notification_attempts where job_id = (pg_temp.job('due')).id),
  array['failed','sent'], 'every attempt logged');
select throws_ok(format('select public.complete_reminder_job(%L, ''sent'')', (pg_temp.job('due')).id),
  'P0001', 'job_not_processing', 'finished job cannot be completed again');
select is(public.complete_reminder_job((pg_temp.job('due2')).id, 'failed', null, 'smtp_550'), 'failed', 'permanent error fails without retry');

-- Worker mati: lease habis diklaim ulang, setelah 3 percobaan berhenti.
select pg_temp.add('crash', 'b7000000-0000-4000-8000-00000000000a', interval '-2 minutes');
select private.enqueue_due_reminders();
select is((select count(*) from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('crash')).id), 1::bigint, 'crash job claimed');
update public.notification_jobs set lease_until = now() - interval '1 second' where id = (pg_temp.job('crash')).id;
select is((select attempt from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('crash')).id), 2, 'expired lease reclaimed');
update public.notification_jobs set lease_until = now() - interval '1 second', attempt_count = 3 where id = (pg_temp.job('crash')).id;
select is((select count(*) from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('crash')).id), 0::bigint, 'no fourth attempt');
select is((pg_temp.job('crash')).state, 'failed', 'crash loop ends as failed');

-- Cek ulang sebelum kirim: jadwal dijeda atau akun dinonaktifkan setelah job dibuat.
select pg_temp.add('pause-later', 'b7000000-0000-4000-8000-00000000000a', interval '-2 minutes');
select private.enqueue_due_reminders();
update public.schedules set active = false where id = (select schedule_id from occ where name = 'pause-later');
select is((select count(*) from public.claim_reminder_jobs('email', 10) c where c.job_id = (pg_temp.job('pause-later')).id), 0::bigint, 'paused schedule not sent');
select is((select error_class from public.notification_attempts where job_id = (pg_temp.job('pause-later')).id), 'schedule_paused', 'suppressed with reason');
select is((pg_temp.job('pause-later')).state, 'suppressed', 'job state suppressed');
select pg_temp.add('suspend-later', 'b7000000-0000-4000-8000-00000000000a', interval '-2 minutes');
select private.enqueue_due_reminders();
update public.profiles set account_status = 'suspended' where user_id = 'b7000000-0000-4000-8000-00000000000a';
select is((select count(*) from public.claim_reminder_jobs('email', 10)), 0::bigint, 'inactive account not sent');
select is((select error_class from public.notification_attempts where job_id = (pg_temp.job('suspend-later')).id), 'account_inactive', 'suppressed as inactive');
update public.profiles set account_status = 'active' where user_id = 'b7000000-0000-4000-8000-00000000000a';

-- Kuota harian: satu email sudah terkirim hari ini, batas 1.
select pg_temp.add('quota', 'b7000000-0000-4000-8000-00000000000a', interval '-2 minutes');
select private.enqueue_due_reminders();
select is((select count(*) from public.claim_reminder_jobs('email', 10, 300, 1)), 0::bigint, 'nothing claimed over the daily cap');
select is((select error_class from public.notification_attempts where job_id = (pg_temp.job('quota')).id), 'quota_exceeded', 'suppressed by quota');

select * from finish();
rollback;
