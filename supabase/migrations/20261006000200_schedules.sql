-- GLB-018 / FR-SCHEDULE-001: jadwal satu kali (tanggal + jam lokal) dan kalender mingguan.
-- Pengulangan mingguan dan status selesai tetap nonaktif sampai BR-PEND-006 diputuskan,
-- jadi setiap jadwal punya tepat satu occurrence yang dibaca dispatcher pengingat (GLB-019).

-- Tabel belum pernah diisi (pengguna hanya punya hak select), jadi kolom wajib aman ditambahkan.
alter table public.schedules
  add column local_date date not null,
  add constraint schedules_medicine_name_check check (char_length(medicine_name) <= 120),
  add constraint schedules_dose_note_check check (char_length(dose_note) <= 200),
  -- Nama obat dan dosis hanya untuk obat dan insulin; tanpa katalog atau saran dosis (BR-OOS-001).
  add constraint schedules_medicine_fields_check check (
    category in ('medicine', 'insulin') or (medicine_name is null and dose_note is null)
  );

create index schedules_user_date_idx on public.schedules (user_id, local_date);
create index schedule_occurrences_due_idx on public.schedule_occurrences (due_at) where state = 'pending';

-- Validasi bersama untuk buat dan ubah. Mengembalikan due_at (UTC) dari tanggal+jam di zona profil.
create or replace function private.schedule_due_at(p_local_date date, p_local_time time, p_zone text)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  due timestamptz := (p_local_date + p_local_time) at time zone case p_zone
    when 'WIB' then 'Asia/Jakarta' when 'WITA' then 'Asia/Makassar' when 'WIT' then 'Asia/Jayapura' end;
begin
  if due is null then raise exception 'timezone_required'; end if;
  if due <= now() then raise exception 'schedule_in_past'; end if;
  if due > now() + interval '366 days' then raise exception 'schedule_too_far'; end if;
  return due;
end;
$$;

create or replace function public.create_schedule(
  p_idempotency_key text,
  p_category text,
  p_title text,
  p_local_date date,
  p_local_time time,
  p_medicine_name text default null,
  p_dose_note text default null
)
returns public.schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  zone text;
  due timestamptz;
  existing_id uuid;
  row public.schedules;
begin
  if not public.user_can_access_health() then raise exception 'health_access_required'; end if;
  insert into private.idempotency_keys (user_id, scope, key)
  values (uid, 'schedule.create', p_idempotency_key)
  on conflict do nothing;
  if not found then
    select resource_id into existing_id from private.idempotency_keys
    where user_id = uid and scope = 'schedule.create' and key = p_idempotency_key;
    select * into row from public.schedules where id = existing_id and user_id = uid;
    if row.id is null then raise exception 'idempotency_conflict'; end if;
    return row;
  end if;

  select timezone_code into zone from public.profiles where user_id = uid;
  due := private.schedule_due_at(p_local_date, p_local_time, zone);
  if (
    select count(*) from public.schedule_occurrences o
    join public.schedules s on s.id = o.schedule_id
    where s.user_id = uid and o.due_at > now()
  ) >= 200 then raise exception 'schedule_limit_reached'; end if;

  insert into public.schedules (user_id, category, title, medicine_name, dose_note, local_date, local_time, timezone_code)
  values (
    uid, p_category, btrim(p_title),
    case when p_category in ('medicine', 'insulin') then nullif(btrim(p_medicine_name), '') end,
    case when p_category in ('medicine', 'insulin') then nullif(btrim(p_dose_note), '') end,
    p_local_date, p_local_time, zone
  ) returning * into row;
  insert into public.schedule_occurrences (schedule_id, due_at) values (row.id, due);
  update private.idempotency_keys set resource_id = row.id
  where user_id = uid and scope = 'schedule.create' and key = p_idempotency_key;
  return row;
end;
$$;

-- Hanya jadwal milik sendiri yang belum lewat. Mengunci baris agar ubah/jeda/hapus tidak bertabrakan.
create or replace function private.own_upcoming_schedule(p_schedule_id uuid)
returns public.schedules
language plpgsql
set search_path = ''
as $$
declare
  row public.schedules;
begin
  if not public.user_can_access_health() then raise exception 'health_access_required'; end if;
  select * into row from public.schedules where id = p_schedule_id and user_id = auth.uid() for update;
  if row.id is null then raise exception 'schedule_not_found'; end if;
  if not exists (
    select 1 from public.schedule_occurrences
    where schedule_id = row.id and state = 'pending' and due_at > now()
  ) then raise exception 'schedule_not_upcoming'; end if;
  return row;
end;
$$;

create or replace function public.update_schedule(
  p_schedule_id uuid,
  p_category text,
  p_title text,
  p_local_date date,
  p_local_time time,
  p_medicine_name text default null,
  p_dose_note text default null
)
returns public.schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.schedules := private.own_upcoming_schedule(p_schedule_id);
  zone text;
  due timestamptz;
