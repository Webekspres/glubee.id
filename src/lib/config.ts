export const APP_CONFIG = {
  name: "Glubee",
  supportedTimezones: ["WIB", "WITA", "WIT"] as const,
  noticeVersions: {
    ageAndRegion: "CNT-AGE-001@0.1-draft-2026-09-09",
    legalDocuments: "CNT-LEGAL-001@0.2-draft-2026-09-15",
    healthData: "CNT-HEALTH-001@0.2-draft-2026-09-15",
  },
  medicalEvaluationEnabled: false,
  valueAlertsEnabled: false,
  cookieNoticeVersion: "CNT-COOKIE-001@0.1-draft-2026-09-09",
  legalVersion: "0.2-draft-2026-09-15",
  disclaimer:
    "Glubee adalah sarana pencatatan mandiri, bukan alat diagnosis atau pengganti tenaga medis.",
  developerNotice:
    "PT Webekspres Teknologi Indonesia menyediakan implementasi teknis berdasarkan aturan yang ditetapkan pengelola Glubee dan tidak memberikan diagnosis atau menetapkan keputusan medis. Hasil dapat mengandung kesalahan dan perlu dikonfirmasi kepada tenaga medis. Pembatasan tanggung jawab berlaku sepanjang diizinkan hukum dan tidak menghapus hak pengguna atau kewajiban yang tidak dapat dikesampingkan.",
} as const;

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
