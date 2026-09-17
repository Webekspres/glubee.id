# Master Implementation Plan: Sprint 2 (Frontend UI, Auth, Onboarding, Glucose Log, & Dashboard)

Dokumen ini adalah **panduan implementasi teknis lengkap dan siap eksekusi** bagi AI Agent / Software Engineer yang akan melanjutkan pengembangan website **Glubee** pada Sprint 2. Seluruh spesifikasi, keputusan klien, kontrak API, desain token, hingga mitigasi error telah dirinci di bawah ini.

---

## 1. Konteks Proyek & Aturan Fundamental

- **Tech Stack**: Next.js 16.3 (App Router), React 19.2, TypeScript 5, Tailwind CSS v4, Bun (`>=1.4.0`), Supabase (PostgreSQL 17, GoTrue Auth, RLS).
- **Package Manager**: **Bun** (`bun install`, `bun run dev`, `bun test`, `bun run check`).
- **Prinsip Utama Produk Kesehatan**:
  1. **Bukan Alat Diagnosis**: Glubee adalah sarana pencatatan mandiri (*self-monitoring log*), bukan pengganti tenaga medis. Seluruh status evaluasi bersifat non-diagnostik (`"rendah"`, `"normal"`, `"tinggi"`).
  2. **Append-Only Data**: Catatan gula darah tidak boleh diedit atau dihapus satuan. Koreksi dilakukan dengan menandai catatan lama sebagai keliru (*invalidate*) dan membuat catatan baru pengganti (*replacement*) yang tertaut. Catatan yang keliru tetap ada untuk audit pribadi tetapi dikeluarkan dari grafik, agregasi rata-rata, dan laporan.
  3. **Privasi & Persetujuan (UU PDP)**: Wajib mencatat receipt persetujuan eksplisit untuk usia 18+, dokumen hukum, dan data kesehatan.
  4. **Aturan Tampilan Persetujuan**: **JANGAN menampilkan kode teknis internal** seperti `CNT-AGE-001:`, `CNT-LEGAL-001:`, `CNT-HEALTH-001:`, atau `NTC-INVALIDATE-001:` pada teks antarmuka yang dilihat pengguna. Gunakan kalimat bahasa Indonesia yang bersih dan natural.

---

## 2. Keputusan Klien Terkonfirmasi (9 September 2026)

| Topik | Keputusan Resmi Klien | Implementasi Teknis |
|---|---|---|
| **Kategori Status** | Hanya 3 istilah: `"rendah"`, `"normal"`, dan `"tinggi"`. Tanpa istilah prediabetes, diabetes, atau kritis. | `type GlucoseStatus = "rendah" \| "normal" \| "tinggi"` |
| **Batas Puasa (`fasting`)** | Normal: `70 - 99 mg/dL`. Rendah: `< 60 mg/dL`. Tinggi: `> 99 mg/dL`. | Konteks puasa minimal 8 jam tanpa asupan kalori. |
| **Batas 2 Jam Stlh Makan (`after_meal`)** | Normal: `70 - 139 mg/dL`. Rendah: `< 60 mg/dL`. Tinggi: `> 139 mg/dL`. | Konteks setelah makan biasa. |
| **Batas Sewaktu (`random` / `before_meal`)** | Normal: `< 180 mg/dL` (≥ 60). Rendah: `< 60 mg/dL`. Tinggi: `≥ 180 mg/dL`. | Konteks sewaktu atau sebelum makan. |
| **Laporan Bulanan** | Mengikuti **tanggal kalender** (tanggal 1 sampai akhir bulan), bukan rolling 30 hari. | Filter `period=current_month` atau `month=YYYY-MM`. |
| **Aset Visual & Desain** | Brand guideline dan maskot belum final dari klien. | Bangun UI fungsional netral dengan *Design Tokens* (CSS variables) berstandar WCAG AAA (kontras tinggi, ramah pembaca lansia). |

---

## 3. Persiapan Lingkungan Lokal

