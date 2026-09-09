# Functional Requirements Document - Glubee

Versi: 0.1-draft
Traceability utama: `docs/product/BRD.MD` -> dokumen ini -> `docs/engineering/SRS.MD` -> test/UAT.

## 1. Prinsip perilaku

- Semua tampilan pengguna berbahasa Indonesia dan responsif.
- Sistem tidak mendiagnosis, tidak menyarankan obat/dosis, dan tidak menyebut hasil sebagai rekam medis.
- Fitur yang bergantung pada `BR-PEND-*` harus berada di balik feature gate yang default-nya nonaktif.
- Waktu ditampilkan menurut zona pilihan pengguna: WIB (UTC+7), WITA (UTC+8), atau WIT (UTC+9).
- Kesalahan validasi tidak boleh menghapus input pengguna tanpa penjelasan.
- Informasi kegagalan notifikasi harus jujur; status antre bukan berarti terkirim.

## 2. Aktor dan izin

| Aktor | Diizinkan | Dilarang |
|---|---|---|
| Pengunjung | Melihat halaman publik, mendaftar, login, membuka undangan kontak. | Melihat data pengguna. |
| Pengguna | Mengelola profil, catatan sendiri, laporan, jadwal, kontak, persetujuan, ekspor, dan penghapusan akun. | Mengakses data pengguna lain atau mengubah catatan kesehatan lama. |
| Kontak darurat | Menerima/menolak undangan dan menerima email sesuai persetujuan. | Login sebagai kontak, membuka dashboard, grafik, atau riwayat. |
| Admin | Melihat identitas akun minimum, status, dan audit admin; mengaktifkan/menonaktifkan akun dengan alasan. | Membaca nilai gula darah, laporan, jadwal kesehatan, atau isi kontak/catatan. |
| Job server | Memproses pekerjaan jatuh tempo dengan scope minimum. | Menjalankan query tanpa batas kepemilikan/tujuan. |

## 3. Autentikasi dan onboarding

### FR-AUTH-001 - Registrasi email/password

Status: DISEPAKATI. Tautan: `BR-001`, `BR-007`, `BR-RULE-001`.

- Pengunjung memasukkan email, password, konfirmasi password, konfirmasi usia 18+, persetujuan S&K/Kebijakan Privasi, dan persetujuan data kesehatan yang terpisah.
- Sistem membuat akun belum terverifikasi, mencatat versi persetujuan, dan mengirim verifikasi email.
- Login data kesehatan ditolak sampai email terverifikasi dan persetujuan wajib lengkap.
- Email duplikat, password lemah, token tidak valid/kedaluwarsa, dan rate limit ditampilkan tanpa membocorkan keberadaan akun secara berlebihan.

Acceptance criteria:

1. Akun terverifikasi dapat masuk; akun belum terverifikasi diarahkan mengirim ulang verifikasi.
2. Persetujuan wajib dan versinya tercatat dengan timestamp serta metode penerimaan.
3. Pengguna di bawah 18 tahun tidak dapat menyelesaikan registrasi.

### FR-AUTH-002 - Login Google

Status: DISEPAKATI. Tautan: `BR-001`.

- Pengunjung dapat memakai Google OAuth.
- Setelah callback pertama, pengguna tetap wajib mengonfirmasi usia, zona layanan, dokumen hukum, dan persetujuan data kesehatan.
- Jika email cocok dengan akun yang ada, linking mengikuti mekanisme aman penyedia auth; sistem tidak membuat dua profil kesehatan tanpa keputusan eksplisit.

### FR-AUTH-003 - Login, logout, pemulihan, dan status akun

- Pengguna dapat login, logout, meminta reset password, dan menyelesaikan reset melalui tautan terbatas waktu.
- Akun nonaktif tidak dapat memakai fungsi aplikasi; halaman menjelaskan status dan kanal bantuan tanpa membuka alasan internal sensitif.
- Akun dalam grace period penghapusan hanya dapat mengunduh data, membatalkan permintaan, atau logout.

### FR-COOKIE-001 - Cookie consent dan preferensi

Status: DISEPAKATI. Tautan: `BR-009`, `BR-RULE-013`.

