# Software Requirements Specification - Glubee

Versi: 0.1-draft
Status arsitektur: USULAN TEKNIS untuk review sebelum implementasi.

## 1. Sasaran teknis

Membangun MVP yang aman dan dapat diaudit untuk data kesehatan sensitif, dengan jumlah komponen minimum. Arsitektur awal adalah satu aplikasi Next.js + TypeScript; UI dan Route Handlers berada dalam satu codebase. PostgreSQL/Auth menggunakan Supabase. Email transaksional menggunakan Brevo. Browser push menggunakan Web Push API melalui server aplikasi. Tidak ada microservice terpisah pada tahap awal.

Rujukan teknis yang harus diverifikasi kembali saat implementasi:

- Next.js Route Handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Cron: https://supabase.com/docs/guides/cron
- Supabase Auth SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase backup: https://supabase.com/docs/guides/platform/backups
- Brevo transactional API: https://developers.brevo.com/docs/send-a-transactional-email

## 2. Batas komponen

```text
Browser
  -> Next.js UI / Route Handlers
       -> Supabase Auth
       -> PostgreSQL + RLS
       -> PDF renderer
       -> Web Push endpoint
       -> Brevo transactional email

Supabase Cron
  -> protected job endpoint / database function
       -> claims due jobs atomically
       -> sends through configured provider
       -> records result and retry
```

Prinsip:

- Client memakai publishable/anon key; service-role key hanya pada server dan hanya untuk operasi terpilih.
- Semua tabel exposed memakai grants minimum dan RLS per operasi.
- Endpoint tidak mempercayai `user_id` dari request body; identitas berasal dari sesi terverifikasi.
- Admin dan health-data API dipisahkan secara kontrak, query, dan test.
- Evaluasi medis berada pada modul/config versioned dan feature gate default-off.

## 3. Lingkungan dan konfigurasi

Minimum environment: local, preview/staging, production. Setiap environment memiliki project database, OAuth callback, sender, VAPID key, secret, dan dataset terpisah. Production tidak boleh memakai data/credentials staging.

Konfigurasi terpusat minimum:

- nama final produk dan identitas/kontak pengelola;
- base URL dan allowed redirect URL;
- zona waktu yang didukung;
- versi dokumen hukum aktif;
- versi cookie notice, kategori aktif, dan daftar vendor per kategori;
- feature gate klasifikasi/alert medis;
- sender email dan support contact;
- batas rate/retensi/retry;
- provider dan paket layanan.

### 3.1 Kepemilikan akun dan repository

| Layanan | Pemilik/akun operasional | Status |
|---|---|---|
| Google dan Google Cloud Platform | `mk.webekspres@gmail.com` | Milik Webekspres; masih free tier. Dipakai untuk project GCP dan konfigurasi Google OAuth yang disetujui. |
| GitHub user | `sultanwebekspres` | Milik Webekspres. |
| GitHub organization | `webekspres` | Belum Enterprise; repository project sudah dibuat dan siap digunakan di organisasi ini. |
| Vercel, Supabase, Brevo | Akun operasional Webekspres menggunakan `mk.webekspres@gmail.com`, kecuali diputuskan lain | Paket produksi dan biaya masih menunggu persetujuan. |

Password, recovery code, MFA secret, API key, service account key, dan token tidak boleh ditulis di repository atau dokumentasi. Akun vendor wajib mengaktifkan MFA dan memiliki recovery/ownership procedure. Free tier GCP maupun vendor lain hanya untuk development/evaluasi sampai kuota, syarat komersial, billing alert, DPA, lokasi data, backup, dan kesiapan produksi disetujui.

### 3.2 Strategi staging dan production

- Gunakan satu project Vercel dengan branch production `main` pada domain `glubee.id` dan branch `staging` pada `staging.glubee.id`.
- Branch `staging` menggunakan Vercel Preview environment/branch-specific environment variables; `main` menggunakan Production environment variables.
- Subdomain hanya memisahkan alamat deployment. Staging wajib memakai Supabase project, Auth configuration, OAuth callback, Brevo/test sender, VAPID key, cron secret, dan data yang terpisah dari production.
- Staging hanya memakai data sintetis. Database atau backup production tidak boleh disalin ke staging.
- Deployment dari feature branch tetap memakai preview URL sementara; hanya branch `staging` yang diarahkan ke subdomain staging tetap.
- Production promotion dilakukan melalui merge/release yang telah lulus QA dan UAT, bukan dengan menyalin environment variable staging ke production.

