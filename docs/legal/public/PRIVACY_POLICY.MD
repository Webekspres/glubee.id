# Draf Kebijakan Privasi Glubee

Status: **DRAF UNTUK REVIEW HUKUM - BELUM UNTUK DIPUBLIKASIKAN**
Versi: 0.1-draft
Tanggal berlaku: [diisi saat disetujui]

Kebijakan ini harus diperiksa penasihat hukum Indonesia dan dicocokkan kembali dengan implementasi, kontrak vendor, lokasi pemrosesan, serta status pendaftaran PSE sebelum dipublikasikan.

## 1. Pengelola layanan

Glubee dikelola bersama oleh:

- Fasty Nazzala Gisty; dan
- Jesslyn Jevoncia,

sebagai perorangan. Kontak dukungan dan pengaduan privasi:

- Email: adnanfasty@gmail.com dan jesslynjevoncia2000@gmail.com
- WhatsApp: +62 857-4288-0883 dan +62 811-5466-799
- Alamat korespondensi publik: [menunggu persetujuan pengelola]

PT Webekspres Teknologi Indonesia membantu pengembangan dan operasi teknis sesuai instruksi serta perjanjian dengan pengelola. Pembagian peran pengendali/prosesor data harus dipastikan dalam review hukum dan kontrak tertulis.

## 2. Cakupan dan kelayakan

Glubee ditujukan bagi pengguna berusia 18 tahun atau lebih di Indonesia. Layanan bukan alat diagnosis, bukan fasilitas pelayanan kesehatan, dan bukan pengganti konsultasi tenaga medis.

## 3. Data yang diproses

Kami dapat memproses:

1. **Data akun dan identitas**: nama, email, identitas login Google bila dipilih, tanggal lahir, jenis kelamin, dan status akun.
2. **Data kesehatan**: nilai gula darah, satuan, waktu dan kondisi pengukuran, catatan pengguna, status valid/salah, grafik, dan laporan.
3. **Data jadwal**: jadwal pemeriksaan, insulin, obat, atau tindakan lain; nama obat/dosis/catatan yang pengguna masukkan sendiri; status pengingat.
4. **Data kontak darurat**: nama, email, status undangan/persetujuan/pencabutan, serta bukti versi notice.
5. **Data persetujuan**: jenis, versi dokumen, keputusan, waktu, dan metode penerimaan/pencabutan.
6. **Data teknis dan keamanan**: zona waktu, subscription browser push, alamat IP atau metadata perangkat yang dibutuhkan untuk keamanan, event audit, correlation ID, dan status pengiriman. Log tidak dimaksudkan memuat nilai gula darah atau isi catatan kesehatan.
7. **Data bantuan**: isi komunikasi yang pengguna kirim kepada kanal dukungan.
8. **Cookie dan penyimpanan perangkat**: cookie sesi/auth, pilihan consent, serta cookie/identifier non-esensial hanya bila pengguna mengizinkan kategori terkait. Daftar nama, penyedia, tujuan, dan durasi final akan berasal dari audit implementasi.

## 4. Tujuan pemrosesan

Data digunakan hanya untuk:

- membuat dan mengamankan akun;
- mencatat, menampilkan, mengoreksi, membuat grafik, mengekspor, dan menyusun laporan gula darah;
- mengelola jadwal serta mengirim pengingat;
- mengundang dan memverifikasi kontak darurat;
- mengirim informasi kepada kontak darurat sesuai persetujuan dan pemicu yang disepakati;
- menangani permintaan pengguna, penghapusan, keamanan, penyalahgunaan, insiden, dan kewajiban hukum;
- menjaga keandalan, backup, pemulihan, audit, dan perbaikan layanan.

Data kesehatan tidak digunakan untuk iklan, penjualan data, penelitian, profil pemasaran, atau pelatihan model AI tanpa pemberitahuan dan dasar pemrosesan baru yang sah.

## 4.1 Cookie dan teknologi serupa

Cookie esensial dipakai agar autentikasi, keamanan, kesinambungan sesi, dan penyimpanan pilihan privasi dapat bekerja. Cookie ini tidak digunakan untuk iklan dan tidak dapat dinonaktifkan melalui consent banner tanpa merusak fungsi inti.

Analytics, marketing, atau penyimpanan non-esensial default-nya tidak aktif dan baru dijalankan setelah pilihan afirmatif. Pengguna dapat menolak, memilih per kategori, atau menarik consent melalui **Pengaturan Cookie**. Penolakan tidak menghalangi fitur inti. Saat vendor final tersedia, kebijakan ini harus memuat tabel cookie/storage nyata: nama, penyedia, tujuan, kategori, first/third party, dan durasi.

## 5. Dasar dan persetujuan pemrosesan

Karena data kesehatan merupakan data pribadi spesifik, alur produk meminta persetujuan eksplisit yang terpisah dan dapat dibuktikan sebelum fitur kesehatan digunakan. Dasar pemrosesan lain yang mungkin berlaku—misalnya pelaksanaan perjanjian, kewajiban hukum, atau kepentingan sah—harus dipetakan dan disetujui melalui review hukum; kebijakan ini tidak menganggap semua pemrosesan otomatis berbasis persetujuan.

Pengguna dapat menarik persetujuan tertentu melalui pengaturan atau kanal privasi. Penarikan dapat menghentikan fitur yang membutuhkan data tersebut dan tidak membatalkan pemrosesan yang telah sah sebelum penarikan.

