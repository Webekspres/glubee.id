-- Sprint 2: bounded complete range, essential cookie receipts, legal revision.
-- Forward fix only; existing health records and consent receipts remain intact.
update public.notice_versions set document_version = 'CNT-LEGAL-001@0.2-draft-2026-09-15' where consent_type='legal_documents';
update public.notice_versions set document_version = 'CNT-HEALTH-001@0.2-draft-2026-09-15' where consent_type='health_data';

create function public.get_my_glucose_range(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare result jsonb;
begin
  if not public.user_can_access_health() then raise exception 'health_access_required'; end if;
  if p_from is null or p_to is null or p_from >= p_to then raise exception 'invalid_range'; end if;
  select case when count(*) > 5000 then jsonb_build_object('tooLarge', true, 'entries', '[]'::jsonb)
    else jsonb_build_object('tooLarge',false,'entries',coalesce(jsonb_agg(to_jsonb(e) order by e.measured_at,e.id),'[]'::jsonb)) end into result
  from (select id, original_value, original_unit, normalized_mg_dl, measurement_context, measured_at, note
    from public.glucose_entries where user_id=auth.uid() and status='valid' and measured_at>=p_from and measured_at<p_to
    order by measured_at,id limit 5001) e;
  return result;
end;
$$;
revoke all on function public.get_my_glucose_range(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_my_glucose_range(timestamptz,timestamptz) to authenticated;

create function public.consume_report_rate_limit()
returns boolean language plpgsql security definer set search_path = ''
as $$
declare allowed boolean;
begin
  if not public.user_can_access_health() then return false; end if;
  insert into private.api_rate_limits(user_id,route,window_started_at,request_count)
  values(auth.uid(),'reports',now(),1)
  on conflict(user_id,route) do update set
    window_started_at=case when private.api_rate_limits.window_started_at <= now()-interval '1 minute' then now() else private.api_rate_limits.window_started_at end,
    request_count=case when private.api_rate_limits.window_started_at <= now()-interval '1 minute' then 1 else private.api_rate_limits.request_count+1 end
  returning request_count<=5 into allowed;
  return allowed;
end;
$$;
revoke all on function public.consume_report_rate_limit() from public,anon;
grant execute on function public.consume_report_rate_limit() to authenticated;

create index cookie_receipts_subject_time_idx on public.cookie_consent_receipts(anonymous_subject_id,recorded_at desc);
create trigger cookie_receipts_append_only before update or delete on public.cookie_consent_receipts
for each row execute function private.prevent_receipt_changes();
create function public.record_cookie_preference(p_subject uuid,p_source text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare receipt_id uuid; version text;
begin
  if p_subject is null or p_source not in ('accept_all','reject','preferences','withdraw') then raise exception 'invalid_preference'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_subject::text,0));
  if (select count(*) from public.cookie_consent_receipts where anonymous_subject_id=p_subject and recorded_at>now()-interval '1 minute') >= 10 then raise exception 'rate_limited'; end if;
  select document_version into version from public.notice_versions where consent_type='cookie' and is_active;
  if version is null then raise exception 'notice_unavailable'; end if;
  insert into public.cookie_consent_receipts(anonymous_subject_id,notice_version,preferences_json,decision_source)
  values(p_subject,version,'{"essential":true,"analytics":false,"marketing":false}'::jsonb,p_source) returning id into receipt_id;
  return jsonb_build_object('id',receipt_id);
end;
$$;
revoke all on function public.record_cookie_preference(uuid,text) from public,anon,authenticated;
grant execute on function public.record_cookie_preference(uuid,text) to service_role;

-- Registration must preserve the versions presented, not retroactively accept a new notice.
alter table private.registration_intents add column consent_versions jsonb;
create or replace function public.create_registration_intent(p_nonce uuid,p_email text,p_birth_date date)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_birth_date > (timezone('Asia/Jakarta',now())::date-interval '18 years')::date then raise exception 'registration_requires_adult'; end if;
  insert into private.registration_intents(nonce,email_hash,birth_date,consent_versions)
  select p_nonce,extensions.digest(lower(btrim(p_email)),'sha256'),p_birth_date,jsonb_object_agg(consent_type,document_version)
  from public.notice_versions where is_active and consent_type in ('age_and_region','legal_documents','health_data');
end;
$$;
create or replace function public.consume_registration_intent(p_nonce uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare intent private.registration_intents; current_email text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  select email into current_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if current_email is null then raise exception 'verified_email_required'; end if;
  select * into intent from private.registration_intents where nonce=p_nonce and consumed_at is null and expires_at>now()
    and email_hash=extensions.digest(lower(btrim(current_email)),'sha256') for update;
  if intent.nonce is null then raise exception 'invalid_registration_intent'; end if;
  update public.profiles set birth_date=intent.birth_date where user_id=auth.uid();
  -- Older intents have no archived versions: onboarding explicitly collects consent again.
  insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
  select auth.uid(),key,value,'accept','email_registration' from jsonb_each_text(coalesce(intent.consent_versions,'{}'::jsonb));
  update private.registration_intents set consumed_at=now() where nonce=p_nonce;
  perform public.refresh_my_account_status();
end;
$$;