Pola branch-domain dan environment variable ini mengikuti kemampuan Vercel Preview/Production. Custom Environment Vercel bernama `staging` tidak wajib; fitur tersebut memerlukan paket Pro/Enterprise, sedangkan branch `staging` dapat menggunakan Preview environment dengan domain dan variable khusus branch.

### 3.3 Rekomendasi alamat email

Status: USULAN TEKNIS.

- Sender transaksional: `Glubee <no-reply@glubee.id>`.
- `Reply-To`: `support@glubee.id` agar balasan pengguna tetap masuk ke kanal yang dipantau.
- Kontak privasi: `privacy@glubee.id` dapat diarahkan ke kedua pengelola setelah mereka menyetujui operasional inbox.
- Email autentikasi, undangan, pengingat, dan alert memakai subdomain/domain yang telah diverifikasi pada Brevo.
- SPF dan DKIM wajib dikonfigurasi sesuai record Brevo; DMARC dimulai dengan kebijakan monitoring, ditinjau hasilnya, lalu diperketat setelah seluruh sender sah teridentifikasi.
- Alamat tersebut belum dianggap aktif sebelum mailbox/forwarder, ownership, DNS, dan deliverability test selesai.

## 4. Model data

### 4.1 ERD logis

```text
auth.users 1---1 profiles
auth.users 1---* glucose_entries
glucose_entries 0---1 glucose_entries (replacement_for)
auth.users 1---* schedules 1---* schedule_occurrences
auth.users 1---* emergency_contacts 1---* contact_consents
auth.users 1---* push_subscriptions
auth.users 1---* notification_jobs 1---* notification_attempts
auth.users 1---* consent_receipts
auth.users 1---* deletion_requests
auth.users 1---* data_exports
auth.users 1---* admin_audit_events (subject only)
admin identity 1---* admin_audit_events (actor)
```

### 4.2 Kamus data inti

Semua primary key UUID. Semua timestamp server `timestamptz` UTC. Field tekstual memiliki batas panjang eksplisit.

| Tabel | Field penting | Aturan |
|---|---|---|
| `profiles` | `user_id`, `name`, `birth_date`, `sex`, `timezone_code`, `created_at`, `updated_at` | Satu profil per auth user; timezone hanya `WIB/WITA/WIT`. |
| `glucose_entries` | `id`, `user_id`, `original_value`, `original_unit`, `normalized_mg_dl`, `measurement_context`, `measured_at`, `recorded_at`, `note`, `status`, `invalidated_at`, `replacement_for_id` | Append-only untuk nilai klinis; `status=invalid` dikecualikan. |
| `evaluation_results` | `entry_id`, `rule_version`, `result_code`, `evaluated_at` | Hanya dibuat bila feature gate dan rule version aktif; tidak menyimpan diagnosis. |
| `schedules` | `id`, `user_id`, `category`, `title`, `medicine_name`, `dose_note`, `local_time`, `timezone_code`, `recurrence_rule`, `active`, timestamps | Recurrence null sampai keputusan final; dose adalah input pengguna. |
| `schedule_occurrences` | `id`, `schedule_id`, `due_at`, `state`, `completed_at` | Unique `(schedule_id,due_at)`; state pending/done/missed/cancelled. |
| `emergency_contacts` | `id`, `user_id`, `name`, `email_ciphertext`, `email_hash`, `state`, timestamps | Maksimal dua non-revoked per user; email terenkripsi dan hash untuk dedupe. |
| `contact_consents` | `id`, `contact_id`, `notice_version`, `decision`, `decided_at`, `token_hash`, `expires_at`, `revoked_at` | Token mentah tidak disimpan; keputusan append-only. |
| `push_subscriptions` | `id`, `user_id`, `endpoint_hash`, encrypted subscription fields, `active`, timestamps | Endpoint/keys rahasia operasional; revoke saat gagal permanen. |
| `notification_jobs` | `id`, `user_id`, `contact_id?`, `type`, `channel`, `dedupe_key`, `due_at`, `state`, `attempt_count`, `payload_ref`, timestamps | Unique `dedupe_key`; tidak menyimpan PHI di log payload. |
| `notification_attempts` | `id`, `job_id`, `provider`, `provider_message_id`, `outcome`, `error_class`, `attempted_at` | Tidak menyimpan isi email/push atau token. |
| `consent_receipts` | `id`, `user_id`, `consent_type`, `document_version`, `decision`, `recorded_at`, `method`, `withdrawn_at` | Append-only; bukti versi persetujuan. |
| `cookie_consent_receipts` | `id`, `user_id?`, `anonymous_subject_id?`, `notice_version`, `preferences_json`, `decision_source`, `recorded_at`, `superseded_at` | Tidak menyimpan IP penuh/fingerprint; satu subject reference pseudonymous. |
| `deletion_requests` | `id`, `user_id`, `requested_at`, `scheduled_for`, `cancelled_at`, `executed_at`, `state` | Satu request aktif per user; admin tanpa update policy. |
| `deletion_tombstones` | `subject_hash`, `deleted_at`, `backup_expiry_after` | Minimum non-kesehatan; mencegah resurrection saat restore. |
| `admin_audit_events` | `id`, `actor_id`, `subject_user_id`, `action`, `reason`, `old_state`, `new_state`, `occurred_at`, `correlation_id` | Tidak memuat data kesehatan. |
| `data_exports` | `id`, `user_id`, `state`, `expires_at`, `object_ref`, timestamps | Object terenkripsi/private; signed URL singkat. |

