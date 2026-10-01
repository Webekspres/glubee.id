import { success } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Dipakai halaman publik (beranda, masuk, daftar) untuk mengarahkan pengguna yang
// masih punya sesi. Selalu 200 agar pengunjung anonim tidak memicu error console.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return success({ signedIn: false });
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("user_id", data.user.id)
    .maybeSingle();
  return success({ signedIn: true, accountStatus: profile?.account_status ?? null });
}
