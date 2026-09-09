import { failure, objectValue, readJson, success } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) return failure("VALIDATION_ERROR", "Email dan password wajib diisi.", 422);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return failure("INVALID_CREDENTIALS", "Email atau password tidak valid, atau email belum diverifikasi.", 401);

  const { data: accountStatus } = await supabase.rpc("refresh_my_account_status");
  return success({ userId: data.user.id, accountStatus });
}
