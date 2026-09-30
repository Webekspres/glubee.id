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
- **Dial:** ENERGY 2 / RHYTHM 2 (landing), RHYTHM 1 (aplikasi), MOTION 1.