### 4.3 Constraint utama

- `original_value > 0`; presisi dan batas teknis ditetapkan setelah UX input disetujui.
- `original_unit IN ('mg/dL','mmol/L')`.
- Konversi internal konsisten dengan formula yang disetujui dan diuji; nilai asli tidak ditimpa.
- `measured_at` boleh historis; waktu masa depan melewati toleransi ditolak.
- Unique partial index membatasi satu deletion request aktif.
- Constraint/trigger membatasi maksimal dua kontak non-revoked per pengguna secara race-safe.
- Unique `dedupe_key` pada notification job dan `(schedule_id,due_at)` pada occurrence.
- Foreign key deletion behavior harus eksplisit; tidak mengandalkan cascade tanpa review data-retention.

## 5. Autorisasi dan RLS

### 5.1 Matriks akses

| Data | Pengguna | Admin | Anon/kontak | Service job |
|---|---|---|---|---|
| Profil | CRUD milik sendiri | Identitas minimum via view khusus | Tidak | Minimum sesuai job |
| Catatan/evaluasi/laporan | CRUD terbatas milik sendiri | Tidak ada | Tidak ada | Baca minimum untuk job yang sah |
| Jadwal | CRUD milik sendiri | Tidak ada | Tidak ada | Occurrence jatuh tempo |
| Kontak | CRUD milik sendiri | Tidak ada isi | Token action terbatas | Kontak untuk pesan yang disetujui |
| Consent | Baca/buat keputusan sendiri | Metadata kepatuhan terbatas | Keputusan token terbatas | Verifikasi status |
| Penghapusan | Buat/batal/baca sendiri | Baca status, tanpa mutasi | Tidak | Eksekusi jatuh tempo |
| Audit admin | Tidak | Sesuai peran | Tidak | Tulis event |

Kebijakan wajib:

- revoke grants default dan grant kembali hanya operasi yang diperlukan;
- RLS eksplisit untuk select/insert/update/delete;
- test pgTAP allow/deny untuk owner, user lain, anon, admin, dan service path;
- view memakai `security_invoker` bila tersedia/tepat atau berada pada schema private;
- fungsi `security definer` memakai `search_path=''`, ownership/revoke/grant minimum, dan test khusus;
- service-role key tidak pernah masuk browser.

## 6. Kontrak API

Format JSON konsisten: sukses `{ data, meta? }`; gagal `{ error: { code, message, fieldErrors?, correlationId } }`. Pesan publik tidak mengandung stack/provider secret. Mutasi kritis menerima `Idempotency-Key`. Pagination cursor-based.

