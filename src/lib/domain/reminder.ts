import { timingSafeEqual } from "node:crypto";
import type { SendEmailResult } from "@/lib/email";
import type { Timezone } from "@/lib/ui";

// GLB-019 / SRS §9: hasil kirim → sent, retry (error sementara), atau failed (permanen).
export type DispatchResult = { result: "sent" | "retry" | "failed"; errorClass: string | null };

// Kode jaringan nodemailer/Node yang biasanya pulih sendiri.
const TRANSIENT = new Set(["ETIMEDOUT", "ECONNECTION", "ECONNREFUSED", "ECONNRESET", "ESOCKET", "EDNS", "EAI_AGAIN"]);

export function classifySend(r: SendEmailResult): DispatchResult {
  if (r.success) return { result: "sent", errorClass: null };
  const code = r.errorCode ?? "";
  if (/^4\d\d$/.test(code)) return { result: "retry", errorClass: `smtp_${code}` };
  if (/^5\d\d$/.test(code)) return { result: "failed", errorClass: `smtp_${code}` };
  if (TRANSIENT.has(code)) return { result: "retry", errorClass: code.toLowerCase() };
  // EAUTH (kredensial salah), EENVELOPE (alamat tidak valid): mengulang tidak membantu.
  if (code) return { result: "failed", errorClass: code.toLowerCase().slice(0, 60) };
  return { result: "retry", errorClass: "unknown" };
}

// Header `Authorization: Bearer <CRON_SECRET>`. Secret kosong/pendek = endpoint mati.
export function dispatchAuthorized(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function reminderSettings(env: Record<string, string | undefined> = process.env) {
  const cap = Number(env.REMINDER_EMAIL_DAILY_CAP);
  return {
    enabled: env.REMINDER_EMAIL_ENABLED === "true",
    dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : 150,
  };
}

// "Rabu, 8 Oktober 2026 pukul 07.30 WIB" dari tanggal/jam lokal jadwal (bukan zona server).
export function reminderWhen(localDate: string, localTime: string, zone: Timezone) {
  const day = new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${localDate}T00:00:00Z`));
  return `${day} pukul ${localTime.slice(0, 5).replace(":", ".")} ${zone}`;
}
