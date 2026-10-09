-- GLB-022 / FR-CONTACT-001, SRS §9: pencabutan kontak darurat dan suppression job.
-- Pengguna mencabut dari profil; kontak berhenti lewat tautan aman (token "stop" tanpa
-- kedaluwarsa, dikirim di email konfirmasi penerimaan dan kelak di setiap email ke kontak).
-- Job ke kontak yang belum terkirim disuppress; worker wajib memeriksa ulang lewat
-- private.contact_job_block_reason() tepat sebelum kirim. Alert nilai/keterlambatan tetap
-- PENDING: belum ada producer, dan trigger di bawah menolak job ke kontak yang tidak aktif.

-- Keputusan pencabutan bisa oleh pengguna (tanpa token) atau kontak (dengan token stop).
alter table public.contact_consents
  alter column token_hash drop not null,
  alter column expires_at drop not null,
  add column actor text not null default 'contact',
  add constraint contact_consents_actor_check check (actor in ('contact', 'user'));

-- Token undangan vs token berhenti di tabel yang sama.
alter table public.contact_invitations
  add column purpose text not null default 'invite',
  add constraint contact_invitations_purpose_check check (purpose in ('invite', 'stop'));

-- Undangan hanya untuk token 'invite'.
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
      where i.contact_id = c.id and i.purpose = 'invite' and i.used_at is null and i.expires_at > now()
    );
$$;