1. **File Konfigurasi `.env.local`**:
   Buat file `.env.local` di root project:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000

   # Supabase Local
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

   CRON_SECRET=test-cron-secret-local-development-only
   BREVO_SENDER_EMAIL=no-reply@glubee.id
   ```

2. **Jalankan & Tes Database**:
   ```bash
   bun run db:start   # Menyalakan container Supabase (port 54321, 54322, Mailpit 54324)
   bun run db:test    # Menjalankan 30 assertion pgTAP database
   ```

---

## 4. Langkah-Langkah Pengerjaan File per File

### Tahap 1: Domain Logic & Konfigurasi

#### 1.1 Modifikasi [`src/lib/config.ts`](file:///home/developer/www/glubee.id/src/lib/config.ts)
- Aktifkan `medicalEvaluationEnabled: true`.
- Tambahkan `cookie: "CNT-COOKIE-001@0.1-draft-2026-09-09"` pada `noticeVersions`.

#### 1.2 Modifikasi [`src/lib/domain/glucose.ts`](file:///home/developer/www/glubee.id/src/lib/domain/glucose.ts)
- Tambahkan fungsi evaluasi 3-status:
  ```typescript
  export type GlucoseStatus = "rendah" | "normal" | "tinggi";

  export function evaluateGlucose(
    valueMgDl: number,
    context: GlucoseInput["measurementContext"]
  ): GlucoseStatus {
    if (valueMgDl < 60) return "rendah";
    switch (context) {
      case "fasting":
        return valueMgDl > 99 ? "tinggi" : "normal";
      case "after_meal":
        return valueMgDl > 139 ? "tinggi" : "normal";
      case "before_meal":
      case "random":
      case "other":
      default:
        return valueMgDl >= 180 ? "tinggi" : "normal";
    }
  }
  ```
- Di `resolveRange`, tambahkan dukungan untuk filter kalender bulanan (`month=YYYY-MM` dan `period=current_month`).
- Di `glucoseSummary`, tambahkan properti `status: evaluateGlucose(...)` pada setiap objek `points`.

#### 1.3 Tambahkan Unit Test di [`src/lib/domain/glucose.test.ts`](file:///home/developer/www/glubee.id/src/lib/domain/glucose.test.ts)
- Uji evaluasi status: `<60` rendah, puasa `70-99` normal & `>99` tinggi, setelah makan `70-139` normal & `>139` tinggi, sewaktu `<180` normal & `≥180` tinggi.
- Uji resolusi rentang kalender bulanan (`month=2026-09`).
- Pastikan seluruh test lulus dengan `bun test`.

---

### Tahap 2: Styling Global & Komponen Utama

#### 2.1 Modifikasi [`src/app/globals.css`](file:///home/developer/www/glubee.id/src/app/globals.css)
- Definisikan CSS custom properties (design tokens) untuk tema medis yang netral, tenang, dan kontras tinggi:
  ```css
  @import "tailwindcss";

  :root {
    --primary: #0284c7;
    --primary-hover: #0369a1;
    --primary-light: #e0f2fe;
    --status-normal: #16a34a;
    --status-normal-bg: #dcfce7;
    --status-low: #d97706;
    --status-low-bg: #fef3c7;
    --status-high: #dc2626;
    --status-high-bg: #fee2e2;
    --bg-page: #f8fafc;
    --surface: #ffffff;
    --border: #e2e8f0;
    --text-main: #0f172a;
    --text-muted: #64748b;
  }

  body {
    background-color: var(--bg-page);
    color: var(--text-main);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    padding: 0;
  }
  ```

#### 2.2 Buat Komponen Navigasi [`src/components/Navbar.tsx`](file:///home/developer/www/glubee.id/src/components/Navbar.tsx)
- Menampilkan logo brand Glubee, tautan navigasi: Dashboard (`/dashboard`), Catat Gula Darah (`/log`), Riwayat (`/history`), Profil & Privasi (`/profile`).
- Menu responsif (hamburger) untuk mobile viewport.
- Tombol "Keluar" (POST ke `/api/auth/logout` lalu redirect ke `/login`).
- Sembunyikan navbar pada halaman autentikasi (`/login`, `/register`, `/auth/verify`).

#### 2.3 Buat Komponen Footer [`src/components/Footer.tsx`](file:///home/developer/www/glubee.id/src/components/Footer.tsx)
- Kotak penafian medis permanen: Glubee bukan pengganti tenaga medis.
- Hak cipta & tautan hukum: Syarat & Ketentuan (`/terms`), Kebijakan Privasi (`/privacy`).
- Tombol aksi: "Pengaturan Cookie" (memicu event `window.dispatchEvent(new Event("open-cookie-preferences"))`).

#### 2.4 Modifikasi [`src/app/layout.tsx`](file:///home/developer/www/glubee.id/src/app/layout.tsx)
- Bungkus konten halaman dengan flex column min-h-screen, pasang `<Navbar />`, `{children}`, `<Footer />`, dan `<CookieConsent />`.

---

### Tahap 3: Manajemen Persetujuan & Kebijakan Privasi

#### 3.1 Buat Route API Cookie Consent [`src/app/api/consents/cookie/route.ts`](file:///home/developer/www/glubee.id/src/app/api/consents/cookie/route.ts)
- Menerima POST `{ preferences: { essential: true, analytics, marketing }, decisionSource, anonymousSubjectId }`.
- Menggunakan `createSupabaseAdminClient()` untuk menyimpan receipt ke tabel `public.cookie_consent_receipts` sesuai constraint database.

#### 3.2 Buat Komponen Banner Cookie [`src/components/CookieConsent.tsx`](file:///home/developer/www/glubee.id/src/components/CookieConsent.tsx)
- Pilihan: *"Tolak non-esensial"*, *"Atur pilihan"*, *"Terima semua"*.
- Modal Pusat Preferensi Cookie dengan toggle kategori esensial (selalu aktif), analytics (opsional default mati), dan marketing (nonaktif).
- **Catatan ESLint React 19**: Gunakan `useSyncExternalStore` untuk pengecekan client-mount dan `setTimeout(..., 0)` saat membaca localStorage agar tidak melanggar aturan `react-hooks/set-state-in-effect`.

#### 3.3 Buat Halaman Legal Publik
- [`src/app/terms/page.tsx`](file:///home/developer/www/glubee.id/src/app/terms/page.tsx): Syarat dan Ketentuan layanan Glubee.
- [`src/app/privacy/page.tsx`](file:///home/developer/www/glubee.id/src/app/privacy/page.tsx): Kebijakan Privasi dan komitmen UU PDP Indonesia.

---

### Tahap 4: Alur Autentikasi & Onboarding

#### 4.1 Halaman Beranda / Landing Page [`src/app/page.tsx`](file:///home/developer/www/glubee.id/src/app/page.tsx)
- Hero section dengan CTA: *"Mulai Sekarang — Gratis"* (`/register`) dan *"Masuk ke Akun"* (`/login`).
- Kotak penafian medis resmi.
- 3 Kartu pilar fitur: Pencatatan Presisi, Visualisasi Tren Acuan, Keamanan & Append-Only.

#### 4.2 Halaman Masuk [`src/app/login/page.tsx`](file:///home/developer/www/glubee.id/src/app/login/page.tsx)
- Formulir input email & password.
- Memanggil `POST /api/auth/login`.
- Jika `accountStatus === 'onboarding'`, redirect ke `/onboarding`; jika `active`, redirect ke `/dashboard`.

#### 4.3 Halaman Pendaftaran [`src/app/register/page.tsx`](file:///home/developer/www/glubee.id/src/app/register/page.tsx)
- Input: Email, Password, Konfirmasi Password, Tanggal Lahir (wajib 18+).
- **3 Checkbox Persetujuan Wajib (Teks Bersih Tanpa Prefix Kode)**:
  1. *"Saya menyatakan berusia 18 tahun atau lebih dan menggunakan Glubee dalam cakupan layanan Indonesia."*
  2. *"Saya telah membaca dan menyetujui Syarat & Ketentuan Glubee serta menyatakan telah menerima Kebijakan Privasi."*
  3. *"Saya memberikan persetujuan eksplisit kepada pengelola Glubee untuk memproses data gula darah, kondisi dan waktu pengukuran, catatan, grafik, serta laporan saya guna menjalankan fitur pencatatan dan pemantauan mandiri. Saya memahami Glubee bukan alat diagnosis atau pengganti tenaga medis."*
- Memanggil `POST /api/auth/register`, lalu redirect ke `/auth/verify?email=...`.

#### 4.4 Halaman Instruksi Email [`src/app/auth/verify/page.tsx`](file:///home/developer/www/glubee.id/src/app/auth/verify/page.tsx)
- Instruksi membuka email konfirmasi aktivasi akun (dan mencantumkan tautan Mailpit lokal `http://127.0.0.1:54324`).

