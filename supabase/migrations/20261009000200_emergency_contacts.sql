-- GLB-021 / FR-CONTACT-001, SRS §5/§7: undangan dan persetujuan kontak darurat.
-- Email kontak dienkripsi di aplikasi (DATA_ENCRYPTION_KEY) + HMAC untuk dedupe; token undangan
-- hanya disimpan sebagai hash, sekali pakai, kedaluwarsa 7 hari. Kontak tidak punya akun; keputusan
-- dicatat append-only di contact_consents beserta versi pemberitahuan yang ditampilkan.
-- Belum ada pengiriman apa pun ke kontak: alert keterlambatan/nilai tetap PENDING (BR-PEND-*).

-- Versi pemberitahuan terpusat: CNT-CONTACT-SHARE-001 (pengguna, sebelum undangan pertama) dan
-- CNT-CONTACT-ACCEPT-001 (kontak, di halaman undangan).
alter table public.notice_versions drop constraint notice_versions_type_check;
alter table public.notice_versions add constraint notice_versions_type_check check (
  consent_type in ('age_and_region', 'legal_documents', 'health_data', 'cookie', 'contact_share', 'contact_accept')
);
insert into public.notice_versions (consent_type, document_version)
values
  ('contact_share', 'CNT-CONTACT-SHARE-001@0.2-draft-2026-09-15'),
  ('contact_accept', 'CNT-CONTACT-ACCEPT-001@0.2-draft-2026-09-15');

alter table public.consent_receipts drop constraint consent_type_check;
alter table public.consent_receipts add constraint consent_type_check check (
  consent_type in ('age_and_region', 'legal_documents', 'health_data', 'contact_share')
);

create table public.contact_invitations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.emergency_contacts(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  constraint contact_invitations_hash_check check (octet_length(token_hash) = 32)
);
create index contact_invitations_contact_idx on public.contact_invitations (contact_id, created_at desc);
-- Tidak ada akses langsung dari klien: hanya lewat fungsi di bawah.
alter table public.contact_invitations enable row level security;
revoke all on public.contact_invitations from anon, authenticated;

