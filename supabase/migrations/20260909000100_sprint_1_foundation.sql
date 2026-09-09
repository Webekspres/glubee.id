create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.notice_versions (
  consent_type text primary key,
  document_version text not null unique,
  is_active boolean not null default true,
  is_draft boolean not null default true,
  created_at timestamptz not null default now(),
  constraint notice_versions_type_check check (
    consent_type in ('age_and_region', 'legal_documents', 'health_data', 'cookie')
  )
);

insert into public.notice_versions (consent_type, document_version)
values
  ('age_and_region', 'CNT-AGE-001@0.1-draft-2026-09-09'),
  ('legal_documents', 'CNT-LEGAL-001@0.1-draft-2026-09-09'),
  ('health_data', 'CNT-HEALTH-001@0.1-draft-2026-09-09'),
  ('cookie', 'CNT-COOKIE-001@0.1-draft-2026-09-09');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  birth_date date,
  sex text,
  timezone_code text,
  account_status text not null default 'onboarding',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_check check (name is null or char_length(btrim(name)) between 1 and 120),
  constraint profiles_sex_check check (sex is null or sex in ('female', 'male')),
  constraint profiles_timezone_check check (timezone_code is null or timezone_code in ('WIB', 'WITA', 'WIT')),
  constraint profiles_status_check check (
    account_status in ('onboarding', 'active', 'suspended', 'deletion_pending', 'deleted')
  )
);

create table public.consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_type text not null,
  document_version text not null,
  decision text not null,
  recorded_at timestamptz not null default now(),
  method text not null,
  locale text not null default 'id-ID',
  withdrawn_at timestamptz,
  constraint consent_type_check check (
    consent_type in ('age_and_region', 'legal_documents', 'health_data')
  ),
  constraint consent_decision_check check (decision in ('accept', 'decline', 'withdraw')),
  constraint consent_method_check check (char_length(method) between 1 and 80),
  constraint consent_withdrawn_check check (
    (decision = 'withdraw' and withdrawn_at is not null)
    or (decision <> 'withdraw' and withdrawn_at is null)
  )
);

create index consent_receipts_latest_idx
  on public.consent_receipts (user_id, consent_type, recorded_at desc, id desc);

create table public.glucose_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_value numeric(10,3) not null,
  original_unit text not null,
  normalized_mg_dl numeric(10,3) not null,
  measurement_context text not null,
  measured_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  note text,
  status text not null default 'valid',
  invalidated_at timestamptz,
  invalidation_reason text,
  replacement_for_id uuid references public.glucose_entries(id) on delete restrict,
  constraint glucose_value_check check (original_value > 0),
  constraint glucose_normalized_check check (normalized_mg_dl > 0),
  constraint glucose_unit_check check (original_unit in ('mg/dL', 'mmol/L')),
  constraint glucose_context_check check (
    measurement_context in ('fasting', 'before_meal', 'after_meal', 'random', 'other')
  ),
  constraint glucose_note_check check (note is null or char_length(note) <= 1000),
  constraint glucose_status_check check (status in ('valid', 'invalid')),
  constraint glucose_invalidation_check check (
    (status = 'valid' and invalidated_at is null and invalidation_reason is null)
    or (status = 'invalid' and invalidated_at is not null)
  )
);

create index glucose_entries_history_idx
  on public.glucose_entries (user_id, measured_at desc, id desc);
create index glucose_entries_valid_idx
  on public.glucose_entries (user_id, measured_at desc, id desc)
  where status = 'valid';
create unique index glucose_entries_one_replacement_idx
  on public.glucose_entries (replacement_for_id)
  where replacement_for_id is not null;

