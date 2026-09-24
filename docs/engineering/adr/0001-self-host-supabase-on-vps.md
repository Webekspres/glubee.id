# ADR-0001: Self-host Supabase dan Next.js di VPS Webekspres

- Status: DISEPAKATI
- Tanggal: 24 September 2026
- Pengambil keputusan: Sultan (Webekspres)
- Menggantikan: asumsi Vercel + Supabase Cloud pada SRS 0.1-draft §1, §2, §3.2, §10.2, §15, §16

## Konteks

- Supabase Free dibatasi dua project aktif per akun. Kedua slot di akun `mk.webekspres@gmail.com` sudah terpakai oleh app demo lain, dan dampak pause/hapus project tersebut belum diketahui.
- Anggaran infrastruktur Glubee saat ini Rp0.
- Hosting shared Plesk/cPanel tidak dapat menjalankan Glubee: aplikasi memakai Route Handlers, callback OAuth, cookie session, dan PDF server-side sehingga tidak dapat di-export sebagai SSG.
- VPS Webekspres (4 vCPU, ±7,75 GB RAM, ±61 GB disk kosong, Docker terpasang, nginx pada 80/443) sudah tersedia tanpa biaya tambahan. VPS ini juga menjalankan production app lain, termasuk `miprogresifbumishalawat.web.id` (absensi pesantren, jadwal presensi: masuk 06:45, batas hadir 07:00, pulang awal 13:00, pulang 13:30, batas scan 14:30; jam puncak yang dilindungi 06:00–07:30 dan 12:45–14:45 WIB).
- Kode bergantung erat pada Supabase: 9 pemanggilan `supabase.auth.*`, 13 `supabase.rpc`, serta migration dengan 17 RLS, 16 policy, 52 `auth.uid()`, dan 16 fungsi `security definer`. Tidak ada dependensi ke Storage, Realtime, `pg_cron`, atau `pg_net`.

## Keputusan

1. Jalankan **Supabase self-hosted (Docker Compose)** dan **Next.js (container)** di VPS Webekspres.
2. Service Supabase yang dipakai:
   - dipasang: `db`, `auth` (GoTrue), `rest` (PostgREST), plus `app`;
   - **tanpa API gateway** (Kong/Envoy): nginx host yang sudah ada merutekan path langsung (lihat poin 3);
   - tidak dipasang: studio, meta, realtime, storage, imgproxy, analytics/logflare, vector, functions, supavisor. Administrasi DB lewat SSH tunnel + `psql`/klien DB di laptop.
3. Topologi jaringan:
   - `glubee.id` → nginx → Next.js `127.0.0.1:3000`;
   - `api.glubee.id` → nginx: `/auth/v1/*` → GoTrue `127.0.0.1:9999`, `/rest/v1/*` → PostgREST `127.0.0.1:3001`;
   - dari internet hanya `/auth/v1/{health,verify,authorize,callback}` yang terbuka; path lain hanya dari subnet network Glubee (`172.30.10.0/24`, dicek dari `$remote_addr`);
   - container app memanggil `https://api.glubee.id` lewat nginx host (`extra_hosts: api.glubee.id:host-gateway`), sehingga satu URL publik tetap dipakai (dibutuhkan `signInWithOAuth`) tanpa perubahan kode;
   - Postgres hanya di-publish ke `127.0.0.1` host (untuk migration/admin via SSH tunnel), tidak pernah ke `0.0.0.0`. Semua port container Glubee memakai bind `127.0.0.1` karena port Docker yang di-publish ke `0.0.0.0` melewati aturan `ufw`.
   - TLS oleh certbot/Let's Encrypt pada nginx yang sudah ada.
   - Rate limit: GoTrue hanya melihat IP container app untuk panggilan server, sehingga limit per-IP GoTrue dilonggarkan dan pembatasan per IP pengguna dipindah ke nginx (`limit_req` pada `glubee.id/api/auth/`). Tanpa perubahan kode aplikasi. Limit email GoTrue tetap (100/jam) untuk kuota Brevo.
   - Key: memakai JWT HS256 model lama (`ANON_KEY`/`SERVICE_ROLE_KEY` dari `JWT_SECRET`); key `sb_publishable_…`/`sb_secret_…` butuh gateway.
