# Review Sprint 2 — 15 September 2026

Status: implementasi versi sementara dan QA lokal; **belum penerimaan klien/UAT dan belum produksi**. Pekerjaan berada pada branch `dev`, belum commit/push. Status live ClickUp tidak diubah. Review ini menambahkan hasil terkini tanpa mengubah riwayat Sprint 1 atau forecast tanggal/capacity secara sepihak.

## Hasil per task

| Task | Hasil lokal | Batas penerimaan |
|---|---|---|
| GLB-010 — Panduan desain/komponen | Komponen responsif, navigasi, form, modal native, empty/error/loading state, dan visual netral sementara selesai. | Pengguna mengizinkan versi sementara karena referensi belum tersedia. Bukan pengganti approval brand atau `DESIGN.MD` final. |
| GLB-011 — Auth/onboarding/profil | Registrasi, verifikasi email, login/logout, reset password sampai login dengan password baru, consent terpisah/versioned, onboarding dan profil berjalan lokal. | Login Google nyata/account linking masih menunggu konfigurasi provider dan QA integrasi. |
| GLB-012 — Catatan/koreksi/riwayat | mg/dL dan mmol/L, konversi, input historis, idempotensi retry, invalidasi append-only, replacement tertaut, serta riwayat berhalaman/filter tersedia. | Status medis tetap “Status belum dievaluasi”; tidak ada pengiriman alarm. |
| GLB-013 — Dashboard/grafik | Periode 7/14/30 hari, bulan kalender dan rentang tanggal; ringkasan catatan valid; detail titik dan tabel alternatif. Grafik dapat digeser di ponsel. | Tidak ada garis ambang, label aman, atau klasifikasi medis yang diada-adakan. |
| GLB-014 — PDF | Unduh langsung untuk pemilik: identitas dasar, periode/zona, timestamp, grafik, tabel valid, catatan, nomor halaman, dan disclaimer. Lima halaman sampel diperiksa visual. | Data lebih dari 5.000 catatan ditolak dengan permintaan memperpendek periode; tidak dipotong diam-diam. Font belum mendukung semua aksara/emoji; karakter yang tidak didukung menghasilkan pesan jelas, bukan PDF rusak. |
| GLB-015 — Legal/cookie | Halaman legal draf, consent versi baru, arsip versi lama, banner pilihan setara, pengaturan/penarikan, receipt server append-only dan cookie bertanda tangan. | Hanya cookie esensial; tidak memasang analytics/marketing. Review hukum dan publikasi legal produksi belum dilakukan. |
| GLB-016 — QA/demo | Alur pencatatan diuji pada browser lokal, dua akun, tiga zona waktu, desktop dan mobile. Artefak sintetis tersedia untuk demo. | Demo kepada klien, feedback, dan persetujuan UAT belum terjadi. |
| GLB-017 — Review/perbaikan | Review teknis dan carry-over dicatat; masalah ukuran grafik mobile, pemisahan baris PDF, pagination/filter, dan versi consent diperbaiki. | Sprint tidak ditandai accepted/Done keseluruhan. Kapasitas/forecast berikutnya belum diubah tanpa input PM. |

## Keputusan yang dipakai dan yang tetap ditahan

Sumber terbaru adalah instruksi pengguna dan kutipan percakapan klien 9 September yang diberikan pada task ini; bukan tebakan dari rencana lama.

- Brand: **Glubee**, domain `glubee.id`.
- UI sementara diizinkan pengguna; aset/variasi maskot final belum diterima.
- Laporan bulanan: bulan kalender menurut zona profil, bukan rolling 30 hari.
- Istilah evaluasi yang diminta klien: tinggi, normal, rendah; tidak ada diagnosis diabetes/prediabetes atau kategori kritis baru.
- Arahan “sewaktu” dicatat untuk evaluasi kondisi sebelum makan/lainnya. Nilai kondisi asli tetap disimpan; mesin evaluasi belum diaktifkan.
- Masih perlu konfirmasi **status 60–69 mg/dL saat puasa/setelah makan** dan **apakah input keluhan digunakan untuk menerapkan aturan <80 mg/dL dengan keluhan = rendah**. Kedua jawaban tidak dapat diturunkan secara pasti dari rentang yang diberikan. Pernyataan klien “sudah divalidasi” dicatat, tetapi identitas/dokumen validator belum dilampirkan.
- Pemicu nilai berbahaya untuk email darurat belum memiliki aturan operasional lengkap. Kontak darurat/jadwal/pengingat adalah scope Sprint 3; bukan diaktifkan sebagai konsekuensi status tinggi/rendah.
- Lima ketentuan kontak darurat disetujui klien. Jawaban kebutuhan mingguan belum menetapkan recurrence/completion obat/insulin secara rinci.

