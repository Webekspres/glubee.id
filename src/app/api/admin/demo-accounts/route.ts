import { adminRequest } from "@/lib/admin";
import { rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { seedDemoAccount } from "@/lib/demo-seed";

// Akun demo untuk klien: email langsung terverifikasi. Pemilik akun tetap harus
// menyetujui dokumen layanan saat onboarding pertama. Setiap pembuatan diaudit.
export async function POST(request: Request) {
  const auth = await adminRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "admin.demo", 5))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const body = objectValue(await readJson(request));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const withSample = body?.withSample === true;
  const fields: Record<string, string> = {};
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = "Format email belum benar.";
  if (password.length < 12) fields.password = "Minimal 12 karakter.";
  if (Object.keys(fields).length)
    return failure("VALIDATION_ERROR", "Periksa kembali data akun demo.", 422, fields);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user)
    return failure(
      "DEMO_ACCOUNT_FAILED",
      /already/i.test(error?.message ?? "") ? "Email ini sudah terdaftar." : "Akun demo belum dapat dibuat.",
      422,
    );
  await admin.rpc("admin_record_event", {
    p_actor_id: auth.user.id,
    p_subject_user_id: data.user.id,
    p_action: "create_verified_demo_account",
    p_reason: "Akun demo klien dibuat admin tanpa email verifikasi",
    p_correlation_id: crypto.randomUUID(),
  });
  let sampleEntries = 0;
  if (withSample) {
    try {
      sampleEntries = await seedDemoAccount(email, password);
    } catch {
      return failure(
        "DEMO_SEED_FAILED",
        "Akun demo dibuat, tetapi data contoh gagal diisi. Masuk dengan akun itu dan lengkapi profil secara manual.",
        500,
      );
    }
    await admin.rpc("admin_record_event", {
      p_actor_id: auth.user.id,
      p_subject_user_id: data.user.id,
      p_action: "seed_demo_data",
      p_reason: `Profil, persetujuan, dan ${sampleEntries} catatan sintetis diisi untuk demo`,
      p_correlation_id: crypto.randomUUID(),
    });
  }
  return success({ userId: data.user.id, email, sampleEntries }, 201);
}
