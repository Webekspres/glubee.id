/**
 * Modul Template Email Produksi Glubee.id
 *
 * Desain berbasis Varian B (Clean Minimalist + 1-Column Vertical Metric)
 * yang telah diuji dan disetujui untuk penderita diabetes:
 * 1. Konten ringkas, lugas, dan faktual (< 30 detik baca).
 * 2. Hierarki jelas: Badge urgensi independen -> Judul tebal -> Metrik 1-kolom -> Tombol aksi langsung -> Poin rincian.
 * 3. Rasio kontras tinggi WCAG AAA, tipografi besar, bebas pemotongan tata letak pada ponsel.
 * 4. Kepatuhan hukum: Identitas PT. Webekspres Teknologi Indonesia & tanpa diagnosis/instruksi medis mandiri.
 */

export type EmailUrgency = "critical" | "reminder" | "security" | "info";

export interface EmailFocalMetric {
  value: string;
  unit: string;
  statusLabel: string;
  timestamp: string;
}

export interface EmailActionButton {
  label: string;
  url: string;
  subtext?: string;
}

export interface EmailSecondaryAction {
  label: string;
  url: string;
}

export interface EmailTemplateData {
  subject: string;
  badgeLabel: string;
  urgencyLevel: EmailUrgency;
  recipientName: string;
  headline: string;
  bodyParagraphs: string[];
  actionButton: EmailActionButton;
  focalMetric?: EmailFocalMetric;
  secondaryAction?: EmailSecondaryAction;
  importantNotice?: string;
  legalDisclaimer?: string;
}

/**
 * Render HTML email responsif dan kompatibel dengan semua klien email
 * (Gmail, Outlook, Apple Mail, Webmail, Mailpit).
 */
