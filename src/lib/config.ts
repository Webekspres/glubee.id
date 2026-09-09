export const APP_CONFIG = {
  name: "Glubee",
  supportedTimezones: ["WIB", "WITA", "WIT"] as const,
  noticeVersions: {
    ageAndRegion: "CNT-AGE-001@0.1-draft-2026-09-09",
    legalDocuments: "CNT-LEGAL-001@0.1-draft-2026-09-09",
    healthData: "CNT-HEALTH-001@0.1-draft-2026-09-09",
  },
  medicalEvaluationEnabled: false,
  valueAlertsEnabled: false,
} as const;

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
