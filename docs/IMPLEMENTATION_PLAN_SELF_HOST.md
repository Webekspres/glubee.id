# Master Implementation Plan: Self-host Supabase + Next.js di VPS Webekspres

Dokumen ini adalah panduan implementasi teknis siap eksekusi untuk memindahkan target deployment Glubee dari Vercel + Supabase Cloud ke VPS Webekspres. Dasar keputusan ada di [ADR-0001](engineering/adr/0001-self-host-supabase-on-vps.md). Bila plan ini bertentangan dengan ADR, ADR yang berlaku.

---

## 1. Konteks & Aturan Fundamental

- **Status proyek**: development, belum ada pengguna aktif. Database live boleh dikosongkan sampai go-live (ADR-0001 §Keputusan 8).
- **Tidak ada perubahan logika aplikasi.** Kode, migration, RLS, pgTAP, dan E2E tetap. Perubahan repo hanya: packaging (Docker), konfigurasi deploy, CI/CD, dan dokumentasi.
- **VPS dipakai bersama production app lain.** Wajib:
  - setiap port Glubee bind ke `127.0.0.1`, tidak pernah `0.0.0.0`;
  - setiap container memiliki `mem_limit`;
  - deploy/restart/maintenance **dilarang** pada 05:30–07:30 dan 14:30–15:30 WIB;
  - jangan mengubah file nginx milik site lain di `/etc/nginx/sites-enabled/`.
- **Secret tidak pernah masuk git.** Repo hanya berisi `.env.example` dengan placeholder.
- **Data uji sintetis.** Tidak ada data kesehatan asli sebelum go-live checklist SRS §15 terpenuhi.

---

## 2. Keputusan Terkonfirmasi (24 September 2026)

| Topik | Keputusan | Implementasi |
|---|---|---|
| Platform | VPS Webekspres, Rp0 | Docker Compose di `/opt/glubee` |
| DB + Auth | Supabase self-hosted | `db`, `auth`, `rest`, `kong` selalu aktif; `studio` + `meta` pakai profile `admin` |
| Domain | `glubee.id` (app), `api.glubee.id` (Supabase API) | nginx vhost baru + certbot |
| Build/deploy | GitHub Actions → GHCR → deploy manual | `workflow_dispatch` dengan guard jam puncak |
| Backup | Harian 02:00 WIB, terenkripsi, 7 versi | `pg_dump` → `age` → `rclone` ke GDrive `backup website/glubee.id/dd-mm-yyyy-HHmm` |
| Scope backup | Glubee saja dulu | Script generik per domain agar mudah ditambah |
| Staging | Tidak ada selama dev; wajib setelah ada pengguna aktif | Dicatat di SRS §3.2 |
| Branch | Kode infra di `dev`; deploy selama dev boleh dari `dev`, setelah go-live wajib `main` | Input `ref` pada workflow |
| User deploy di VPS | `adminweb` (user existing) | SSH key **khusus GitHub Actions**, terpisah dari key pribadi, agar bisa dicabut sendiri |
| Monitoring backup | Healthchecks.io free | Ping `/start`, sukses, `/fail`; alert email bila gagal atau tidak jalan |
| Monitoring uptime | UptimeRobot free, aktif sejak dev | 4 monitor, alert ke `mk.webekspres@gmail.com` |

---

## 3. Prasyarat (dikerjakan manusia, bukan agent)

| # | Tindakan | Pemilik | Blocking untuk |
|---|---|---|---|
| P1 | Izin atasan untuk memakai ±2,5 GB RAM VPS | Sultan | Tahap 3 |
| P2 | DNS A record `glubee.id` dan `api.glubee.id` → IP VPS | Sultan | Tahap 4 |
| P3 | Buat keypair `age`; simpan **private key** di password manager (bukan di VPS), berikan public key | Sultan | Tahap 5 |
| P4 | `rclone config` di VPS: otorisasi remote `gdrive` dengan akun `mk.webekspres@gmail.com` | Sultan | Tahap 5 |
| P5 | Buat SSH keypair khusus GitHub Actions, public key ke `~adminweb/.ssh/authorized_keys`, lalu isi GitHub Actions secrets (daftar di Tahap 2.3) | Sultan | Tahap 2 deploy |
| P6 | Kredensial SMTP Brevo ke `/opt/glubee/.env` | Sultan | Tahap 3 |
| P7 | Tambah redirect URI `https://api.glubee.id/auth/v1/callback` di Google Cloud Console, lalu isi client ID/secret di `.env` | Sultan | Tahap 6 (Google login) |
| P8 | Daftar Healthchecks.io dengan `mk.webekspres@gmail.com`, buat check `glubee.id-backup` (cron `0 2 * * *`, TZ `Asia/Jakarta`, grace 30 menit), simpan ping URL ke `/opt/glubee/.env` | Sultan | Tahap 5 |
| P9 | Daftar UptimeRobot dengan `mk.webekspres@gmail.com`, buat monitor sesuai Tahap 7 | Sultan | Tahap 7 |