- Pada kunjungan pertama sebelum teknologi non-esensial dijalankan, sistem menampilkan banner ringkas dengan tindakan **Terima semua**, **Tolak non-esensial**, dan **Atur pilihan** yang mudah ditemukan dan tidak menyesatkan.
- Cookie/penyimpanan yang mutlak diperlukan untuk autentikasi, keamanan, load balancing, dan penyimpanan pilihan consent dijelaskan sebagai esensial serta tidak dapat dimatikan melalui banner.
- Analytics dan marketing merupakan kategori terpisah, default-nya mati, tidak pre-checked, dan hanya aktif setelah tindakan afirmatif. Selama belum ada vendor/tujuan yang disetujui, kategori tersebut tetap tidak menjalankan script apa pun.
- Pengguna dapat membuka pusat preferensi dari footer/pengaturan, mengubah atau menarik consent semudah memberikannya.
- Sistem meminta pilihan ulang bila tujuan/vendor berubah secara material, versi notice berubah, atau bukti consent telah kedaluwarsa menurut kebijakan final.
- Penolakan cookie non-esensial tidak menghalangi fitur inti.

Acceptance criteria:

1. Network/storage test membuktikan tidak ada teknologi non-esensial sebelum consent.
2. Tolak non-esensial mempertahankan hanya teknologi esensial; perubahan pilihan segera menghentikan pemuatan berikutnya dan menghapus identifier non-esensial yang dapat dihapus oleh aplikasi.
3. Bukti pilihan menyimpan versi notice, kategori, keputusan, waktu, dan metode tanpa fingerprinting.
4. Consent banner dan preference center dapat dipakai dengan keyboard dan screen reader.

## 4. Profil

### FR-PROFILE-001 - Membuat dan memperbarui profil

Status: DISEPAKATI. Tautan: `BR-001`, `BR-007`.

Field wajib: nama, tanggal lahir, jenis kelamin, dan zona waktu WIB/WITA/WIT. Sistem menghitung usia dari tanggal lahir dan menolak profil yang menunjukkan usia di bawah 18 tahun.

Acceptance criteria:

1. Zona waktu mengubah penyajian jadwal/hari tanpa mengubah instant UTC tersimpan.
2. Perubahan zona waktu tidak mengirim ulang notifikasi lama.
3. Profil pengguna lain tidak dapat dibaca atau diubah.

## 5. Pencatatan gula darah

### FR-GLUCOSE-001 - Membuat catatan

Status: DISEPAKATI. Tautan: `BR-001`, `BR-RULE-004`.

Input: nilai numerik positif, satuan mg/dL atau mmol/L, waktu pengukuran, kondisi pengukuran, dan catatan opsional. Kondisi final harus menyelesaikan konflik **sebelum makan** versus **GDS**; sampai itu selesai, pilihan yang ambigu tidak dipakai untuk evaluasi medis.

Perilaku:

1. Sistem memvalidasi rentang teknis, presisi, waktu yang tidak melampaui toleransi masa depan, dan zona waktu.
2. Sistem menyimpan nilai/satuan asli, nilai normalisasi untuk perhitungan, `measured_at`, dan `recorded_at` secara terpisah.
3. Catatan historis disimpan dan masuk riwayat/grafik, tetapi tidak memicu alert historis.
4. Jika mesin evaluasi belum disetujui, sistem menampilkan "Status belum dievaluasi", bukan "aman".
5. Jika fitur evaluasi telah disetujui dan hasil masuk pemicu bahaya, pengguna harus mengonfirmasi nilai sebelum alert kontak dibuat.

Acceptance criteria:

- Konversi tampilan mg/dL <-> mmol/L konsisten dan tidak menimpa nilai asli.
- Request duplikat dengan idempotency key yang sama menghasilkan satu catatan.
- Nilai invalid ditolak tanpa membuat catatan/job.

### FR-GLUCOSE-002 - Menandai salah dan membuat pengganti

Status: DISEPAKATI. Tautan: `BR-RULE-002`, `BR-RULE-003`.

- Pengguna memilih "Tandai sebagai salah", memasukkan alasan opsional, lalu mengonfirmasi.
- Sistem tidak mengubah nilai asli; mencatat actor, waktu, dan status invalid.
- Pengguna dapat membuat catatan pengganti yang menaut ke catatan salah.
- Catatan salah terlihat jelas di riwayat audit pribadi, tetapi dikecualikan dari grafik, laporan, ringkasan, status, dan semua alarm.
- Job belum terkirim yang berasal dari catatan tersebut dibatalkan. Pesan yang sudah terkirim tidak dapat ditarik dan tetap diaudit.

### FR-GLUCOSE-003 - Riwayat, rekap, dan dashboard

- Pengguna dapat melihat riwayat miliknya, urut terbaru, dengan pagination.
- Filter minimum: 7 hari, 14 hari, 30 hari, dan rentang tanggal.
- Dashboard menampilkan ringkasan aktivitas/data valid saja.
- Rekap kategori hanya aktif ketika istilah dan ambang telah disetujui; jika belum, rekap berdasarkan tanggal/kondisi tanpa label medis.

