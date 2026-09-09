# Katalog Persetujuan dan Pemberitahuan Glubee

Status: internal draft untuk product + legal review
Aturan: teks final harus sesuai implementasi dan diberi version ID tetap. Checkbox persetujuan tidak boleh pre-checked atau digabung dengan pemasaran.

## 1. Bukti persetujuan

Setiap receipt minimum memuat:

- `consent_type`;
- `document_version` dan hash/arsip teks;
- keputusan accept/decline/withdraw;
- timestamp server;
- user/contact subject reference;
- metode dan konteks UI;
- locale;
- bukti verifikasi yang proporsional tanpa menyimpan rahasia/token mentah.

Perubahan material menghasilkan versi baru. Persetujuan lama tidak ditimpa.

## 2. CNT-AGE-001 - Usia dan wilayah

Momen: registrasi email atau onboarding pertama OAuth. Wajib.

> Saya menyatakan berusia 18 tahun atau lebih dan menggunakan Glubee dalam cakupan layanan Indonesia.

Penolakan: akun tidak dapat menyelesaikan onboarding.

## 3. CNT-LEGAL-001 - Penerimaan dokumen layanan

Momen: registrasi/onboarding. Wajib.

> Saya telah membaca dan menyetujui Syarat dan Ketentuan Glubee serta menyatakan telah menerima Kebijakan Privasi versi yang ditampilkan.

UI wajib menautkan versi dokumen, bukan sekadar nama.

## 4. CNT-HEALTH-001 - Pemrosesan data kesehatan

Momen: sebelum catatan kesehatan pertama. Eksplisit dan terpisah.

> Saya memberikan persetujuan eksplisit kepada pengelola Glubee untuk memproses data gula darah, kondisi dan waktu pengukuran, catatan, jadwal, grafik, serta laporan saya guna menjalankan fitur pencatatan, pemantauan, pengingat, keamanan, dan dukungan layanan sebagaimana dijelaskan dalam Kebijakan Privasi. Saya memahami Glubee bukan alat diagnosis atau pengganti tenaga medis.

Penarikan: hentikan pemrosesan opsional/fitur terkait dan arahkan pengguna ke ekspor/penghapusan atau dasar pemrosesan lain yang telah direview hukum.

## 5. CNT-CONTACT-SHARE-001 - Berbagi kepada kontak darurat

Momen: sebelum pengguna mengirim undangan pertama. Eksplisit.

> Saya meminta Glubee mengundang kontak yang saya pilih. Jika kontak tersebut menyetujui, Glubee dapat mengirim informasi terbatas berupa nama saya, nilai dan satuan gula darah, waktu pengukuran, serta imbauan menghubungi saya ketika pemicu yang telah disetujui terjadi. Kontak juga dapat diberi tahu bila saya belum mencatat gula darah 24 jam setelah jadwal pemeriksaan terlewat. Saya memastikan alamat email yang saya masukkan benar dan saya berwenang mengundangnya.

Jika alert medis belum aktif, UI harus mengatakan fitur tersebut belum tersedia; jangan meminta persetujuan seolah pemrosesan sudah berjalan.

## 6. CNT-CONTACT-ACCEPT-001 - Penerimaan kontak darurat

Momen: halaman undangan token sekali pakai.

> [Nama pengguna] mengundang Anda sebagai kontak darurat Glubee. Jika Anda menerima, Glubee dapat mengirim email terbatas ketika pengguna belum mencatat gula darah 24 jam setelah jadwal pemeriksaan terlewat dan, setelah fitur terkait divalidasi/diaktifkan, ketika pengguna mengonfirmasi nilai yang memenuhi pemicu bahaya. Email nilai dapat memuat nama pengguna, nilai, satuan, waktu pengukuran, dan imbauan menghubungi pengguna. Anda tidak memperoleh akun atau akses ke dashboard/riwayat. Anda dapat menolak sekarang atau berhenti melalui tautan pada email.

Tombol: **Terima undangan** / **Tolak**. Tidak ada status aktif tanpa tindakan eksplisit.

## 7. CNT-PUSH-001 - Izin browser push

Momen: setelah pengguna memahami manfaat, sebelum prompt native browser. Opsional.

Pre-prompt:

> Aktifkan notifikasi browser untuk menerima pengingat jadwal. Jika Anda tidak mengizinkan atau browser tidak mendukung push, Glubee dapat memakai email terverifikasi sebagai cadangan. Notifikasi dapat terlambat atau gagal dan bukan layanan darurat.

Penolakan tidak menghalangi penggunaan fitur pencatatan.

## 7.1 CNT-COOKIE-001 - Cookie dan teknologi non-esensial

