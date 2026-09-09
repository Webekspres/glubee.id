# Panduan Kerja Project Glubee

Status dokumen: internal, aktif
Nama produk final: **Glubee**, telah dikonfirmasi klien.
Bahasa kerja dan produk: Bahasa Indonesia.

## 1. Urutan membaca

Sebelum mengubah kode atau spesifikasi, baca dokumen berikut secara berurutan:

1. `docs/product/BRD.MD` - tujuan, ruang lingkup, keputusan bisnis, dan batas proyek.
2. `docs/product/FRD.MD` - perilaku fitur dan acceptance criteria.
3. `docs/engineering/SRS.MD` - rancangan teknis, data, API, keamanan, operasi, dan pengujian.
4. `docs/legal/internal/CONSENT_AND_NOTICES.MD` - teks persetujuan dan pemberitahuan yang memengaruhi alur produk.
5. `docs/legal/public/PRIVACY_POLICY.MD` dan `docs/legal/public/TERMS_AND_CONDITIONS.MD` - draf janji publik yang harus sesuai implementasi.
6. `docs/legal/internal/LEGAL_OPERATIONS.MD` - prosedur internal privasi, insiden, vendor, dan rilis.
7. `docs/design/DESIGN.MD` - hanya setelah brand guideline dan desain klien tersedia.

Urutan prioritas keputusan: instruksi pengguna terbaru > keputusan klien yang tercatat sebagai disepakati > BRD > FRD > SRS > usulan implementasi. Konflik wajib dihentikan dan dicatat; jangan memilih diam-diam.

## 2. Status kebutuhan

Setiap kebutuhan memakai salah satu status:

- **DISEPAKATI**: boleh diimplementasikan sesuai acceptance criteria.
- **USULAN TEKNIS**: boleh dibuat lokal jika tidak mengunci keputusan bisnis, medis, vendor berbayar, atau produksi.
- **PENDING**: tidak boleh diaktifkan sebagai perilaku final sampai pihak keputusan menyetujui.
- **DI LUAR SCOPE**: tidak diimplementasikan tanpa change request.

ID kebutuhan tidak boleh diganti atau digunakan ulang. Perubahan perilaku harus memperbarui tautan BRD, FRD, SRS, pengujian, dan dokumen hukum yang terdampak.

## 3. Batas produk yang wajib dijaga

- Produk adalah sarana pencatatan dan pemantauan, bukan alat diagnosis, layanan medis, atau pengganti tenaga medis.
- Jangan membuat ambang medis, label klinis, rekomendasi obat/dosis, atau pemicu darurat baru.
- Klasifikasi nilai, istilah status, dan alarm berbasis nilai tetap nonaktif sampai kebutuhan `BR-PEND-001` sampai `BR-PEND-004` disetujui.
- Data tanpa evaluasi tidak boleh diberi label "aman".
- Admin aplikasi tidak boleh membaca catatan gula darah, laporan, atau detail kesehatan pengguna.
- Kontak darurat tidak memiliki akun dan tidak dapat membuka dashboard atau riwayat pengguna.
- Catatan gula darah bersifat append-only. Koreksi dilakukan dengan menandai catatan salah dan membuat pengganti.
- Catatan salah tidak masuk grafik, laporan, status, atau alarm.
- Input historis boleh dilakukan, tetapi tidak memicu alarm darurat historis.
- Fitur artikel edukasi, aplikasi native, WhatsApp, integrasi alat ukur/wearable, akun dokter, dan pengiriman laporan langsung ke dokter berada di luar scope.

## 4. Aturan data kesehatan dan rahasia

- Gunakan data sintetis untuk development, demo, seed, screenshot, dan test.
- Jangan menyimpan kredensial, service-role key, token OAuth, SMTP/API key, atau data pengguna nyata di Git, log, fixture, dokumentasi, maupun client bundle.
- Rahasia hanya tersedia pada runtime server dan dikelola per lingkungan.
- Log tidak boleh berisi nilai gula darah, catatan pengguna, tanggal lahir lengkap, alamat email kontak darurat, token undangan, atau isi laporan.
- Terapkan least privilege, Row Level Security, validasi kepemilikan server-side, dan pengujian akses lintas pengguna.
- Semua akses istimewa harus beralasan, seminimal mungkin, dan tercatat tanpa memuat data kesehatan.
- Jangan menyalin database produksi ke development.
- Jangan menambahkan analytics, marketing tag, third-party script, cookie, local storage, atau server-side tracking non-esensial sebelum `FR-COOKIE-001`, inventory, consent gate, dan legal review dipenuhi.