Agent memberi tahu Sultan setiap kali satu prasyarat menjadi blocker, lalu lanjut ke item lain yang tidak terblokir.

---

## 4. Langkah Pengerjaan

### Tahap 1: Packaging aplikasi

#### 1.1 Modifikasi [`next.config.ts`](../next.config.ts)
- Tambah `output: "standalone"`. Pertahankan `outputFileTracingIncludes` yang ada (font PDF dan dokumen legal) dan verifikasi file tersebut ikut ter-copy ke `.next/standalone`.

#### 1.2 Buat `Dockerfile` (multi-stage) dan `.dockerignore`
- Builder `oven/bun:1.4`: `bun install --frozen-lockfile`, `bun run build`.
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` dipasang sebagai **build args** karena di-inline saat build.
- Copy `supabase/templates/*.html` ke `public/_auth-templates/` agar GoTrue dapat mengambilnya melalui network internal (`http://app:3000/_auth-templates/...`).
- Runner `oven/bun:1.4-slim`, user non-root, `EXPOSE 3000`, `CMD ["bun", "server.js"]`, `HEALTHCHECK` ke `/`.
- `.dockerignore`: `node_modules`, `.next`, `.git`, `tests`, `.env*`, `playwright-report`, `test-results`.

#### 1.3 Verifikasi lokal
```bash
docker build -t glubee:local --build-arg NEXT_PUBLIC_APP_URL=http://localhost:3000 --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon lokal> .
```
Jalankan dengan `bun run db:start` aktif; login, input gula darah, dan unduh PDF harus berhasil.

### Tahap 2: Konfigurasi deploy di repo (`deploy/`)

#### 2.1 `deploy/docker-compose.yml`
- Basis: `docker/docker-compose.yml` resmi Supabase (pin versi image, catat di komentar), dipangkas menjadi `db`, `auth`, `rest`, `kong`, `meta`, `studio`, plus `app`.
- `db`: image `supabase/postgres` major 17 (sama dengan `supabase/config.toml`), volume `glubee_db`, ports `127.0.0.1:54329:5432`.
- `kong`: ports `127.0.0.1:8000:8000`. `app`: ports `127.0.0.1:3000:3000`, image `ghcr.io/webekspres/glubee:${APP_TAG}`.
- `meta` + `studio`: `profiles: ["admin"]`, studio ports `127.0.0.1:54323:3000`.
- `mem_limit`: db 1g, auth 256m, rest 256m, kong 384m, app 768m, meta 256m, studio 512m.
- `restart: unless-stopped` untuk service selalu aktif.
- Logging semua service: driver `json-file` dengan `max-size: 10m`, `max-file: 3` agar disk tidak penuh.
- Semua image di-pin ke versi eksak (tidak memakai `latest` untuk Supabase). Update manual sebulan sekali di luar jam puncak, dicatat di `deploy/README.md`.
- Konfigurasi `auth` (dipetakan dari `supabase/config.toml`):
  - `GOTRUE_SITE_URL=https://glubee.id`, `API_EXTERNAL_URL=https://api.glubee.id`, `GOTRUE_URI_ALLOW_LIST=https://glubee.id/**`;
  - `GOTRUE_JWT_EXP=3600`, `GOTRUE_PASSWORD_MIN_LENGTH=8`, `GOTRUE_MAILER_AUTOCONFIRM=false`;
  - `GOTRUE_MAILER_TEMPLATES_{CONFIRMATION,RECOVERY,INVITE}=http://app:3000/_auth-templates/<file>.html`;
  - `GOTRUE_MAILER_SUBJECTS_*` sesuai subject di `config.toml`;
  - SMTP Brevo dan `GOTRUE_EXTERNAL_GOOGLE_*` dari `.env`.

#### 2.2 `deploy/kong.yml`, `deploy/.env.example`, `deploy/README.md`
- `kong.yml` hanya merutekan `/auth/v1/*` dan `/rest/v1/*` (hapus route storage/realtime/functions/analytics).
- `.env.example`: `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `SMTP_*`, `GOOGLE_CLIENT_ID/SECRET`, `APP_TAG`, variabel `SMTP_*` aplikasi (`src/lib/email.ts`).
- `deploy/README.md`: cara generate `JWT_SECRET` dan menurunkan `ANON_KEY`/`SERVICE_ROLE_KEY` darinya, cara start profile admin, cara SSH tunnel.

#### 2.3 `.github/workflows/deploy.yml`
- Trigger: `workflow_dispatch` (input `ref`, default `main`). Selama dev boleh `ref=dev`; setelah go-live job gagal bila `ref` bukan `main`.
- Job `build`: `bun run check` → `docker build` dengan build args dari secrets → push `ghcr.io/webekspres/glubee:<sha>` dan `:latest`.
- Job `deploy`: guard jam WIB (gagal bila di 05:30–07:30 atau 14:30–15:30), SSH ke VPS, `APP_TAG=<sha> docker compose pull app && docker compose up -d app`, lalu smoke check `curl -fsS https://glubee.id/`.
- Secrets: `VPS_HOST`, `VPS_USER` (`adminweb`), `VPS_SSH_KEY` (key khusus GitHub Actions), `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. VPS login ke GHCR memakai PAT `read:packages`.
- Rollback: jalankan ulang job `deploy` dengan `APP_TAG` sha sebelumnya.

### Tahap 3: Provision stack di VPS (butuh P1, P6)

1. Cek prasyarat VPS: `docker compose version` (wajib Compose v2) dan `adminweb` anggota grup `docker`.
2. `/opt/glubee` milik `adminweb`, isi dari folder `deploy/`, `.env` dengan `chmod 600`.
3. `docker compose up -d db auth rest kong` → cek `docker compose ps` sehat dan `free -h` masih menyisakan headroom untuk app lain.
4. Terapkan migration lewat SSH tunnel:
   ```bash
   ssh -L 54329:127.0.0.1:54329 adminweb@<vps>
   bunx supabase db push --db-url "postgresql://postgres:<password>@127.0.0.1:54329/postgres"
   ```
5. Jalankan pgTAP terhadap DB VPS (`bunx supabase test db --db-url ...`); semua harus lulus.
6. Verifikasi dari luar VPS bahwa port 54329, 8000, 3000 **tidak** dapat dijangkau (`nc -zv <ip> 54329` gagal).

### Tahap 4: nginx + TLS (butuh P2)

- Buat `/etc/nginx/sites-available/glubee.id` dan `api.glubee.id` (template disimpan di `deploy/nginx/`), symlink ke `sites-enabled`.
- `glubee.id` → `proxy_pass http://127.0.0.1:3000`; `api.glubee.id` → `proxy_pass http://127.0.0.1:8000`. Teruskan `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`.
- `certbot --nginx -d glubee.id -d api.glubee.id`.
- Selalu `nginx -t` sebelum `systemctl reload nginx`; jangan `restart` (site lain ikut terputus).

### Tahap 5: Backup (butuh P3, P4, P8)

#### 5.1 `deploy/backup/backup.sh` (generik, argumen: nama domain + container DB)
0. `curl -fsS -m 10 --retry 3 "$HC_PING_URL/start"` (kegagalan ping tidak menggagalkan backup).
1. `docker exec <db> pg_dump -U postgres -Fc postgres` (mencakup schema `auth` dan `public`).
2. Enkripsi stream dengan `age -r <public key>` → `glubee.id.dump.age`.
3. `rclone copy` ke `gdrive:backup website/glubee.id/$(TZ=Asia/Jakarta date +%d-%m-%Y-%H%M)/`.
4. Hapus folder tertua sampai tersisa 7.
5. Bila semua sukses: ping `$HC_PING_URL`. Bila langkah mana pun gagal: ping `$HC_PING_URL/fail` dengan 1 KB terakhir log sebagai body, lalu exit non-zero. Log ke `/var/log/glubee-backup.log`.
6. Tidak ada pengiriman email dari script; alert email dikirim Healthchecks.io (gagal **atau** tidak jalan sampai lewat grace 30 menit).

#### 5.2 Jadwal
- systemd timer atau cron `0 2 * * *` dengan `TZ=Asia/Jakarta` (02:00 WIB).

#### 5.3 Restore drill (wajib sebelum go-live, SRS §10.2)
- Unduh backup, dekripsi dengan private key, restore ke Supabase lokal (`pg_restore`), jalankan pgTAP dan login dengan akun uji. Catat tanggal dan hasil di `docs/planning/`.

### Tahap 6: Verifikasi end-to-end (butuh P7 untuk Google)

- Register email → email verifikasi terkirim via Brevo dengan template Glubee → verifikasi → onboarding.
- Login password, logout, reset password, update password, resend email.
- Login Google (redirect ke `api.glubee.id/auth/v1/callback` lalu kembali ke `glubee.id/auth/callback`).
- Input gula darah, invalidate/replacement, dashboard, unduh PDF laporan.
- Jalankan Playwright E2E terhadap `https://glubee.id` dengan data sintetis, lalu kosongkan DB (diperbolehkan selama dev).

### Tahap 7: Uptime monitoring (butuh P9, aktif sejak dev)

Monitor UptimeRobot, interval 5 menit, alert email ke `mk.webekspres@gmail.com`:
1. HTTP keyword `https://glubee.id`, keyword `Glubee`.
2. HTTP `https://api.glubee.id/auth/v1/health` (GoTrue; lewat Kong butuh header `apikey` anon, atau tambahkan route health tanpa key di `kong.yml`).
3. SSL expiry `glubee.id` dan `api.glubee.id`.
4. Domain expiry `glubee.id`.

Catatan: halaman pricing UptimeRobot menyebut paket free untuk "hobby and non-profit"; ketentuan komersial Healthchecks.io free juga belum jelas. Verifikasi ulang sebelum go-live (SRS §16).

---

## 5. Pembaruan Dokumen Spesifikasi

Sudah dikerjakan bersama plan ini:
- [ADR-0001](engineering/adr/0001-self-host-supabase-on-vps.md) dibuat.
- [SRS](engineering/SRS.MD) §1, §2, §3.1, §3.2, §10.2, §15, §16 mengacu ke ADR-0001.
- [LEGAL_OPERATIONS](legal/internal/LEGAL_OPERATIONS.MD) §8 mencatat vendor/lokasi baru.

Masih TODO (butuh review legal, **jangan** diubah agent):
- [PRIVACY_POLICY](legal/public/PRIVACY_POLICY.MD) §7 "Penyedia layanan dan transfer data" masih menyebut Vercel/Supabase Cloud.

---

## 6. Checklist Verifikasi & Kriteria Selesai (DoD)

1. `bun run check` dan `bun run db:test` lulus di lokal (tidak ada regresi).
2. Image dibangun di GitHub Actions dan ter-push ke GHCR; deploy manual berhasil dan guard jam puncak terbukti menolak.
3. Di VPS: `docker compose ps` semua service selalu-aktif `healthy`; `studio`/`meta` tidak berjalan.
4. Dari luar VPS: hanya 80/443 terbuka; 54329/8000/3000/54323 tertutup.
5. pgTAP terhadap DB VPS lulus.
6. Semua alur Tahap 6 lulus di `https://glubee.id`.
7. Backup 02:00 WIB muncul di GDrive dengan format folder benar; rotasi 7 versi terverifikasi; restore drill tercatat.
8. Healthchecks.io menerima ping sukses harian; uji `/fail` (mis. matikan rclone sementara) menghasilkan email alert.
9. Keempat monitor UptimeRobot hijau; uji down (stop container `app` di luar jam puncak) menghasilkan email alert.
10. RAM app lain di VPS tidak terganggu: `free -h` dan uptime `miprogresifbumishalawat.web.id` normal selama 24 jam setelah provisioning.

---
Dokumen ini disusun sebagai panduan resmi migrasi infrastruktur Glubee ke VPS Webekspres.