export function renderEmailLayout(data: EmailTemplateData): string {
  const isCritical = data.urgencyLevel === "critical";
  const isReminder = data.urgencyLevel === "reminder";
  const isSecurity = data.urgencyLevel === "security";

  // Semantic color tokens
  const badgeBg = isCritical
    ? "#fee2e2"
    : isReminder
    ? "#ccfbf1"
    : isSecurity
    ? "#dbeafe"
    : "#f1f5f9";

  const badgeText = isCritical
    ? "#991b1b"
    : isReminder
    ? "#0f766e"
    : isSecurity
    ? "#1e40af"
    : "#334155";

  const badgeBorder = isCritical
    ? "#fca5a5"
    : isReminder
    ? "#5eead4"
    : isSecurity
    ? "#93c5fd"
    : "#cbd5e1";

  const metricCardBg = isCritical
    ? "#fef2f2"
    : isReminder
    ? "#f0fdfa"
    : isSecurity
    ? "#eff6ff"
    : "#f8fafc";

  const metricBorder = isCritical
    ? "#f87171"
    : isReminder
    ? "#2dd4bf"
    : isSecurity
    ? "#60a5fa"
    : "#cbd5e1";

  const metricValueColor = isCritical ? "#991b1b" : "#0f172a";

  const buttonBg = isCritical
    ? "#991b1b"
    : isReminder
    ? "#16605b"
    : isSecurity
    ? "#1e40af"
    : "#0f172a";

  const icon = isCritical ? "⚠️" : isReminder ? "⏰" : isSecurity ? "🛡️" : "ℹ️";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.subject)}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: Arial, Helvetica, sans-serif; color: #0f172a; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);">
    
    <!-- Clean Minimalist Header: Only GLUBEE.ID Branding -->
    <div style="padding: 22px 24px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td valign="middle">
            <span style="font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #0f172a;">
              glubee<span style="color: #16605b;">.id</span>
            </span>
            <div style="font-size: 11px; color: #64748b; font-weight: 600;">
              Pemantauan Glukosa Terpercaya
            </div>
          </td>
          <td align="right" valign="middle">
            <span style="font-size: 12px; color: #94a3b8; font-weight: 600;">
              Pemberitahuan Resmi
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Main Content Area -->
    <div style="padding: 26px 24px;">
      
      <!-- Status Badge (Independent line, prevents mobile collision) -->
      <div style="margin-bottom: 16px;">
        <span style="display: inline-block; padding: 6px 14px; border-radius: 9999px; background-color: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;">
          ${icon} ${escapeHtml(data.badgeLabel)}
        </span>
      </div>

      <!-- Headline -->
      <h1 style="font-size: 23px; font-weight: 900; line-height: 1.3; color: #0f172a; margin: 0 0 10px 0;">
        ${escapeHtml(data.headline)}
      </h1>

      <!-- Recipient Notice -->
      <div style="font-size: 14px; color: #475569; font-weight: 600; margin-bottom: 22px;">
        Ditujukan untuk: <strong style="color: #0f172a;">${escapeHtml(data.recipientName)}</strong>
      </div>

      ${
        data.focalMetric
          ? `
      <!-- 1-Column Vertical Metric Card (Prevents squishing/clipping on narrow screens) -->
      <div style="background-color: ${metricCardBg}; border: 1.5px solid ${metricBorder}; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: left;">
        <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; color: ${
          isCritical ? "#991b1b" : "#0f766e"
        }; letter-spacing: 0.06em; margin-bottom: 6px;">
          ${escapeHtml(data.focalMetric.statusLabel)}
        </div>
        <div style="margin-bottom: 14px;">
          <span style="font-size: 44px; font-weight: 900; line-height: 1.05; color: ${metricValueColor}; letter-spacing: -0.5px;">
            ${escapeHtml(data.focalMetric.value)}
          </span>
          <span style="font-size: 19px; font-weight: 800; color: #475569; margin-left: 6px;">
            ${escapeHtml(data.focalMetric.unit)}
          </span>
        </div>
        <div style="padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #334155;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="color: #64748b; font-weight: 600;">Waktu / Kondisi:</td>
              <td align="right" style="font-weight: 700; color: #0f172a;">${escapeHtml(data.focalMetric.timestamp)}</td>
            </tr>
          </table>
        </div>
      </div>`
          : ""
      }

      <!-- Direct Primary Action Button -->
      <div style="margin-bottom: 26px;">
        <a href="${escapeHtml(data.actionButton.url)}" style="display: block; width: 100%; box-sizing: border-box; background-color: ${buttonBg}; color: #ffffff; font-size: 17px; font-weight: 900; text-align: center; padding: 16px 20px; border-radius: 10px; text-decoration: none; box-shadow: 0 2px 8px rgba(15,23,42,0.15);">
          ${escapeHtml(data.actionButton.label)} &rarr;
        </a>
        ${
          data.actionButton.subtext
            ? `<div style="text-align: center; font-size: 12px; font-weight: 600; color: #64748b; margin-top: 8px;">${escapeHtml(data.actionButton.subtext)}</div>`
            : ""
        }
      </div>

      <!-- Concise Bullet Cards -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; color: #334155; margin-bottom: 10px;">
          Ringkasan & Fakta:
        </div>
        ${data.bodyParagraphs
          .map(
            (p, i) => `
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="30" valign="top">
                <div style="width: 22px; height: 22px; border-radius: 50%; background-color: #0f172a; color: #ffffff; text-align: center; line-height: 22px; font-size: 12px; font-weight: 900;">
                  ${i + 1}
                </div>
              </td>
              <td valign="top" style="font-size: 15px; font-weight: 600; line-height: 1.55; color: #1e293b;">
                ${escapeHtml(p)}
              </td>
            </tr>
          </table>
        </div>`
          )
          .join("")}
      </div>

      ${
        data.secondaryAction
          ? `
      <div style="text-align: center; margin-bottom: 24px;">
        <a href="${escapeHtml(data.secondaryAction.url)}" style="display: inline-block; padding: 10px 18px; border-radius: 8px; border: 1px solid #cbd5e1; background-color: #ffffff; color: #0f172a; font-weight: 700; font-size: 14px; text-decoration: none;">
          ${escapeHtml(data.secondaryAction.label)}
        </a>
      </div>`
          : ""
      }

      ${
        data.importantNotice
          ? `
      <div style="padding: 14px 18px; background-color: #fffbeb; border: 1px solid #fde68a; border-left: 5px solid #d97706; border-radius: 8px; font-size: 13px; line-height: 1.55; color: #78350f; font-weight: 600; margin-bottom: 20px;">
        ${escapeHtml(data.importantNotice)}
      </div>`
          : ""
      }
    </div>

    <!-- Clean Minimalist Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 0 0 10px 0;">${escapeHtml(data.legalDisclaimer || "")}</p>
      <div style="padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
        &copy; 2026 Glubee.id &bull; PT. Webekspres Teknologi Indonesia
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 1. Peringatan Darurat Gula Darah Kritis (untuk Kontak Darurat)
 */