#### 4.5 Halaman Lengkapi Profil [`src/app/onboarding/page.tsx`](file:///home/developer/www/glubee.id/src/app/onboarding/page.tsx)
- Form: Nama Lengkap, Tanggal Lahir (terbaca dari pendaftaran), Jenis Kelamin (`male`/`female`), dan Zona Waktu (`WIB`/`WITA`/`WIT`).
- Memanggil `PATCH /api/profile` yang otomatis memperbarui status akun menjadi `active`, lalu redirect ke `/dashboard`.

---

### Tahap 5: Pencatatan Gula Darah & Dashboard Pemantauan

#### 5.1 Komponen Formulir Input [`src/components/GlucoseEntryForm.tsx`](file:///home/developer/www/glubee.id/src/components/GlucoseEntryForm.tsx)
- Input angka hasil pengukuran, tombol toggle satuan `mg/dL` vs `mmol/L`.
- Pilihan kondisi: Puasa, 2 Jam Setelah Makan, Sebelum Makan, Sewaktu, Lainnya.
- Waktu pengukuran lokal (datetime-local picker, batas masa depan maks 5 menit).
- Catatan opsional (maksimal 1000 karakter).
- **Pratinjau Status Instan**: Menggunakan `evaluateGlucose()` untuk menampilkan badge non-diagnostik (`normal`, `rendah`, atau `tinggi`) sebelum submit.
- **Header Keamanan**: Kirim header `"Idempotency-Key": crypto.randomUUID()` pada setiap POST request.
- Mendukung mode pencatatan baru (`/api/glucose-entries`) maupun mode catatan pengganti (`/api/glucose-entries/[id]/replacement`).