create table public.evaluation_results (
  entry_id uuid primary key references public.glucose_entries(id) on delete restrict,
  rule_version text not null,
  result_code text not null,
  evaluated_at timestamptz not null default now()
);
comment on table public.evaluation_results is
  'Feature-gated storage only. No evaluation is produced while BR-PEND-001..004 remain unresolved.';

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  medicine_name text,
  dose_note text,
  local_time time not null,
  timezone_code text not null,
  recurrence_rule text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_category_check check (category in ('glucose_check', 'medicine', 'insulin', 'other')),
  constraint schedules_title_check check (char_length(btrim(title)) between 1 and 120),
  constraint schedules_timezone_check check (timezone_code in ('WIB', 'WITA', 'WIT')),
  constraint schedules_pending_recurrence_check check (recurrence_rule is null)
);
comment on column public.schedules.recurrence_rule is
  'Must remain null until BR-PEND-006 is approved.';

create table public.schedule_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  due_at timestamptz not null,
  state text not null default 'pending',
  completed_at timestamptz,
  constraint schedule_occurrences_state_check check (state in ('pending', 'done', 'missed', 'cancelled')),
  constraint schedule_occurrences_unique unique (schedule_id, due_at)
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email_ciphertext bytea not null,
  email_hash bytea not null,
  state text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint emergency_contacts_name_check check (char_length(btrim(name)) between 1 and 120),
  constraint emergency_contacts_state_check check (state in ('pending', 'active', 'declined', 'expired', 'revoked')),
  constraint emergency_contacts_email_unique unique (user_id, email_hash)
);

create table public.contact_consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.emergency_contacts(id) on delete cascade,
  notice_version text not null,
  decision text not null,
  decided_at timestamptz not null default now(),
  token_hash bytea not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint contact_consents_decision_check check (decision in ('accept', 'decline', 'revoke'))
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash bytea not null,
  subscription_ciphertext bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_unique unique (user_id, endpoint_hash)
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.emergency_contacts(id) on delete cascade,
  type text not null,
  channel text not null,
  dedupe_key text not null unique,
  due_at timestamptz not null,
  state text not null default 'queued',
  attempt_count integer not null default 0,
  payload_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_jobs_channel_check check (channel in ('dashboard', 'push', 'email')),
  constraint notification_jobs_state_check check (state in ('queued', 'processing', 'sent', 'failed', 'suppressed', 'cancelled')),
  constraint notification_jobs_attempt_check check (attempt_count >= 0)
);

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.notification_jobs(id) on delete cascade,
  provider text not null,
  provider_message_id text,
  outcome text not null,
  error_class text,
  attempted_at timestamptz not null default now(),
  constraint notification_attempts_outcome_check check (outcome in ('sent', 'failed', 'suppressed'))
);

create table public.cookie_consent_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_subject_id uuid,
  notice_version text not null,
  preferences_json jsonb not null,
  decision_source text not null,
  recorded_at timestamptz not null default now(),
  superseded_at timestamptz,
  constraint cookie_subject_check check (num_nonnulls(user_id, anonymous_subject_id) = 1),
  constraint cookie_preferences_check check (
    preferences_json ? 'essential'
    and preferences_json ? 'analytics'
    and preferences_json ? 'marketing'
    and preferences_json->>'essential' = 'true'
  )
);

create table public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  cancelled_at timestamptz,
  executed_at timestamptz,
  state text not null default 'pending',
  constraint deletion_requests_state_check check (state in ('pending', 'cancelled', 'executing', 'completed', 'failed')),
  constraint deletion_requests_schedule_check check (scheduled_for >= requested_at + interval '7 days')
);
create unique index deletion_requests_one_active_idx
  on public.deletion_requests (user_id)
  where state in ('pending', 'executing', 'failed');

create table public.deletion_tombstones (
  subject_hash bytea primary key,
  deleted_at timestamptz not null,
  backup_expiry_after timestamptz not null
);

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  reason text not null,
  old_state text,
  new_state text,
  occurred_at timestamptz not null default now(),
  correlation_id uuid not null,
  constraint admin_audit_action_check check (char_length(action) between 1 and 80),
  constraint admin_audit_reason_check check (char_length(reason) between 1 and 500)
);

create table public.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'queued',
  expires_at timestamptz,
  object_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_exports_state_check check (state in ('queued', 'processing', 'ready', 'failed', 'expired'))
);

create table private.registration_intents (
  nonce uuid primary key,
  email_hash bytea not null,
  birth_date date not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  consumed_at timestamptz
);

