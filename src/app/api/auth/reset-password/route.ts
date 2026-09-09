import { appUrl } from "@/lib/config";
import { objectValue, readJson, success } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (/^\S+@\S+\.\S+$/.test(email)) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/auth/callback?next=/?resetPassword=required", appUrl()).toString(),
    });
  }
  return success({ message: "Jika akun tersedia, tautan pemulihan telah dikirim." }, 202);
}