Pesan klarifikasi yang dapat diteruskan kepada klien:

> Kak, untuk melengkapi tabel aturan agar implementasinya tidak salah: nilai 60–69 mg/dL pada pemeriksaan puasa dan 2 jam setelah makan masuk status apa? Apakah form juga perlu pilihan ada/tidak ada keluhan, sehingga nilai di bawah 80 mg/dL dengan keluhan diberi status rendah? Selain dua hal ini, istilah tinggi/normal/rendah dan laporan bulan kalender sudah kami catat.

## Disclaimer dan versi persetujuan

Penjelasan peran PT Webekspres Teknologi Indonesia ditambahkan pada footer situs, form persetujuan, PDF, Syarat & Ketentuan, Kebijakan Privasi, serta panduan legal internal. Naskah membedakan penyedia implementasi teknis dari pengelola aturan/keputusan medis, menyatakan hasil dapat salah, dan tetap tunduk pada hukum yang berlaku. Ini adalah **draf untuk review hukum**, bukan jaminan kebal tuntutan atau penghapusan seluruh tanggung jawab.

Versi legal dan health consent baru: `0.2-draft-2026-09-15`. Versi lama diarsipkan di `docs/legal/archive/0.1-draft/`; receipt lama tidak ditimpa. Intent registrasi menyimpan versi yang benar-benar ditampilkan agar verifikasi email yang terlambat tidak dianggap menerima dokumen baru secara retroaktif. Pengguna yang belum menerima versi aktif diarahkan ke onboarding/reconsent.

## Bukti pengujian

| Pemeriksaan | Hasil |
|---|---|
| `bun run check` | Lint, TypeScript, 11 unit test / 29 assertion, dan production build lulus; 31 halaman/rute diproses pada build. |
| `bun run db:test` | 49 assertion lulus (30 fondasi + 19 Sprint 2). |
| Playwright lokal | 2 skenario end-to-end lulus, 55 detik pada run final: user journey lengkap dan public/error/privacy states. |
| Dependency lock | `bun install --frozen-lockfile` lulus tanpa perubahan paket. |
| Pemeriksaan visual | Desktop 1440 px, mobile 390 px; tidak ada overflow horizontal halaman. Seluruh lima halaman PDF A4 diperiksa setelah perbaikan divider/row pagination. |
| `git diff --check` | Lulus sebelum serah terima. |

Skenario database mencakup isolasi owner/lintas-user/admin/anon, akun suspended, laporan >1.000 catatan tanpa truncation, batas >5.000, invalidasi, rentang kosong/salah, rate limit PDF, receipt cookie append-only, dan versi persetujuan registrasi ketika notice berubah. Data dan akun test sintetis; tidak menyentuh produksi.

Skenario browser mencakup verifikasi email/reset melalui Mailpit lokal, konversi 5,5 mmol/L menjadi 99 mg/dL, pengganti 6 mmol/L menjadi 108 mg/dL, riwayat 20/40/48 baris, request idempotent, penolakan cross-origin, batas hari WIB/WITA/WIT, PDF multi-page, serta pengaturan cookie. Pengujian memantau request eksternal dan local/session storage: tidak ada teknologi non-esensial yang dijalankan.

Tambahan run final: simulasi respons 503 mempertahankan input dan memakai ulang idempotency key saat retry sukses; cookie palsu tidak dianggap consent sah; versi legal lama masih dapat dibaca; tautan invalid dan sesi tanpa autentikasi menampilkan pesan/redirect yang tepat. Simulasi error adalah pengujian UI terkontrol, bukan klaim outage vendor nyata.

