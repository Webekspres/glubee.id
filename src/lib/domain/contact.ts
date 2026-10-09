import { createHash, randomBytes } from "node:crypto";
import type { FieldErrors } from "@/lib/api";

// GLB-021 / FR-CONTACT-001: undangan kontak darurat.

export const MAX_CONTACTS = 2;
export const INVITE_DAYS = 7;

export function contactSettings(env: Record<string, string | undefined> = process.env) {
  // Undangan memakai kuota Brevo yang sama: mati sampai uji kolektif.
  return { enabled: env.CONTACT_INVITES_ENABLED === "true" };
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validateContactInput(value: unknown, ownEmail?: string | null) {
  const body = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const errors: FieldErrors = {};
  if (!name) errors.name = "Nama kontak wajib diisi.";
  else if (name.length > 120) errors.name = "Nama kontak maksimal 120 karakter.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = "Masukkan alamat email yang valid.";
  else if (ownEmail && email === normalizeEmail(ownEmail)) errors.email = "Gunakan email orang lain, bukan email Anda sendiri.";
  // Persetujuan berbagi cukup sekali per versi; route memeriksa apakah masih diperlukan.
  return Object.keys(errors).length ? { errors } : { data: { name, email, shareAccepted: body.shareAccepted === true } };
}

// Token mentah hanya ada di email/URL fragment; database menyimpan SHA-256-nya.
export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashInviteToken(token) };
}

export const hashInviteToken = (token: string) => createHash("sha256").update(token).digest();

export const validToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

const MESSAGES: Record<string, string> = {
  contact_share_consent_required: "Centang persetujuan untuk mengirim undangan.",
  contact_already_invited: "Email ini sudah diundang.",
  contact_declined: "Kontak ini sudah menolak undangan dan tidak dapat diundang lagi.",
  emergency_contact_limit_reached: "Maksimal dua kontak darurat aktif atau menunggu persetujuan.",
  contact_not_pending: "Undangan hanya bisa dikirim ulang untuk kontak yang belum menjawab.",
  contact_not_found: "Kontak tidak ditemukan.",
  contact_opted_out: "Kontak ini sudah berhenti sendiri dan tidak dapat diundang lagi.",
  contact_not_revocable: "Kontak ini sudah tidak aktif.",
  not_allowed: "Lengkapi profil dan persetujuan terlebih dahulu.",
};

export function contactErrorMessage(message: string) {
  const key = Object.keys(MESSAGES).find((k) => message.includes(k));
  return key ? MESSAGES[key] : "Undangan belum dapat diproses.";
}

const INVITE_MESSAGES: Record<string, string> = {
  invitation_used: "Undangan ini sudah dijawab.",
  invitation_expired: "Undangan ini sudah tidak berlaku. Minta pengundang mengirim undangan baru.",
  invitation_not_found: "Undangan tidak ditemukan.",
  notice_outdated: "Penjelasan undangan baru saja diperbarui. Muat ulang halaman dan baca kembali.",
};

export function invitationErrorMessage(message: string) {
  const key = Object.keys(INVITE_MESSAGES).find((k) => message.includes(k));
  return key ? INVITE_MESSAGES[key] : "Undangan belum dapat diproses.";
}

// "Jumat, 16 Oktober 2026 pukul 10.00 WIB" pada zona pengundang.
export function inviteExpiresText(expiresAt: Date, zone: "WIB" | "WITA" | "WIT") {
  const tz = { WIB: "Asia/Jakarta", WITA: "Asia/Makassar", WIT: "Asia/Jayapura" }[zone];
  const day = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz }).format(expiresAt);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz })
    .format(expiresAt)
    .replace(":", ".");
  return `${day} pukul ${time} ${zone}`;
}