| Method dan route | Auth | Ringkasan | FR |
|---|---|---|---|
| `GET/PATCH /api/profile` | user | Baca/perbarui profil sendiri. | FR-PROFILE-001 |
| `GET/POST /api/glucose-entries` | user | Daftar/buat catatan milik sendiri. | FR-GLUCOSE-001/003 |
| `POST /api/glucose-entries/{id}/invalidate` | user | Tandai salah, alasan opsional. | FR-GLUCOSE-002 |
| `POST /api/glucose-entries/{id}/replacement` | user | Buat pengganti tertaut. | FR-GLUCOSE-002 |
| `POST /api/glucose-entries/{id}/confirm-alert` | user + gate | Konfirmasi alert untuk nilai sendiri. | FR-CONTACT-002 |
| `GET /api/glucose-summary` | user | Ringkasan/grafik terfilter. | FR-GLUCOSE-003/004 |
| `POST /api/reports` | user | Generate laporan async/sync sesuai ukuran. | FR-REPORT-001 |
| `GET /api/reports/{id}/download` | user | Signed/streamed download milik sendiri. | FR-REPORT-001 |
| `GET/POST /api/schedules` | user | Daftar/buat jadwal. | FR-SCHEDULE-001 |
| `PATCH/DELETE /api/schedules/{id}` | user | Ubah/jeda/aktifkan/hapus jadwal sendiri. | FR-SCHEDULE-001 |
| `GET/POST /api/emergency-contacts` | user | Daftar/undang kontak. | FR-CONTACT-001 |
| `DELETE /api/emergency-contacts/{id}` | user | Cabut hubungan. | FR-CONTACT-001 |
| `POST /api/contact-invitations/{token}` | public token | Terima/tolak sekali pakai. | FR-CONTACT-001 |
| `POST/DELETE /api/push-subscriptions` | user | Tambah/nonaktif subscription. | FR-REMINDER-001 |
| `GET/PUT /api/privacy/cookie-preferences` | optional user/session | Baca/simpan preferensi dan receipt versioned. | FR-COOKIE-001 |
| `POST /api/account/deletion` | re-auth user | Ajukan penghapusan. | FR-DELETE-001 |
| `DELETE /api/account/deletion` | re-auth user | Batalkan penghapusan. | FR-DELETE-001 |
| `POST /api/account/export` | re-auth user | Buat ekspor. | FR-EXPORT-001 |
| `GET/PATCH /api/admin/accounts/{id}/status` | admin | Status akun dan alasan; tanpa health join. | FR-ADMIN-001 |
| `POST /api/internal/jobs/dispatch` | signed internal | Claim/proses batch job jatuh tempo. | FR-REMINDER-001 |
| `POST /api/internal/jobs/delete-accounts` | signed internal | Eksekusi deletion jatuh tempo. | FR-DELETE-002 |

Trust-boundary validation menggunakan schema server. CSRF/origin protection diterapkan untuk cookie-based mutation; OAuth redirect allowlist ketat. Token publik memiliki rate limit, expiry, single-use, dan response yang tidak membocorkan akun.

## 7. Waktu, jadwal, dan satuan

- Simpan instant UTC serta zona IANA ekuivalen yang dipetakan dari WIB/WITA/WIT; label pilihan pengguna tetap disimpan.
- `measured_at`, `recorded_at`, `due_at`, dan `sent_at` berbeda dan tidak dapat dipertukarkan.
- Job scheduler boleh berjalan setiap menit; claim memakai transaction + locking/`SKIP LOCKED` atau pola atomik setara.
- Perubahan zona menghasilkan occurrence mendatang menurut aturan produk; occurrence lampau tidak dihitung ulang.
- Dedupe key minimum mencakup type, subject, occurrence/entry, recipient, dan channel.
- Nilai asli/satuan asli selalu digunakan untuk komunikasi kontak; normalisasi hanya untuk perhitungan konsisten.

## 8. Mesin evaluasi medis

Status: PENDING, default-off.

- Rule disimpan sebagai konfigurasi/migration versioned, bukan hard-code tersebar.
- Setiap hasil mencatat `rule_version` dan input context.
- Urutan evaluasi serta threshold tidak diimplementasikan sebagai final sebelum `BR-PEND-001..004` selesai.
- Kondisi **sebelum makan** dan **GDS** memiliki enum berbeda sampai keputusan menyatukannya secara eksplisit.
- Keluaran hanya code non-diagnostik yang telah disetujui.
- Rule change tidak mengevaluasi ulang data lama tanpa keputusan bisnis, komunikasi pengguna, dan audit.

## 9. Notifikasi dan antrean

