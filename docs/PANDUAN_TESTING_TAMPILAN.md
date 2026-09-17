# Panduan Checklist Pengujian Tampilan Glubee (Step-by-Step)

Dokumen ini disusun berurutan mengikuti perjalanan pengguna (*user journey*) dari awal pertama kali membuka website hingga seluruh fitur pencatatan dan dashboard selesai dicoba.

---

## Persiapan Sebelum Memulai

Pastikan server lokal sudah berjalan di terminal:

1. **Jalankan Aplikasi Web**:
   ```bash
   bun run dev
   ```
   Aplikasi akan aktif di: **[http://localhost:3000](http://localhost:3000)**

2. **Buka Layanan Email Testing (Mailpit)**:
   Karena Supabase berjalan di lokal, email konfirmasi tidak dikirim ke inbox asli, melainkan ditangkap oleh Mailpit di:
   **[http://127.0.0.1:54324](http://127.0.0.1:54324)**

---

## Alur Pengujian Berurutan

### Langkah 1: Halaman Depan & Cookie Consent
- **URL**: `http://localhost:3000`
- **Yang Harus Diperiksa**:
  1. **Tampilan Hero**: Judul besar, deskripsi, dan tombol CTA *"Mulai Sekarang — Gratis"* dan *"Masuk ke Akun"*.
  2. **Banner Penafian Medis**: Di bawah tombol, terdapat kotak informasi bahwa Glubee adalah sarana pencatatan mandiri (bukan alat diagnosis).
  3. **Banner Cookie Consent (Bawah Layar)**:
     - Muncul banner *"Pemberitahuan Cookie & Privasi"*.
     - Klik tombol **"Atur pilihan"** &rarr; pastikan modal Pusat Preferensi Cookie terbuka dengan kategori Esensial (Selalu Aktif), Analytics (Opsional), dan Marketing (Nonaktif).
     - Klik **"Terima semua"** atau **"Tolak non-esensial"** &rarr; banner akan tertutup dan pilihan tersimpan.
  4. **Tautan Footer**:
     - Klik tautan **Syarat & Ketentuan** (`/terms`) &rarr; baca dokumen ketentuan.
     - Klik tautan **Kebijakan Privasi** (`/privacy`) &rarr; baca dokumen privasi data UU PDP.
     - Klik tombol **"Pengaturan Cookie"** di footer &rarr; modal preferensi cookie dapat dibuka kembali kapan saja.

---

### Langkah 2: Pendaftaran Pengguna Baru (Register)
- **URL**: `http://localhost:3000/register` (atau klik tombol *"Mulai Sekarang"* dari Beranda)
- **Yang Harus Diperiksa**:
  1. **Formulir Input**:
     - Masukkan Email (contoh: `pengguna@test.id`).
     - Masukkan Password (minimal 8 karakter, contoh: `Password123!`).
     - Masukkan Konfirmasi Password.
     - Pilih Tanggal Lahir (pastikan memilih usia 18 tahun ke atas, contoh: tahun 1995).
  2. **3 Checkbox Persetujuan Wajib (Teks Bersih Tanpa Kode Teknis)**:
     - [x] Pernyataan usia 18+ dan wilayah Indonesia.
     - [x] Persetujuan Syarat & Ketentuan serta Kebijakan Privasi.
     - [x] Persetujuan eksplisit pemrosesan data kesehatan mandiri non-diagnostik.
  3. Klik tombol **"Daftar Akun"**.
  4. Halaman akan otomatis berpindah ke halaman instruksi verifikasi email.

---

### Langkah 3: Verifikasi Email Pendaftaran
- **URL**: `http://localhost:3000/auth/verify`
- **Yang Harus Diperiksa**:
  1. Muncul halaman konfirmasi dengan ikon amplop yang menginformasikan bahwa tautan verifikasi telah dikirim ke email Anda.
  2. Buka tab browser baru ke Mailpit: **[http://127.0.0.1:54324](http://127.0.0.1:54324)**.
  3. Di kotak masuk Mailpit, klik email dari Supabase (berjudul *"Confirm Your Signup"*).
  4. Klik link konfirmasi di dalam email tersebut.
  5. Anda akan otomatis dialihkan ke halaman **Lengkapi Profil (Onboarding)** di Glubee!

---

### Langkah 4: Melengkapi Profil (Onboarding)
- **URL**: `http://localhost:3000/onboarding`
- **Yang Harus Diperiksa**:
  1. Tanggal lahir sudah otomatis terisi dari saat pendaftaran.
  2. Masukkan **Nama Lengkap / Nama Panggilan** (contoh: *Budi Pratama*).
  3. Pilih **Jenis Kelamin** (*Laki-laki* atau *Perempuan*).
  4. Pilih **Zona Waktu** (*WIB*, *WITA*, atau *WIT*).
  5. Klik tombol **"Simpan & Lanjutkan ke Dashboard"**.
  6. Status akun Anda kini aktif dan Anda langsung masuk ke Dashboard!

---

### Langkah 5: Dashboard Pemantauan
- **URL**: `http://localhost:3000/dashboard`
- **Yang Harus Diperiksa**:
  1. **Header**: Judul Dashboard dan tombol biru `+ Catat Gula Darah`.
  2. **Banner Peringatan Medis**: Kotak kuning tenang di bagian atas yang mengingatkan rentang normal acuan non-diagnostik.
  3. **Filter Periode**: Pilihan tombol *7 Hari*, *14 Hari*, *30 Hari*, dan *Bulan Kalender Ini*.
  4. **4 Kartu Metrik Ringkasan**:
     - Rata-rata Gula Darah (mg/dL)
     - Nilai Terendah (mg/dL)
     - Nilai Tertinggi (mg/dL)
     - Total Pengukuran
  5. **Grafik Tren Gula Darah (SVG)**:
     - Jika belum ada data, menampilkan kotak kosong yang rapi (*"Belum Ada Data Grafik"*).
     - Terdapat area hijau lembut sebagai penanda rentang normal (70 – 140 mg/dL).

---

### Langkah 6: Mencatat Hasil Gula Darah Baru
- **URL**: `http://localhost:3000/log` (atau klik tombol *"Catat Gula Darah"* di Dashboard)
- **Skenario Tes Input**:
  1. **Tes Nilai Normal**:
     - Masukkan nilai: `85` (satuan `mg/dL`).
     - Pilih kondisi: **Puasa (Min. 8 Jam)**.
     - Perhatikan kotak pratinjau status di bawah input: otomatis muncul badge hijau **"normal"**.
     - Klik **"Simpan Catatan"** &rarr; muncul animasi sukses *"Catatan berhasil disimpan!"*.
  2. **Tes Nilai Rendah**:
     - Masukkan nilai: `55` (satuan `mg/dL`).
     - Pilih kondisi: **Sebelum Makan** atau **Sewaktu**.
     - Perhatikan kotak pratinjau status: otomatis muncul badge kuning **"rendah"** (karena `< 60 mg/dL`).
     - Simpan catatan.
  3. **Tes Nilai Tinggi**:
     - Masukkan nilai: `165` (satuan `mg/dL`).
     - Pilih kondisi: **2 Jam Setelah Makan**.
     - Perhatikan kotak pratinjau status: otomatis muncul badge merah **"tinggi"** (karena `> 139 mg/dL`).
     - Berikan catatan tambahan opsional (contoh: *"Makan siang nasi padang"*).
     - Simpan catatan.
  4. **Tes Konversi mmol/L**:
     - Klik tombol satuan **mmol/L**.
     - Masukkan nilai: `5.0` (setara 90 mg/dL).
     - Simpan catatan.

---

### Langkah 7: Memeriksa Visualisasi Grafik & Kartu Ringkasan
- **URL**: `http://localhost:3000/dashboard`
- **Yang Harus Diperiksa**:
  1. Grafik tren sekarang menampilkan garis poliline biru dengan titik-titik bulat berwarna:
     - Titik **Hijau**: nilai normal.
     - Titik **Kuning/Oranye**: nilai rendah (< 60).
     - Titik **Merah**: nilai tinggi.
  2. **Interaktivitas Tooltip**: Arahkan mouse atau sentuh titik grafik &rarr; muncul kartu kecil di bawah grafik yang menunjukkan rincian nilai asli, satuan, kondisi, dan tanggal/jam pengukuran.
  3. **Kartu Metrik Terkini**: Menampilkan rata-rata hitungan mg/dL, nilai terendah, nilai tertinggi, dan jumlah total catatan.
  4. **Daftar Catatan Terbaru**: 5 pengukuran terbaru muncul di bawah grafik dengan tanggal dan kondisi pengukuran.

---

### Langkah 8: Riwayat Catatan & Koreksi Data (Append-Only)
- **URL**: `http://localhost:3000/history`
- **Yang Harus Diperiksa**:
  1. Menampilkan seluruh riwayat catatan berurutan dari yang paling baru.
  2. Setiap catatan memiliki badge hijau **"Aktif"**.
  3. **Uji Fitur Koreksi Catatan (Tandai Salah & Ganti)**:
     - Pilih salah satu catatan, lalu klik tombol **"Koreksi Catatan"**.
     - Muncul konfirmasi alert pemberitahuan (menjelaskan bahwa catatan asli tetap ada untuk audit tetapi dikeluarkan dari ringkasan).
     - Klik **OK** &rarr; muncul modal formulir untuk memasukkan data pengganti yang benar.
     - Masukkan nilai baru dan simpan.
     - **Hasil di tabel riwayat**: Catatan lama kini dicoret dengan badge merah *"Keliru / Dibatalkan"*, dan di bawahnya muncul catatan baru dengan badge biru *"Catatan Pengganti"*.
     - Kembali ke Dashboard &rarr; pastikan nilai yang keliru **tidak lagi dihitung** pada grafik maupun angka rata-rata!

---

### Langkah 9: Profil Pengguna & Bukti Persetujuan (UU PDP)
- **URL**: `http://localhost:3000/profile`
- **Yang Harus Diperiksa**:
  1. **Informasi Akun**: Nama, tanggal lahir, jenis kelamin, dan zona waktu. Coba ubah nama atau zona waktu lalu klik *"Simpan Perubahan"*.
  2. **Bukti Persetujuan (Consent Receipts)**:
     - Menampilkan log resmi persetujuan Anda:
       - Pernyataan Usia 18+ & Wilayah Indonesia
       - Syarat Layanan & Kebijakan Privasi
       - Persetujuan Pemrosesan Data Kesehatan Pribadi
     - Setiap item mencantumkan status keputusan `ACCEPT`, versi dokumen aktif, metode pendaftaran, dan tanggal/jam pencatatan di server.
  3. **Pengaturan Cookie**: Terdapat tombol untuk membuka kembali pengaturan cookie kapan saja.
  4. **Hak Penghapusan Akun**: Informasi mengenai masa jeda perlindungan 7 hari sebelum data dihapus permanen.

---

### Langkah 10: Halaman Masuk Kembali (Logout & Login)
- **Yang Harus Diperiksa**:
  1. Klik tombol **"Keluar"** di pojok kanan atas Navbar.
  2. Anda akan diarahkan ke halaman Login (`/login`).
  3. Coba masukkan email dan password yang tadi Anda daftarkan.
  4. Klik **"Masuk"** &rarr; Anda langsung diarahkan kembali ke Dashboard dengan seluruh riwayat data Anda yang tetap aman tersimpan!

---

Selamat mencoba! Jika ada tampilan atau alur yang ingin disesuaikan lebih lanjut, silakan beri tahu saya.