## 6. Kontak darurat dan pembagian data

Kontak darurat tidak memiliki akun atau akses ke dashboard. Hubungan baru aktif setelah kontak menerima undangan email dan menyetujui notice yang berlaku.

Jika fitur alert nilai berbahaya telah divalidasi dan diaktifkan, email dapat berisi nama pengguna/pengundang, nilai dan satuan gula darah, waktu pengukuran, serta imbauan menghubungi pengguna. Kontak juga dapat menerima pemberitahuan bila pengguna belum mencatat gula darah 24 jam setelah jadwal yang terlewat, sesuai pengaturan yang berlaku.

Pengguna atau kontak dapat mencabut hubungan. Pekerjaan yang belum dikirim akan ditekan bila secara teknis memungkinkan; pesan yang sudah dikirim tidak dapat ditarik kembali.

## 7. Penyedia layanan dan transfer data

Usulan penyedia teknis mencakup Vercel (hosting aplikasi), Supabase (database dan autentikasi), serta Brevo (email transaksional). Daftar final, entitas kontraktual, negara/lokasi pemrosesan, subprocessor, dasar transfer lintas negara, dan tautan kebijakan vendor akan diperbarui setelah paket produksi dipilih.

Penyedia hanya diberi data yang diperlukan untuk fungsi masing-masing dan tunduk pada pengaturan kontraktual serta pengamanan yang harus ditinjau sebelum produksi. Kami dapat membagikan data bila diwajibkan hukum atau diperlukan untuk melindungi hak/keamanan, sesuai proses yang sah.

Kami tidak menjual data pribadi.

## 8. Penyimpanan dan keamanan

Kami merancang kontrol seperti enkripsi saat transit, pembatasan akses, Row Level Security, pemisahan lingkungan, pencatatan audit, pengelolaan rahasia server-side, backup terenkripsi, pengujian akses lintas pengguna, dan pemantauan insiden. Tidak ada sistem yang dapat menjamin keamanan mutlak.

Admin aplikasi tidak dapat membaca catatan gula darah atau laporan pengguna. Akses teknis istimewa Webekspres, bila benar-benar diperlukan, dibatasi, beralasan, dan diaudit menurut prosedur internal.

## 9. Retensi dan penghapusan

Data aktif disimpan selama akun aktif dan diperlukan untuk tujuan yang dijelaskan. Pengguna dapat meminta penghapusan akun dengan masa jeda tujuh hari:

- selama masa jeda, pencatatan dan pengingat dihentikan;
- pengguna hanya dapat mengunduh data, membatalkan permintaan, atau keluar;
- hanya pengguna yang dapat membatalkan;
- admin diberi tahu tetapi tidak dapat menunda atau membatalkan;
- pada tenggat, sistem menghapus atau menganonimkan data aktif menurut kategori.

Salinan backup mengikuti siklus retensi terpisah dan tidak selalu hilang seketika. Data yang terhapus tidak akan digunakan kembali untuk operasi normal dan harus dicegah agar tidak aktif kembali saat pemulihan backup. Catatan minimum non-kesehatan dapat disimpan bila diperlukan untuk keamanan, pembuktian kepatuhan, penyelesaian sengketa, atau kewajiban hukum, berdasarkan jadwal retensi yang disetujui.

Jangka retensi final per kategori: [menunggu legal review dan keputusan operasi].

## 10. Hak pengguna

Sesuai hukum yang berlaku, pengguna dapat meminta informasi, akses, salinan, koreksi data profil, penghentian/pembatasan tertentu, penarikan persetujuan, portabilitas bila berlaku, keberatan, dan penghapusan. Catatan gula darah lama tidak diedit; koreksi dilakukan dengan menandai salah dan membuat catatan pengganti agar integritas riwayat terjaga.

Permintaan diajukan melalui kontak privasi. Kami dapat meminta verifikasi identitas yang proporsional. Target waktu dan proses respons harus mengikuti hukum yang berlaku dan dicatat dalam `docs/legal/internal/LEGAL_OPERATIONS.MD`.

## 11. Notifikasi dan keterbatasan layanan

Browser push dan email dapat terlambat, diblokir, masuk spam, gagal karena perangkat/jaringan/vendor, atau tidak terkirim saat kuota habis. Glubee tidak boleh digunakan sebagai satu-satunya sarana menghadapi keadaan darurat. Dalam keadaan gawat, pengguna atau kontak harus menggunakan layanan darurat/tenaga medis yang sesuai.

## 12. Perubahan kebijakan

Setiap versi memiliki nomor dan tanggal berlaku. Perubahan material diberitahukan secara layak dan, bila dasar hukum mengharuskan, persetujuan baru akan diminta sebelum pemrosesan terkait dilanjutkan.

## 13. Pengaduan

Pengguna dapat menghubungi kontak privasi pada Bagian 1. Hak mengajukan pengaduan kepada otoritas yang berwenang tetap berlaku sesuai hukum Indonesia.

## 14. Rujukan review

- UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi: https://peraturan.go.id/id/uu-no-27-tahun-2022
- PP Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik: https://www.peraturan.go.id/id/pp-no-71-tahun-2019
- Permenkominfo Nomor 5 Tahun 2020 beserta perubahannya mengenai PSE Lingkup Privat: https://peraturan.go.id/id/permenkominfo-no-5-tahun-2020
- UU Nomor 17 Tahun 2023 tentang Kesehatan: https://peraturan.go.id/id/uu-no-17-tahun-2023