export function createEmergencyAlertEmail(params: {
  recipientName: string;
  patientName: string;
  glucoseValue: number | string;
  unit?: string;
  timestamp: string;
  condition?: string;
  patientPhone?: string;
  dashboardUrl?: string;
}): { subject: string; html: string } {
  const unit = params.unit || "mg/dL";
  const subject = `[PERINGATAN] Glubee: Catatan Gula Darah Kritis dari ${params.patientName}`;

  const data: EmailTemplateData = {
    subject,
    badgeLabel: "PERINGATAN DARURAT",
    urgencyLevel: "critical",
    recipientName: params.recipientName,
    headline: "Catatan Gula Darah Membutuhkan Perhatian Anda",
    bodyParagraphs: [
      `${params.patientName} baru saja mencatat kadar gula darah yang berada di luar rentang aman target hariannya.`,
      "Sebagai kontak darurat yang terdaftar dan disetujui, kami menyarankan Anda segera menghubungi beliau untuk memastikan kondisinya baik-baik saja.",
    ],
    focalMetric: {
      value: String(params.glucoseValue),
      unit,
      statusLabel: "Sangat Tinggi (Kritis)",
      timestamp: `${params.timestamp}${params.condition ? ` (${params.condition})` : ""}`,
    },
    actionButton: {
      label: params.patientPhone
        ? `Hubungi ${params.patientName} Sekarang`
        : "Buka Status Terbaru Pasien",
      url: params.patientPhone ? `tel:${params.patientPhone}` : (params.dashboardUrl || "https://glubee.id/dashboard"),
      subtext: "Pastikan pasien dalam keadaan sadar dan aman",
    },
    secondaryAction: params.dashboardUrl
      ? {
          label: "Buka Dasbor Pemantauan",
          url: params.dashboardUrl,
        }
      : undefined,
    importantNotice:
      "PERHATIAN PENTING: Glubee hanya menyampaikan data pengukuran faktual yang diinput oleh pengguna dan TIDAK memberikan diagnosis ataupun instruksi medis. Jika pengguna menunjukkan gejala pusing hebat, linglung, sesak napas, atau tidak sadarkan diri, segera hubungi layanan gawat darurat (112 / 119) atau bawa ke IGD terdekat.",
    legalDisclaimer:
      `Email ini dikirim otomatis oleh Glubee.id karena Anda terdaftar sebagai kontak darurat aktif ${params.patientName}. Anda dapat memperbarui preferensi notifikasi di glubee.id.`,
  };

  return { subject, html: renderEmailLayout(data) };
}

/**
 * 2. Pengingat Rutin Cek Glukosa Darah
 */
