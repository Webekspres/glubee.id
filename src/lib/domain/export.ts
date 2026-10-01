import { ZONES, type Timezone } from "@/lib/ui";

// Re-authentication sebelum ekspor (SRS §11). Akun email memasukkan ulang
// password; akun Google saja cukup bila baru masuk dalam 10 menit terakhir.
export const RECENT_LOGIN_MS = 10 * 60 * 1000;

export function reauthMethod(
  user: { providers: string[]; lastSignInAt: string | null },
  now = new Date(),
): "password" | "recent_login" | "relogin_required" {
  if (user.providers.includes("email")) return "password";
  const last = user.lastSignInAt ? new Date(user.lastSignInAt).valueOf() : 0;
  return now.valueOf() - last <= RECENT_LOGIN_MS ? "recent_login" : "relogin_required";
}

export function exportFileName(now: Date, zone: Timezone) {
  const date = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONES[zone] }).format(now);
  return `glubee-data-${date}.json`;
}