-- Kontak pending yang semua undangannya lewat batas menjadi expired (melepas slot).
create or replace function private.expire_contact_invitations(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.emergency_contacts c set state = 'expired', updated_at = now()
  where c.user_id = p_user_id and c.state = 'pending'
    and not exists (
      select 1 from public.contact_invitations i
      where i.contact_id = c.id and i.used_at is null and i.expires_at > now()
    );
$$;

-- Undang kontak baru atau undang ulang kontak yang kedaluwarsa/dicabut pengguna.
-- Kontak yang menolak tidak dapat diundang ulang (mencegah undangan berulang ke orang yang sama).
create or replace function public.invite_emergency_contact(
  p_name text,
  p_email_ciphertext bytea,
  p_email_hash bytea,
  p_token_hash bytea
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.emergency_contacts;
  cid uuid;
begin
  if uid is null or not public.user_can_access_health() then raise exception 'not_allowed'; end if;
  if not private.latest_consent_is_accept(uid, 'contact_share') then raise exception 'contact_share_consent_required'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'invalid_contact_name'; end if;
  if octet_length(p_email_hash) <> 32 or octet_length(p_token_hash) <> 32
     or octet_length(p_email_ciphertext) not between 29 and 2048 then
    raise exception 'invalid_contact_input';
  end if;

  perform private.expire_contact_invitations(uid);
  select * into existing from public.emergency_contacts
  where user_id = uid and email_hash = p_email_hash for update;

  if existing.id is null then
    insert into public.emergency_contacts (user_id, name, email_ciphertext, email_hash, state)
    values (uid, btrim(p_name), p_email_ciphertext, p_email_hash, 'pending')
    returning id into cid;
  elsif existing.state in ('pending', 'active') then
    raise exception 'contact_already_invited';
  elsif existing.state = 'declined' then
    raise exception 'contact_declined';
  else
    update public.emergency_contacts
    set name = btrim(p_name), email_ciphertext = p_email_ciphertext, state = 'pending',
        revoked_at = null, updated_at = now()
    where id = existing.id
    returning id into cid;
  end if;

  -- Undangan lama untuk kontak ini tidak berlaku lagi.
  update public.contact_invitations set expires_at = least(expires_at, now())
  where contact_id = cid and used_at is null;
  insert into public.contact_invitations (contact_id, token_hash, expires_at)
  values (cid, p_token_hash, now() + interval '7 days');
  return cid;
end;
$$;

-- Kirim ulang undangan untuk kontak pending/expired dengan token baru.
create or replace function public.reissue_contact_invitation(p_contact_id uuid, p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.emergency_contacts;
begin
  if auth.uid() is null or not public.user_can_access_health() then raise exception 'not_allowed'; end if;
  if octet_length(p_token_hash) <> 32 then raise exception 'invalid_contact_input'; end if;
  perform private.expire_contact_invitations(auth.uid());
  select * into c from public.emergency_contacts where id = p_contact_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'contact_not_found'; end if;
  if c.state not in ('pending', 'expired') then raise exception 'contact_not_pending'; end if;
  -- Pembatas 2 kontak berlaku lagi saat expired → pending.
  update public.emergency_contacts set state = 'pending', updated_at = now() where id = c.id;
  update public.contact_invitations set expires_at = least(expires_at, now())
  where contact_id = c.id and used_at is null;
  insert into public.contact_invitations (contact_id, token_hash, expires_at)
  values (c.id, p_token_hash, now() + interval '7 days');
end;
$$;

-- Undangan gagal dikirim (email error): hapus kontak yang belum pernah diputuskan.
create or replace function public.discard_contact_invitation(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  delete from public.emergency_contacts c
  where c.id = p_contact_id and c.user_id = auth.uid() and c.state = 'pending'
    and not exists (select 1 from public.contact_consents cc where cc.contact_id = c.id);
end;
$$;

-- Daftar kontak milik sendiri, dengan masa berlaku undangan terakhir.
create or replace function public.my_emergency_contacts()
returns table (
  id uuid,
  name text,
  email_ciphertext bytea,
  state text,
  created_at timestamptz,
  invitation_expires_at timestamptz,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  perform private.expire_contact_invitations(auth.uid());
  return query
  select c.id, c.name, c.email_ciphertext, c.state, c.created_at,
    (select max(i.expires_at) from public.contact_invitations i where i.contact_id = c.id and i.used_at is null),
    (select max(cc.decided_at) from public.contact_consents cc where cc.contact_id = c.id)
  from public.emergency_contacts c
  where c.user_id = auth.uid() and c.state <> 'revoked'
  order by c.created_at;
end;
$$;

-- Halaman undangan publik (lewat server dengan service role): hanya nama pengundang dan kontak.
create or replace function public.get_contact_invitation(p_token_hash bytea)
returns table (status text, inviter_name text, contact_name text, notice_version text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when i.used_at is not null then 'used'
      when i.expires_at <= now() or c.state <> 'pending' or p.account_status <> 'active' then 'expired'
      else 'valid'
    end,
    p.name, c.name,
    (select v.document_version from public.notice_versions v where v.consent_type = 'contact_accept' and v.is_active)
  from public.contact_invitations i
  join public.emergency_contacts c on c.id = i.contact_id
  join public.profiles p on p.user_id = c.user_id
  where i.token_hash = p_token_hash;
$$;

-- Keputusan kontak: sekali pakai, sebelum kedaluwarsa, dengan versi pemberitahuan yang ditampilkan.
create or replace function public.decide_contact_invitation(p_token_hash bytea, p_decision text, p_notice_version text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.contact_invitations;
  c public.emergency_contacts;
  current_version text;
begin
  if p_decision not in ('accept', 'decline') then raise exception 'invalid_decision'; end if;
  select * into inv from public.contact_invitations where token_hash = p_token_hash for update;
  if inv.id is null then raise exception 'invitation_not_found'; end if;
  if inv.used_at is not null then raise exception 'invitation_used'; end if;
  select * into c from public.emergency_contacts where id = inv.contact_id for update;
  if inv.expires_at <= now() or c.state <> 'pending'
     or (select account_status from public.profiles where user_id = c.user_id) <> 'active' then
    raise exception 'invitation_expired';
  end if;
  select document_version into current_version from public.notice_versions
  where consent_type = 'contact_accept' and is_active;
  -- Pemberitahuan berubah sejak halaman dibuka: kontak harus membaca versi terbaru.
  if p_notice_version is distinct from current_version then raise exception 'notice_outdated'; end if;

  update public.contact_invitations set used_at = now() where id = inv.id;
  insert into public.contact_consents (contact_id, notice_version, decision, token_hash, expires_at)
  values (c.id, current_version, p_decision, inv.token_hash, inv.expires_at);
  update public.emergency_contacts
  set state = case when p_decision = 'accept' then 'active' else 'declined' end, updated_at = now()
  where id = c.id;
  return case when p_decision = 'accept' then 'active' else 'declined' end;
end;
$$;

revoke all on function private.expire_contact_invitations(uuid) from public, anon, authenticated;
revoke all on function public.invite_emergency_contact(text, bytea, bytea, bytea) from public, anon;
revoke all on function public.reissue_contact_invitation(uuid, bytea) from public, anon;
revoke all on function public.discard_contact_invitation(uuid) from public, anon;
revoke all on function public.my_emergency_contacts() from public, anon;
grant execute on function public.invite_emergency_contact(text, bytea, bytea, bytea) to authenticated;
grant execute on function public.reissue_contact_invitation(uuid, bytea) to authenticated;
grant execute on function public.discard_contact_invitation(uuid) to authenticated;
grant execute on function public.my_emergency_contacts() to authenticated;
revoke all on function public.get_contact_invitation(bytea) from public, anon, authenticated;
revoke all on function public.decide_contact_invitation(bytea, text, text) from public, anon, authenticated;
grant execute on function public.get_contact_invitation(bytea) to service_role;
grant execute on function public.decide_contact_invitation(bytea, text, text) to service_role;

-- Batas permintaan untuk /api/emergency-contacts.
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
    when 'contact.write' then 10
    when 'contact.read' then 60
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
