# Business Requirements Document - Glubee

Versi: 0.1-draft
Tanggal: 9 September 2026
Pemilik keputusan bisnis: Fasty Nazzala Gisty dan Jesslyn Jevoncia
Penyedia teknis: PT Webekspres Teknologi Indonesia

## 1. Ringkasan

Glubee adalah responsive web application berbahasa Indonesia untuk membantu orang dewasa mencatat hasil pengukuran gula darah manual, melihat tren, menyusun laporan, menjaga jadwal tindakan, dan menghubungkan maksimal dua kontak darurat melalui persetujuan email. Produk tidak melakukan diagnosis dan tidak menggantikan konsultasi tenaga medis.

Proposal revisi yang menjadi baseline komersial memuat dua modul, nilai proyek Rp5.000.000, dan estimasi 40 hari kerja. Detail komersial tidak mengubah release gate, kewajiban keamanan, atau kebutuhan persetujuan untuk layanan berbayar.

## 2. Latar belakang dan tujuan bisnis

| ID | Status | Kebutuhan bisnis |
|---|---|---|
| BR-001 | DISEPAKATI | Menyediakan pencatatan gula darah yang terstruktur untuk pengguna dewasa di Indonesia. |
| BR-002 | DISEPAKATI | Menyajikan riwayat, grafik, dan laporan PDF agar data mudah dibawa saat konsultasi. |
| BR-003 | DISEPAKATI | Membantu pengguna mengelola jadwal pemeriksaan, obat, insulin, atau tindakan lain yang mereka tentukan sendiri. |
| BR-004 | DISEPAKATI | Menyampaikan pengingat melalui dashboard dan browser push, dengan fallback email jika push tidak tersedia atau ditolak. |
| BR-005 | DISEPAKATI | Memberi tahu kontak darurat yang telah menyetujui ketika kondisi pemicu yang disepakati terjadi. |
| BR-006 | DISEPAKATI | Menjaga privasi dengan isolasi data per pengguna, pembatasan admin, persetujuan kontak, dan penghapusan akun. |
| BR-007 | DISEPAKATI | Menyediakan layanan gratis bagi pengguna 18+ di Indonesia; data digunakan hanya untuk operasi layanan. |
| BR-008 | DISEPAKATI | Memungkinkan rilis publik terbatas untuk fitur yang final dan lulus pengujian, tanpa mengaktifkan fitur medis yang pending. |
| BR-009 | DISEPAKATI | Memberi pengguna kontrol atas cookie/teknologi penyimpanan non-esensial melalui consent banner dan pusat preferensi. |

## 3. Pengguna dan pemangku kepentingan

- **Pengguna utama**: masyarakat Indonesia berusia minimal 18 tahun, termasuk orang yang memantau gula darah; tidak harus memiliki diagnosis diabetes.
- **Kontak darurat**: penerima email yang secara eksplisit menerima undangan; tidak memiliki akun atau akses ke aplikasi/data lengkap.
- **Admin aplikasi**: mengelola status akun dan kebutuhan operasional non-kesehatan; tidak membaca data kesehatan.
- **Pengelola layanan**: Fasty Nazzala Gisty dan Jesslyn Jevoncia sebagai perorangan dan pengelola bersama. Keduanya menjadi kontak publik melalui email/WhatsApp yang disepakati.
- **Webekspres**: pengembang dan pengelola teknis sesuai perjanjian, dengan akses infrastruktur terbatas dan terkontrol.
- **Penerima UAT**: Fasty Nazzala Gisty dan Jesslyn Jevoncia, setara sebagai perwakilan klien; minimal satu dari keduanya wajib memberikan persetujuan eksplisit atas kandidat final, pihak kedua tetap diupayakan dan dicatat (keputusan PM 9 September 2026, lihat task GLB-001).

## 4. Ruang lingkup

### 4.1 Modul 1 - Pencatatan dan pemantauan gula darah

- registrasi/login email-password dan Google;
- verifikasi email dan pemulihan akun;
- profil: nama, tanggal lahir, jenis kelamin, serta WIB/WITA/WIT;
- input nilai, satuan mg/dL atau mmol/L, tanggal/waktu pengukuran, kondisi, dan catatan opsional;
- penyimpanan nilai dan satuan asli serta konversi tampilan;
- riwayat append-only dan penandaan catatan salah;
- catatan pengganti yang terhubung ke catatan salah;
- grafik periode 7, 14, dan 30 hari serta rentang tanggal;
- rekap dan laporan PDF yang dapat diunduh pengguna;
- dashboard ringkasan tanpa menyimpulkan diagnosis;
- klasifikasi/status hanya setelah aturan medis final disetujui.

### 4.2 Modul 2 - Pengingat dan notifikasi darurat

