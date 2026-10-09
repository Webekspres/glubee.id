-- GLB-020 / FR-REMINDER-001, SRS §9: browser push dengan email sebagai fallback.
-- Per occurrence hanya satu pengingat: push bila pengguna punya subscription aktif, selain itu
-- email. Push yang tidak bisa terkirim (subscription hilang/ditolak, gagal permanen, retry habis)
-- membuat satu job email fallback. Pengingat dashboard dibaca langsung dari schedule_occurrences.
-- Subscription dienkripsi di aplikasi (AES-256-GCM); database hanya menyimpan ciphertext + HMAC endpoint.

-- Subscription milik pengguna sendiri, maksimal 10 aktif (perangkat/browser) per akun.
create or replace function public.save_push_subscription(p_endpoint_hash bytea, p_ciphertext bytea)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null or not public.user_can_access_health() then raise exception 'not_allowed'; end if;
  if octet_length(p_endpoint_hash) <> 32 or octet_length(p_ciphertext) not between 29 and 8192 then
    raise exception 'invalid_subscription';
  end if;
  insert into public.push_subscriptions (user_id, endpoint_hash, subscription_ciphertext, active)
  values (uid, p_endpoint_hash, p_ciphertext, true)
  on conflict (user_id, endpoint_hash)
  do update set subscription_ciphertext = excluded.subscription_ciphertext, active = true, updated_at = now()
  returning id into sid;
  if (select count(*) from public.push_subscriptions where user_id = uid and active) > 10 then
    raise exception 'too_many_subscriptions';
  end if;
  return sid;
end;
$$;

create or replace function public.remove_push_subscription(p_endpoint_hash bytea)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  update public.push_subscriptions set active = false, updated_at = now()
  where user_id = auth.uid() and endpoint_hash = p_endpoint_hash and active;
  return found;
end;
$$;