create table private.idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null,
  key text not null,
  resource_id uuid,
  created_at timestamptz not null default now(),
  primary key (user_id, scope, key),
  constraint idempotency_key_length_check check (char_length(key) between 8 and 200)
);

create table private.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  window_started_at timestamptz not null,
  request_count integer not null,
  primary key (user_id, route)
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger schedules_set_updated_at before update on public.schedules
for each row execute function private.set_updated_at();
create trigger emergency_contacts_set_updated_at before update on public.emergency_contacts
for each row execute function private.set_updated_at();
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions
for each row execute function private.set_updated_at();
create trigger notification_jobs_set_updated_at before update on public.notification_jobs
for each row execute function private.set_updated_at();
create trigger data_exports_set_updated_at before update on public.data_exports
for each row execute function private.set_updated_at();

create or replace function private.validate_adult_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null and new.birth_date > (
    timezone(case new.timezone_code
      when 'WITA' then 'Asia/Makassar'
      when 'WIT' then 'Asia/Jayapura'
      else 'Asia/Jakarta'
    end, now())::date - interval '18 years'
  )::date then
    raise exception using errcode = '23514', message = 'profile_requires_adult';
  end if;
  return new;
end;
$$;
create trigger profiles_validate_adult before insert or update of birth_date on public.profiles
for each row execute function private.validate_adult_profile();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, nullif(btrim(new.raw_user_meta_data->>'name'), ''))
  on conflict (user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.prevent_receipt_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = '55000', message = 'append_only_record';
end;
$$;
create trigger consent_receipts_append_only before update or delete on public.consent_receipts
for each row execute function private.prevent_receipt_changes();
create trigger contact_consents_append_only before update or delete on public.contact_consents
for each row execute function private.prevent_receipt_changes();
create trigger notification_attempts_append_only before update or delete on public.notification_attempts
for each row execute function private.prevent_receipt_changes();

create or replace function private.protect_glucose_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception using errcode = '55000', message = 'glucose_entry_append_only';
  end if;
  if old.user_id <> new.user_id
    or old.original_value <> new.original_value
    or old.original_unit <> new.original_unit
    or old.normalized_mg_dl <> new.normalized_mg_dl
    or old.measurement_context <> new.measurement_context
    or old.measured_at <> new.measured_at
    or old.recorded_at <> new.recorded_at
    or old.note is distinct from new.note
    or old.replacement_for_id is distinct from new.replacement_for_id
    or old.status <> 'valid'
    or new.status <> 'invalid'
    or new.invalidated_at is null then
    raise exception using errcode = '55000', message = 'glucose_entry_append_only';
  end if;
  return new;
end;
$$;
create trigger glucose_entries_append_only before update or delete on public.glucose_entries
for each row execute function private.protect_glucose_entry();

create or replace function private.validate_glucose_replacement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  original public.glucose_entries;
begin
  if new.measured_at > now() + interval '5 minutes' then
    raise exception using errcode = '22007', message = 'measurement_time_in_future';
  end if;
  if new.replacement_for_id is not null then
    select * into original from public.glucose_entries where id = new.replacement_for_id;
    if original.id is null or original.user_id <> new.user_id or original.status <> 'invalid' then
      raise exception using errcode = '23514', message = 'invalid_replacement_target';
    end if;
  end if;
  return new;
end;
$$;
create trigger glucose_entries_validate before insert on public.glucose_entries
for each row execute function private.validate_glucose_replacement();

create or replace function private.enforce_contact_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  active_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if new.state in ('pending', 'active') then
    select count(*) into active_count
    from public.emergency_contacts
    where user_id = new.user_id
      and state in ('pending', 'active')
      and id <> new.id;
    if active_count >= 2 then
      raise exception using errcode = '23514', message = 'emergency_contact_limit_reached';
    end if;
  end if;
  return new;
end;
$$;
create trigger emergency_contacts_limit before insert or update of state, user_id
on public.emergency_contacts for each row execute function private.enforce_contact_limit();

create or replace function private.latest_consent_is_accept(p_user_id uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select receipt.decision = 'accept' and receipt.document_version = version.document_version
    from public.consent_receipts receipt
    join public.notice_versions version
      on version.consent_type = receipt.consent_type and version.is_active
    where receipt.user_id = p_user_id and receipt.consent_type = p_type
    order by receipt.recorded_at desc, receipt.id desc
    limit 1
  ), false);
