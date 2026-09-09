# Pedoman Operasional Hukum dan Privasi Glubee

Status: internal draft - bukan nasihat hukum
Pemilik: pengelola Glubee bersama Webekspres sesuai pembagian tanggung jawab yang dikontrakkan.

## 1. Tujuan

Dokumen ini menerjemahkan janji publik dan kebutuhan hukum menjadi prosedur operasional. Sebelum produksi, penasihat hukum harus menilai UU PDP, PP PSTE, PSE Lingkup Privat dan perubahannya, UU Kesehatan, perlindungan konsumen, kontrak vendor, transfer data lintas negara, serta status para pengelola yang masih perorangan.

## 2. Pembagian tanggung jawab yang harus difinalkan

| Area | Pengelola Glubee | Webekspres | Catatan |
|---|---|---|---|
| Tujuan/cara utama pemrosesan | Accountable/decision owner | Advises/implements | Peran hukum final perlu kontrak. |
| Keputusan medis dan copy | Approves + obtains medical review | Tidak menetapkan | Feature gate sampai bukti tersedia. |
| Hak pengguna/pengaduan | Public contact dan keputusan | Technical fulfilment | SLA dan escalation tertulis. |
| Keamanan aplikasi | Menyetujui risiko/anggaran | Implementasi dan operasi sesuai kontrak | Shared responsibility vendor. |
| Vendor/DPA/transfer | Contract owner atau pihak yang ditunjuk | Due diligence teknis | Entitas akun tidak boleh ambigu. |
| Insiden | Joint incident team | Detect/contain/evidence | Siapa memberi notifikasi ditetapkan sebelum rilis. |
| Publikasi legal | Approves after counsel | Deploys approved version | Tidak publish draft. |

## 3. Register pemrosesan

Sebelum go-live, buat dan jaga register yang memuat kategori subjek/data, tujuan, dasar hukum, penerima/vendor, lokasi/transfer, retensi, kontrol keamanan, owner, dan sistem sumber. Setiap fitur baru menjalani privacy impact review sebelum development.

Data kesehatan diperlakukan sebagai data pribadi spesifik. Dilarang memperluas tujuan ke marketing, riset, atau AI training tanpa analisis dasar hukum, notice, consent bila diperlukan, dan persetujuan tertulis.

## 4. Pengelolaan akses

- Daftar personel berakses produksi, peran, alasan, tanggal grant/review/revoke.
- MFA untuk seluruh akun vendor/production.
- Tidak ada shared account kecuali keterbatasan vendor terdokumentasi dan dimitigasi.
- Service-role/DB access hanya break-glass atau tugas terotorisasi; event tercatat.
- Review akses minimal triwulanan dan segera setelah personel keluar/berubah peran.
- Admin aplikasi tidak memiliki route/query untuk data kesehatan.
- Akses support memakai data minimum; screenshot/ticket disanitasi.

## 5. Permintaan hak pengguna

Alur minimum:

1. Catat request ID, jenis permintaan, waktu masuk, dan kanal.
2. Verifikasi identitas secara proporsional; jangan meminta data berlebih.
3. Cari data pada Auth, database, object storage, queue, vendor email, backup, dan log sesuai scope.
4. Evaluasi pengecualian/kewajiban retensi bersama legal owner.
5. Penuhi melalui workflow teknis dan second-person review untuk ekspor/penghapusan berisiko.
6. Jawab melalui kanal terverifikasi dan simpan bukti tindakan.
7. Eskalasi sengketa atau keterlambatan.

SLA hukum final harus diisi dari nasihat hukum yang berlaku; jangan mengarang tenggat. Pengguna tetap dapat memakai penghapusan self-service tujuh hari sesuai FRD.

## 6. Operasi penghapusan

