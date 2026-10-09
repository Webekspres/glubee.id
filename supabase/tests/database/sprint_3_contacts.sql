begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

-- A pengundang utama, D pengguna lain; keduanya aktif dan WIB.
insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
  ('00000000-0000-0000-0000-000000000000','b9000000-0000-4000-8000-00000000000a','authenticated','authenticated','kontak-a@example.test',now(),'{"provider":"email"}','{}',now(),now()),
  ('00000000-0000-0000-0000-000000000000','b9000000-0000-4000-8000-00000000000d','authenticated','authenticated','kontak-d@example.test',now(),'{"provider":"email"}','{}',now(),now());
update public.profiles set name='Bu Sari',birth_date='1958-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id::text like 'b9000000-%';
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id::text like 'b9000000-%' and n.consent_type in ('age_and_region','legal_documents','health_data');

create function pg_temp.h(p text) returns bytea language sql as $$ select extensions.digest(p, 'sha256') $$;
create function pg_temp.blob() returns bytea language sql as $$ select extensions.gen_random_bytes(64) $$;
create function pg_temp.as_user(p uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role', 'authenticated')::text, true) $$;
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
create function pg_temp.contact(p text) returns public.emergency_contacts language sql as $$
  select c.* from public.emergency_contacts c join ids on ids.id = c.id where ids.name = p $$;
create function pg_temp.accept_version() returns text language sql as $$
  select document_version from public.notice_versions where consent_type = 'contact_accept' $$;

set local role authenticated;
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000a');

-- Persetujuan berbagi wajib sebelum undangan pertama.
select throws_ok($$select public.invite_emergency_contact('Andi', pg_temp.blob(), pg_temp.h('andi@x.test'), pg_temp.h('tok-a1'))$$,
  'P0001', 'contact_share_consent_required', 'share consent required before inviting');
select is((public.record_consent('contact_share', 'accept', 'contact_invite')).consent_type, 'contact_share', 'share consent recorded');

insert into ids select 'andi', public.invite_emergency_contact('Andi', pg_temp.blob(), pg_temp.h('andi@x.test'), pg_temp.h('tok-a1'));
select is((pg_temp.contact('andi')).state, 'pending', 'invited contact is pending');
select throws_ok($$select * from public.contact_invitations$$, '42501', null, 'invitations not readable by users');
select throws_ok($$select public.invite_emergency_contact('Andi lagi', pg_temp.blob(), pg_temp.h('andi@x.test'), pg_temp.h('tok-a2'))$$,
  'P0001', 'contact_already_invited', 'same email cannot be invited twice');
select throws_ok($$select public.invite_emergency_contact(' ', pg_temp.blob(), pg_temp.h('x@x.test'), pg_temp.h('tok-x'))$$,
  'P0001', 'invalid_contact_name', 'blank name rejected');
insert into ids select 'budi', public.invite_emergency_contact('Budi', pg_temp.blob(), pg_temp.h('budi@x.test'), pg_temp.h('tok-b1'));
select throws_ok($$select public.invite_emergency_contact('Cici', pg_temp.blob(), pg_temp.h('cici@x.test'), pg_temp.h('tok-c1'))$$,
  '23514', 'emergency_contact_limit_reached', 'third pending/active contact rejected');
select is((select count(*) from public.my_emergency_contacts()), 2::bigint, 'owner lists own contacts');
select ok((select bool_and(invitation_expires_at > now() + interval '6 days 23 hours') from public.my_emergency_contacts()), 'invitation valid for 7 days');

-- Pengguna lain tidak melihat atau mengubah kontak A.
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000d');
select is((select count(*) from public.my_emergency_contacts()), 0::bigint, 'other user sees no contacts');
select is((select count(*) from public.emergency_contacts), 0::bigint, 'RLS hides other users contacts');
select throws_ok(format('select public.reissue_contact_invitation(%L, pg_temp.h(''tok-evil''))', (select id from ids where name='andi')),
  'P0001', 'contact_not_found', 'cannot reissue someone else''s invitation');

-- Halaman publik hanya lewat service role.
select throws_ok($$select * from public.get_contact_invitation(pg_temp.h('tok-a1'))$$, '42501', null, 'users cannot read invitations by token');
select throws_ok($$select public.decide_contact_invitation(pg_temp.h('tok-a1'), 'accept', 'x')$$, '42501', null, 'users cannot decide');
reset role;

select is((select status from public.get_contact_invitation(pg_temp.h('tok-a1'))), 'valid', 'fresh token is valid');
select is((select inviter_name || '/' || contact_name from public.get_contact_invitation(pg_temp.h('tok-a1'))), 'Bu Sari/Andi', 'page shows inviter and contact names only');
select is((select count(*) from public.get_contact_invitation(pg_temp.h('tok-unknown'))), 0::bigint, 'unknown token returns nothing');
select throws_ok($$select public.decide_contact_invitation(pg_temp.h('tok-a1'), 'accept', 'CNT-CONTACT-ACCEPT-001@lama')$$,
  'P0001', 'notice_outdated', 'outdated notice version rejected');
select is(public.decide_contact_invitation(pg_temp.h('tok-a1'), 'accept', pg_temp.accept_version()), 'active', 'contact accepts');
select is((select notice_version || ':' || decision from public.contact_consents where contact_id = (pg_temp.contact('andi')).id),
  pg_temp.accept_version() || ':accept', 'receipt records notice version');
select throws_ok($$select public.decide_contact_invitation(pg_temp.h('tok-a1'), 'decline', pg_temp.accept_version())$$,
  'P0001', 'invitation_used', 'token is single use');

-- Kedaluwarsa: token ditolak, kontak expired dan slot terbuka.
update public.contact_invitations set expires_at = now() - interval '1 minute' where token_hash = pg_temp.h('tok-b1');
select is((select status from public.get_contact_invitation(pg_temp.h('tok-b1'))), 'expired', 'expired token reported');
select throws_ok($$select public.decide_contact_invitation(pg_temp.h('tok-b1'), 'accept', pg_temp.accept_version())$$,
  'P0001', 'invitation_expired', 'expired token cannot be used');
set local role authenticated;
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000a');
select is((select state from public.my_emergency_contacts() where name = 'Budi'), 'expired', 'contact marked expired');
insert into ids select 'cici', public.invite_emergency_contact('Cici', pg_temp.blob(), pg_temp.h('cici@x.test'), pg_temp.h('tok-c1'));
select throws_ok(format('select public.reissue_contact_invitation(%L, pg_temp.h(''tok-b2''))', (select id from ids where name='budi')),
  '23514', 'emergency_contact_limit_reached', 'reissue respects the two-contact limit');
reset role;

-- Penolakan: kontak tidak bisa diundang ulang oleh pengguna.
select is(public.decide_contact_invitation(pg_temp.h('tok-c1'), 'decline', pg_temp.accept_version()), 'declined', 'contact declines');
set local role authenticated;
select pg_temp.as_user('b9000000-0000-4000-8000-00000000000a');
select throws_ok($$select public.invite_emergency_contact('Cici', pg_temp.blob(), pg_temp.h('cici@x.test'), pg_temp.h('tok-c2'))$$,
  'P0001', 'contact_declined', 'declined contact cannot be re-invited');
-- Undang ulang Budi (expired) kini muat; token lama tetap mati.
select lives_ok(format('select public.reissue_contact_invitation(%L, pg_temp.h(''tok-b2''))', (select id from ids where name='budi')), 'expired contact reissued');
reset role;
select is((select status from public.get_contact_invitation(pg_temp.h('tok-b2'))), 'valid', 'new token valid');

-- Pengundang dinonaktifkan: undangan tidak bisa diterima.
update public.profiles set account_status = 'suspended' where user_id = 'b9000000-0000-4000-8000-00000000000a';
select is((select status from public.get_contact_invitation(pg_temp.h('tok-b2'))), 'expired', 'inactive inviter invalidates invitation');

select * from finish();
rollback;