$$;

create or replace function private.health_requirements_met(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.profiles p on p.user_id = u.id
    where u.id = p_user_id
      and u.email_confirmed_at is not null
      and p.name is not null
      and p.birth_date is not null
      and p.birth_date <= (
        timezone(case p.timezone_code
          when 'WITA' then 'Asia/Makassar'
          when 'WIT' then 'Asia/Jayapura'
          else 'Asia/Jakarta'
        end, now())::date - interval '18 years'
      )::date
      and p.sex is not null
      and p.timezone_code is not null
      and private.latest_consent_is_accept(p_user_id, 'age_and_region')
      and private.latest_consent_is_accept(p_user_id, 'legal_documents')
      and private.latest_consent_is_accept(p_user_id, 'health_data')
  );
$$;

create or replace function public.user_can_access_health()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_requirements_met(auth.uid())
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and account_status = 'active'
    );
$$;
revoke all on function public.user_can_access_health() from public;
grant execute on function public.user_can_access_health() to authenticated;

create or replace function public.user_can_access_limited_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.health_requirements_met(auth.uid())
    and exists (
      select 1 from public.profiles
      where user_id = auth.uid() and account_status in ('active', 'deletion_pending')
    );
$$;
revoke all on function public.user_can_access_limited_account() from public;
grant execute on function public.user_can_access_limited_account() to authenticated;

create or replace function public.refresh_my_account_status()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select account_status into next_status from public.profiles where user_id = auth.uid() for update;
  if next_status in ('suspended', 'deletion_pending', 'deleted') then return next_status; end if;
  next_status := case when private.health_requirements_met(auth.uid()) then 'active' else 'onboarding' end;
  update public.profiles set account_status = next_status where user_id = auth.uid();
  return next_status;
end;
$$;
revoke all on function public.refresh_my_account_status() from public;
grant execute on function public.refresh_my_account_status() to authenticated;

