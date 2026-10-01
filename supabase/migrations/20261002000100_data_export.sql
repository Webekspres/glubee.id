-- GLB-023 / FR-EXPORT-001: ekspor data milik pengguna sendiri sebagai JSON.
-- Lewat security definer karena RLS data kesehatan hanya untuk akun 'active',
-- sedangkan ekspor wajib tersedia selama masa jeda penghapusan (deletion_pending).
-- Tidak ada file yang disimpan: isi dikirim langsung, hanya jejaknya dicatat.

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
  if not public.user_can_access_limited_account() then raise exception 'export_not_allowed'; end if;

  select jsonb_build_object(
    'schemaVersion', 1,
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
        'localTime', s.local_time, 'timezone', s.timezone_code,
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

revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Tambah route ekspor ke daftar rate limit yang diizinkan.
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
