begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(instance_id,id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',id::uuid,'authenticated','authenticated',email,now(),'{"provider":"email"}','{}',now(),now()
from (values
  ('b6000000-0000-4000-8000-000000000001','jadwal-wib@example.test'),
  ('b6000000-0000-4000-8000-000000000002','jadwal-wit@example.test'),
  ('b6000000-0000-4000-8000-000000000003','jadwal-nonaktif@example.test')
) v(id,email);
update public.profiles set name='Synthetic Schedule',birth_date='1970-01-01',sex='female',timezone_code='WIB',account_status='active'
where user_id::text like 'b6000000-%';
update public.profiles set timezone_code='WIT' where user_id='b6000000-0000-4000-8000-000000000002';
update public.profiles set account_status='suspended' where user_id='b6000000-0000-4000-8000-000000000003';
insert into public.consent_receipts(user_id,consent_type,document_version,decision,method)
select p.user_id,n.consent_type,n.document_version,'accept','database_test' from public.profiles p cross join public.notice_versions n
where p.user_id::text like 'b6000000-%' and n.consent_type in ('age_and_region','legal_documents','health_data');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;
set local role authenticated;

-- Membuat: tanggal+jam lokal menjadi due_at UTC sesuai zona profil.
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000001',true);
insert into ids select 'obat', (public.create_schedule('jadwal-obat-1','medicine','Minum obat pagi',
  (now() at time zone 'Asia/Jakarta')::date + 2, '07:30','Metformin 500','1 tablet sesudah makan')).id;
select is((select local_time from public.schedules where id=(select id from ids where name='obat')),'07:30'::time,'local time stored');
select is((select timezone_code from public.schedules where id=(select id from ids where name='obat')),'WIB','zone taken from profile');
select is(
  (select due_at from public.schedule_occurrences where schedule_id=(select id from ids where name='obat')),
  (((now() at time zone 'Asia/Jakarta')::date + 2) + time '07:30') at time zone 'Asia/Jakarta',
  'one occurrence at the local time in UTC');
select is(
  (public.create_schedule('jadwal-obat-1','medicine','Minum obat pagi',(now() at time zone 'Asia/Jakarta')::date + 2,'07:30')).id,
  (select id from ids where name='obat'),
  'same idempotency key returns the same schedule');
insert into ids select 'cek', (public.create_schedule('jadwal-cek-1','glucose_check','Cek gula puasa',
  (now() at time zone 'Asia/Jakarta')::date + 3, '06:00','Tidak dipakai','Tidak dipakai')).id;
select is((select medicine_name is null and dose_note is null from public.schedules where id=(select id from ids where name='cek')),true,
  'medicine fields dropped for non-medicine categories');
select is((select count(*) from public.schedules where recurrence_rule is not null),0::bigint,'no recurrence stored');

select throws_ok($$select public.create_schedule('jadwal-lalu','other','Kemarin',(now() at time zone 'Asia/Jakarta')::date - 1,'08:00')$$,
  'P0001','schedule_in_past','past schedule rejected');
select throws_ok($$select public.create_schedule('jadwal-jauh','other','Terlalu jauh',(now() at time zone 'Asia/Jakarta')::date + 400,'08:00')$$,
  'P0001','schedule_too_far','more than a year ahead rejected');
select throws_ok($$select public.create_schedule('jadwal-kosong','other','  ',(now() at time zone 'Asia/Jakarta')::date + 1,'08:00')$$,
  '23514',null,'blank title rejected');
select throws_ok($$select public.create_schedule('jadwal-kategori','vitamin','Vitamin',(now() at time zone 'Asia/Jakarta')::date + 1,'08:00')$$,
  '23514',null,'unknown category rejected');

-- Mengubah: occurrence ikut pindah.
select is((public.update_schedule((select id from ids where name='obat'),'insulin','Insulin malam',
  (now() at time zone 'Asia/Jakarta')::date + 4,'21:00','Insulin basal','10 unit')).category,'insulin','owner can update');
select is(
  (select due_at from public.schedule_occurrences where schedule_id=(select id from ids where name='obat')),
  (((now() at time zone 'Asia/Jakarta')::date + 4) + time '21:00') at time zone 'Asia/Jakarta',
  'occurrence moves with the update');

-- Jeda dan aktifkan.
select is((public.set_schedule_active((select id from ids where name='obat'),false)).active,false,'owner can pause');
select is((public.set_schedule_active((select id from ids where name='obat'),true)).active,true,'owner can resume');

-- Pengguna lain (zona WIT) tidak melihat dan tidak bisa mengubah.
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000002',true);
select is((select count(*) from public.schedules where user_id::text like 'b6000000-0000-4000-8000-000000000001'),0::bigint,'other user cannot read');
select throws_ok(format('select public.update_schedule(%L,''other'',''x'',current_date + 2,''08:00'')',(select id from ids where name='obat')),
  'P0001','schedule_not_found','other user cannot update');
select throws_ok(format('select public.delete_schedule(%L)',(select id from ids where name='obat')),
  'P0001','schedule_not_found','other user cannot delete');
insert into ids select 'wit', (public.create_schedule('jadwal-wit-1','glucose_check','Cek WIT',
  (now() at time zone 'Asia/Jayapura')::date + 1,'06:00')).id;
select is(
  (select due_at from public.schedule_occurrences where schedule_id=(select id from ids where name='wit')),
  (((now() at time zone 'Asia/Jayapura')::date + 1) + time '06:00') at time zone 'Asia/Jayapura',
  'WIT profile schedules in WIT');

-- Akun nonaktif tidak bisa membuat jadwal.
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.create_schedule('jadwal-x','other','x',current_date + 2,'08:00')$$,
  'P0001','health_access_required','suspended account cannot create');

-- Jadwal yang sudah lewat hanya baca.
reset role;
update public.schedule_occurrences set due_at = now() - interval '1 hour' where schedule_id=(select id from ids where name='cek');
set local role authenticated;
select set_config('request.jwt.claim.sub','b6000000-0000-4000-8000-000000000001',true);
select throws_ok(format('select public.update_schedule(%L,''other'',''x'',current_date + 2,''08:00'')',(select id from ids where name='cek')),
  'P0001','schedule_not_upcoming','past schedule cannot be edited');
select throws_ok(format('select public.delete_schedule(%L)',(select id from ids where name='cek')),
  'P0001','schedule_not_upcoming','past schedule cannot be deleted');

-- Hapus jadwal mendatang: occurrence ikut terhapus.
select lives_ok(format('select public.delete_schedule(%L)',(select id from ids where name='obat')),'owner deletes upcoming schedule');
select is((select count(*) from public.schedule_occurrences where schedule_id=(select id from ids where name='obat')),0::bigint,'occurrence removed with schedule');

-- Ekspor menyertakan tanggal dan waktu jatuh tempo.
select ok((public.export_my_data()->'schedules'->0) ?& array['localDate','dueAt'],'export includes date and due time');

select * from finish();
rollback;