create or replace function public.create_registration_intent(
  p_nonce uuid,
  p_email text,
  p_birth_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_birth_date > (timezone('Asia/Jakarta', now())::date - interval '18 years')::date then
    raise exception using errcode = '23514', message = 'registration_requires_adult';
  end if;
  insert into private.registration_intents (nonce, email_hash, birth_date)
  values (p_nonce, extensions.digest(lower(btrim(p_email)), 'sha256'), p_birth_date);
end;
$$;
revoke all on function public.create_registration_intent(uuid, text, date) from public, anon, authenticated;
grant execute on function public.create_registration_intent(uuid, text, date) to service_role;

create or replace function public.consume_registration_intent(p_nonce uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  intent private.registration_intents;
  current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select email into current_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  if current_email is null then raise exception 'verified_email_required'; end if;

  select * into intent
  from private.registration_intents
  where nonce = p_nonce
    and consumed_at is null
    and expires_at > now()
    and email_hash = extensions.digest(lower(btrim(current_email)), 'sha256')
  for update;
  if intent.nonce is null then raise exception 'invalid_registration_intent'; end if;

  update public.profiles set birth_date = intent.birth_date where user_id = auth.uid();
  insert into public.consent_receipts (user_id, consent_type, document_version, decision, method)
  select auth.uid(), consent_type, document_version, 'accept', 'email_registration'
  from public.notice_versions
  where is_active and consent_type in ('age_and_region', 'legal_documents', 'health_data');
  update private.registration_intents set consumed_at = now() where nonce = p_nonce;
  perform public.refresh_my_account_status();
end;
$$;
revoke all on function public.consume_registration_intent(uuid) from public, anon;
grant execute on function public.consume_registration_intent(uuid) to authenticated;

create or replace function public.record_consent(p_type text, p_decision text, p_method text)
returns public.consent_receipts
language plpgsql
security definer
set search_path = ''
as $$
declare
  version text;
  receipt public.consent_receipts;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if p_decision not in ('accept', 'decline', 'withdraw') then raise exception 'invalid_consent_decision'; end if;
  if char_length(p_method) not between 1 and 80 then raise exception 'invalid_consent_method'; end if;
  select document_version into version
  from public.notice_versions where consent_type = p_type and is_active;
  if version is null or p_type = 'cookie' then raise exception 'invalid_consent_type'; end if;
  insert into public.consent_receipts (
    user_id, consent_type, document_version, decision, method, withdrawn_at
  ) values (
    auth.uid(), p_type, version, p_decision, p_method,
    case when p_decision = 'withdraw' then now() else null end
  ) returning * into receipt;
  perform public.refresh_my_account_status();
  return receipt;
end;
$$;
revoke all on function public.record_consent(text, text, text) from public, anon;
grant execute on function public.record_consent(text, text, text) to authenticated;

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
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

create or replace function public.create_glucose_entry(
  p_idempotency_key text,
  p_original_value numeric,
  p_original_unit text,
  p_measurement_context text,
  p_measured_at timestamptz,
  p_note text default null,
  p_replacement_for_id uuid default null
)
returns public.glucose_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  entry public.glucose_entries;
begin
  if not public.user_can_access_health() then raise exception 'health_access_required'; end if;
  insert into private.idempotency_keys (user_id, scope, key)
  values (auth.uid(), 'glucose.create', p_idempotency_key)
  on conflict do nothing;
  if not found then
    select resource_id into existing_id from private.idempotency_keys
    where user_id = auth.uid() and scope = 'glucose.create' and key = p_idempotency_key;
    select * into entry from public.glucose_entries where id = existing_id and user_id = auth.uid();
    if entry.id is null then raise exception 'idempotency_conflict'; end if;
    return entry;
  end if;

  insert into public.glucose_entries (
    user_id, original_value, original_unit, normalized_mg_dl,
    measurement_context, measured_at, note, replacement_for_id
  ) values (
    auth.uid(), p_original_value, p_original_unit,
    case when p_original_unit = 'mg/dL' then p_original_value else round(p_original_value * 18.0, 3) end,
    p_measurement_context, p_measured_at, nullif(btrim(p_note), ''), p_replacement_for_id
  ) returning * into entry;
  update private.idempotency_keys set resource_id = entry.id
  where user_id = auth.uid() and scope = 'glucose.create' and key = p_idempotency_key;
  return entry;
end;
$$;
revoke all on function public.create_glucose_entry(text, numeric, text, text, timestamptz, text, uuid) from public, anon;
grant execute on function public.create_glucose_entry(text, numeric, text, text, timestamptz, text, uuid) to authenticated;

create or replace function public.invalidate_glucose_entry(
  p_entry_id uuid,
  p_idempotency_key text,
  p_reason text default null
)
returns public.glucose_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  entry public.glucose_entries;
begin
  if not public.user_can_access_health() then raise exception 'health_access_required'; end if;
  insert into private.idempotency_keys (user_id, scope, key)
  values (auth.uid(), 'glucose.invalidate', p_idempotency_key)
  on conflict do nothing;
  if not found then
    select resource_id into existing_id from private.idempotency_keys
    where user_id = auth.uid() and scope = 'glucose.invalidate' and key = p_idempotency_key;
    select * into entry from public.glucose_entries where id = existing_id and user_id = auth.uid();
    if entry.id is null then raise exception 'idempotency_conflict'; end if;
    return entry;
  end if;
  update public.glucose_entries
  set status = 'invalid', invalidated_at = now(), invalidation_reason = nullif(left(btrim(p_reason), 500), '')
  where id = p_entry_id and user_id = auth.uid() and status = 'valid'
  returning * into entry;
  if entry.id is null then raise exception 'glucose_entry_not_found_or_invalid'; end if;
  update private.idempotency_keys set resource_id = entry.id
  where user_id = auth.uid() and scope = 'glucose.invalidate' and key = p_idempotency_key;
  return entry;
end;
$$;
revoke all on function public.invalidate_glucose_entry(uuid, text, text) from public, anon;
grant execute on function public.invalidate_glucose_entry(uuid, text, text) to authenticated;

alter table public.notice_versions enable row level security;
alter table public.profiles enable row level security;
alter table public.consent_receipts enable row level security;
alter table public.glucose_entries enable row level security;
alter table public.evaluation_results enable row level security;
alter table public.schedules enable row level security;
alter table public.schedule_occurrences enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.contact_consents enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.notification_attempts enable row level security;
alter table public.cookie_consent_receipts enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.deletion_tombstones enable row level security;
alter table public.admin_audit_events enable row level security;
alter table public.data_exports enable row level security;

create policy notice_versions_read on public.notice_versions for select to anon, authenticated using (true);
create policy profiles_select_own on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = auth.uid() and account_status in ('onboarding', 'active'))
  with check (user_id = auth.uid() and account_status in ('onboarding', 'active'));
create policy consent_receipts_select_own on public.consent_receipts for select to authenticated using (user_id = auth.uid());
create policy glucose_entries_select_own on public.glucose_entries for select to authenticated
  using (user_id = auth.uid() and public.user_can_access_health());
create policy evaluations_select_own on public.evaluation_results for select to authenticated
  using (exists (
    select 1 from public.glucose_entries e
    where e.id = entry_id and e.user_id = auth.uid() and public.user_can_access_health()
  ));
create policy schedules_owner_all on public.schedules for all to authenticated
  using (user_id = auth.uid() and public.user_can_access_health())
  with check (user_id = auth.uid() and public.user_can_access_health());
create policy schedule_occurrences_owner_all on public.schedule_occurrences for all to authenticated
  using (public.user_can_access_health() and exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()))
  with check (public.user_can_access_health() and exists (select 1 from public.schedules s where s.id = schedule_id and s.user_id = auth.uid()));