-- Tutup semua job kontak yang belum terkirim, dengan jejak alasan.
create or replace function private.suppress_contact_jobs(p_contact_id uuid, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  with closed as (
    update public.notification_jobs set state = 'suppressed', lease_until = null, updated_at = now()
    where contact_id = p_contact_id and state = 'queued'
    returning id
  )
  insert into public.notification_attempts (job_id, provider, outcome, error_class)
  select id, 'glubee', 'suppressed', p_reason from closed;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function private.revoke_contact(p_contact_id uuid, p_actor text, p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.emergency_contacts set state = 'revoked', revoked_at = now(), updated_at = now()
  where id = p_contact_id;
  -- Semua tautan undangan/berhenti milik kontak ini tidak berlaku lagi.
  update public.contact_invitations set used_at = coalesce(used_at, now())
  where contact_id = p_contact_id;
  insert into public.contact_consents (contact_id, notice_version, decision, token_hash, expires_at, actor)
  select p_contact_id, v.document_version, 'revoke', p_token_hash, null, p_actor
  from public.notice_versions v where v.consent_type = 'contact_accept';
  perform private.suppress_contact_jobs(p_contact_id, 'contact_revoked');
end;
$$;

-- Pengguna mencabut kontak pending/aktif. Bisa diundang lagi nanti (kecuali kontak sudah menolak/berhenti).
create or replace function public.revoke_emergency_contact(p_contact_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.emergency_contacts;
begin
  if auth.uid() is null then raise exception 'not_allowed'; end if;
  select * into c from public.emergency_contacts where id = p_contact_id and user_id = auth.uid() for update;
  if c.id is null then raise exception 'contact_not_found'; end if;
  if c.state not in ('pending', 'active', 'expired') then raise exception 'contact_not_revocable'; end if;
  perform private.revoke_contact(c.id, 'user', null);
end;
$$;

-- Token berhenti baru untuk kontak aktif (raw token hanya di email).

create or replace function public.issue_contact_stop_token(p_contact_id uuid, p_token_hash bytea)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if octet_length(p_token_hash) <> 32 then raise exception 'invalid_token'; end if;
  if not exists (select 1 from public.emergency_contacts where id = p_contact_id and state = 'active') then
    raise exception 'contact_not_active';
  end if;
  insert into public.contact_invitations (contact_id, token_hash, expires_at, purpose)
  values (p_contact_id, p_token_hash, 'infinity', 'stop');
end;
$$;

-- Halaman berhenti (publik lewat service role): nama saja.
create or replace function public.get_contact_stop(p_token_hash bytea)
returns table (status text, inviter_name text, contact_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select case when i.used_at is not null or c.state <> 'active' then 'done' else 'valid' end, p.name, c.name
  from public.contact_invitations i
  join public.emergency_contacts c on c.id = i.contact_id
  join public.profiles p on p.user_id = c.user_id
  where i.token_hash = p_token_hash and i.purpose = 'stop';
$$;

create or replace function public.stop_contact(p_token_hash bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.contact_invitations;
  c public.emergency_contacts;
begin
  select * into inv from public.contact_invitations where token_hash = p_token_hash and purpose = 'stop' for update;
  if inv.id is null then raise exception 'invitation_not_found'; end if;
  select * into c from public.emergency_contacts where id = inv.contact_id for update;
  -- Idempotent: berhenti dua kali tetap "berhenti".
  if inv.used_at is not null or c.state <> 'active' then return 'revoked'; end if;
  perform private.revoke_contact(c.id, 'contact', inv.token_hash);
  return 'revoked';
end;
$$;

-- Keputusan undangan: hanya token 'invite'; versi stop untuk kontak yang menerima dibuat app.
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
  where i.token_hash = p_token_hash and i.purpose = 'invite';
$$;

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
  select * into inv from public.contact_invitations where token_hash = p_token_hash and purpose = 'invite' for update;
  if inv.id is null then raise exception 'invitation_not_found'; end if;
  if inv.used_at is not null then raise exception 'invitation_used'; end if;
  select * into c from public.emergency_contacts where id = inv.contact_id for update;
  if inv.expires_at <= now() or c.state <> 'pending'
     or (select account_status from public.profiles where user_id = c.user_id) <> 'active' then
    raise exception 'invitation_expired';
  end if;
  select document_version into current_version from public.notice_versions
  where consent_type = 'contact_accept' and is_active;
  if p_notice_version is distinct from current_version then raise exception 'notice_outdated'; end if;

  update public.contact_invitations set used_at = now() where id = inv.id;
  insert into public.contact_consents (contact_id, notice_version, decision, token_hash, expires_at, actor)
  values (c.id, current_version, p_decision, inv.token_hash, inv.expires_at, 'contact');
  update public.emergency_contacts
  set state = case when p_decision = 'accept' then 'active' else 'declined' end, updated_at = now()
  where id = c.id;
  return case when p_decision = 'accept' then 'active' else 'declined' end;
end;
$$;

-- Untuk email konfirmasi setelah kontak menerima: id + email terenkripsi + nama, dari token undangan.
create or replace function public.contact_for_invitation(p_token_hash bytea)
returns table (contact_id uuid, contact_name text, inviter_name text, email_ciphertext bytea)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.name, p.name, c.email_ciphertext
  from public.contact_invitations i
  join public.emergency_contacts c on c.id = i.contact_id
  join public.profiles p on p.user_id = c.user_id
  where i.token_hash = p_token_hash and i.purpose = 'invite';
$$;

-- Undangan ulang: kontak yang menolak atau berhenti sendiri tidak dapat diundang lagi.
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
  elsif exists (
    select 1 from public.contact_consents cc
    where cc.contact_id = existing.id and cc.decision = 'revoke' and cc.actor = 'contact'
  ) then
    raise exception 'contact_opted_out';
  else
    update public.emergency_contacts
    set name = btrim(p_name), email_ciphertext = p_email_ciphertext, state = 'pending',
        revoked_at = null, updated_at = now()
    where id = existing.id
    returning id into cid;
  end if;

  update public.contact_invitations set expires_at = least(expires_at, now())
  where contact_id = cid and purpose = 'invite' and used_at is null;
  insert into public.contact_invitations (contact_id, token_hash, expires_at)
  values (cid, p_token_hash, now() + interval '7 days');
  return cid;
end;
$$;

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
  update public.emergency_contacts set state = 'pending', updated_at = now() where id = c.id;
  update public.contact_invitations set expires_at = least(expires_at, now())
  where contact_id = c.id and purpose = 'invite' and used_at is null;
  insert into public.contact_invitations (contact_id, token_hash, expires_at)
  values (c.id, p_token_hash, now() + interval '7 days');
end;
$$;

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
    (select max(i.expires_at) from public.contact_invitations i
     where i.contact_id = c.id and i.purpose = 'invite' and i.used_at is null),
    (select max(cc.decided_at) from public.contact_consents cc where cc.contact_id = c.id)
  from public.emergency_contacts c
  where c.user_id = auth.uid() and c.state <> 'revoked'
  order by c.created_at;
end;
$$;

-- Worker (kelak, saat FR-CONTACT-002/FR-REMINDER-002 disetujui) memanggil ini tepat sebelum kirim.
-- null = boleh kirim. Tanpa feature gate yang aktif, alert selalu ditolak.
create or replace function private.contact_job_block_reason(p_job_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when j.id is null then 'job_missing'
    when j.state not in ('queued', 'processing') then 'job_closed'
    when c.id is null or c.state <> 'active' then 'contact_not_active'
    when not exists (
      select 1 from public.contact_consents cc
      where cc.contact_id = c.id and cc.decision = 'accept'
        and not exists (
          select 1 from public.contact_consents later
          where later.contact_id = c.id and later.decision = 'revoke' and later.decided_at >= cc.decided_at
        )
    ) then 'consent_missing'
    when p.account_status <> 'active' then 'account_inactive'
    when j.type = 'value_alert' and exists (
      select 1 from public.glucose_entries g where g.id::text = j.payload_ref and g.status <> 'valid'
    ) then 'entry_invalidated'
    when j.type in ('value_alert', 'missed_check_alert') then 'feature_pending'
    else null
  end
  from (select p_job_id as id) req
  left join public.notification_jobs j on j.id = req.id
  left join public.emergency_contacts c on c.id = j.contact_id
  left join public.profiles p on p.user_id = j.user_id;
$$;

-- Penjaga: job ke kontak hanya boleh dibuat untuk kontak aktif milik pengguna yang sama.
create or replace function private.guard_contact_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contact_id is not null and not exists (
    select 1 from public.emergency_contacts c
    where c.id = new.contact_id and c.user_id = new.user_id and c.state = 'active'
  ) then
    raise exception using errcode = '23514', message = 'contact_not_active';
  end if;
  return new;
end;
$$;
create trigger notification_jobs_contact_guard before insert on public.notification_jobs
for each row execute function private.guard_contact_job();

revoke all on function private.suppress_contact_jobs(uuid, text) from public, anon, authenticated;
revoke all on function private.revoke_contact(uuid, text, bytea) from public, anon, authenticated;
revoke all on function private.contact_job_block_reason(uuid) from public, anon, authenticated;
revoke all on function public.revoke_emergency_contact(uuid) from public, anon;
grant execute on function public.revoke_emergency_contact(uuid) to authenticated;
revoke all on function public.issue_contact_stop_token(uuid, bytea) from public, anon, authenticated;
revoke all on function public.get_contact_stop(bytea) from public, anon, authenticated;
revoke all on function public.stop_contact(bytea) from public, anon, authenticated;
revoke all on function public.contact_for_invitation(bytea) from public, anon, authenticated;
grant execute on function public.issue_contact_stop_token(uuid, bytea) to service_role;
grant execute on function public.get_contact_stop(bytea) to service_role;
grant execute on function public.stop_contact(bytea) to service_role;
grant execute on function public.contact_for_invitation(bytea) to service_role;
