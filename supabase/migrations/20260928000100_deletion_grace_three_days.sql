-- Masa jeda penghapusan akun diturunkan dari 7 menjadi 3 hari (3x24 jam),
-- sejalan dengan UU 27/2022 Pasal 40 dan PP 33/2026. Lihat BR-RULE-009.
alter table public.deletion_requests
  drop constraint deletion_requests_schedule_check;

alter table public.deletion_requests
  add constraint deletion_requests_schedule_check
  check (scheduled_for >= requested_at + interval '3 days');
