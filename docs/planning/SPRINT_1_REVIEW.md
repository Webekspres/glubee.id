# Review Sprint 1 — 9 September 2026

Status dokumen: hasil implementasi lokal; status live ClickUp belum diperbarui karena konektor ClickUp tidak tersedia pada sesi ini.

## Hasil per task

| Task | Hasil lokal | Bukti | Constraint/carry-over |
|---|---|---|---|
| GLB-001 | Selesai diverifikasi | Baseline 40 hari kerja, satu developer, due date tanpa jam, dan aturan UAT minimal satu persetujuan sudah konsisten pada AGENTS/BRD/FRD/Legal Operations. | Status ClickUp belum dapat dibaca ulang. |
| GLB-002 | Selesai | Bun-only scaffold; lint, typecheck, unit test, frozen install, dan production build lulus. Rahasia tidak masuk Git. | Tidak ada. |
| GLB-003 | Selesai | Migration tunggal dapat di-reset ulang; tabel profil, consent, catatan, jadwal, kontak, queue, deletion, audit, dan export tersedia. | Retensi final dan operasi fitur Sprint berikutnya tetap menunggu task terkait. |
| GLB-004 | Selesai untuk scope Sprint 1 | 30 pgTAP membuktikan RLS owner/lintas-user/anon/admin, append-only, idempotency, rate limit tetap, dua kontak, satu deletion aktif, dan recurrence pending tetap off. | Service/cloud environment belum diuji. |
| GLB-005 | Selesai lokal | Smoke test: usia <18 ditolak; akun belum terverifikasi ditolak; verifikasi, login, logout, reset email, consent versioned, dan token kedaluwarsa diuji dengan Supabase + Mailpit lokal. | SMTP/URL production belum dikonfigurasi. |
| GLB-006 | Sebagian | Route OAuth/callback dan backend profil selesai; WIB/WITA/WIT dan batas usia diuji. OAuth tetap membawa pengguna ke onboarding. | Login Google nyata dan account linking menunggu Google/Supabase OAuth credentials pada GLB-E02. |
| GLB-007 | Selesai lokal | Create, konversi, idempotency, histori, invalidasi, dan replacement tertaut lulus database/API smoke test. Nilai asli tidak ditimpa. | Presisi/rentang UX final masih belum diputuskan; backend memakai maksimum tiga desimal dan toleransi masa depan lima menit sebagai batas teknis sementara. |
| GLB-008 | Selesai lokal | Pagination cursor, periode 7/14/30 hari, rentang tanggal WIB/WITA/WIT, exclusion catatan invalid, dan empty summary null diuji. | UI grafik adalah scope Sprint 2 dan menunggu aset. |
| GLB-009 | Selesai sebagai review lokal | Bukti test dan carry-over dicatat pada dokumen ini. | Status/capacity aktual di ClickUp belum dapat diverifikasi live. |
| GLB-E01 | Belum dikerjakan | — | Menunggu aset, brand guideline, desain, dan maskot klien. |
| GLB-E02 | Belum selesai | Konfigurasi lokal dan placeholder environment tersedia. | Memerlukan otorisasi/kredensial domain, sender, Google OAuth, serta project staging terpisah. |
| GLB-E05 | Belum dikerjakan | Semua feature gate medis tetap `false`; recurrence wajib `null`. | Menunggu keputusan klien/validator medis untuk BR-PEND-001..007. |

## API Sprint 1

Kontrak respons mengikuti SRS: sukses `{ data, meta? }`, gagal `{ error: { code, message, fieldErrors?, correlationId } }`.

| Route | Fungsi |
|---|---|
| `POST /api/auth/register` | Registrasi email dengan deklarasi usia dan consent terpisah. |
| `POST /api/auth/login`, `/logout` | Membuka dan mengakhiri sesi. |
| `POST /api/auth/reset-password`, `/update-password` | Memulai dan menyelesaikan pemulihan. |
| `GET /api/auth/google`, `GET /auth/callback` | Memulai OAuth PKCE dan menukar code menjadi sesi. |
| `GET/POST /api/consents` | Membaca dan mencatat receipt versioned append-only. |
| `GET/PATCH /api/profile` | Membaca dan memperbarui profil milik sendiri. |
| `GET/POST /api/glucose-entries` | Riwayat cursor-based dan pencatatan idempotent. |
| `POST /api/glucose-entries/{id}/invalidate` | Menandai catatan salah tanpa menimpa nilai. |
| `POST /api/glucose-entries/{id}/replacement` | Membuat pengganti yang tertaut. |
| `GET /api/glucose-summary` | Ringkasan dan titik grafik dari catatan valid. |

## Rencana masuk Sprint 2

GLB-006 dibawa sebagai verifikasi OAuth setelah GLB-E02 tersedia. UI final GLB-010–016 tidak dimulai sebelum GLB-E01; jika aset tetap tertunda, pekerjaan hanya boleh melanjutkan integrasi fungsional tanpa membuat branding sementara.
