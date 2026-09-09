# Paket backlog ClickUp — Glubee.id

Status: siap dibaca agent untuk impor; **belum diimpor ke ClickUp**.

Sumber data utama: [CLICKUP_BACKLOG.json](CLICKUP_BACKLOG.json). Manifest ini bukan payload API langsung. Seluruh teks task berbahasa Indonesia, tanpa estimasi jam atau story point.

Target: [Space Glubee.id di Webekspres](https://app.clickup.com/90181827111/v/s/901813134902), workspace `90181827111`, Space `901813134902`, Folder `MVP 1.0`. Jangan menggunakan browser.

## Jadwal

| Sprint | Mulai | Akhir | Hasil |
|---|---|---|---|
| Sprint 1 | 2026-09-10 | 2026-09-23 | Fondasi teruji, autentikasi/profil dan pencatatan dapat didemokan melalui backend; dependensi aset dipantau. |
| Sprint 2 | 2026-09-24 | 2026-10-07 | Pengguna dapat onboarding, mencatat, mengoreksi, melihat grafik dan mengunduh PDF dengan UI sesuai aset klien. |
| Sprint 3 | 2026-10-08 | 2026-10-21 | Pengguna dapat mengelola jadwal, pengingat, kontak, ekspor/penghapusan akun; admin terbatas tersedia. |
| Sprint 4 | 2026-10-22 | 2026-11-04 | QA/UAT tuntas, production sehat, pelatihan dan serah terima selesai. |

40 hari dihitung inklusif Senin–Jumat mulai 10 September. Target deploy 2 November, observasi 3 November, serah terima paling lambat 4 November 2026. Kalender libur/cuti belum dimasukkan; tanggal merupakan forecast yang perlu disesuaikan sebelum commitment. Ketersediaan satu developer berubah dan tidak diasumsikan penuh delapan jam/hari.

Cadangkan sekitar 25% kapasitas aktual untuk bug, review dan pekerjaan mendadak. Ini kebijakan planning, bukan estimasi beban yang terukur. Jangan menafsirkan setiap due date sebagai satu hari kerja penuh; pecah task bila tidak muat setelah developer meninjau pekerjaan. Tanggal untuk task eksternal adalah target follow-up, bukan tanggal yang telah dijanjikan klien.

## Keputusan yang mengikat

- Semua fitur DISEPAKATI menjadi target MVP. Penundaan scope kontraktual harus dicatat melalui keputusan klien/change request; keamanan dan gate rilis tidak dihilangkan untuk mengejar tanggal.
- UI menunggu aset, desain dan brand guideline klien. Target penerimaan 18 September adalah asumsi planning. Backend/fondasi dapat dikerjakan sambil menunggu.
- UAT kandidat final cukup dengan satu persetujuan eksplisit Fasty atau Jesslyn; pihak kedua tetap diupayakan. Ini keputusan pengguna terbaru yang menggantikan aturan kedua reviewer dalam dokumen lama. GLB-001 mencakup sinkronisasinya.
- Review berarti pemeriksaan teknis oleh developer sendiri. UAT berarti pengujian/penerimaan klien. Task internal boleh selesai setelah Review; fitur pengguna memerlukan penerimaan sesuai paket UAT.
- Fitur medis dan keputusan produk pending tetap off. Penyelesaian GLB-E05 tidak otomatis menyetujui GLB-P01–P05. Task bersyarat belum mempunyai due date atau commitment sprint.
- Akun vendor operasional milik Webekspres; domain dikoordinasikan CS. Paket produksi/biaya tetap perlu keputusan, sebagaimana dokumen kebutuhan.
- Maintenance proposal: fix bug dan update minor selama satu tahun, backup mingguan, pemantauan keamanan dan pelatihan. Periode aktual dicatat saat serah terima; frekuensi backup final juga harus memenuhi RPO yang disepakati.
- Scaffold sudah terlihat di repo, tetapi implementasinya belum diaudit pada penyusunan backlog. Verifikasi pekerjaan existing sebelum menjalankan task; jangan menimpa atau mengulangnya otomatis.
- Impor task tidak berarti izin deployment, pembelian, perubahan DNS, publikasi legal atau mengirim komunikasi ke klien. Tindakan tersebut mengikuti otorisasi pelaksanaannya.

## Instruksi untuk agent pengimpor

1. Baca seluruh JSON, khususnya `planning`, `definition_of_done`, `tasks` dan `import`.
2. Pakai konektor ClickUp, verifikasi ID target, lalu baca semua Folder/List/Task di scope tersebut termasuk pagination. Reuse struktur yang sudah ada.
3. Buat Lists biasa sesuai manifest. Native Sprints tidak wajib. `Bugs & Change Requests` disiapkan kosong untuk temuan nyata.
4. Pakai prefix `[GLB-...]` sebagai ID eksternal untuk deduplikasi. Jangan menganggap task bernama sama tanpa ID sebagai task yang pasti cocok.
5. Set due date sebagai tanggal Asia/Jakarta, tanpa jam; biarkan tanggal null tetap kosong. Tag MoSCoW terpisah dari native priority. Resolve assignee dari anggota workspace; jika tidak pasti, biarkan kosong.
6. Description task harus memuat lingkup, acceptance criteria, ID kebutuhan, blocker, decision owner bila ada, serta DoD yang relevan. Simpan owner peran meskipun assignee belum terpetakan.
7. Buat task dahulu, kemudian hubungkan dependency memakai ID ClickUp yang dikembalikan. `depends_on` berarti task tersebut menunggu prasyarat.
8. Simpan journal di `docs/planning/CLICKUP_IMPORT_LOG.json` memakai template pada JSON. Jangan mengarang ID, URL, status sukses, atau bukti selesai.
9. Rerun harus mempertahankan status yang telah maju, komentar dan perubahan manusia. Laporkan konflik atau keterbatasan status/tag/dependency; jangan mengubah Space lain.
10. Baca kembali hasil untuk memeriksa tanggal, jumlah task, dependency dan duplikasi. Jika konektor tidak tersedia, laporkan bahwa impor belum dilakukan; jangan beralih ke browser.

Semua task awal adalah Backlog atau Blocked. Dependency internal menjadi syarat pindah ke Ready; status Blocked dipakai terutama untuk aset, keputusan eksternal, dan fitur bersyarat. Task yang tanggalnya lewat tidak boleh otomatis dianggap selesai.

## Daftar task

### Product Backlog

| ID | Task | Due date | Prasyarat |
|---|---|---|---|
| GLB-P01 | Implementasikan evaluasi nilai setelah validasi medis | Belum dijadwalkan | GLB-E05, GLB-007 |
| GLB-P02 | Implementasikan alert nilai ke kontak setelah persetujuan | Belum dijadwalkan | GLB-P01, GLB-022 |
| GLB-P03 | Implementasikan alert keterlambatan pencatatan | Belum dijadwalkan | GLB-E05, GLB-022 |
| GLB-P04 | Implementasikan pengulangan mingguan dan status selesai | Belum dijadwalkan | GLB-E05, GLB-018 |
| GLB-P05 | Tambahkan preset laporan bulanan | Belum dijadwalkan | GLB-E05, GLB-014 |
| GLB-M01 | Jalankan maintenance satu tahun sesuai proposal | Belum dijadwalkan | GLB-035 |

### Sprint 1

| ID | Task | Due date | Prasyarat |
|---|---|---|---|
| GLB-001 | Kunci baseline proyek dan sinkronkan keputusan terbaru | 2026-09-10 | — |
| GLB-002 | Verifikasi scaffold dan lengkapi quality checks | 2026-09-11 | GLB-001 |
| GLB-003 | Siapkan database lokal dan migration inti | 2026-09-14 | GLB-002 |
| GLB-004 | Terapkan isolasi data dan kontrak API dasar | 2026-09-15 | GLB-003 |
| GLB-005 | Bangun backend registrasi, sesi dan consent | 2026-09-16 | GLB-004 |
| GLB-006 | Integrasikan Google OAuth dan backend profil | 2026-09-17 | GLB-005 |
| GLB-007 | Bangun backend pencatatan dan koreksi | 2026-09-18 | GLB-006 |
| GLB-008 | Bangun query riwayat, ringkasan dan grafik | 2026-09-21 | GLB-007 |
| GLB-009 | Review Sprint 1 dan rencanakan Sprint 2 | 2026-09-23 | GLB-008 |
| GLB-E01 | Terima aset, brand guideline dan desain dari klien | 2026-09-18 | GLB-001 |
| GLB-E02 | Koordinasikan domain, sender, OAuth dan staging | 2026-09-22 | GLB-002 |
| GLB-E05 | Kumpulkan keputusan fitur pending dan catat dampaknya | 2026-09-22 | GLB-001 |

### Sprint 2

| ID | Task | Due date | Prasyarat |
|---|---|---|---|
| GLB-010 | Terjemahkan aset klien menjadi panduan desain dan komponen | 2026-09-24 | GLB-008, GLB-E01 |
| GLB-011 | Integrasikan UI autentikasi, onboarding dan profil | 2026-09-25 | GLB-010, GLB-006 |
| GLB-012 | Integrasikan UI catatan, koreksi dan riwayat | 2026-09-28 | GLB-011, GLB-008 |
| GLB-013 | Integrasikan dashboard dan grafik | 2026-09-29 | GLB-012 |
| GLB-014 | Implementasikan laporan PDF dan unduh | 2026-09-30 | GLB-013 |
| GLB-015 | Implementasikan halaman legal dan cookie consent | 2026-10-01 | GLB-011 |
| GLB-016 | QA dan demo alur pencatatan lengkap | 2026-10-02 | GLB-014, GLB-015 |
| GLB-017 | Review Sprint 2 dan tutup perbaikan modul pencatatan | 2026-10-07 | GLB-016 |
| GLB-E03 | Putuskan paket produksi, biaya dan kapasitas vendor | 2026-10-02 | GLB-E02 |
| GLB-E04 | Selesaikan review legal, retensi dan kesiapan operasi | 2026-10-06 | GLB-E03 |

### Sprint 3

| ID | Task | Due date | Prasyarat |
|---|---|---|---|
| GLB-018 | Bangun jadwal dan kalender mingguan | 2026-10-08 | GLB-017 |
| GLB-019 | Bangun antrean dan dispatcher pengingat | 2026-10-09 | GLB-018 |
| GLB-020 | Integrasikan push, pengingat dashboard dan email fallback | 2026-10-12 | GLB-019, GLB-E02 |
| GLB-021 | Implementasikan undangan dan persetujuan kontak darurat | 2026-10-13 | GLB-020 |
| GLB-022 | Implementasikan pencabutan kontak dan suppression job | 2026-10-14 | GLB-021 |
| GLB-023 | Implementasikan ekspor data portabel | 2026-10-15 | GLB-022, GLB-014 |
| GLB-024 | Implementasikan penghapusan akun tujuh hari | 2026-10-16 | GLB-023 |
| GLB-025 | Implementasikan administrasi status akun | 2026-10-19 | GLB-024 |
| GLB-026 | Review Sprint 3 dan QA notifikasi serta siklus akun | 2026-10-21 | GLB-025 |

### Sprint 4

| ID | Task | Due date | Prasyarat |
|---|---|---|---|
| GLB-027 | Jalankan regression, security dan compatibility QA | 2026-10-22 | GLB-026 |
| GLB-028 | Uji backup, restore dan rollback | 2026-10-23 | GLB-027, GLB-E03, GLB-E04 |
| GLB-029 | Siapkan release candidate dan paket UAT | 2026-10-23 | GLB-028, GLB-E02 |
| GLB-030 | Jalankan UAT klien dan catat hasil | 2026-10-27 | GLB-029 |
| GLB-031 | Perbaiki temuan UAT dan regression ulang | 2026-10-29 | GLB-030 |
| GLB-032 | Tutup checklist go-live dan persetujuan release | 2026-10-30 | GLB-031, GLB-E03, GLB-E04 |
| GLB-033 | Deploy production dan jalankan smoke test | 2026-11-02 | GLB-032 |
| GLB-034 | Pantau rilis dan tangani defect awal | 2026-11-03 | GLB-033 |
| GLB-035 | Serah terima, pelatihan dan mulai maintenance | 2026-11-04 | GLB-034 |

### Bugs & Change Requests

Belum ada defect/change request nyata; jangan membuat bug fiktif.

## Template defect dan change request

Untuk defect: catat ID unik, judul, environment/versi, severity, langkah reproduksi, expected/actual, bukti yang disanitasi, acceptance criteria perbaikan, dependency, due date hasil triage, dan hasil regression. Jangan menaruh data kesehatan nyata atau rahasia pada tiket.

Untuk change request: catat permintaan, sumber keputusan, dampak scope/tanggal/biaya, alternatif, approver, dan keputusan. Pengurangan fitur DISEPAKATI memerlukan keputusan tercatat; task pending yang baru disetujui harus dijadwalkan ulang, bukan dimasukkan diam-diam ke sprint penuh.

## Prompt siap pakai

> Baca docs/planning/CLICKUP_IMPORT.md dan docs/planning/CLICKUP_BACKLOG.json seluruhnya. Impor backlog tersebut ke Space Glubee.id pada workspace Webekspres memakai konektor ClickUp, tanpa browser. Ikuti ID target, due date Asia/Jakarta, status, acceptance criteria, dependency, dan aturan deduplikasi manifest. Reuse Folder/List/Task existing, pertahankan perubahan manusia, simpan journal ID/URL hasil impor, lalu verifikasi seluruh hasil. Jangan menjalankan pekerjaan development, deployment atau mengirim pesan ke klien hanya karena task-nya dibuat.