### FR-GLUCOSE-004 - Grafik

- Grafik memakai `measured_at` dalam zona pengguna dan hanya catatan valid.
- Titik menampilkan nilai/satuan tampilan, waktu, dan kondisi.
- Periode tanpa data menampilkan empty state, bukan garis nol.

### FR-REPORT-001 - Laporan PDF

Status: DISEPAKATI. Tautan: `BR-002`, `BR-PEND-007`.

- Pengguna memilih rentang tanggal lalu mengunduh PDF berisi identitas dasar, periode/zona waktu, grafik, dan tabel catatan valid.
- Judul memakai "Laporan Pemantauan Gula Darah", bukan "rekam medis".
- PDF memuat timestamp pembuatan dan disclaimer non-diagnosis.
- Catatan salah tidak masuk isi klinis; laporan dapat menyebut jumlah catatan yang dikecualikan tanpa nilainya.
- Preset "bulanan" tidak diberi definisi sampai `BR-PEND-007` selesai.

## 6. Jadwal dan pengingat

### FR-SCHEDULE-001 - Mengelola jadwal

Status: DISEPAKATI sebagian. Tautan: `BR-003`, `BR-PEND-006`.

Input minimum: tanggal, jam lokal, kategori (pemeriksaan, insulin, obat, lain), nama tindakan, status aktif. Jika kategori obat, nama obat dan dosis/catatan menjadi tersedia sebagai input bebas; sistem tidak memberi rekomendasi.

- Pengguna dapat membuat, melihat, mengubah jadwal mendatang, menjeda, mengaktifkan kembali, dan menghapus jadwal mendatang.
- Perubahan tidak mengubah kejadian yang sudah selesai/terlewat.
- Pengulangan mingguan dan tombol selesai untuk insulin/obat tetap feature-gated sampai dikonfirmasi.
- Kalender mingguan adalah tampilan sederhana.

### FR-REMINDER-001 - Mengirim pengingat pengguna

Status: DISEPAKATI. Tautan: `BR-004`.

- Saat jadwal jatuh tempo, sistem membuat satu pekerjaan per kanal yang berlaku.
- Dashboard selalu tersedia untuk pengguna aktif.
- Browser push dikirim hanya bila subscription aktif dan izin tersedia.
- Bila push tidak tersedia/ditolak, sistem mengantrekan fallback email.
- Retry tidak boleh membuat duplikasi logis; hasil `queued`, `sent`, `delivered` (jika tersedia), `failed`, atau `suppressed` dibedakan.
- Jadwal dijeda, akun nonaktif, dan grace period penghapusan tidak menghasilkan pekerjaan baru.

### FR-REMINDER-002 - Keterlambatan pencatatan

Status: PENDING; proposal adalah baseline, tetapi penegasan klien masih diperlukan. Tautan: `BR-005`, `BR-PEND-005`.

- Hanya setelah feature gate diaktifkan, bila tidak ada catatan valid yang memenuhi jadwal pemeriksaan hingga 24 jam setelah jadwal terlewat, sistem dapat membuat alert ke kontak darurat aktif.
- Hanya jadwal pemeriksaan gula darah yang menjadi baseline; obat/insulin terlewat tidak memicu kontak sampai disetujui.
- Pembuatan catatan yang valid sebelum cutoff membatalkan alert belum terkirim.

## 7. Kontak darurat

### FR-CONTACT-001 - Undangan dan persetujuan

Status: DISEPAKATI. Tautan: `BR-RULE-005` sampai `BR-RULE-007`.

1. Pengguna memasukkan nama dan email maksimal dua kontak.
2. Sistem mengirim tautan undangan sekali pakai dan terbatas waktu.
3. Halaman undangan menjelaskan pengelola, pengundang, jenis data yang mungkin dibagikan, kanal/frekuensi, hak menolak/mencabut, dan kontak dukungan.
4. Kontak dapat menerima atau menolak tanpa membuat akun.
5. Notifikasi baru aktif setelah penerimaan dan pencatatan versi notice.
6. Pengguna dapat mencabut hubungan; kontak juga dapat berhenti melalui tautan aman.

Acceptance criteria:

- Token disimpan dalam bentuk hash, sekali pakai, kedaluwarsa, dan tidak muncul di log.
- Email yang belum menyetujui tidak menerima data kesehatan.
- Pencabutan menekan pekerjaan belum terkirim dan tidak menghapus audit minimal yang diwajibkan.

### FR-CONTACT-002 - Alert nilai berbahaya

Status: PENDING. Tautan: `BR-PEND-001` sampai `BR-PEND-005`.

