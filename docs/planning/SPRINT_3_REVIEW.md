# Review Sprint 3 — 9 Oktober 2026 (bagian developer)

Task: [GLB-026](https://app.clickup.com/t/86eyvadz3) · Kebutuhan: UAT-005..010

Status: semua fitur Sprint 3 sudah ada di kode. GLB-018, 019, 023, 024, 025 live di production. GLB-020, 021, 022, dan 048 masih berupa PR ke `dev` dan **belum di-merge**. Uji kolektif pengguna dan demo klien belum dilakukan.

## Status task

| Task | Kode | Live | Sisa |
|---|---|---|---|
| GLB-018 Jadwal | 71bd7ec | Ya | Uji kolektif |
| GLB-019 Antrean pengingat | 3a8b486 | Ya, email mati | Uji kolektif (`REMINDER_EMAIL_ENABLED`) |
| GLB-020 Push + dashboard + fallback | PR #6 | Belum | Migration 0100, kunci VAPID + `DATA_ENCRYPTION_KEY`, uji perangkat asli |
| GLB-021 Undangan kontak | PR #7 (di atas #6) | Belum | Migration 0200, `CONTACT_INVITES_ENABLED` |
| GLB-022 Pencabutan + suppression | PR #8 (di atas #7) | Belum | Migration 0300 |
| GLB-023 Ekspor | 2de1de5 | Ya | Uji unduh live (email + Google) |
| GLB-024 Hapus akun 3 hari | c9dc308 | Ya | Uji live dengan akun uji, runbook restore (GLB-028) |
| GLB-025 Admin status akun | c46d8df | Ya | UAT |
| GLB-048 PDF baru | PR #9 (independen) | Belum | Cetak A4 hitam-putih + cek di ponsel |
| GLB-040 Audit fungsional live | — | — | Digabung ke sesi uji kolektif |

## Bukti uji (AC GLB-026: job duplikat, pencabutan, akun nonaktif, grace period, tenggat dengan jam uji terkontrol)

Waktu dikendalikan dengan menggeser `due_at`/`expires_at`/`scheduled_for` di dalam transaksi pgTAP (tanpa menunggu jam asli).

| UAT | Skenario | Bukti |
|---|---|---|
| UAT-005 Jadwal | buat/ubah/jeda/aktifkan/hapus, tanpa job ganda | pgTAP `sprint_3_schedule` (24), e2e `schedule.spec` |
| UAT-006 Kontak | undang, batas 2, terima/tolak, kedaluwarsa, sekali pakai, cabut (pengguna/kontak), tidak bisa undang ulang yang menolak/berhenti, tanpa akses data | pgTAP `sprint_3_contacts` (30) + `sprint_3_revocation` (27), e2e `contacts.spec` (3) |
| UAT-007 Pengingat | dedupe per occurrence, klaim atomik + lease, retry 1-2-4 menit, maksimal 3, kuota harian, push → fallback email (no_subscription / gagal permanen / retry habis), subscription 404/410 dinonaktifkan | pgTAP `sprint_3_reminder` (28) + `sprint_3_push` (23), unit `reminder.test`, e2e `reminder.spec` + `push.spec` |
| UAT-008 Hapus akun | ajukan, mode terbatas, batal, tenggat 3 hari, job antre dibatalkan, tombstone, rekonsiliasi restore | pgTAP `sprint_3_deletion` (22) + `sprint_3_restore` (13), e2e `deletion.spec` |
| UAT-009 Admin | ubah status beralasan, tanpa data kesehatan | pgTAP `sprint_3_admin` (14), e2e `admin.spec` |
| UAT-010 Gate pending | alert nilai/keterlambatan tidak pernah terkirim: trigger menolak job ke kontak tidak aktif, `contact_job_block_reason` → `feature_pending`, UI & email menyatakan belum ada pemberitahuan ke kontak | pgTAP `sprint_3_revocation` |
| Akun nonaktif | pengingat disuppress `account_inactive`; undangan dari pengundang nonaktif tidak berlaku; alert diblok | pgTAP reminder, contacts, revocation |

Hasil terakhir (branch `fitur/glb-022`, berisi #6–#8): pgTAP 243/243, Playwright **13/13 seluruh suite**, lint, typecheck, `bun test`, build. Branch `fitur/glb-048`: `bun test` + 4 tes PDF, e2e Sprint 2 (unduh PDF) 2/2.

## Urutan rilis

> ⚠️ Workflow Deploy saat ini **otomatis men-deploy ke production setiap push ke `dev`** (`GO_LIVE` belum `true`). Merge PR ke `dev` = deploy production. Staging (`staging.glubee.id`, GLB-E02) belum ada.

Urutan yang aman (keputusan lingkungan uji ada di pengguna, lihat "Perlu keputusan"):

1. Migration production lebih dulu, berurutan: `20261009000100_push_reminders` → `0200_emergency_contacts` → `0300_contact_revocation`. Migration ini aditif. Satu-satunya perubahan signature adalah `claim_reminder_jobs`, dan selama flag pengingat mati dispatcher tidak memanggilnya.
2. `.env` VPS: `DATA_ENCRYPTION_KEY` (`generate-keys.sh`, simpan juga di password manager), `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` (`bunx web-push generate-vapid-keys`), `VAPID_SUBJECT`. Semua flag tetap `false`.
3. Merge #6 → #7 → #8, lalu #9 (independen), dan #5 (docs).
4. Hari uji kolektif: set `REMINDER_EMAIL_ENABLED`, `REMINDER_PUSH_ENABLED`, `CONTACT_INVITES_ENABLED` = `true`, lalu `docker compose up -d app`.

## Checklist uji kolektif (±16 Okt, target 21 Okt)

Gunakan akun dan email uji, bukan data pasien nyata.

- [ ] Jadwal: buat jadwal 5 menit ke depan → email tiba (push mati di perangkat itu).
- [ ] Push: Chrome Android/desktop → "Aktifkan notifikasi" → jadwal 5 menit → notifikasi tiba, klik membuka /schedule, tidak ada email ganda.
- [ ] Push ditolak: blokir izin → pengingat lewat email.
- [ ] iPhone: pasang ke Layar Utama → aktifkan → notifikasi tiba.
- [ ] Dashboard: "Jadwal hari ini" menampilkan jadwal tanpa push/email.
- [ ] Kontak: undang 2 email uji → terima satu, tolak satu → buka ulang tautan (sudah dijawab) → email konfirmasi berisi tautan berhenti → berhenti.
- [ ] Cabut kontak dari profil; undang ulang yang dicabut pengguna (boleh); undang ulang yang menolak (ditolak).
- [ ] PDF: unduh 30 hari, cetak A4 hitam-putih, buka di ponsel.
- [ ] Ekspor data (email + Google), ajukan lalu batalkan penghapusan akun.
- [ ] Login/register/reset (GLB-040).

## Perlu keputusan pengguna

1. **Lingkungan uji kolektif.** Staging belum ada, sedangkan merge ke `dev` langsung naik ke production. Pilihan: (a) siapkan staging dulu (GLB-E02: stack Supabase, subdomain, OAuth callback, VAPID, secret terpisah), lalu ubah workflow supaya `dev` → staging; atau (b) uji di production dengan flag yang dinyalakan hanya selama sesi uji, memakai akun uji.
2. Siapa yang me-merge PR (#5–#9) dan kapan, mengingat poin 1.

## Gate yang tetap pending

BR-PEND-001..007: evaluasi nilai, alert nilai ke kontak (FR-CONTACT-002), alert keterlambatan (FR-REMINDER-002), pengulangan jadwal/status selesai (BR-PEND-006), dan GLB-043 (batas nilai & waktu ukur). Semuanya tetap nonaktif di kode.
