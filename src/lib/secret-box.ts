import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

// SRS §11: field kontak/push dienkripsi di aplikasi sebelum masuk database.
// DATA_ENCRYPTION_KEY = 32 byte base64 (`openssl rand -base64 32`), berbeda per lingkungan.
// Format ciphertext: versi (1 byte) | IV (12) | tag GCM (16) | isi.

const VERSION = 1;

function keys(env: Record<string, string | undefined> = process.env) {
  const raw = Buffer.from(env.DATA_ENCRYPTION_KEY ?? "", "base64");
  if (raw.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes base64");
  const derive = (info: string) => Buffer.from(hkdfSync("sha256", raw, Buffer.alloc(0), info, 32));
  return { enc: derive("glubee:encrypt:v1"), mac: derive("glubee:hash:v1") };
}

export function sealText(text: string, env?: Record<string, string | undefined>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keys(env).enc, iv);
  const body = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), body]);
}

export function openText(sealed: Buffer, env?: Record<string, string | undefined>) {
  if (sealed[0] !== VERSION || sealed.length < 29) throw new Error("unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", keys(env).enc, sealed.subarray(1, 13));
  decipher.setAuthTag(sealed.subarray(13, 29));
  return Buffer.concat([decipher.update(sealed.subarray(29)), decipher.final()]).toString("utf8");
}

// Hash berkunci untuk dedupe/lookup (endpoint push, email kontak) tanpa menyimpan nilai asli.
export function keyedHash(text: string, env?: Record<string, string | undefined>) {
  return createHmac("sha256", keys(env).mac).update(text).digest();
}

// bytea lewat PostgREST: kirim/terima sebagai "\x<hex>".
export const toBytea = (b: Buffer) => `\\x${b.toString("hex")}`;
export const fromBytea = (s: string) => Buffer.from(s.replace(/^\\x/, ""), "hex");