create policy emergency_contacts_owner_all on public.emergency_contacts for all to authenticated
  using (user_id = auth.uid() and public.user_can_access_health())
  with check (user_id = auth.uid() and public.user_can_access_health());
create policy contact_consents_owner_read on public.contact_consents for select to authenticated
  using (public.user_can_access_health() and exists (select 1 from public.emergency_contacts c where c.id = contact_id and c.user_id = auth.uid()));
create policy push_subscriptions_owner_all on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid() and public.user_can_access_health())
  with check (user_id = auth.uid() and public.user_can_access_health());
create policy notification_jobs_owner_read on public.notification_jobs for select to authenticated
  using (user_id = auth.uid() and public.user_can_access_health());
create policy notification_attempts_owner_read on public.notification_attempts for select to authenticated
  using (public.user_can_access_health() and exists (select 1 from public.notification_jobs j where j.id = job_id and j.user_id = auth.uid()));
create policy cookie_receipts_owner_read on public.cookie_consent_receipts for select to authenticated using (user_id = auth.uid());
create policy deletion_requests_owner_read on public.deletion_requests for select to authenticated
  using (user_id = auth.uid() and public.user_can_access_limited_account());
create policy data_exports_owner_read on public.data_exports for select to authenticated
  using (user_id = auth.uid() and public.user_can_access_limited_account());

revoke all on all tables in schema public from anon, authenticated;
grant select on public.notice_versions to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (name, birth_date, sex, timezone_code) on public.profiles to authenticated;
grant select on public.consent_receipts, public.glucose_entries, public.evaluation_results to authenticated;
grant select on public.schedules, public.schedule_occurrences, public.emergency_contacts, public.push_subscriptions to authenticated;
grant select on public.contact_consents, public.notification_jobs, public.notification_attempts, public.cookie_consent_receipts to authenticated;
grant select on public.deletion_requests, public.data_exports to authenticated;

revoke all on all tables in schema public from public;
revoke all on all sequences in schema public from public, anon, authenticated;