Artefak QA di `test-results/` diabaikan Git dan dapat dibuat ulang melalui `bun run test:e2e`: `dashboard-desktop.png`, `dashboard-mobile.png`, dan `laporan-glubee.pdf`. Akun/record `example.test` sintetis tetap berada di database lokal setelah test (tidak dihapus karena catatan bersifat append-only). Ini bukan backup atau hasil medis nyata.

## Perubahan teknis/operasional

- Migration tambahan `20260915000100_sprint_2_ui_support.sql` sudah diterapkan hanya pada Supabase lokal. Migration fondasi tidak diubah; tidak melakukan reset atau penghapusan data pengguna.
- RPC range mengembalikan satu snapshot bounded agar ringkasan/PDF tidak terpotong oleh batas row API; invalid record dikeluarkan oleh database.
- PDF memakai `pdf-lib`, fontkit, dan font Liberation Sans berlisensi yang disertakan. Tidak ada file kesehatan yang dipublikasikan, public storage bucket, atau URL unduh permanen.
- Cookie sesi auth HttpOnly/SameSite; response API no-store. Mutasi browser membutuhkan JSON dan origin yang sesuai. Redirect callback hanya menerima tujuan yang diizinkan.
- Receipt cookie disimpan server-side. Cookie `glubee_privacy` adalah session cookie bertanda tangan dan HttpOnly; hanya menyimpan referensi keputusan/version, bukan data kesehatan. Analytics/marketing false; tidak menetapkan masa retensi cookie permanen tanpa keputusan.
- Graph Codebase Memory diperiksa pada tier Verify. JSX tertentu dan SQL ditandai partial; source terkait dibaca langsung dan diuji, bukan dianggap lengkap berdasarkan graph saja.
- Pemeriksaan exact-match terhadap dua secret aktif di environment lokal menemukan nilai `SUPABASE_SERVICE_ROLE_KEY` dan `CRON_SECRET` pada dokumen lama milik pengguna `docs/IMPLEMENTATION_PLAN_SPRINT_2.md` (baris 42/44). File itu untracked dan tidak diubah; **jangan ikut commit sebelum redaksi**. Tidak ada kecocokan pada source aplikasi baru atau `.next/static`. Pemeriksaan ini bukan audit kebocoran menyeluruh; tidak menyimpulkan keamanan production atau perlunya rotasi tanpa memeriksa riwayat distribusi secret tersebut.

## Cara mencoba

1. Pastikan `.env.local` memakai Supabase lokal dan Docker aktif. Jalankan `bun run db:start` jika belum berjalan, lalu `bunx supabase migration up --local`.
2. Jalankan `bun run dev`, buka `http://localhost:3000`, daftar akun uji, dan buka email konfirmasi di Mailpit `http://localhost:54324` menggunakan browser yang sama.
3. Lengkapi profil/consent → catat pengukuran → koreksi dari riwayat → periksa grafik → unduh laporan PDF.
4. Untuk mengulang QA, ikuti README. Playwright menolak URL aplikasi/database non-lokal.

## Sisa sebelum penerimaan/rilis

- Jawaban dua celah klasifikasi medis di atas dan bukti review aturan; aktivasi memerlukan pengujian boundary baru. Fitur pencatatan/grafik/PDF tetap dapat diuji tanpa evaluasi.
- Aset/desain final serta review tampilan sementara oleh pengguna/klien.
- Google OAuth nyata, account linking, konfigurasi URL/email/vendor dan lingkungan staging terpisah.
- Review hukum, alamat pengelola yang boleh dipublikasikan, serta proses release/backup/rollback sesuai dokumen operasi.
- Demo/feedback dan minimal satu persetujuan eksplisit kandidat final dari penerima UAT yang ditunjuk; QA developer bukan UAT.
- Jadwal, kontak darurat, notifikasi, ekspor/penghapusan akun tetap sprint berikutnya.

Dokumen rencana lama, termasuk `IMPLEMENTATION_PLAN_SPRINT_2.md` dan `PANDUAN_TESTING_TAMPILAN.md` yang sudah ada sebagai file untracked milik pengguna, tidak ditimpa. Jika berbeda dengan hasil implementasi (misalnya aktivasi label medis atau struktur laporan), gunakan keputusan terbaru BRD dan review ini. Tidak ada perubahan live ClickUp, DNS, pengiriman email eksternal, deployment, atau migrasi produksi pada pekerjaan ini.