- Outbox/database queue adalah source of truth; request pengguna tidak menunggu provider eksternal.
- Producer membuat job idempotent; worker mengklaim batch kecil, menetapkan lease, mengirim, lalu mencatat attempt.
- Retry exponential/backoff terbatas untuk transient error; permanent error disuppress dan subscription invalid dinonaktifkan.
- Kuota provider dipantau. Email autentikasi, undangan, reminder, dan alert dihitung dalam kapasitas yang sama.
- Konten template versioned dan diuji agar tidak menyatakan diagnosis.
- Alert kontak memeriksa ulang consent, status akun, invalidation catatan, dan grace-period tepat sebelum send.
- Tidak ada fallback WhatsApp. Browser push yang tidak diizinkan memakai email bila alamat terverifikasi.

## 10. Penghapusan, retensi, dan backup

### 10.1 Retensi usulan untuk review hukum

| Data | Retensi usulan |
|---|---|
| Data akun/health aktif | Selama akun aktif atau sampai deletion dieksekusi. |
| Job payload sensitif | Minimum operasional; hapus/redact setelah terminal. |
| Audit consent/admin/security | Sesuai kewajiban hukum dan limitation period yang ditetapkan counsel. |
| Backup off-site | Rotasi terenkripsi dengan periode final yang disetujui sebelum produksi. |
| Tombstone deletion | Minimum yang diperlukan untuk mencegah restore, tanpa data kesehatan. |
| Export file | Kedaluwarsa singkat dan dihapus otomatis. |

### 10.2 Backup/restore

- Supabase Free tidak memiliki backup otomatis; bila dipakai sementara, jadwalkan `db dump` terenkripsi ke lokasi off-site terkontrol.
- Production tier dan RPO/RTO harus disetujui sebelum go-live; usulan awal untuk review: RPO <=24 jam, RTO <=8 jam.
- Restore drill dilakukan sebelum rilis dan berkala; hasil dicatat.
- Restore wajib menjalankan deletion-tombstone reconciliation agar akun/data yang sudah dihapus tidak aktif kembali.
- Backup database tidak otomatis mencakup object storage; keduanya memiliki prosedur terpisah.

## 11. Keamanan

- TLS wajib; secure/httpOnly/sameSite cookie sesuai flow.
- Password/OAuth ditangani Supabase Auth; custom SMTP production dikonfigurasi dengan domain terverifikasi.
- Enkripsi field kontak/push sensitif pada aplikasi/KMS yang disetujui; database/storage encryption vendor diverifikasi.
- Rate limit per IP, account, route, dan token untuk auth, invite, report, export, dan alert confirm.
- Security headers, CSP, validation upload/object, dependency scanning, secret scanning, dan audit log.
- Re-authentication untuk deletion, export, serta perubahan keamanan akun.
- Tidak ada PHI pada analytics pihak ketiga; analytics non-esensial perlu review dan consent terpisah.
- Threat model minimum: IDOR, RLS bypass, service-role leak, token replay, enumeration, CSRF, XSS pada note/nama, SSRF/provider webhook, job replay, backup leak, dan admin overreach.

### 11.1 Implementasi cookie consent

- Cookie sesi/auth memakai `Secure`, `HttpOnly` bila dapat diterapkan oleh flow, `SameSite` yang paling ketat tanpa merusak OAuth, scope path/domain minimum, dan expiry proporsional.
- Consent manager dimuat sebelum tag non-esensial. Tag analytics/marketing tidak boleh ada pada HTML awal, preload, service worker, atau request server-side sebelum kategori terkait aktif.
- Preferensi anonim disimpan first-party dengan identifier acak minimum; setelah login dapat ditautkan ke receipt akun tanpa membuat fingerprint lintas situs.
- Penarikan consent mencegah request berikutnya dan menghapus cookie/local storage non-esensial first-party yang dikenal. Penghapusan identifier third-party mengikuti kemampuan/vendor dan dijelaskan secara jujur.
- Daftar cookie/storage harus dihasilkan dari audit nyata dan memuat nama, penyedia, tujuan, kategori, durasi, serta first/third party. Jangan mengarang daftar sebelum implementasi/vendor final.

## 12. Observabilitas

Metric minimum:

- request rate/error/latency per route tanpa health payload;
- job queued/claimed/sent/failed/suppressed/oldest-age;
- email/push quota dan failure class;
- auth error/abuse signal;
- deletion due/failed/overdue;
- backup age dan restore-drill age.