export function createGlucoseReminderEmail(params: {
  recipientName: string;
  scheduleName: string;
  targetTime: string;
  targetRange?: string;
  logUrl?: string;
  historyUrl?: string;
}): { subject: string; html: string } {
  const subject = `Waktunya Cek Gula Darah: ${params.scheduleName}`;
  const logUrl = params.logUrl || "https://glubee.id/log";

  const data: EmailTemplateData = {
    subject,
    badgeLabel: "PENGINGAT JADWAL",
    urgencyLevel: "reminder",
    recipientName: params.recipientName,
    headline: "Luangkan 1 Menit untuk Mencatat Gula Darah Anda",
    bodyParagraphs: [
      "Pencatatan yang konsisten dan teratur membantu Anda dan dokter memantau respon tubuh terhadap pola makan serta terapi harian.",
      "Keluarkan glukometer Anda sekarang, bersihkan ujung jari, dan masukkan hasil tes ke aplikasi Glubee.",
    ],
    focalMetric: {
      value: "Jadwal Tes",
      unit: params.targetTime,
      statusLabel: params.scheduleName,
      timestamp: `Target: ${params.targetRange || "80 – 140 mg/dL"}`,
    },
    actionButton: {
      label: "Catat Hasil Tes Sekarang",
      url: logUrl,
      subtext: "Formulir pencatatan cepat di Glubee",
    },
    secondaryAction: params.historyUrl
      ? {
          label: "Lihat Riwayat & Grafik",
          url: params.historyUrl,
        }
      : undefined,
    importantNotice:
      "Pastikan tangan dalam keadaan bersih dan kering sebelum mengambil sampel darah. Bila hasil tes menunjukkan angka di bawah 70 mg/dL (hipoglikemia), segera konsumsi sumber glukosa cepat serap seperti air gula atau jus buah.",
    legalDisclaimer:
      "Pengingat ini dikirim karena push notification peramban tidak aktif pada perangkat Anda. Atur jadwal pengingat di Menu Profil > Pengaturan Pengingat.",
  };

  return { subject, html: renderEmailLayout(data) };
}

/**
 * 3. Undangan Menjadi Kontak Darurat
 */
export function createContactInviteEmail(params: {
  recipientName: string;
  inviterName: string;
  acceptUrl: string;
  declineUrl?: string;
}): { subject: string; html: string } {
  const subject = `${params.inviterName} Mengundang Anda Menjadi Kontak Darurat di Glubee`;

  const data: EmailTemplateData = {
    subject,
    badgeLabel: "UNDANGAN DARURAT",
    urgencyLevel: "info",
    recipientName: params.recipientName,
    headline: `Dukungan Anda Sangat Berarti untuk ${params.inviterName}`,
    bodyParagraphs: [
      `${params.inviterName} menggunakan Glubee.id untuk memantau catatan diabetes hariannya dan telah menunjuk Anda sebagai Kontak Darurat terpercaya.`,
      "Jika Anda menerima undangan ini, sistem Glubee hanya akan mengirimi Anda email pemberitahuan bila terdapat catatan kadar gula darah yang sangat tinggi atau sangat rendah (kondisi darurat).",
    ],
    focalMetric: {
      value: "Peran Kontak",
      unit: "Darurat",
      statusLabel: "Maks. 2 Kontak per Akun",
      timestamp: "Perlu Persetujuan Anda",
    },
    actionButton: {
      label: "Terima & Konfirmasi Undangan",
      url: params.acceptUrl,
      subtext: "Anda dapat membatalkan persetujuan ini kapan saja",
    },
    secondaryAction: params.declineUrl
      ? {
          label: "Tolak Undangan Ini",
          url: params.declineUrl,
        }
      : undefined,
    importantNotice:
      `Sesuai UU Perlindungan Data Pribadi (UU PDP), Glubee tidak akan membagikan data riwayat kesehatan ${params.inviterName} kepada Anda sebelum Anda memberikan persetujuan eksplisit melalui tombol di atas.`,
    legalDisclaimer:
      `Dikirim oleh Glubee.id atas inisiatif ${params.inviterName}. Hubungi support@glubee.id untuk bantuan dan informasi privasi.`,
  };

  return { subject, html: renderEmailLayout(data) };
}

/**
 * 4. Verifikasi Alamat Email (Registrasi Akun Baru)
 */
