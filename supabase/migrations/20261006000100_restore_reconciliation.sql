-- GLB-024 / GLB-028, SRS §10.2: rekonsiliasi penghapusan akun setelah restore backup.
-- Backup lama masih memuat akun yang sudah dihapus dan permintaan yang sudah dibatalkan.
-- Fungsi ini dijalankan admin lewat psql tepat setelah restore (deploy/README.md, Restore).
--
--   p_tombstones       ekspor deletion_tombstones dari database sebelum restore:
--                      [{"subject_hash":"<hex>","deleted_at":"...","backup_expiry_after":"..."}]
--   p_active_requests  ekspor permintaan aktif (pending/failed) dari database sebelum restore:
--                      [{"user_id":"...","requested_at":"...","scheduled_for":"...","previous_account_status":"..."}]
--                      null bila database lama tidak bisa dibaca; sinkronisasi permintaan dilewati.
create or replace function private.reconcile_deletions_after_restore(
  p_tombstones jsonb,
  p_active_requests jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer := 0;
  reinstated integer := 0;
  cancelled integer := 0;
  r record;
begin
  perform set_config('glubee.account_deletion', 'on', true);

  insert into public.deletion_tombstones (subject_hash, deleted_at, backup_expiry_after)
  select decode(t->>'subject_hash', 'hex'), (t->>'deleted_at')::timestamptz, (t->>'backup_expiry_after')::timestamptz
  from jsonb_array_elements(coalesce(p_tombstones, '[]'::jsonb)) t
  on conflict (subject_hash) do update
    set deleted_at = greatest(public.deletion_tombstones.deleted_at, excluded.deleted_at),
        backup_expiry_after = greatest(public.deletion_tombstones.backup_expiry_after, excluded.backup_expiry_after);

  -- Akun yang sudah dihapus sebelum restore dihapus lagi; permintaannya ditutup sebagai selesai.
  update public.deletion_requests d set state = 'completed', executed_at = coalesce(d.executed_at, now())
  from public.deletion_tombstones t
  where t.subject_hash = extensions.digest(d.user_id::text, 'sha256')
    and d.state in ('pending', 'executing', 'failed');
  delete from auth.users u
  using public.deletion_tombstones t
  where t.subject_hash = extensions.digest(u.id::text, 'sha256');
  get diagnostics removed = row_count;

  if p_active_requests is not null then
    -- Diajukan setelah backup dibuat: pasang lagi dengan jadwal aslinya.
    for r in
      select (a->>'user_id')::uuid as user_id, (a->>'requested_at')::timestamptz as requested_at,
             (a->>'scheduled_for')::timestamptz as scheduled_for, a->>'previous_account_status' as previous_status
      from jsonb_array_elements(p_active_requests) a
    loop
      continue when not exists (select 1 from auth.users where id = r.user_id);
      continue when exists (
        select 1 from public.deletion_requests
        where user_id = r.user_id and state in ('pending', 'executing', 'failed')
      );
      insert into public.deletion_requests (user_id, requested_at, scheduled_for, previous_account_status)
      values (r.user_id, r.requested_at, r.scheduled_for, r.previous_status);
      update public.profiles set account_status = 'deletion_pending' where user_id = r.user_id;
      update public.notification_jobs set state = 'cancelled' where user_id = r.user_id and state = 'queued';
      reinstated := reinstated + 1;
    end loop;

    -- Dibatalkan setelah backup dibuat: batalkan lagi agar akun tidak terhapus tanpa kehendak pemiliknya.
    for r in
      select d.id, d.user_id, d.previous_account_status
      from public.deletion_requests d
      where d.state in ('pending', 'failed') and d.user_id is not null
        and not exists (
          select 1 from jsonb_array_elements(p_active_requests) a where (a->>'user_id')::uuid = d.user_id
        )
    loop
      update public.deletion_requests set state = 'cancelled', cancelled_at = now() where id = r.id;
      update public.profiles set account_status = case
        when r.previous_account_status = 'suspended' then 'suspended'
        when private.health_requirements_met(r.user_id) then 'active'
        else 'onboarding'
      end
      where user_id = r.user_id;
      cancelled := cancelled + 1;
    end loop;
  end if;

  perform set_config('glubee.account_deletion', 'off', true);
  return jsonb_build_object('removed', removed, 'reinstated', reinstated, 'cancelled', cancelled);
end;
$$;

revoke all on function private.reconcile_deletions_after_restore(jsonb, jsonb) from public, anon, authenticated;