begin
  select timezone_code into zone from public.profiles where user_id = auth.uid();
  due := private.schedule_due_at(p_local_date, p_local_time, zone);
  update public.schedules set
    category = p_category,
    title = btrim(p_title),
    medicine_name = case when p_category in ('medicine', 'insulin') then nullif(btrim(p_medicine_name), '') end,
    dose_note = case when p_category in ('medicine', 'insulin') then nullif(btrim(p_dose_note), '') end,
    local_date = p_local_date,
    local_time = p_local_time,
    timezone_code = zone
  where id = row.id
  returning * into row;
  update public.schedule_occurrences set due_at = due where schedule_id = row.id and state = 'pending';
  return row;
end;
$$;

create or replace function public.set_schedule_active(p_schedule_id uuid, p_active boolean)
returns public.schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.schedules := private.own_upcoming_schedule(p_schedule_id);
begin
  update public.schedules set active = p_active where id = row.id returning * into row;
  return row;
end;
$$;

create or replace function public.delete_schedule(p_schedule_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.schedules := private.own_upcoming_schedule(p_schedule_id);
begin
  delete from public.schedules where id = row.id;
end;
$$;

revoke all on function private.schedule_due_at(date, time, text) from public, anon, authenticated;
revoke all on function private.own_upcoming_schedule(uuid) from public, anon, authenticated;
revoke all on function public.create_schedule(text, text, text, date, time, text, text) from public, anon;
revoke all on function public.update_schedule(uuid, text, text, date, time, text, text) from public, anon;
revoke all on function public.set_schedule_active(uuid, boolean) from public, anon;
revoke all on function public.delete_schedule(uuid) from public, anon;
grant execute on function public.create_schedule(text, text, text, date, time, text, text) to authenticated;
grant execute on function public.update_schedule(uuid, text, text, date, time, text, text) to authenticated;
grant execute on function public.set_schedule_active(uuid, boolean) to authenticated;
grant execute on function public.delete_schedule(uuid) to authenticated;

-- Ekspor menyertakan tanggal dan waktu jatuh tempo jadwal (schemaVersion 2).
create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  if not exists (
    select 1 from public.profiles where user_id = uid and account_status <> 'deleted'
  ) then raise exception 'export_not_allowed'; end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'generatedAt', now(),
    'account', (
      select jsonb_build_object(
        'email', u.email,
        'createdAt', u.created_at,
        'name', p.name,
        'birthDate', p.birth_date,
        'sex', p.sex,
        'timezone', p.timezone_code,
        'accountStatus', p.account_status
      )
      from auth.users u join public.profiles p on p.user_id = u.id
      where u.id = uid
    ),
    'glucoseEntries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'originalValue', e.original_value,
        'originalUnit', e.original_unit,
        'valueMgDl', e.normalized_mg_dl,
        'measurementContext', e.measurement_context,
        'measuredAt', e.measured_at,
        'recordedAt', e.recorded_at,
        'note', e.note,
        'status', e.status,
        'invalidatedAt', e.invalidated_at,
        'invalidationReason', e.invalidation_reason,
        'replacementForId', e.replacement_for_id
      ) order by e.measured_at, e.recorded_at)
      from public.glucose_entries e where e.user_id = uid
    ), '[]'::jsonb),
    'schedules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'category', s.category, 'title', s.title,
        'medicineName', s.medicine_name, 'doseNote', s.dose_note,
        'localDate', s.local_date, 'localTime', s.local_time, 'timezone', s.timezone_code,
        'dueAt', (select o.due_at from public.schedule_occurrences o where o.schedule_id = s.id limit 1),
        'recurrenceRule', s.recurrence_rule, 'active', s.active, 'createdAt', s.created_at
      ) order by s.created_at)
      from public.schedules s where s.user_id = uid
    ), '[]'::jsonb),
    -- Email kontak tersimpan terenkripsi; ekspor hanya nama dan status.
    'emergencyContacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', c.name, 'state', c.state, 'createdAt', c.created_at, 'revokedAt', c.revoked_at
      ) order by c.created_at)
      from public.emergency_contacts c where c.user_id = uid
    ), '[]'::jsonb),
    'consentReceipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'type', r.consent_type, 'documentVersion', r.document_version, 'decision', r.decision,
        'method', r.method, 'recordedAt', r.recorded_at, 'withdrawnAt', r.withdrawn_at
      ) order by r.recorded_at)
      from public.consent_receipts r where r.user_id = uid
    ), '[]'::jsonb),
    'cookieConsentReceipts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'noticeVersion', k.notice_version, 'preferences', k.preferences_json,
        'source', k.decision_source, 'recordedAt', k.recorded_at, 'supersededAt', k.superseded_at
      ) order by k.recorded_at)
      from public.cookie_consent_receipts k where k.user_id = uid
    ), '[]'::jsonb),
    'deletionRequests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'requestedAt', d.requested_at, 'scheduledFor', d.scheduled_for,
        'cancelledAt', d.cancelled_at, 'state', d.state
      ) order by d.requested_at)
      from public.deletion_requests d where d.user_id = uid
    ), '[]'::jsonb),
    'previousExports', coalesce((
      select jsonb_agg(x.created_at order by x.created_at)
      from public.data_exports x where x.user_id = uid
    ), '[]'::jsonb)
  ) into result;

  insert into public.data_exports (user_id, state, expires_at)
  values (uid, 'expired', now());
  return result;
end;
$$;

-- Route rate limit jadwal.
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