Log terstruktur memakai correlation ID, actor class, event type, object ID pseudonymous, dan outcome. Alert operasional tidak membawa nilai gula darah atau isi pesan. Akses log dibatasi dan memiliki retensi.

## 13. Kinerja, aksesibilitas, dan kompatibilitas

- Target awal berbasis pengukuran nyata setelah UI tersedia; jangan menjanjikan SLA sebelum paket vendor dipilih.
- Query time-series terindeks pada `(user_id, measured_at)` dengan partial/index strategy untuk status valid.
- Pagination wajib untuk riwayat/audit; report besar tidak menahan request tanpa batas.
- UI memenuhi WCAG 2.2 AA sebagai target: keyboard, focus, label, contrast, error association, reduced motion, dan grafik memiliki alternatif tabel.
- Browser support final mengikuti analytics target; push bersifat enhancement, bukan satu-satunya pengingat.

## 14. Pengujian

- Unit: konversi satuan, waktu/cutoff, dedupe, state machine, dan rule version (setelah disetujui).
- Database: constraint, migration, RLS allow/deny, view/function privilege, dan concurrency limit dua kontak.
- Integration: auth/OAuth callback, Brevo mock, Web Push mock, cron claim/retry, PDF, export, deletion.
- E2E: seluruh `UAT-001..011` pada FRD.
- Security: IDOR lintas pengguna, admin health-access denial, token replay/expiry, CSRF, rate limit, secret/log scan.
- Privacy/cookie: scan network, cookie, local/session storage, service worker, dan server-side tags sebelum/sesudah setiap pilihan consent.
- Resilience: provider timeout/quota, duplicate delivery request, worker crash after send, backup restore + tombstone.
- Data uji selalu sintetis.

## 15. Deployment dan rollback

1. CI menjalankan format/lint/typecheck/test/build/migration checks.
2. Preview memakai environment terpisah dan data sintetis.
3. Migration production direview, dibackup, dan memakai expand/migrate/contract bila perubahan destruktif.
4. Feature gate baru default-off; aktifkan setelah deploy sehat dan persetujuan tersedia.
5. Rollback aplikasi ke artifact sebelumnya; schema memakai backward-compatible forward-fix atau rollback yang telah diuji.
6. Validasi smoke test auth, input, isolation, queue, dan deletion guard.

Tidak ada deployment produksi sebelum UAT, checklist legal, paket vendor, backup/restore, sender domain, DNS, monitoring, dan persetujuan eksplisit selesai.

## 16. Batas paket vendor per 9 September 2026

- Vercel Hobby hanya untuk penggunaan personal/nonkomersial; pilih paket yang sesuai untuk proyek klien.
- Supabase Free dapat dijeda setelah aktivitas rendah dan tidak menyediakan backup otomatis; jangan jadikan tier gratis satu-satunya kesiapan produksi.
- Brevo Free menyediakan 300 pengiriman email per hari; pesan lebih dari kapasitas dapat tertunda/tidak terkirim. Sistem harus memantau dan menampilkan kegagalan.
- Jumlah pengguna awal dan volume notifikasi belum dapat dipastikan. Karena itu tidak ada angka kapasitas yang dijanjikan; rilis dilakukan terbatas dengan metric penggunaan, antrean, error, dan kuota, lalu paket dinaikkan berdasarkan data nyata.
- Harga, kuota, lokasi pemrosesan, DPA, subprocessor, dan ketentuan vendor wajib diverifikasi lagi tepat sebelum keputusan produksi.

## 17. Traceability ringkas

| BR | FR | Komponen/test utama |
|---|---|---|
| BR-001/002 | FR-GLUCOSE-*, FR-REPORT-001 | entries, summary, PDF, RLS/E2E |
| BR-003/004 | FR-SCHEDULE-*, FR-REMINDER-001 | schedules, occurrences, queue, provider mock |
| BR-005 | FR-REMINDER-002, FR-CONTACT-* | consent, cutoff, dedupe, revocation test |
| BR-006/007 | FR-AUTH-*, FR-PROFILE-*, FR-DELETE-*, FR-ADMIN-* | Auth, RLS, audit, deletion/restore |
| BR-009 | FR-COOKIE-001 | Consent manager, storage/network scan, versioned receipt |
| BR-PEND-001..008, BR-PEND-010..011 | Feature gates dan release gate | Assert kebutuhan yang masih PENDING tetap default-off/terblokir pada CI/UAT |