- jadwal tanggal/jam dan kalender mingguan;
- kategori pemeriksaan gula darah, insulin, obat, atau tindakan lain;
- nama tindakan; nama obat dan dosis hanya bila relevan;
- aktivasi/jeda jadwal;
- dashboard reminder, browser push, dan fallback email;
- maksimal dua kontak darurat;
- undangan, persetujuan, penolakan/kedaluwarsa, serta pencabutan hubungan;
- email kondisi bahaya berisi nilai, satuan, waktu pengukuran, dan imbauan menghubungi pengguna, hanya setelah konfirmasi pengguna dan setelah aturan pemicu disetujui;
- notifikasi kontak darurat bila pengguna belum mencatat gula darah 24 jam setelah jadwal yang terlewat sebagai baseline proposal, tetapi aktivasi menunggu `BR-PEND-005`;
- status selesai/terlewat dan pengulangan mingguan menunggu konfirmasi `BR-PEND-006`.

## 5. Di luar scope

| ID | Item |
|---|---|
| BR-OOS-001 | Diagnosis diabetes/prediabetes, keputusan klinis, rekomendasi terapi, katalog obat, atau penentuan dosis. |
| BR-OOS-002 | Aplikasi Android/iOS native. |
| BR-OOS-003 | Integrasi glucose meter, wearable, WhatsApp, atau sistem layanan kesehatan. |
| BR-OOS-004 | Akun dokter, akses dokter, atau kirim laporan langsung ke dokter. |
| BR-OOS-005 | Artikel edukasi dan panel pengelolaan artikel. |
| BR-OOS-006 | Drag-and-drop kalender dan fitur kalender kompleks. |
| BR-OOS-007 | Riset, iklan, pemasaran berbasis data kesehatan, atau penjualan data. |
| BR-OOS-008 | Desain visual final sebelum brand guideline, desain, dan aset maskot disetujui. |

## 6. Aturan bisnis yang disepakati

| ID | Aturan |
|---|---|
| BR-RULE-001 | Pengguna harus menyatakan berusia minimal 18 tahun dan berada dalam cakupan layanan Indonesia. |
| BR-RULE-002 | Catatan tidak dapat diedit atau dihapus satuan; koreksi dilakukan dengan menandai salah dan membuat pengganti. |
| BR-RULE-003 | Catatan salah tetap untuk audit tetapi tidak masuk grafik, laporan, status, atau alarm. |
| BR-RULE-004 | Input historis diperbolehkan dan tidak memicu alarm darurat historis. |
| BR-RULE-005 | Maksimal dua kontak darurat aktif/pending per pengguna. |
| BR-RULE-006 | Notifikasi kontak baru aktif setelah persetujuan eksplisit melalui email. |
| BR-RULE-007 | Kontak darurat tidak memiliki akun dan hanya menerima informasi yang dijelaskan dalam persetujuan. |
| BR-RULE-008 | Admin dapat mengubah status akun dengan alasan tercatat, tetapi tidak dapat membaca data kesehatan. |
| BR-RULE-009 | Permintaan penghapusan memiliki masa jeda tujuh hari dan hanya dapat dibatalkan pengguna. |
| BR-RULE-010 | Selama jeda penghapusan, aktivitas dan pengingat berhenti; pengguna hanya dapat mengunduh data, membatalkan permintaan, atau keluar. |
| BR-RULE-011 | Admin diberi tahu mengenai permintaan penghapusan, tetapi tidak dapat menunda atau membatalkannya. |
| BR-RULE-012 | Penghapusan data aktif dan kedaluwarsa backup dijelaskan terpisah; tidak menjanjikan seluruh salinan hilang seketika. |
| BR-RULE-013 | Cookie esensial boleh dipakai hanya untuk fungsi yang diperlukan; analytics, marketing, atau teknologi non-esensial default-nya nonaktif sampai pengguna memilih. |

## 7. Keputusan tertunda

| ID | Sumber/pemberi keputusan | Keputusan yang diperlukan | Dampak dan syarat aktivasi |
|---|---|---|---|
| BR-PEND-001 | Klien + validator medis | Batas pasti kritis tinggi: >=240 atau >=300 mg/dL, termasuk konversinya. | Semua klasifikasi/alert nilai sangat tinggi nonaktif sampai aturan tertulis disetujui. |
| BR-PEND-002 | Klien + validator medis | Kategori 54-69 mg/dL dan relasinya dengan <54 mg/dL. | Status rendah/kritis rendah nonaktif sampai disetujui. |
| BR-PEND-003 | Klien | Persetujuan istilah non-diagnostik: dalam/di bawah/di atas rentang, sangat rendah, sangat tinggi. | UI tidak boleh memakai label diabetes/prediabetes. |
| BR-PEND-004 | Klien | Bukti validasi aturan oleh tenaga medis kompeten. | Mesin evaluasi medis tidak boleh dirilis tanpa bukti review. |
| BR-PEND-005 | Klien | Penegasan seluruh aturan kontak darurat dan apakah obat/insulin terlewat juga memicu kontak. | Hanya pemicu keterlambatan pencatatan yang ada pada baseline; pemicu lain nonaktif. |
| BR-PEND-006 | Klien | Jadwal berulang mingguan dan tombol "Sudah dilakukan" untuk obat/insulin. | Recurrence/completion final tidak diaktifkan sampai disetujui. |
| BR-PEND-007 | Klien | Laporan bulanan berarti bulan kalender atau 30 hari terakhir. | Filter rentang tanggal tetap tersedia; preset bulanan tidak diberi makna final. |
| BR-PEND-008 | Klien | Brand guideline, desain, dan variasi maskot tiap status. | `docs/design/DESIGN.MD` dan UI final ditunda. |
| BR-PEND-010 | Klien/Webekspres | Paket produksi Vercel/Supabase/Brevo/GCP dan anggaran berulang. Kepemilikan akun Webekspres telah ditentukan, tetapi paket masih free tier/belum final. | Tidak ada pembelian/deployment produksi tanpa persetujuan. |
| BR-PEND-011 | Klien/legal counsel | Alamat pengelola yang boleh dipublikasikan dan hasil legal review. | Dokumen publik tetap draft. |