## 5. Codebase Memory

Untuk discovery kode, selalu dahulukan knowledge graph:

1. `search_graph`
2. `trace_path`
3. `get_code_snippet`
4. `check_index_coverage`
5. `query_graph`
6. `get_architecture`

Pada awal sesi atau setelah compaction, panggil `list_projects` atau `index_status`, catat project dan generation, lalu pilih evidence tier. Default adalah **Verify (Tier 2)**. Setelah path kandidat diketahui, jalankan `check_index_coverage` untuk semua path bukti. Gunakan `rg`/pembacaan source untuk literal, file non-code, hasil graph yang tidak cukup, serta setiap rentang coverage yang partial/skipped/excluded/stale/pending/unknown.

## 6. Standar perubahan

- Buat perubahan terkecil yang memenuhi kebutuhan disepakati; jangan menyiapkan abstraksi atau fitur spekulatif.
- Gunakan satu aplikasi Next.js + TypeScript dengan Route Handlers selama kebutuhan belum membuktikan perlunya service terpisah.
- Perubahan skema harus melalui migration yang dapat direproduksi dan memiliki strategi rollback atau forward-fix.
- Perubahan status kebutuhan PENDING harus diawali bukti persetujuan dan pembaruan dokumen.
- Nama produk, identitas pengelola, kontak publik, zona waktu, dan teks hukum harus berasal dari konfigurasi/versi terpusat bila masuk kode.
- Jangan melakukan deployment produksi, migrasi produksi, publikasi dokumen hukum, perubahan DNS, pengiriman email nyata, atau pembelian layanan tanpa persetujuan eksplisit.
- Repository remote ditujukan ke organisasi GitHub `webekspres` melalui akun Webekspres `sultanwebekspres`. Google/GCP dan akun vendor operasional menggunakan `mk.webekspres@gmail.com`; jangan menyimpan atau meminta kredensialnya melalui source/documentation.
- Repository sudah tersedia. Gunakan `main` untuk production dan branch `staging` untuk deployment `staging.glubee.id`; keduanya memakai environment variable, backend/Auth, secret, dan data yang terpisah.
- Pekerjaan lokal, test, lint, build, migration dry-run, dan dokumentasi boleh dilakukan mandiri.

## 7. Definition of done

Perubahan dianggap selesai jika:

- acceptance criteria yang relevan lulus;
- type-check, lint, unit/integration test, dan build relevan lulus;
- kebijakan RLS memiliki test allow dan deny;
- skenario lintas pengguna dan admin tanpa akses kesehatan diuji;
- idempotensi diuji untuk job/notifikasi terjadwal;
- tidak ada data sensitif atau rahasia pada log dan diff;
- dokumen dan traceability diperbarui bila perilaku berubah;
- perubahan yang menyentuh penghapusan menguji pembatalan, tenggat, job antre, backup, dan tombstone;
- perubahan yang menyentuh waktu menguji WIB, WITA, WIT, DST yang tidak berlaku di Indonesia, serta batas hari;
- fitur PENDING tetap tidak aktif.
- test jaringan/storage membuktikan teknologi non-esensial tidak berjalan sebelum cookie consent dan berhenti setelah penarikan.

## 8. Release gate

Rilis publik terbatas hanya boleh dilakukan untuk fitur DISEPAKATI yang lulus QA dan UAT. Backend saja bukan produk publik siap digunakan. UAT berbeda dari QA teknis dan memerlukan minimal satu persetujuan eksplisit dari anggota tim penerima yang ditunjuk (Fasty Nazzala Gisty atau Jesslyn Jevoncia); pihak kedua tetap diupayakan dan dicatat (keputusan PM 9 September 2026). Sebelum go-live, selesaikan checklist `docs/legal/internal/LEGAL_OPERATIONS.MD`, kapasitas vendor, backup/restore drill, dan rollback drill.
