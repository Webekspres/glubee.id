# Deploy Glubee ke VPS Webekspres

Keputusan arsitektur: [ADR-0001](../docs/engineering/adr/0001-self-host-supabase-on-vps.md). Urutan kerja lengkap: [IMPLEMENTATION_PLAN_SELF_HOST](../docs/IMPLEMENTATION_PLAN_SELF_HOST.md).

## Isi folder

| File | Fungsi |
|---|---|
| `docker-compose.yml` | `db` (Postgres 17), `auth` (GoTrue), `rest` (PostgREST), `app` (Next.js). Tanpa gateway, Studio, atau meta. |
| `db/roles.sql`, `db/jwt.sql` | Init DB dari upstream Supabase; hanya jalan saat volume `db-data` masih kosong. |
| `nginx/glubee.id.conf` | Proxy ke app, `limit_req` untuk `/api/auth/` dan `POST /api/consents/cookie`, buffer header 16k untuk cookie sesi OAuth. |
| `nginx/api.glubee.id.conf` | Pengganti gateway: path publik terbatas, path lain hanya dari subnet container. |
| `.env.example` | Template `/opt/glubee/.env`. |
| `generate-keys.sh` | Membuat password DB, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `CRON_SECRET`. |

## Aturan VPS

- Jangan deploy, restart, atau update pada **06:00–07:30** dan **12:45–14:45 WIB** (jam puncak app absensi pesantren di VPS yang sama).
- Semua port hanya bind ke `127.0.0.1`. Jangan ubah ke `0.0.0.0`: port Docker yang di-publish melewati `ufw`.
- Jangan mengubah file nginx milik site lain. Selalu `sudo nginx -t` lalu `sudo systemctl reload nginx` (bukan `restart`).

## Provision pertama

1. Cek Docker Compose v2 dan grup docker, lalu pastikan port kosong:
   ```bash
   docker compose version
   id -nG adminweb | grep -w docker
   sudo ss -tlnp | grep -E ':(3000|3001|9999|54329)\b'
   ```
   Bila ada port terpakai, ubah `*_HOST_PORT` di `.env` **dan** port upstream di template nginx.
2. Salin folder `deploy/` ke `/opt/glubee`, lalu buat `.env`:
   ```bash
   cd /opt/glubee
   cp .env.example .env && chmod 600 .env
   bash generate-keys.sh   # salin hasilnya ke .env
   ```
   Isi juga SMTP Brevo. `GOOGLE_ENABLED` tetap `false` sampai redirect URI terdaftar.
3. Login GHCR sekali dengan PAT `read:packages`:
   ```bash
   docker login ghcr.io -u sultanwebekspres
   ```
4. Nyalakan backend, lalu cek:
   ```bash
   docker compose up -d db auth rest
   docker compose ps
   free -h
   ```
5. Migration dan pgTAP dari laptop lewat SSH tunnel (Postgres tanpa SSL, jadi wajib `sslmode=disable`; tunnel sudah terenkripsi):
   ```bash
   ssh -N -L 54329:127.0.0.1:54329 adminweb@<vps>
   bunx supabase db push --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54329/postgres?sslmode=disable"
   bunx supabase test db --db-url "postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54329/postgres?sslmode=disable"
   ```
6. Deploy app pertama kali lewat GitHub Actions (workflow **Deploy**), atau manual: `docker compose up -d app`.

Deploy key GitHub Actions di `~adminweb/.ssh/authorized_keys` memakai opsi `restrict,port-forwarding,permitopen="127.0.0.1:54329"`: tanpa PTY dan hanya boleh tunnel ke Postgres. Jangan buka forwarding ke port lain.

## Administrasi database

Tidak ada Studio. Pakai SSH tunnel di atas, lalu `psql` atau DBeaver/TablePlus ke `127.0.0.1:54329`, user `postgres`, SSL nonaktif.

## Path publik `api.glubee.id`

Dari internet hanya ini yang terbuka: `/auth/v1/health`, `/auth/v1/verify`, `/auth/v1/authorize`, `/auth/v1/callback`. Semua path lain (termasuk `/rest/v1` dan `/auth/v1/admin`) menghasilkan 403 kecuali dari subnet `GLUBEE_SUBNET`. Container app mencapainya lewat `extra_hosts: api.glubee.id:host-gateway`.

