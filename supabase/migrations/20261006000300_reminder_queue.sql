-- GLB-019 / FR-REMINDER-001, SRS §9: antrean pengingat jadwal.
-- Producer di database (pg_cron tiap menit), pengiriman di app lewat endpoint internal
-- yang mengklaim job secara atomik dengan lease. Kanal GLB-019: email saja; push dan
-- dashboard menyusul di GLB-020.

alter table public.notification_jobs
  add column occurrence_id uuid references public.schedule_occurrences(id) on delete cascade,
  -- Kapan job boleh dicoba lagi (retry dengan jeda); null = sejak due_at.
  add column next_attempt_at timestamptz,
  -- Batas klaim worker; job processing yang lewat batas dianggap worker mati dan diklaim ulang.
  add column lease_until timestamptz;

create index notification_jobs_ready_idx on public.notification_jobs (channel, coalesce(next_attempt_at, due_at))
  where state in ('queued', 'processing');

-- Producer: satu job email per occurrence yang jatuh tempo (dedupe_key unik).
-- Jendela 2 jam: pengingat yang jauh terlambat tidak berguna lagi.
create or replace function private.enqueue_due_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  created integer;
begin
  insert into public.notification_jobs (user_id, type, channel, dedupe_key, due_at, next_attempt_at, occurrence_id)
  select s.user_id, 'schedule_reminder', 'email', 'reminder:email:' || o.id, o.due_at, o.due_at, o.id
  from public.schedule_occurrences o
  join public.schedules s on s.id = o.schedule_id
  join public.profiles p on p.user_id = s.user_id
  join auth.users u on u.id = s.user_id
  where o.state = 'pending'
    and o.due_at <= now()
    and o.due_at > now() - interval '2 hours'
    and s.active
    and p.account_status = 'active'
    and u.email_confirmed_at is not null
  on conflict (dedupe_key) do nothing;
  get diagnostics created = row_count;
  return created;
end;
$$;

-- Klaim batch untuk worker. Job yang tidak lagi boleh dikirim langsung ditutup di sini
-- (cek ulang tepat sebelum kirim), dengan jejak di notification_attempts.
create or replace function public.claim_reminder_jobs(
  p_limit integer default 10,
  p_lease_seconds integer default 300,
  p_daily_cap integer default 150
)
returns table (
  job_id uuid,
  attempt integer,
  email text,
  recipient_name text,
  title text,
  local_date date,
  local_time time,
  timezone_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  reason text;
  sent_today integer;
begin
  select count(*) into sent_today
  from public.notification_attempts a
  join public.notification_jobs j on j.id = a.job_id
  where j.channel = 'email' and j.type = 'schedule_reminder' and a.outcome = 'sent'
    and a.attempted_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta');

  for r in
    select j.id, j.attempt_count, j.due_at, j.state,
           u.email, u.email_confirmed_at, p.account_status, p.name,
           s.id as schedule_id, s.active, s.title, s.local_date, s.local_time, s.timezone_code
    from public.notification_jobs j
    join auth.users u on u.id = j.user_id
    join public.profiles p on p.user_id = j.user_id
    left join public.schedule_occurrences o on o.id = j.occurrence_id
    left join public.schedules s on s.id = o.schedule_id
    where j.channel = 'email' and j.type = 'schedule_reminder'
      and (
        (j.state = 'queued' and coalesce(j.next_attempt_at, j.due_at) <= now())
        or (j.state = 'processing' and j.lease_until < now())
      )
    order by j.due_at
    limit greatest(p_limit, 0)
    for update of j skip locked
  loop
    reason := case
      when r.state = 'processing' and r.attempt_count >= 3 then 'max_attempts'
      when r.account_status <> 'active' then 'account_inactive'
      when r.email_confirmed_at is null then 'email_unverified'
      when r.schedule_id is null then 'schedule_missing'
      when not r.active then 'schedule_paused'
      when r.due_at < now() - interval '2 hours' then 'stale'
      when sent_today >= p_daily_cap then 'quota_exceeded'
    end;

    if reason = 'max_attempts' then
      -- Worker mati berulang kali di tengah pengiriman: berhenti, jangan kirim ganda.
      insert into public.notification_attempts (job_id, provider, outcome, error_class)
      values (r.id, 'glubee', 'failed', reason);
      update public.notification_jobs set state = 'failed', lease_until = null, updated_at = now() where id = r.id;
    elsif reason is not null then
      insert into public.notification_attempts (job_id, provider, outcome, error_class)
      values (r.id, 'glubee', 'suppressed', reason);
      update public.notification_jobs set state = 'suppressed', lease_until = null, updated_at = now() where id = r.id;
    else
      update public.notification_jobs
      set state = 'processing',
          attempt_count = attempt_count + 1,
          lease_until = now() + make_interval(secs => p_lease_seconds),
          updated_at = now()
      where id = r.id;
      -- Kuota dihitung terhadap klaim, agar satu batch tidak melewati batas harian.
      sent_today := sent_today + 1;
      job_id := r.id;
      attempt := r.attempt_count + 1;
      email := r.email;
      recipient_name := r.name;
      title := r.title;
      local_date := r.local_date;
      local_time := r.local_time;
      timezone_code := r.timezone_code;
      return next;
    end if;
  end loop;
end;
$$;

-- Hasil pengiriman dari worker. 'retry' = error sementara: dicoba lagi dengan jeda 1, 2, 4 menit
-- sampai 3 percobaan. Hanya job yang masih diklaim (processing) yang bisa diselesaikan.
create or replace function public.complete_reminder_job(
  p_job_id uuid,
  p_result text,
  p_provider_message_id text default null,
  p_error_class text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.notification_jobs;
  next_state text;
begin
  if p_result not in ('sent', 'retry', 'failed') then raise exception 'invalid_result'; end if;
  select * into job from public.notification_jobs where id = p_job_id for update;
  if job.id is null or job.state <> 'processing' then raise exception 'job_not_processing'; end if;

  insert into public.notification_attempts (job_id, provider, provider_message_id, outcome, error_class)
  values (
    job.id, 'brevo', left(p_provider_message_id, 200),
    case when p_result = 'sent' then 'sent' else 'failed' end,
    left(p_error_class, 60)
  );

  next_state := case
    when p_result = 'sent' then 'sent'
    when p_result = 'retry' and job.attempt_count < 3 then 'queued'
    else 'failed'
  end;
  update public.notification_jobs
  set state = next_state,
      lease_until = null,
      next_attempt_at = case when next_state = 'queued'
        then now() + make_interval(mins => power(2, job.attempt_count - 1)::integer) end,
      updated_at = now()
  where id = job.id;
  return next_state;
end;
$$;

revoke all on function private.enqueue_due_reminders() from public, anon, authenticated;
revoke all on function public.claim_reminder_jobs(integer, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_reminder_job(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.claim_reminder_jobs(integer, integer, integer) to service_role;
grant execute on function public.complete_reminder_job(uuid, text, text, text) to service_role;

select cron.schedule('glubee-enqueue-reminders', '* * * * *', 'select private.enqueue_due_reminders()');