- Monitor request due dan overdue setiap hari.
- Admin hanya melihat status; tidak memiliki kontrol cancel/defer.
- Pada request: stop schedule/job baru, suppress queue, revoke active session sesuai desain, dan kirim receipt.
- Pada hari ketujuh: eksekusi idempotent, hapus/anonymize data aktif, cabut subscription/token, hapus export, dan buat tombstone minimum.
- Catat kategori berhasil/gagal tanpa nilai kesehatan.
- Reconcile tombstone setelah setiap restore.
- Jadwal backup expiry didokumentasikan; backup tidak dipakai untuk operasi normal setelah deletion.

## 7. Manajemen insiden data

Severity awal:

- **SEV-1**: akses/ekspor massal, service key bocor, cross-user health data, backup bocor, atau kontrol isolasi gagal.
- **SEV-2**: akses terbatas/satu subjek, token undangan disalahgunakan, atau pengiriman data ke kontak yang tidak berhak.
- **SEV-3**: upaya gagal atau event tanpa bukti akses data, tetap diselidiki.

Prosedur:

1. Deteksi dan buka incident record; jangan menaruh data kesehatan di kanal umum.
2. Contain: revoke key/session, disable route/gate, isolate job/provider.
3. Preserve bukti dengan chain-of-custody dan akses minimum.
4. Tentukan kategori/jumlah subjek, data, waktu, penyebab, penerima, dan dampak.
5. Libatkan pengelola, Webekspres, vendor, keamanan, dan counsel sesuai matriks.
6. Counsel menentukan kewajiban, isi, penerima, dan tenggat notifikasi regulator/subjek berdasarkan hukum; keputusan dicatat.
7. Remediasi, validasi, postmortem tanpa menyalahkan individu, dan tracking action.

Template komunikasi tidak boleh mengecilkan insiden, berspekulasi, atau menjanjikan hasil yang belum terbukti.

## 8. Due diligence vendor

Sebelum mengaktifkan Vercel, Supabase, Brevo, monitoring, analytics, atau vendor baru, catat:

- entitas kontraktual dan pemilik akun;
- paket/kuota, SLA, support, dan exit plan;
- DPA, subprocessor, lokasi data, serta mekanisme transfer;
- enkripsi, access control, audit/log, deletion, backup, dan breach terms;
- data minimum yang dikirim;
- tanggal review dan approver;
- biaya berulang dan persetujuan pembelian.

Account owner operasional yang disepakati adalah Webekspres: Google/GCP serta akun vendor menggunakan `mk.webekspres@gmail.com`, sedangkan GitHub memakai user `sultanwebekspres` pada organisasi `webekspres`. Organisasi GitHub belum Enterprise dan GCP masih free tier. Detail ini menetapkan kepemilikan operasional, tetapi tidak otomatis menetapkan peran hukum pengendali/prosesor atau mengotorisasi paket berbayar.

Per 9 September 2026: Vercel Hobby tidak sesuai untuk penggunaan komersial; Supabase Free dapat dijeda dan tidak menyediakan backup otomatis; Brevo Free dibatasi 300 email/hari. Batas harus diverifikasi ulang sebelum produksi.

## 9. Retensi

Buat schedule final sebelum go-live untuk setiap tabel, object, log, email-provider record, consent, admin audit, security evidence, export, backup, dan tombstone. Schedule menentukan owner, trigger awal, durasi, dasar, metode deletion/anonymization, legal hold, dan verifikasi.

Nilai default pada SRS adalah usulan, bukan keputusan hukum. Legal hold harus terbatas, beralasan, terdokumentasi, dan dicabut saat tidak diperlukan.

## 10. Publikasi dan versioning dokumen

- Legal counsel/reviewer menyetujui naskah final.
- Simpan immutable copy, version ID, hash, approver, tanggal publikasi/berlaku.
- Product config menunjuk versi aktif.
- Perubahan material dipetakan ke kebutuhan re-consent/notice.
- Receipt pengguna selalu menunjuk versi yang benar.
- Versi lama tetap tersedia untuk pembuktian.

## 11. Registrasi dan kepatuhan pra-rilis

Review hukum wajib memutuskan:

- kebutuhan dan pihak yang melakukan pendaftaran PSE Lingkup Privat;
- identitas/nama usaha/alamat yang wajib dipublikasikan;
- peran pengendali bersama/prosesor dan perjanjian Webekspres;
- dasar pemrosesan data kesehatan dan transfer lintas negara;
- kewajiban petugas/pejabat pelindungan data bila berlaku;
- mekanisme hak subjek, pengaduan, dan notifikasi insiden;
- implikasi penggunaan istilah/fitur kesehatan dan perlindungan konsumen;
- validitas masa jeda tujuh hari dan retensi bukti/backup.

Sebutan "Pelayanan Kesehatan" dari data registrasi domain bukan bukti izin fasilitas atau kewenangan medis.

### 11.1 Arti keputusan legal-operasional yang masih dibutuhkan

- **Legal review**: penasihat hukum memeriksa apakah Privacy Policy, T&C, consent, pembagian tanggung jawab, dan alur penghapusan sesuai hukum serta implementasi nyata. Dokumen sekarang tetap draft sampai review ini selesai.
- **Keputusan PSE**: menentukan apakah/atas nama siapa Glubee harus didaftarkan sebagai Penyelenggara Sistem Elektronik Lingkup Privat dan menuntaskan proses yang berlaku sebelum layanan publik.
- **Retensi final**: menetapkan berapa lama setiap kategori data, log, consent receipt, email record, export, dan backup disimpan serta kapan dihapus.
- **RPO/RTO**: RPO adalah batas kehilangan data yang masih dapat diterima setelah insiden; RTO adalah target waktu pemulihan layanan. Angka final menentukan frekuensi backup dan kebutuhan paket infrastruktur.
- **Transfer data vendor**: memastikan negara/lokasi pemrosesan Vercel, Supabase, Brevo, dan vendor lain, dasar transfer lintas negara, kontrak/DPA, subprocessor, serta informasi yang perlu diberikan kepada pengguna.

Keputusan tersebut bukan blocker untuk scaffolding lokal, tetapi wajib ditutup sebelum go-live karena Glubee memproses data kesehatan.

## 12. Checklist release legal-operational

- [x] Nama/ejaan merek final: **Glubee**; identitas pengelola final telah dicatat.
- [ ] Alamat/kontak publik disetujui.
- [ ] Legal review Privacy Policy, T&C, consent, dan disclaimer selesai.
- [ ] Peran dan kontrak pengolahan data pengelola-Webekspres final.
- [ ] PSE dan kewajiban regulasi lain dinilai/dituntaskan.
- [ ] Aturan medis memiliki bukti validasi; atau seluruh fitur terkait tetap off.
- [ ] Vendor, DPA, subprocessor, lokasi, transfer, paket, dan anggaran disetujui.
- [ ] Retention schedule serta legal hold final.
- [ ] Hak pengguna dan deletion runbook diuji.
- [ ] Incident response tabletop dan daftar kontak selesai.
- [ ] Backup/restore + tombstone drill lulus.
- [ ] RLS/cross-user/admin isolation test lulus.
- [ ] Kapasitas email mencakup auth, invite, reminder, dan alert.
- [ ] Minimal satu dari Fasty Nazzala Gisty atau Jesslyn Jevoncia menyetujui UAT secara eksplisit dan terbukti; pihak kedua tetap diupayakan (keputusan PM 9 September 2026).
- [ ] Versi dokumen dan consent receipt cocok dengan deployment.
- [ ] Audit cookie/storage/network selesai; inventory nyata cocok dengan notice dan tidak ada teknologi non-esensial sebelum consent.
- [ ] Banner menyediakan accept, reject, pengaturan granular, serta withdrawal yang setara dan aksesibel.

## 13. Rujukan resmi awal

- UU PDP: https://peraturan.go.id/id/uu-no-27-tahun-2022
- PP PSTE: https://www.peraturan.go.id/id/pp-no-71-tahun-2019
- Permenkominfo PSE Lingkup Privat dan status perubahannya: https://peraturan.go.id/id/permenkominfo-no-5-tahun-2020
- UU Kesehatan: https://peraturan.go.id/id/uu-no-17-tahun-2023
