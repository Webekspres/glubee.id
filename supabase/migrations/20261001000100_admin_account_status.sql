-- GLB-025 / FR-ADMIN-001: admin melihat dan mengubah status akun dengan alasan tercatat.
-- Admin ditandai lewat app_metadata.app_role = 'admin' (hanya bisa diset service role).
-- Fungsi di sini tidak pernah membaca nilai gula darah, laporan, catatan, atau kontak.

create or replace function private.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'app_role', '') = 'admin';
$$;

create or replace function public.admin_search_accounts(p_query text)
returns table (
  user_id uuid,
  email text,
  email_confirmed boolean,
  account_status text,
  is_admin boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if char_length(coalesce(trim(p_query), '')) < 3 then raise exception 'query_too_short'; end if;
  return query
    select u.id, u.email::text, u.email_confirmed_at is not null,
      coalesce(p.account_status, 'onboarding'),
      coalesce(u.raw_app_meta_data ->> 'app_role', '') = 'admin',
      u.created_at
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where u.email ilike '%' || replace(replace(trim(p_query), '%', '\%'), '_', '\_') || '%'
    order by u.created_at desc
    limit 20;
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_reason text,
  p_correlation_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_status text;
  new_status text;
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_change_own_account'; end if;
  if p_status not in ('suspended', 'active') then raise exception 'invalid_status'; end if;
  if char_length(coalesce(trim(p_reason), '')) not between 5 and 500 then raise exception 'reason_required'; end if;

  select account_status into old_status from public.profiles where user_id = p_user_id for update;
  if old_status is null then raise exception 'profile_not_found'; end if;
  if old_status in ('deletion_pending', 'deleted') then raise exception 'status_locked'; end if;

  if p_status = 'suspended' then
    if old_status = 'suspended' then raise exception 'no_change'; end if;
    new_status := 'suspended';
  else
    if old_status <> 'suspended' then raise exception 'no_change'; end if;
    -- Aktifkan kembali ke status yang sesuai kelengkapan akun, bukan langsung 'active'.
    new_status := case when private.health_requirements_met(p_user_id) then 'active' else 'onboarding' end;
  end if;

  update public.profiles set account_status = new_status where user_id = p_user_id;
  insert into public.admin_audit_events (actor_id, subject_user_id, action, reason, old_state, new_state, correlation_id)
  values (auth.uid(), p_user_id, 'set_account_status', trim(p_reason), old_status, new_status, p_correlation_id);
  return new_status;
end;
$$;

create or replace function public.admin_recent_audit()
returns table (
  occurred_at timestamptz,
  action text,
  reason text,
  old_state text,
  new_state text,
  actor_email text,
  subject_email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  return query
    select e.occurred_at, e.action, e.reason, e.old_state, e.new_state,
      a.email::text, s.email::text
    from public.admin_audit_events e
    left join auth.users a on a.id = e.actor_id
    left join auth.users s on s.id = e.subject_user_id
    order by e.occurred_at desc
    limit 30;
end;
$$;

-- Dipanggil server (service role) setelah membuat akun demo terverifikasi.
create or replace function public.admin_record_event(
  p_actor_id uuid,
  p_subject_user_id uuid,
  p_action text,
  p_reason text,
  p_correlation_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit_events (actor_id, subject_user_id, action, reason, correlation_id)
  values (p_actor_id, p_subject_user_id, p_action, p_reason, p_correlation_id);
$$;

revoke all on function private.is_admin() from public;
revoke all on function public.admin_search_accounts(text) from public, anon;
revoke all on function public.admin_set_account_status(uuid, text, text, uuid) from public, anon;
revoke all on function public.admin_recent_audit() from public, anon;
revoke all on function public.admin_record_event(uuid, uuid, text, text, uuid) from public, anon, authenticated;

grant execute on function public.admin_search_accounts(text) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text, uuid) to authenticated;
grant execute on function public.admin_recent_audit() to authenticated;
grant execute on function public.admin_record_event(uuid, uuid, text, text, uuid) to service_role;

-- Tambah route admin ke daftar rate limit yang diizinkan.
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