Jika dan hanya jika feature gate aktif setelah persetujuan: pengguna mengonfirmasi nilai; sistem membuat maksimal satu alert per catatan/kontak; email memuat nilai, satuan asli, waktu pengukuran, dan imbauan segera menghubungi pengguna. Email tidak menyatakan diagnosis atau instruksi medis.

## 8. Penghapusan dan ekspor akun

### FR-DELETE-001 - Mengajukan dan membatalkan penghapusan

Status: DISEPAKATI. Tautan: `BR-RULE-009` sampai `BR-RULE-012`.

- Pengguna melakukan re-authentication dan konfirmasi berisiko tinggi sebelum mengajukan.
- Sistem menetapkan `scheduled_for = requested_at + 7 hari`, menonaktifkan aktivitas/pengingat, membatalkan job belum terkirim, dan memberi tahu admin tanpa hak veto.
- Selama grace period, pengguna hanya dapat mengunduh data, membatalkan, atau logout.
- Pembatalan hanya oleh pengguna setelah re-authentication; layanan kembali aktif tanpa mengirim ulang job lama.

### FR-DELETE-002 - Mengeksekusi penghapusan

- Job idempotent menghapus/anonymize data aktif sesuai kategori pada/ setelah tenggat.
- Sistem menyimpan tombstone minimum non-kesehatan untuk mencegah data terhapus hidup kembali saat restore backup.
- Backup kedaluwarsa menurut jadwal retensi terpisah; produk tidak menjanjikan pemusnahan seketika dari semua salinan.
- Kegagalan diekskalasikan tanpa memperpanjang tenggat secara diam-diam.

### FR-EXPORT-001 - Unduh data

- Pengguna dapat mengekspor data miliknya dalam format portabel yang ditetapkan implementasi serta PDF laporan.
- Ekspor tersedia selama grace period dan dilindungi re-authentication/tautan terbatas waktu.

## 9. Administrasi akun

### FR-ADMIN-001 - Status akun

Status: DISEPAKATI. Tautan: `BR-RULE-008`.

- Admin dapat mencari akun berdasarkan identitas minimum, melihat status, dan mengaktifkan/menonaktifkan akun.
- Setiap perubahan memerlukan alasan, actor, timestamp, status lama/baru, dan correlation ID.
- API/halaman admin tidak mengambil nilai gula darah, laporan, catatan kesehatan, jadwal, atau isi kontak darurat.
- Admin tidak dapat membatalkan/menunda penghapusan.

## 10. Matriks skenario UAT minimum

| UAT | Kebutuhan | Skenario hasil yang diharapkan |
|---|---|---|
| UAT-001 | FR-AUTH-* | Registrasi email/Google, verifikasi, reset, consent, dan usia 18+. |
| UAT-002 | FR-PROFILE-001 | Zona WIB/WITA/WIT konsisten pada jadwal, grafik, dan PDF. |
| UAT-003 | FR-GLUCOSE-* | Input, konversi, historis, koreksi append-only, dan exclusion catatan salah. |
| UAT-004 | FR-REPORT-001 | Rentang tanggal, isi PDF, disclaimer, dan isolasi data. |
| UAT-005 | FR-SCHEDULE-* | Buat/ubah/jeda/aktifkan/hapus jadwal tanpa menduplikasi job. |
| UAT-006 | FR-CONTACT-* | Undang, terima/tolak, kedaluwarsa, cabut, dan larangan akses data. |
| UAT-007 | FR-REMINDER-* | Push allowed/denied, fallback, kegagalan vendor, retry, dan deduplikasi. |
| UAT-008 | FR-DELETE-* | Ajukan, mode terbatas, batal, tenggat, job antre, tombstone, dan restore. |
| UAT-009 | FR-ADMIN-001 | Ubah status beralasan tanpa endpoint/response data kesehatan. |
| UAT-010 | BR-PEND-* | Semua perilaku pending tetap nonaktif pada release. |
| UAT-011 | FR-COOKIE-001 | First visit, accept, reject, granular choice, withdrawal, version change, accessibility, dan pembuktian tidak ada request non-esensial sebelum consent. |

Penerimaan UAT dinyatakan lengkap setelah minimal satu dari **Fasty Nazzala Gisty** atau **Jesslyn Jevoncia** memberikan persetujuan eksplisit yang dapat dibuktikan atas kandidat final; pihak kedua tetap diupayakan dan dicatat. Diam bukan persetujuan. (Keputusan PM 9 September 2026, menggantikan ketentuan sebelumnya yang mensyaratkan persetujuan keduanya.)