#### 5.2 Halaman Catat Gula Darah Mandiri [`src/app/log/page.tsx`](file:///home/developer/www/glubee.id/src/app/log/page.tsx)
- Halaman mandiri yang merender `GlucoseEntryForm`.

#### 5.3 Komponen Grafik Tren Interaktif [`src/components/TrendChart.tsx`](file:///home/developer/www/glubee.id/src/components/TrendChart.tsx)
- Komponen SVG murni (ringan, tanpa library external).
- Area arsiran hijau penanda rentang normal (70 – 140 mg/dL), garis batas putus-putus untuk 70, 140, dan 180 mg/dL.
- Titik pengukuran dengan warna status: Hijau (normal), Kuning/Oranye (rendah < 60), Merah (tinggi).
- Tooltip interaktif saat titik disentuh atau disorot kursor.
- Tampilan *empty state* yang ramah jika belum ada catatan.

#### 5.4 Halaman Dashboard [`src/app/dashboard/page.tsx`](file:///home/developer/www/glubee.id/src/app/dashboard/page.tsx)
- Banner penafian medis di bagian atas.
- Tombol pintas `+ Catat Gula Darah` (membuka modal log cepat).
- Filter periode: 7 Hari, 14 Hari, 30 Hari, Bulan Kalender Ini.
- 4 Kartu Metrik: Rata-rata Gula Darah (mg/dL), Terendah, Tertinggi, Total Pengukuran.
- Grafik tren gula darah (`TrendChart`).
- 5 Riwayat catatan terbaru dengan tombol aksi "Tandai Salah" (invalidasi).
- **Catatan ESLint**: Gunakan `useCallback` dan pembatalan async (`ignore = true`) di `useEffect` untuk fetching data agar tidak terkena `set-state-in-effect`. Pesan konfirmasi pembatalan catatan tidak boleh diawali teks `NTC-INVALIDATE-001:`.

#### 5.5 Halaman Riwayat Lengkap & Audit Append-Only [`src/app/history/page.tsx`](file:///home/developer/www/glubee.id/src/app/history/page.tsx)
- Menampilkan seluruh catatan dengan pagination cursor.
- Penanda status yang jelas: badge hijau "Aktif" vs badge merah "Keliru / Dibatalkan" (dicoret).
- Tombol "Koreksi Catatan": menandai catatan keliru via `POST /api/glucose-entries/[id]/invalidate` lalu membuka modal input data pengganti tertaut via `POST /api/glucose-entries/[id]/replacement`.

#### 5.6 Halaman Profil & Bukti Persetujuan [`src/app/profile/page.tsx`](file:///home/developer/www/glubee.id/src/app/profile/page.tsx)
- Form edit profil (nama dan zona waktu).
- Tabel Bukti Persetujuan (*Consent Receipts*) yang sah dari database (`GET /api/consents`) sesuai UU PDP.
- Tombol pembuka preferensi cookie.
- Informasi hak pengguna dan prosedur penghapusan akun 7 hari.

---

## 5. Pembaruan Dokumen Spesifikasi

Perbarui file spesifikasi bisnis [`docs/product/BRD.MD`](file:///home/developer/www/glubee.id/docs/product/BRD.MD) pada bagian **7. Keputusan tertunda** dan **7.1 Keputusan terselesaikan**:
- Pindahkan `BR-PEND-001`, `BR-PEND-002`, `BR-PEND-003`, `BR-PEND-004`, dan `BR-PEND-007` ke status **DISEPAKATI** dengan bukti konfirmasi tertulis WhatsApp klien tanggal 9 September 2026.

---

## 6. Checklist Verifikasi & Kriteria Selesai (DoD)

Sebelum menyatakan pekerjaan selesai, AI Agent wajib menjalankan perintah verifikasi berikut:

1. **Unit Test Domain**:
   ```bash
   bun test
   ```
   *Ekspektasi*: 11 test lulus (31 assertions, 0 fail).

2. **Database Test (pgTAP)**:
   ```bash
   bun run db:test
   ```
   *Ekspektasi*: 30/30 test lulus (RLS, trigger append-only, batasan kontak, rate limiting).

3. **Check Suite (Lint, Typecheck, Build)**:
   ```bash
   bun run check
   ```
   *Ekspektasi*: Exit code 0. ESLint 0 warning/error, TypeScript 0 error, dan Next.js production build menghasilkan 25 route terkompilasi optimal.

---
Dokumen ini disusun sebagai panduan standar resmi Sprint 2 Glubee.
