// Isi akun demo dengan catatan contoh 14 hari lewat API aplikasi (bukan langsung ke DB).
//
// Lokal (membuat akun demo terverifikasi, kredensial dari .env.local):
//   bun scripts/demo-data.ts --create-local
// Production (akun sudah didaftarkan dan onboarding lewat UI oleh pemiliknya):
//   GLUBEE_URL=https://glubee.id DEMO_EMAIL=... DEMO_PASSWORD=... bun scripts/demo-data.ts
// Jangan menyimpan kredensial production di repository (repo publik).
import { createClient } from "@supabase/supabase-js";

const base = (process.env.GLUBEE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const email = process.env.DEMO_EMAIL ?? "";
const password = process.env.DEMO_PASSWORD ?? "";
const isLocal = ["localhost", "127.0.0.1"].includes(new URL(base).hostname);
if (!email || !password) throw new Error("Isi DEMO_EMAIL dan DEMO_PASSWORD.");

const jar = new Map<string, string>();
async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(base + path, {
    ...init,
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: base,
      cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
      ...init.headers,
    },
  });
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
  const body = res.headers.get("content-type")?.includes("json")
    ? await res.json()
    : null;
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(body)}`);
  return body?.data;
}

if (process.argv.includes("--create-local")) {
  if (!isLocal) throw new Error("--create-local hanya untuk Supabase lokal.");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error && !/already/i.test(error.message)) throw error;
}

await call("/api/auth/login", {
  method: "POST",
  body: JSON.stringify({ email, password }),
});

// Onboarding hanya untuk akun lokal baru; akun production melewati UI sendiri.
const profile = await call("/api/profile");
if (!profile?.name) {
  if (!isLocal)
    throw new Error("Selesaikan onboarding akun ini lewat UI dulu, lalu ulangi.");
  const receipts: { consent_type: string }[] = await call("/api/consents");
  for (const type of ["age_and_region", "legal_documents", "health_data"])
    if (!receipts.some((r) => r.consent_type === type))
      await call("/api/consents", {
        method: "POST",
        body: JSON.stringify({ consentType: type, decision: "accept", method: "onboarding" }),
      });
  await call("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({
      name: "Demo Glubee",
      birthDate: "1968-05-12",
      sex: "female",
      timezoneCode: "WIB",
    }),
  });
}

const existing = await call("/api/glucose-entries?period=30&limit=1");
if (existing.length && !process.argv.includes("--force")) {
  console.log("Akun sudah berisi catatan; lewati (pakai --force untuk menambah).");
  process.exit(0);
}

// Dua catatan per hari: pagi puasa, siang/malam 2 jam setelah makan. Data sintetis.
const fasting = [104, 98, 112, 109, 101, 116, 95, 107, 113, 102, 119, 111, 99, 106];
const afterMeal = [162, 149, 171, 138, 155, 144, 167, 152, 141, 176, 158, 147, 136, 160];
const now = new Date();
let saved = 0;
for (let day = 13; day >= 0; day--) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - day);
  const morning = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 15));
  const noon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 6, 30));
  for (const [value, context, at] of [
    [fasting[13 - day], "fasting", morning],
    [afterMeal[13 - day], "after_meal", noon],
  ] as const) {
    if (at > now) continue;
    await call("/api/glucose-entries", {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        originalValue: value,
        originalUnit: "mg/dL",
        measurementContext: context,
        measuredAt: at.toISOString(),
        note: "",
      }),
    });
    saved++;
  }
}
console.log(`Selesai: ${saved} catatan contoh di ${base}.`);
