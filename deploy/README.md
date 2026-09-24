# Deploy Glubee ke VPS Webekspres

Keputusan arsitektur: [ADR-0001](../docs/engineering/adr/0001-self-host-supabase-on-vps.md). Urutan kerja lengkap: [IMPLEMENTATION_PLAN_SELF_HOST](../docs/IMPLEMENTATION_PLAN_SELF_HOST.md).

## Isi folder

| File | Fungsi |
|---|---|
| `docker-compose.yml` | `db` (Postgres 17), `auth` (GoTrue), `rest` (PostgREST), `app` (Next.js). Tanpa gateway, Studio, atau meta. |
| `db/roles.sql`, `db/jwt.sql` | Init DB dari upstream Supabase; hanya jalan saat volume `db-data` masih kosong. |
| `nginx/glubee.id.conf` | Proxy ke app + `limit_req` untuk `/api/auth/`. |
| `nginx/api.glubee.id.conf` | Pengganti gateway: path publik terbatas, path lain hanya dari subnet container. |
| `.env.example` | Template `/opt/glubee/.env`. |
| `generate-keys.sh` | Membuat password DB, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`, `CRON_SECRET`. |

## Aturan VPS

- Jangan deploy, restart, atau update pada **05:30–07:30** dan **14:30–15:30 WIB** (jam puncak app absensi pesantren di VPS yang sama).
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

## Administrasi database

Tidak ada Studio. Pakai SSH tunnel di atas, lalu `psql` atau DBeaver/TablePlus ke `127.0.0.1:54329`, user `postgres`, SSL nonaktif.

## Path publik `api.glubee.id`

Dari internet hanya ini yang terbuka: `/auth/v1/health`, `/auth/v1/verify`, `/auth/v1/authorize`, `/auth/v1/callback`. Semua path lain (termasuk `/rest/v1` dan `/auth/v1/admin`) menghasilkan 403 kecuali dari subnet `GLUBEE_SUBNET`. Container app mencapainya lewat `extra_hosts: api.glubee.id:host-gateway`.

Fitur baru yang memanggil Supabase langsung dari browser (realtime, OAuth provider lain, magic link) wajib menambah path-nya di `nginx/api.glubee.id.conf`.

## Rate limit

- nginx: `glubee.id/api/auth/` 10 request/menit per IP (burst 5); path publik `api.glubee.id` 30/menit per IP (burst 10).
- GoTrue melihat semua panggilan server sebagai satu IP (container app), jadi limit per-IP-nya dilonggarkan. Limit email tetap 100/jam global untuk menjaga kuota Brevo.

## Update image (sebulan sekali, di luar jam puncak)

1. Bandingkan tag di `docker-compose.yml` dengan `supabase/docker/docker-compose.yml` upstream; baca changelog GoTrue, PostgREST, dan `supabase/postgres`.
2. Ubah tag di repo, commit, salin ke `/opt/glubee`, lalu `docker compose pull && docker compose up -d`.
3. Upgrade **major** Postgres tidak boleh lewat ganti tag saja; butuh prosedur dump/restore tersendiri.

## Rollback aplikasi

Jalankan ulang workflow **Deploy** dari commit sebelumnya, atau di VPS: ubah `APP_TAG` di `.env` ke sha sebelumnya lalu `docker compose up -d app`.