Momen: kunjungan pertama, sebelum teknologi non-esensial berjalan.

Copy banner:

> Glubee memakai cookie esensial agar login, keamanan, dan pilihan privasi berfungsi. Dengan izin Anda, kami juga dapat memakai kategori non-esensial yang dijelaskan pada pengaturan. Cookie non-esensial tidak dijalankan sebelum Anda memilih. Anda dapat mengubah pilihan kapan saja.

Tindakan setara dan mudah ditemukan:

- **Tolak non-esensial**
- **Atur pilihan**
- **Terima semua**

Preference center:

- **Esensial - selalu aktif**: autentikasi, keamanan, kesinambungan sesi, dan penyimpanan pilihan consent.
- **Analytics - default mati**: hanya tersedia setelah tujuan, data, vendor, durasi, dan transfernya disetujui serta ditampilkan.
- **Marketing - default mati**: tidak digunakan dalam scope saat ini; tidak boleh diaktifkan tanpa perubahan kebutuhan dan legal review.

Tidak ada checkbox pre-checked untuk kategori non-esensial. Footer/pengaturan selalu menyediakan tautan **Pengaturan Cookie**. Receipt memakai `CNT-COOKIE-001` beserta version ID teks.

## 8. NTC-DANGEROUS-CONFIRM-001 - Konfirmasi nilai pemicu alert

Status: PENDING sampai `BR-PEND-001..005` selesai.

> Periksa kembali nilai, satuan, kondisi, serta waktu pengukuran. Jika Anda melanjutkan, catatan akan disimpan dan pemberitahuan dapat dikirim kepada kontak darurat yang aktif. Glubee tidak memberikan diagnosis. Bila Anda merasa dalam keadaan gawat, segera cari bantuan medis yang sesuai.

Tombol tidak boleh memakai kata "aman". Request memakai idempotency key.

## 9. NTC-DELETE-001 - Permintaan penghapusan akun

Momen: setelah re-authentication.

> Akun Anda dijadwalkan untuk dihapus tujuh hari setelah permintaan. Selama masa jeda, pencatatan, pengingat, dan notifikasi kontak dihentikan. Anda hanya dapat mengunduh data, membatalkan permintaan, atau keluar. Hanya Anda yang dapat membatalkan. Setelah tenggat, data aktif akan dihapus atau dianonimkan; salinan backup kedaluwarsa sesuai jadwal terpisah dan tidak selalu hilang seketika.

Konfirmasi wajib menampilkan tanggal/jam lokal dan UTC yang tepat.

## 10. NTC-DELETE-CANCEL-001 - Pembatalan

> Permintaan penghapusan dibatalkan. Akun kembali aktif. Pengingat lama yang telah lewat tidak akan dikirim ulang; periksa jadwal aktif Anda.

## 11. NTC-FEATURE-PENDING-001 - Fitur belum tersedia

> Fitur ini belum tersedia karena aturan dan/atau materi pendukung masih menunggu persetujuan. Data Anda tetap dapat dicatat, tetapi tidak akan diberi label medis atau memicu pemberitahuan berbasis nilai.

Dipakai untuk klasifikasi medis, alert nilai, preset bulanan, recurrence/completion, dan maskot sesuai gate masing-masing.

## 12. NTC-DELIVERY-001 - Status pengiriman

- `queued`: "Notifikasi sedang diproses."
- `sent`: "Notifikasi telah diserahkan ke penyedia pengiriman; penerimaan belum dapat dijamin."
- `failed`: "Notifikasi gagal dikirim. Periksa alamat/izin atau coba lagi. Jangan mengandalkan Glubee untuk keadaan darurat."
- `suppressed`: "Notifikasi tidak dikirim karena izin, persetujuan, status akun, atau catatan sudah tidak memenuhi syarat."

## 13. NTC-INVALIDATE-001 - Tandai catatan salah

> Catatan asli tetap ada pada riwayat audit pribadi, tetapi dikeluarkan dari grafik, laporan, ringkasan, status, dan alarm. Anda dapat membuat catatan pengganti setelah melanjutkan. Pesan yang sudah terkirim tidak dapat ditarik.

## 14. Checklist implementasi copy

- Tidak ada dark pattern, checkbox pre-checked, atau consent bundling.
- Tautan dokumen dan version ID terlihat sebelum keputusan.
- Decline/withdraw semudah accept bila pemrosesan bersifat opsional.
- Banner cookie tidak memakai dark pattern; tombol menolak tidak disembunyikan atau dibuat jauh lebih sulit daripada menerima.
- Bahasa tidak menyatakan diagnosis, kepastian pengiriman, atau jaminan bebas risiko.
- Semua copy diuji pada mobile, keyboard, screen reader, dan error state.