4. Build image Next.js di GitHub Actions, push ke GHCR, deploy ke VPS dengan trigger manual (`workflow_dispatch`). Build memakai Bun, **runtime memakai Node.js 22**: CPU VPS adalah `QEMU Virtual CPU version 2.5+` tanpa SSE4.2/POPCNT/AVX, sehingga Bun (termasuk build baseline) berputar 100% CPU tanpa pernah berjalan. Dev lokal dan test tetap Bun.
5. Backup harian 02:00 WIB: `pg_dump` terenkripsi, upload ke Google Drive `mk.webekspres@gmail.com` di `backup website/glubee.id/dd-mm-yyyy-HHmm`, simpan 7 versi harian terakhir.
6. Monitoring sejak development: Healthchecks.io free untuk job backup, UptimeRobot free untuk uptime app/API, SSL, dan domain.
7. Deploy dari GitHub Actions memakai user VPS `adminweb` dengan SSH key khusus yang terpisah dari key pribadi.
8. Staging:
   - selama development (belum ada pengguna aktif), environment live boleh dipakai untuk uji dan database boleh dikosongkan;
   - setelah ada pengguna aktif, setiap perubahan wajib melalui staging terpisah sebelum ke production, dan database production tidak boleh dikosongkan.

## Opsi yang ditolak

| Opsi | Alasan ditolak |
|---|---|
| Membatasi akses DB dengan CORS | CORS hanya dipatuhi browser untuk request HTTP. Koneksi Postgres/MySQL adalah TCP langsung dan tidak dilindungi CORS. |
| MySQL | RLS, `security definer`, dan RPC adalah fitur Postgres; migrasi berarti menulis ulang seluruh migration dan otorisasi. |
| Vercel + Postgres di VPS yang dibuka ke internet | IP Vercel dinamis sehingga allowlist tidak praktis; DB kesehatan terekspos publik; Supabase Auth tetap harus diganti. |
| Gateway Kong atau Envoy (default upstream sejak 2026) | Menambah lapisan proxy di belakang nginx yang sudah ada; fungsi yang dipakai hanya routing path. Pemeriksaan `apikey` bukan batas keamanan karena anon key publik; otorisasi tetap JWT + RLS. |
| Postgres polos + ganti Auth (mis. Better Auth) | Menuntut rewrite auth, RLS `auth.uid()`, dan RPC (±1–2 sprint) tanpa keuntungan berarti karena RAM VPS cukup. |
| Supabase Cloud (pause project demo / Pro $25) | Pause memerlukan keputusan pemilik demo yang belum tersedia; Pro melebihi anggaran Rp0. Tetap menjadi jalur keluar. |
| Hosting shared (Plesk/cPanel) + SSG | Glubee tidak dapat di-SSG. |

## Konsekuensi

- Positif: biaya Rp0; kode aplikasi, migration, dan test hampir tidak berubah (hanya URL dan key); Postgres tidak pernah terekspos.
- Negatif: Webekspres menanggung operasi (update image, patch keamanan, disk, TLS, backup, restore drill); satu VPS menjadi single point of failure bersama app lain; tidak ada SLA vendor.
- Negatif (tanpa gateway): routing `api.glubee.id` dirawat sendiri di nginx dan berbeda dari upstream; fitur baru yang memanggil Supabase dari browser wajib membuka path-nya secara eksplisit.
- Mitigasi: `mem_limit` per container, jadwal deploy di luar jam puncak app pesantren, backup off-site terenkripsi, restore drill sebelum go-live.
- Jalur keluar: karena tetap memakai Supabase, migrasi ke Supabase Cloud cukup `pg_dump`/restore dan pergantian environment variable.
- Dokumen legal: register vendor diperbarui di `LEGAL_OPERATIONS.MD` §8. Privacy Policy publik masih menyebut Vercel/Supabase dan menunggu review legal (TODO).