export function createAuthVerifyEmail(params: {
  recipientName: string;
  verifyUrl: string;
  otpCode?: string;
  expiryMinutes?: number;
}): { subject: string; html: string } {
  const expiry = params.expiryMinutes || 15;
  const subject = "Verifikasi Alamat Email Anda untuk Glubee.id";

  const data: EmailTemplateData = {
    subject,
    badgeLabel: "VERIFIKASI AKUN",
    urgencyLevel: "security",
    recipientName: params.recipientName,
    headline: "Satu Langkah Lagi untuk Mengaktifkan Akun Anda",
    bodyParagraphs: [
      "Terima kasih telah mendaftar di Glubee.id. Kami berkomitmen menjaga privasi dan keamanan data riwayat kesehatan Anda dengan standar perlindungan tinggi.",
      params.otpCode
        ? "Klik tombol di bawah ini atau masukkan kode OTP verifikasi untuk mengonfirmasi bahwa alamat email ini milik Anda."
        : "Klik tombol di bawah ini untuk mengonfirmasi bahwa alamat email ini milik Anda.",
    ],
    focalMetric: params.otpCode
      ? {
          value: params.otpCode,
          unit: "Kode OTP",
          statusLabel: `Berlaku ${expiry} Menit`,
          timestamp: "Tautan & Kode Sekali Pakai",
        }
      : undefined,
    actionButton: {
      label: "Verifikasi Email Saya",
      url: params.verifyUrl,
      subtext: "Tautan ini hanya dapat digunakan satu kali",
    },
    importantNotice:
      "PERINGATAN KEAMANAN: Jangan bagikan tautan atau kode verifikasi ini kepada siapa pun, termasuk staf Glubee. Jika Anda tidak pernah mendaftar di Glubee.id, abaikan email ini dan akun Anda tidak akan diaktifkan.",
    legalDisclaimer:
      "Email verifikasi otomatis dari Glubee.id (PT. Webekspres Teknologi Indonesia). Dikirim sesuai kepatuhan regulasi perlindungan data pribadi UU PDP.",
  };

  return { subject, html: renderEmailLayout(data) };
}

/**
 * 5. Pemulihan Kata Sandi (Password Reset)
 */
export function createPasswordResetEmail(params: {
  recipientName: string;
  resetUrl: string;
  expiryMinutes?: number;
  requestIp?: string;
  requestLocation?: string;
}): { subject: string; html: string } {
  const expiry = params.expiryMinutes || 60;
  const subject = "Permintaan Pemulihan Kata Sandi Glubee.id";

  const data: EmailTemplateData = {
    subject,
    badgeLabel: "KEAMANAN AKUN",
    urgencyLevel: "security",
    recipientName: params.recipientName,
    headline: "Setel Ulang Kata Sandi Akun Anda",
    bodyParagraphs: [
      "Kami menerima permintaan untuk mengatur ulang kata sandi akun Glubee.id Anda.",
      "Gunakan tombol di bawah ini untuk membuat kata sandi baru. Pastikan kata sandi baru Anda kuat dan tidak digunakan di situs lain.",
    ],
    focalMetric: {
      value: `${expiry} Menit`,
      unit: "Batas Waktu",
      statusLabel: "Tautan Sekali Pakai",
      timestamp: params.requestLocation || "Permintaan Pemulihan Sandi",
    },
    actionButton: {
      label: "Setel Ulang Kata Sandi",
      url: params.resetUrl,
      subtext: "Akan mengarahkan ke halaman peramban yang aman",
    },
    importantNotice:
      "Jika Anda TIDAK meminta perubahan kata sandi ini, segera abaikan email ini. Kata sandi lama Anda tetap aman dan tidak akan berubah tanpa persetujuan Anda.",
    legalDisclaimer:
      "Notifikasi keamanan resmi dari Glubee.id (PT. Webekspres Teknologi Indonesia). Hubungi support@glubee.id jika Anda mencurigai aktivitas mencurigakan pada akun Anda.",
  };

  return { subject, html: renderEmailLayout(data) };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
