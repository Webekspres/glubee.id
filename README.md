# Glubee

Responsive web application untuk pencatatan dan pemantauan gula darah. Produk ini bukan alat diagnosis atau pengganti tenaga medis.

## Prasyarat

- Bun 1.4 atau lebih baru
- Docker dengan daemon aktif
- Node.js 20+ dan Chromium Playwright untuk pengujian browser

## Menjalankan secara lokal

```bash
cp .env.example .env.local
bun install
bun run db:start
bun run dev
```

Isi variabel Supabase lokal pada `.env.local` dari keluaran `bunx supabase status`. Jangan commit file tersebut.

Buka http://localhost:3000.

### Email lokal (Mailpit)

Semua email lokal ditangkap oleh **Mailpit bawaan Supabase CLI**, tidak perlu container Mailpit terpisah:

| Pengirim | Jalur | Konfigurasi |
|---|---|---|
| Supabase Auth (verifikasi, reset password) | Mailpit bawaan | `[auth.email.smtp] enabled = false` di `supabase/config.toml` |
| Aplikasi (`src/lib/email.ts`, nodemailer) | SMTP `127.0.0.1:54325` | `[local_smtp] smtp_port = 54325`, `SMTP_PORT=54325` di `.env.local` |

Inbox: http://127.0.0.1:54324. E2E juga membaca email dari API Mailpit di port ini.

Jangan arahkan SMTP Auth lokal ke `host.docker.internal`. Pada podman rootless, alamat itu resolve ke IP LAN host yang dari dalam container kembali ke namespace container sendiri, sehingga koneksi ditolak (`connection refused`). Setelah mengubah `supabase/config.toml`, jalankan `bunx supabase stop` lalu `bun run db:start`.

### Podman rootless

Bila `bun run db:start` gagal dengan `statfs /var/run/docker.sock: permission denied`, `docker.sock` menunjuk ke socket podman rootful. Arahkan ke socket rootless:

```bash
DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock bun run db:start
```

## Pemeriksaan

```bash
bun run check
bun run db:test
```

`bun run check` menjalankan lint, typecheck, unit test Bun, dan production build. `bun run db:test` menjalankan test migration, constraint, dan RLS pada Supabase lokal.

Untuk checkout dengan database Sprint 1 yang sudah berjalan, terapkan migration tambahan tanpa menghapus data:

```bash
bunx supabase migration up --local
```

Pengujian browser memerlukan aplikasi dan Supabase lokal aktif, `.env.local` terisi, serta Mailpit bawaan Supabase pada port 54324 (lihat [Email lokal](#email-lokal-mailpit)):

```bash
bunx playwright install chromium
bun run test:e2e
```

Runner menolak URL aplikasi/database non-lokal. Fixture menggunakan akun `example.test` dan data sintetis; pengujian tidak menghapus akun/catatan tersebut. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` dapat menunjuk Chromium yang sudah terpasang. Screenshot dan PDF QA ada di `test-results/` (diabaikan Git). Login Google sungguhan memerlukan konfigurasi provider terpisah dan belum termasuk verifikasi lokal.

## Environment

| Lingkungan | Branch | Domain | Data |
|---|---|---|---|
| Local | branch aktif | `localhost:3000` | Sintetis |
| Staging | `staging` | `staging.glubee.id` | Sintetis, terpisah dari production |
| Production | `main` | `glubee.id` | Data pengguna nyata setelah release gate |

Staging dan production menggunakan environment variables, Supabase project/Auth, credentials, serta job secrets yang berbeda.

## Dokumentasi

Mulai dari [panduan dokumentasi](docs/README.md), [hasil Sprint 1](docs/planning/SPRINT_1_REVIEW.md), [hasil Sprint 2](docs/planning/SPRINT_2_REVIEW.md), dan [aturan kerja agent](AGENTS.MD). Fitur medis yang masih berstatus PENDING tidak boleh diaktifkan.
