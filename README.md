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

Pengujian browser memerlukan aplikasi dan Supabase lokal aktif, `.env.local` terisi, serta Mailpit lokal pada port 54324:

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
