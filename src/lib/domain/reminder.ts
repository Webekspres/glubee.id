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
  const vapid = {
    publicKey: env.VAPID_PUBLIC_KEY ?? "",
    privateKey: env.VAPID_PRIVATE_KEY ?? "",
    subject: env.VAPID_SUBJECT ?? "",
  };
  return {
    enabled: env.REMINDER_EMAIL_ENABLED === "true",
    dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : 150,
    // Push butuh flag + kunci VAPID lengkap; tanpa salah satunya pengguna tidak bisa berlangganan.
    push: env.REMINDER_PUSH_ENABLED === "true" && Boolean(vapid.publicKey && vapid.privateKey && vapid.subject),
    vapid,
  };
}

// GLB-020: hasil Web Push per subscription. 404/410 = subscription mati (nonaktifkan);
// 429/5xx/jaringan = coba lagi; selain itu (400/403/413: payload/VAPID salah) gagal permanen.
export type PushOutcome = "sent" | "gone" | "retry" | "failed";

export function classifyPush(statusCode: number | undefined): PushOutcome {
  if (statusCode !== undefined && statusCode >= 200 && statusCode < 300) return "sent";
  if (statusCode === 404 || statusCode === 410) return "gone";
  if (statusCode === undefined || statusCode === 429 || statusCode >= 500) return "retry";
  return "failed";
}

// Satu job push dikirim ke semua perangkat pengguna: cukup satu yang berhasil.
export function combinePush(outcomes: PushOutcome[]): DispatchResult {
  if (outcomes.includes("sent")) return { result: "sent", errorClass: null };
  if (outcomes.includes("retry")) return { result: "retry", errorClass: "push_retry" };
  if (outcomes.includes("failed")) return { result: "failed", errorClass: "push_failed" };
  return { result: "failed", errorClass: "push_gone" };
}

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

// Bentuk PushSubscription.toJSON() dari browser. Endpoint wajib https (layanan push browser).
export function validatePushSubscription(value: unknown): PushSubscriptionInput | null {
  if (!value || typeof value !== "object") return null;
  const { endpoint, keys } = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof endpoint !== "string" || endpoint.length > 2048) return null;
  try {
    if (new URL(endpoint).protocol !== "https:") return null;
  } catch {
    return null;
  }
  const b64url = /^[A-Za-z0-9_-]+={0,2}$/;
  const p256dh = keys?.p256dh, auth = keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!b64url.test(p256dh) || !b64url.test(auth) || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, keys: { p256dh, auth } };
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
