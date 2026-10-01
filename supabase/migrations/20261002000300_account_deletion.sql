-- GLB-024 / FR-DELETE-001, FR-DELETE-002: penghapusan akun dengan masa jeda 3 hari.
-- Eksekusi menghapus baris auth.users; semua data aktif ikut terhapus lewat cascade.

-- Catatan permintaan tetap ada sebagai bukti tanpa identitas setelah akun dihapus.
alter table public.deletion_requests
  alter column user_id drop not null,
  drop constraint deletion_requests_user_id_fkey,
  add constraint deletion_requests_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete set null,
  -- Status sebelum pengajuan: pembatalan tidak boleh mengaktifkan akun yang dinonaktifkan admin.
  add column previous_account_status text,
  -- Kode SQLSTATE bila eksekusi gagal (tanpa data pribadi), untuk pemantauan admin.
  add column failure_code text;

-- Tabel append-only (bukti persetujuan, catatan gula darah, dll.) menolak hapus/ubah.
-- Pengecualian satu-satunya: eksekusi penghapusan akun yang menyalakan penanda
-- transaksi `glubee.account_deletion`. Pengguna tidak punya hak DELETE pada tabel ini
-- dan tidak dapat menjalankan SQL bebas, jadi penanda ini tidak bisa disalahgunakan.
create or replace function private.prevent_receipt_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('glubee.account_deletion', true) = 'on' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception using errcode = '55000', message = 'append_only_record';
end;
$$;

create or replace function private.protect_glucose_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('glubee.account_deletion', true) = 'on' then
    return old;
  end if;
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

create or replace function public.request_account_deletion()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  current_status text;
  req public.deletion_requests;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select account_status into current_status from public.profiles where user_id = uid for update;
  -- Hak penghapusan berlaku juga untuk akun yang dinonaktifkan admin (UU PDP).
  if current_status is null or current_status not in ('active', 'onboarding', 'suspended') then
    raise exception 'deletion_not_allowed';
  end if;

  insert into public.deletion_requests (user_id, requested_at, scheduled_for, previous_account_status)
  values (uid, now(), now() + interval '3 days', current_status)
  returning * into req;
  update public.profiles set account_status = 'deletion_pending' where user_id = uid;
  -- Hentikan pengingat dan notifikasi yang belum terkirim; tidak dikirim ulang bila dibatalkan.
  update public.notification_jobs set state = 'cancelled'
  where user_id = uid and state = 'queued';

  return jsonb_build_object('id', req.id, 'requestedAt', req.requested_at, 'scheduledFor', req.scheduled_for);
end;
$$;

create or replace function public.cancel_account_deletion()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  req public.deletion_requests;
  restored text;
begin
  if uid is null then raise exception 'authentication_required'; end if;
  select * into req from public.deletion_requests
  where user_id = uid and state = 'pending' for update;
  if not found then raise exception 'no_pending_deletion'; end if;
  if req.scheduled_for <= now() then raise exception 'deletion_window_closed'; end if;

  update public.deletion_requests set state = 'cancelled', cancelled_at = now() where id = req.id;
  restored := case
    when req.previous_account_status = 'suspended' then 'suspended'
    when private.health_requirements_met(uid) then 'active'
    else 'onboarding'
  end;
  update public.profiles set account_status = restored where user_id = uid;
  return restored;
end;
$$;

-- Dibaca halaman Status akun; RLS biasa tidak berlaku untuk akun yang belum lengkap.
create or replace function public.get_my_deletion_request()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', id, 'requestedAt', requested_at, 'scheduledFor', scheduled_for, 'state', state)
  from public.deletion_requests
  where user_id = auth.uid() and state in ('pending', 'executing', 'failed')
  order by requested_at desc
  limit 1;
$$;

create or replace function private.execute_due_deletions(p_limit integer default 50)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  req record;
  done integer := 0;
begin
  for req in
    select id, user_id from public.deletion_requests
    where state in ('pending', 'failed') and scheduled_for <= now() and user_id is not null
    order by scheduled_for
    limit p_limit
    for update skip locked
  loop
    begin
      perform set_config('glubee.account_deletion', 'on', true);
      update public.deletion_requests set state = 'executing', failure_code = null where id = req.id;
      -- Tombstone tanpa data kesehatan: mencegah akun hidup kembali saat restore backup.
      -- Backup harian disimpan 7 versi, jadi semua salinan kedaluwarsa setelah 8 hari.
      insert into public.deletion_tombstones (subject_hash, deleted_at, backup_expiry_after)
      values (extensions.digest(req.user_id::text, 'sha256'), now(), now() + interval '8 days')
      on conflict (subject_hash) do update
        set deleted_at = excluded.deleted_at, backup_expiry_after = excluded.backup_expiry_after;
      delete from auth.users where id = req.user_id;
      update public.deletion_requests set state = 'completed', executed_at = now() where id = req.id;
      perform set_config('glubee.account_deletion', 'off', true);
      done := done + 1;
    exception when others then
      perform set_config('glubee.account_deletion', 'off', true);
      update public.deletion_requests set state = 'failed', failure_code = sqlstate where id = req.id;
    end;
  end loop;
  return done;
end;
$$;

-- Admin diberi tahu tanpa hak veto: hanya daftar baca.
create or replace function public.admin_deletion_requests()
returns table (
  email text,
  requested_at timestamptz,
  scheduled_for timestamptz,
  state text,
  failure_code text,
  cancelled_at timestamptz,
  executed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then raise exception 'admin_required'; end if;
  return query
    select u.email::text, d.requested_at, d.scheduled_for, d.state, d.failure_code, d.cancelled_at, d.executed_at
    from public.deletion_requests d
    left join auth.users u on u.id = d.user_id
    where d.state in ('pending', 'executing', 'failed')
      or d.requested_at > now() - interval '30 days'
    order by d.requested_at desc
    limit 50;
end;
$$;

revoke all on function public.request_account_deletion() from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.get_my_deletion_request() from public, anon;
revoke all on function private.execute_due_deletions(integer) from public, anon, authenticated;
revoke all on function public.admin_deletion_requests() from public, anon;
grant execute on function public.request_account_deletion() to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.get_my_deletion_request() to authenticated;
grant execute on function public.admin_deletion_requests() to authenticated;

-- Jalankan eksekusi setiap 15 menit di dalam database (pg_cron sudah dimuat image supabase/postgres).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('glubee-execute-deletions', '*/15 * * * *', 'select private.execute_due_deletions()');
