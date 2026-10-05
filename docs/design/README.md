# Design Documentation

Folder ini disiapkan untuk `DESIGN.MD` dan aset referensi desain yang telah disetujui.

`DESIGN.MD` belum dibuat karena brand guideline dan aset final (file font berlisensi, logo, PNG maskot) masih menunggu klien. `BR-PEND-008` baru terpenuhi sebagian.

## Riwayat

- **15 September 2026** — pengguna mengizinkan versi visual sementara untuk Sprint 2: tipografi sistem, panel netral, aksen teal, wordmark teks, ilustrasi grafik sintetis. Lihat `docs/planning/SPRINT_2_REVIEW.md`.
- **28 September 2026** — klien mengirim brief visual (`DESAIN VISUAL GLUBEE.pdf`: font, palet, empat ekspresi maskot, mockup dashboard varian A–D). Setelah membandingkan prototype keempat varian, pengguna memilih **varian B**. UI diperbarui mengikuti brief tersebut.

## Visual saat ini (varian B)

| Unsur | Nilai | Catatan |
| --- | --- | --- |
| Halaman | `#002A45` Prussian blue | Header, footer, dan bottom bar `#011B2F` Oxford blue |
| Permukaan/kartu | `#F7FBF9`, kartu metrik `#DCECE6` | Kartu rata-rata `#FFD358` Mustard |
| Aksen/tombol utama | `#FFB915` Selective yellow, teks navy | Judul di atas navy `#FFD358` |
| Pelengkap | `#88BBAA`, `#306771`, `#4D612D`, `#0C2A33` | Garis grafik `#4D612D` |
| Font judul | Titan One | **Pengganti** Ellak (berbayar, belum ada file) |
| Font teks | Fraunces | **Pengganti** Morally Serif (berbayar, belum ada file) |
| Logo | Wordmark "glubee", huruf b digambar sebagai lebah menghadap kanan | **Placeholder** SVG di `src/components/Shell.tsx` |
| Maskot | `public/brand/mascot.webp` (netral) | **Final** dari klien 30 Sep 2026 (PNG 9000 px transparan, di-trim dan diperkecil ke 420 px WebP). Dipakai di beranda, dashboard, halaman masuk/daftar, empty state grafik, dan 404 lewat komponen `Mascot`. |

Token warna ada di `:root` pada `src/app/globals.css`. Permukaan terang (`.panel`, `.dialog`, `.notice`, dan lainnya) mendefinisikan ulang token teks, sehingga komponen tidak perlu tahu sedang berada di atas latar gelap atau terang.

## Belum diterapkan

- **Ekspresi maskot per status** (aman, krisis tinggi, krisis rendah, bahaya) dan kartu "Status hari ini". Evaluasi tinggi/normal/rendah masih nonaktif sampai `BR-PEND-002` selesai.
- **Jadwal perawatan dan pengingat** di dashboard mockup. Fiturnya masuk scope (BRD Modul 2, FRD §6), dijadwalkan Sprint 3.
- **Ekspresi status** sudah tersedia (`mascot-safe`, `mascot-high`, `mascot-low`, `mascot-danger` .webp) tetapi belum ditampilkan sampai evaluasi nilai (GLB-P01) disetujui.
- **Aset final lain.** Setelah diterima: ganti file font lewat `next/font/local` di `src/app/layout.tsx` dan logo di komponen `Wordmark`.

## Perbaikan antislop (30 September 2026)

Detail dan alasan: [`anti-slop/audit-001-2026-09-30.md`](../../anti-slop/audit-001-2026-09-30.md).

- **Font teks:** Atkinson Hyperlegible Next untuk isi, label, dan angka kecil (dirancang untuk penglihatan menurun). Titan One untuk judul besar dan angka utama, Fraunces untuk judul bagian.
- **Ukuran:** isi 17 px, petunjuk form 15 px, minimum 14 px; label tanpa huruf kapital semua.
- **Radius:** kartu 16 px, tombol/input 12 px, badge 6 px; pil hanya chip filter dan FAB.
- **Motif:** sel madu heksagonal dari tubuh maskot (`--hex`) untuk ikon kondisi pengukuran (`src/components/Icons.tsx`).
- **Aksen kuning:** aksi utama dan angka utama; nav aktif memakai garis bawah.
- **Dial:** ENERGY 2 / RHYTHM 2 (landing), RHYTHM 1 (aplikasi), MOTION 2 sejak 1 Okt 2026 atas permintaan pengguna: halaman masuk dengan fade-up, konten tampil setelah dimuat, loader sel madu + maskot, dialog muncul halus. Semua mati bila "kurangi gerakan" aktif.


## Perbaikan antislop 002 (2 Oktober 2026)

Detail: [`anti-slop/audit-002-2026-10-02.md`](../../anti-slop/audit-002-2026-10-02.md).

- **Angka mg/dL** di ringkasan, hasil konversi, dan PDF dibulatkan (`mgDlText`).
- **Form Catat:** satuan dan kondisi berupa tombol pilihan besar; kondisi memakai ikon sel madu.
- **Keluar** di mobile pindah ke akhir halaman Profil; onboarding dan status akun tidak menampilkan navigasi aplikasi.
- **Tanggal lahir** diketik hh/bb/tttt (`BirthDateInput`), bukan date picker.
- **Laporan** menampilkan jumlah catatan dan rentang tanggal sebelum unduh.
- **Maskot** tidak lagi di judul dashboard. Pose per konteks (melambai, memegang laporan, mencari, dll.) menunggu aset.

## Aset maskot dan ikon (5 Oktober 2026)

Dibuat dengan ChatGPT dari maskot klien memakai [`ASSET_PROMPTS.md`](ASSET_PROMPTS.md). Sumber PNG ada di luar repo (`~/Downloads/asset-glubee/Mascot`); yang masuk repo sudah di-trim dan dikonversi.

| Aset | File | Dipakai di |
| --- | --- | --- |
| Melambai | `public/brand/mascot-wave.webp` | Hero landing, halaman masuk |
| Menunjuk | `public/brand/mascot-point.webp` | Halaman daftar akun, penutup landing (menunjuk ke CTA) |
| Mencari | `public/brand/mascot-search.webp` | 404, riwayat kosong |
| Istirahat | `public/brand/mascot-rest.webp` | Grafik kosong |
| Memegang laporan | `public/brand/mascot-report.webp` | Judul halaman Laporan (desktop) |
| Bersorak | `public/brand/mascot-cheer.webp` | Hanya setelah catatan pertama, bukan reaksi terhadap nilai |
| Memegang layar | `public/brand/mascot-display.webp` | Demo satuan di landing; angka ditulis kode (`MascotDisplay`) |
| Kepala | `src/app/icon.png`, `apple-icon.png`, `public/icons/*` | Favicon, ikon iOS, manifest PWA |
| Garis satu warna | `assets/brand/mascot-line.png` | Header halaman pertama PDF laporan |
| Ilustrasi OG | `assets/brand/og-base.jpg` | `src/app/opengraph-image.tsx` (teks ditulis kode) |

Netral (`mascot.webp`) tetap dipakai di loader. Ekspresi status belum dipakai (GLB-P01). Belum dibuat: bingkai animasi (M4), simbol logo (B1), revisi ekspresi status (M6).