Fitur baru yang memanggil Supabase langsung dari browser (realtime, OAuth provider lain, magic link) wajib menambah path-nya di `nginx/api.glubee.id.conf`.

## Memperbarui konfigurasi nginx

Workflow **Deploy** hanya mengganti image app; file nginx tidak ikut. Setelah `deploy/nginx/*.conf` berubah dan sudah di-push, jalankan di VPS (di luar jam puncak):

```bash
sudo curl -fsSL https://raw.githubusercontent.com/Webekspres/glubee.id/dev/deploy/nginx/glubee.id.conf -o /opt/glubee/nginx/glubee.id.conf
sudo bash /opt/glubee/nginx/install.sh
```

Ganti `dev` dengan `main` setelah production dirilis dari `main`. Callback OAuth yang 502 biasanya berarti buffer header terlalu kecil (`upstream sent too big header` di `/var/log/nginx/error.log`).

## Akun admin dan akun demo

Halaman admin ada di `https://glubee.id/admin-xyz` (cari akun, ubah status dengan alasan, buat akun demo terverifikasi). Path ini bukan pengaman; akses dicek dari `app_metadata.app_role = "admin"` di server dan di database, dan setiap tindakan tercatat di `admin_audit_events`.

1. Terapkan migration `20261001000100_admin_account_status.sql` lewat tunnel (langkah 5 di atas: `supabase db push`), lalu deploy app.
2. Daftarkan email admin lewat `https://glubee.id/register` dan verifikasi, atau buat akun lewat form akun demo di halaman admin yang sudah ada.
3. Jadikan admin lewat tunnel Postgres (ganti email):
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"app_role":"admin"}'
   where email = 'admin@glubee.id';
   ```
   Admin harus keluar lalu masuk lagi agar token membawa role baru. Gunakan password panjang yang unik; jangan menyimpannya di repo.
4. Akun demo klien: buat di halaman admin, lalu isi data contoh dari laptop:
   ```bash
   GLUBEE_URL=https://glubee.id DEMO_EMAIL=... DEMO_PASSWORD=... bun scripts/demo-data.ts --onboard
   ```

## Rate limit

- nginx: `glubee.id/api/auth/` 10 request/menit per IP (burst 5); `POST /api/consents/cookie` 10/menit per IP (burst 5); path publik `api.glubee.id` 30/menit per IP (burst 10).
- GoTrue melihat semua panggilan server sebagai satu IP (container app), jadi limit per-IP-nya dilonggarkan. Limit email tetap 100/jam global untuk menjaga kuota Brevo.

## Backup

`backup/backup.sh` berjalan lewat crontab `adminweb` pukul 02:37 (zona server WIB; bukan jam bulat karena kuota Drive client bersama rclone sering habis di jam bulat):

```cron
37 2 * * * /opt/glubee/backup/backup.sh glubee.id /opt/glubee
```

- `pg_dump -Fc` langsung dienkripsi dengan `age` (plaintext tidak pernah menyentuh disk), diunggah ke `gdrive:backup website/glubee.id/dd-mm-yyyy-HHmm/`, lalu hanya 7 folder terbaru yang disimpan.
- Healthchecks.io menerima ping `/start`, sukses, atau `/fail` (dengan 1 KB log terakhir). Email alert datang bila gagal **atau** tidak berjalan.
- Log: `/opt/glubee/backup/backup.log`.
- Menambah domain lain: jalankan script yang sama dengan `<domain> <stack-dir>` miliknya, dengan variabel `BACKUP_*` di `.env` stack tersebut.

### Restore (drill wajib sebelum go-live, SRS §10.2)

Di laptop yang memegang private key, ke Supabase lokal (`bun run db:start`):

```bash
rclone copy "gdrive:backup website/glubee.id/<dd-mm-yyyy-HHmm>" ./restore
age -d -i ~/glubee-backup.agekey ./restore/glubee.id.dump.age > ./restore/glubee.dump
pg_restore -h 127.0.0.1 -p 54322 -U postgres -d postgres --clean --if-exists --no-owner ./restore/glubee.dump
bun run db:test
```

Setelah restore, jalankan rekonsiliasi penghapusan akun (di bawah) sebelum data dipakai. Hapus `./restore` setelah selesai.

### Rekonsiliasi penghapusan akun setelah restore (wajib)

Backup lama masih memuat akun yang sudah dihapus setelah backup dibuat, dan tidak tahu permintaan hapus yang diajukan atau dibatalkan sesudahnya. Tanpa langkah ini, akun terhapus hidup lagi (melanggar hak penghapusan UU PDP) atau akun yang batal dihapus ikut terhapus oleh `pg_cron`. Tabel `deletion_tombstones` ikut ter-restore ke versi lama, jadi datanya harus diambil **sebelum** restore.

`DB` di bawah adalah URL database yang dipulihkan: production lewat tunnel (`?sslmode=disable`) atau Supabase lokal saat drill.

1. **Sebelum restore**, bila database lama masih bisa dibaca, ekspor tombstone dan permintaan aktif (`mkdir -p ./restore` dulu):
   ```bash
   psql "$DB" -Atc "select coalesce(jsonb_agg(jsonb_build_object('subject_hash',encode(subject_hash,'hex'),'deleted_at',deleted_at,'backup_expiry_after',backup_expiry_after)),'[]') from public.deletion_tombstones" > ./restore/tombstones.json
   psql "$DB" -Atc "select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'requested_at',requested_at,'scheduled_for',scheduled_for,'previous_account_status',previous_account_status)),'[]') from public.deletion_requests where state in ('pending','failed') and user_id is not null" > ./restore/active-requests.json
   ```
   Bila database lama sudah tidak bisa dibaca, ambil tombstone dari backup **terbaru** (restore dulu ke Supabase lokal, jalankan perintah pertama di sana) dan lewati `active-requests.json`. Risiko yang tersisa ditulis di laporan insiden: penghapusan setelah backup terbaru tidak tercatat, dan pembatalan setelah backup terbaru tidak diketahui.
2. Production: hentikan app agar tidak ada penulisan baru: `docker compose stop app`.
3. Restore (perintah `pg_restore` di atas, dengan `$DB` sebagai tujuan).
4. **Langsung** matikan eksekusi otomatis supaya `pg_cron` tidak menghapus akun sebelum rekonsiliasi:
   ```bash
   psql "$DB" -c "select cron.unschedule('glubee-execute-deletions')"
   ```
   Backup yang lebih tua dari migration terbaru belum punya job ini (abaikan error `could not find valid entry`) atau fungsi rekonsiliasi. Terapkan migration yang tertinggal dulu: `bunx supabase db push --db-url "$DB"`, lalu ulangi `cron.unschedule` karena migration deletion membuat job baru.
5. Rekonsiliasi. Tanpa `active-requests.json`, ganti `:'a'::jsonb` dengan `null` dan hapus `-v a=...`:
   ```bash
   echo "select private.reconcile_deletions_after_restore(:'t'::jsonb, :'a'::jsonb)" |
     psql "$DB" -v t="$(cat ./restore/tombstones.json)" -v a="$(cat ./restore/active-requests.json)"
   ```
   Query dikirim lewat stdin karena psql tidak mengganti variabel `:'t'` pada `-c`. Hasilnya `{"removed": n, "reinstated": n, "cancelled": n}`: akun bertombstone yang dihapus lagi, permintaan baru yang dipasang lagi dengan jadwal aslinya, dan permintaan yang dibatalkan lagi. Aman dijalankan ulang (hasil kedua bernilai 0). Catat angkanya di laporan insiden/drill.
6. Nyalakan lagi eksekusi otomatis, lalu app:
   ```bash
   psql "$DB" -c "select cron.schedule('glubee-execute-deletions', '*/15 * * * *', 'select private.execute_due_deletions()')"
   docker compose start app
   ```
7. Hapus `./restore` (berisi hash akun dan dump).

## Update image (sebulan sekali, di luar jam puncak)

1. Bandingkan tag di `docker-compose.yml` dengan `supabase/docker/docker-compose.yml` upstream; baca changelog GoTrue, PostgREST, dan `supabase/postgres`.
2. Ubah tag di repo, commit, salin ke `/opt/glubee`, lalu `docker compose pull && docker compose up -d`.
3. Upgrade **major** Postgres tidak boleh lewat ganti tag saja; butuh prosedur dump/restore tersendiri.

## Rollback aplikasi

Jalankan ulang workflow **Deploy** dari commit sebelumnya, atau di VPS: ubah `APP_TAG` di `.env` ke sha sebelumnya lalu `docker compose up -d app`.
