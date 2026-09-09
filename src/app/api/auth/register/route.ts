import { appUrl } from "@/lib/config";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { isAdult } from "@/lib/domain/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const passwordConfirmation = typeof body?.passwordConfirmation === "string" ? body.passwordConfirmation : "";
  const birthDate = typeof body?.birthDate === "string" ? body.birthDate : "";
  const errors: Record<string, string> = {};

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) errors.email = "Email tidak valid.";
  if (password.length < 8) errors.password = "Password minimal delapan karakter.";
  if (password !== passwordConfirmation) errors.passwordConfirmation = "Konfirmasi password tidak sama.";
  if (!isAdult(birthDate)) errors.birthDate = "Pengguna harus berusia minimal 18 tahun.";
  if (body?.ageAndRegionAccepted !== true) errors.ageAndRegionAccepted = "Pernyataan usia dan wilayah wajib diterima.";
  if (body?.legalDocumentsAccepted !== true) errors.legalDocumentsAccepted = "Dokumen layanan wajib diterima.";
  if (body?.healthDataAccepted !== true) errors.healthDataAccepted = "Persetujuan data kesehatan wajib diberikan secara terpisah.";
  if (Object.keys(errors).length) return failure("VALIDATION_ERROR", "Periksa kembali data registrasi.", 422, errors);

  const nonce = crypto.randomUUID();
  const admin = createSupabaseAdminClient();
  const { error: intentError } = await admin.rpc("create_registration_intent", {
    p_nonce: nonce,
    p_email: email,
    p_birth_date: birthDate,
  });
  if (intentError) return failure("REGISTRATION_UNAVAILABLE", "Registrasi belum dapat diproses.", 503);

  const supabase = await createSupabaseServerClient();
  const callback = new URL("/auth/callback", appUrl());
  callback.searchParams.set("intent", nonce);
  callback.searchParams.set("next", "/?onboarding=required");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callback.toString() },
  });

  if (error?.code === "weak_password") {
    return failure("VALIDATION_ERROR", "Password belum memenuhi persyaratan keamanan.", 422, {
      password: "Gunakan password yang lebih kuat.",
    });
  }
  if (error) return failure("REGISTRATION_UNAVAILABLE", "Registrasi belum dapat diproses.", 503);

  return success({ message: "Jika alamat dapat digunakan, tautan verifikasi telah dikirim." }, 202);
}
