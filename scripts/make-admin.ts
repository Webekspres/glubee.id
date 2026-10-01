// Buat atau jadikan akun admin (app_metadata.app_role = "admin") memakai service role.
// Lokal: ADMIN_EMAIL=... ADMIN_PASSWORD=... bun scripts/make-admin.ts
// Production: GoTrue admin API hanya terbuka dari VPS, jadi pakai SQL di deploy/README.md.
// Jangan menyimpan password admin di repository (repo publik).
import { createClient } from "@supabase/supabase-js";

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";
if (!email || !password) throw new Error("Isi ADMIN_EMAIL dan ADMIN_PASSWORD.");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;
const existing = list.users.find((u) => u.email === email);
const { error } = existing
  ? await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { ...existing.app_metadata, app_role: "admin" },
    })
  : await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { app_role: "admin" },
    });
if (error) throw error;
console.log(`${email} sekarang admin.`);