-- Email fallback untuk satu occurrence (idempotent lewat dedupe_key).
create or replace function private.enqueue_email_fallback(p_user_id uuid, p_occurrence_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notification_jobs (user_id, type, channel, dedupe_key, due_at, next_attempt_at, occurrence_id)
  select p_user_id, 'schedule_reminder', 'email', 'reminder:email:' || p_occurrence_id, o.due_at, now(), o.id
  from public.schedule_occurrences o
  where o.id = p_occurrence_id
  on conflict (dedupe_key) do nothing;
$$;

-- Producer: satu job per occurrence, kanal dipilih saat jatuh tempo.
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
  select s.user_id, 'schedule_reminder', c.channel, 'reminder:' || c.channel || ':' || o.id, o.due_at, o.due_at, o.id
  from public.schedule_occurrences o
  join public.schedules s on s.id = o.schedule_id
  join public.profiles p on p.user_id = s.user_id
  join auth.users u on u.id = s.user_id
  cross join lateral (
    select case when exists (
      select 1 from public.push_subscriptions ps where ps.user_id = s.user_id and ps.active
    ) then 'push' else 'email' end as channel
  ) c
  where o.state = 'pending'
    and o.due_at <= now()
    and o.due_at > now() - interval '2 hours'
    and s.active
    and p.account_status = 'active'
    and (c.channel = 'push' or u.email_confirmed_at is not null)
    -- Kanal bisa berubah antar menit (subscription dicabut); occurrence tetap satu pengingat.
    and not exists (
      select 1 from public.notification_jobs j
      where j.occurrence_id = o.id and j.type = 'schedule_reminder'
    )
  on conflict (dedupe_key) do nothing;
  get diagnostics created = row_count;
  return created;
end;
$$;

drop function public.claim_reminder_jobs(integer, integer, integer);

-- Klaim batch per kanal. Kuota harian hanya untuk email (Brevo); push tidak berbayar.
create or replace function public.claim_reminder_jobs(
  p_channel text,
  p_limit integer default 10,
  p_lease_seconds integer default 300,
  p_daily_cap integer default 150
)
returns table (
  job_id uuid,
  attempt integer,
  user_id uuid,
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
  sent_today integer := 0;
begin
  if p_channel not in ('push', 'email') then raise exception 'invalid_channel'; end if;

  if p_channel = 'email' then
    select count(*) into sent_today
    from public.notification_attempts a
    join public.notification_jobs j on j.id = a.job_id
    where j.channel = 'email' and j.type = 'schedule_reminder' and a.outcome = 'sent'
      and a.attempted_at >= (date_trunc('day', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta');
  end if;

  for r in
    select j.id, j.user_id, j.occurrence_id, j.attempt_count, j.due_at, j.state,
           u.email, u.email_confirmed_at, p.account_status, p.name,
           s.id as schedule_id, s.active, s.title, s.local_date, s.local_time, s.timezone_code,
           exists (
             select 1 from public.push_subscriptions ps where ps.user_id = j.user_id and ps.active
           ) as has_push
    from public.notification_jobs j
    join auth.users u on u.id = j.user_id
    join public.profiles p on p.user_id = j.user_id
    left join public.schedule_occurrences o on o.id = j.occurrence_id
    left join public.schedules s on s.id = o.schedule_id
    where j.channel = p_channel and j.type = 'schedule_reminder'
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
      when r.schedule_id is null then 'schedule_missing'
      when not r.active then 'schedule_paused'
      when r.due_at < now() - interval '2 hours' then 'stale'
      when p_channel = 'push' and not r.has_push then 'no_subscription'
      when p_channel = 'email' and r.email_confirmed_at is null then 'email_unverified'
      when p_channel = 'email' and sent_today >= p_daily_cap then 'quota_exceeded'
    end;

    if reason = 'max_attempts' then
      -- Worker mati berulang kali di tengah pengiriman: berhenti, jangan kirim ganda.
      insert into public.notification_attempts (job_id, provider, outcome, error_class)
      values (r.id, 'glubee', 'failed', reason);
      update public.notification_jobs set state = 'failed', lease_until = null, updated_at = now() where id = r.id;
      if p_channel = 'push' then perform private.enqueue_email_fallback(r.user_id, r.occurrence_id); end if;
    elsif reason is not null then
      insert into public.notification_attempts (job_id, provider, outcome, error_class)
      values (r.id, 'glubee', 'suppressed', reason);
      update public.notification_jobs set state = 'suppressed', lease_until = null, updated_at = now() where id = r.id;
      if reason = 'no_subscription' then perform private.enqueue_email_fallback(r.user_id, r.occurrence_id); end if;
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
      user_id := r.user_id;
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
-- sampai 3 percobaan. Push yang akhirnya gagal diteruskan ke email fallback.
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
    job.id, case when job.channel = 'push' then 'webpush' else 'brevo' end, left(p_provider_message_id, 200),
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
  if next_state = 'failed' and job.channel = 'push' then
    perform private.enqueue_email_fallback(job.user_id, job.occurrence_id);
  end if;
  return next_state;
end;
$$;

revoke all on function public.save_push_subscription(bytea, bytea) from public, anon;
revoke all on function public.remove_push_subscription(bytea) from public, anon;
grant execute on function public.save_push_subscription(bytea, bytea) to authenticated;
grant execute on function public.remove_push_subscription(bytea) to authenticated;
revoke all on function private.enqueue_email_fallback(uuid, uuid) from public, anon, authenticated;
revoke all on function public.claim_reminder_jobs(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_reminder_jobs(text, integer, integer, integer) to service_role;

-- Batas permintaan untuk /api/push-subscriptions (POST/DELETE).
create or replace function public.consume_rate_limit(
  p_route text,
  p_limit integer default 60,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if auth.uid() is null then return false; end if;
  if p_window_seconds <> 60 or p_limit <> (case p_route
    when 'consents' then 20
    when 'profile' then 20
    when 'glucose.create' then 30
    when 'glucose.invalidate' then 30
    when 'glucose.replacement' then 30
    when 'glucose.history' then 120
    when 'glucose.summary' then 120
    when 'admin.search' then 60
    when 'admin.status' then 30
    when 'admin.demo' then 5
    when 'account.export' then 5
    when 'account.deletion' then 5
    when 'schedule.write' then 30
    when 'schedule.read' then 120
    when 'push.write' then 20
    else -1
  end) then
    raise exception 'invalid_rate_limit_configuration';
  end if;
  insert into private.api_rate_limits (user_id, route, window_started_at, request_count)
  values (auth.uid(), left(p_route, 120), now(), 1)
  on conflict (user_id, route) do update
    set window_started_at = case
          when private.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then now() else private.api_rate_limits.window_started_at end,
        request_count = case
          when private.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
          then 1 else private.api_rate_limits.request_count + 1 end
  returning request_count <= p_limit into allowed;
  return allowed;
end;
$$;
