-- GLB-023: keputusan pemilik produk 1 Okt 2026 mengikuti UU PDP (hak akses subjek data):
-- akun yang dinonaktifkan admin tetap boleh mengekspor datanya sendiri.
-- Hanya akun yang sudah dihapus yang ditolak.
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
