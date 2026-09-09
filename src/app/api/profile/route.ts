import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, readJson, safeDatabaseFailure, success } from "@/lib/api";
import { validateProfile } from "@/lib/domain/profile";

export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("name,birth_date,sex,timezone_code,account_status,created_at,updated_at")
    .single();
  return error ? safeDatabaseFailure() : success(data);
}

export async function PATCH(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "profile", 20)) return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const validated = validateProfile(await readJson(request));
  if (!validated.data) return failure("VALIDATION_ERROR", "Periksa kembali profil.", 422, validated.errors);
  const { data, error } = await auth.supabase
    .from("profiles")
    .update({
      name: validated.data.name,
      birth_date: validated.data.birthDate,
      sex: validated.data.sex,
      timezone_code: validated.data.timezoneCode,
    })
    .eq("user_id", auth.user.id)
    .select("name,birth_date,sex,timezone_code,account_status,updated_at")
    .single();
  if (error) return safeDatabaseFailure("Profil belum dapat diperbarui.");
  const { data: accountStatus } = await auth.supabase.rpc("refresh_my_account_status");
  return success({ ...data, account_status: accountStatus });
}