### 7.1 Keputusan terselesaikan

| ID | Status | Keputusan | Bukti keputusan |
|---|---|---|---|
| BR-PEND-009 | DISEPAKATI | Nama dan ejaan produk final adalah **Glubee**. | Konfirmasi klien disampaikan melalui Webekspres pada 9 September 2026. |

Catatan khusus: proposal menyebut kondisi pengukuran **sebelum makan**, sedangkan algoritma klien menyebut **gula darah sewaktu (GDS)**. Keduanya bukan sinonim dan tidak boleh dipetakan diam-diam.

## 8. Risiko dan dependensi

- Kesalahan aturan medis dapat menyebabkan rasa aman palsu atau alarm keliru; mitigasi: feature gate dan validasi medis.
- Browser push tidak selalu tersedia/diizinkan; mitigasi: status izin yang jelas dan fallback email.
- Email bukan kanal waktu-nyata dan dapat gagal/tertunda; mitigasi: antrean, retry terbatas, status pengiriman, dan disclaimer.
- Vercel Hobby terbatas pada penggunaan personal/nonkomersial; bukan baseline produksi proyek klien.
- Supabase Free dapat dijeda dan tidak menyediakan backup otomatis; diperlukan backup off-site dan evaluasi paket.
- Brevo Free dibatasi 300 email/hari; kapasitas harus mencakup autentikasi, undangan, pengingat, dan alert.
- Pengelola belum berbadan hukum; pembagian peran, kontrak pemrosesan data, PSE, dan tanggung jawab insiden perlu review hukum.
- Nama, desain, brand guideline, aset maskot, sender domain, dan kredensial vendor masih dependensi eksternal.
- Brand guideline, desain, dan aset maskot dikirim menyusul; pekerjaan backend/fondasi tidak menunggu materi tersebut, tetapi UI final dan `docs/design/DESIGN.MD` tetap ditunda.
- Jumlah pengguna awal dan volume notifikasi belum dapat dipastikan; rilis awal harus terbatas dan kapasitas ditinjau dari penggunaan nyata.

## 9. Kriteria keberhasilan dan penerimaan

| ID | Kriteria |
|---|---|
| BR-SUCCESS-001 | Pengguna hanya dapat membaca/mengubah data miliknya; test lintas pengguna gagal secara aman. |
| BR-SUCCESS-002 | Admin dapat mengelola status akun tanpa akses ke data kesehatan. |
| BR-SUCCESS-003 | Catatan salah dan input historis mengikuti aturan `BR-RULE-002` sampai `BR-RULE-004`. |
| BR-SUCCESS-004 | Grafik dan PDF konsisten terhadap data valid dan zona waktu pengguna. |
| BR-SUCCESS-005 | Undangan/pencabutan kontak dan kegagalan/duplikasi pengiriman ditangani serta dapat diaudit. |
| BR-SUCCESS-006 | Penghapusan tujuh hari, pembatalan, penghentian job, eksekusi otomatis, backup expiry, dan tombstone lulus test. |
| BR-SUCCESS-007 | Tidak ada fitur PENDING yang aktif tanpa persetujuan tercatat. |
| BR-SUCCESS-008 | Minimal satu dari Fasty Nazzala Gisty atau Jesslyn Jevoncia menyetujui hasil UAT fitur yang dirilis secara eksplisit dan terbukti; pihak kedua tetap diupayakan dan dicatat (keputusan PM 9 September 2026). |
| BR-SUCCESS-009 | Sebelum consent, tidak ada script/storage non-esensial yang berjalan; pilihan tolak, terima, ubah, dan tarik kembali terbukti bekerja. |

## 10. Tanggung jawab

- **Klien/pengelola**: keputusan bisnis dan medis, identitas publik, legal review, materi brand/desain, akun vendor, UAT, dan persetujuan biaya/produksi.
- **Webekspres**: analisis, implementasi sesuai dokumen, keamanan aplikasi dalam scope, test, dokumentasi, deployment yang disetujui, pelatihan, dan maintenance sesuai kontrak.
- **Vendor**: layanan sesuai ketentuan masing-masing; tidak menggantikan kewajiban pengelola/Webekspres untuk konfigurasi, monitoring, dan respons insiden.
