import "server-only";

import { authenticatedRequest } from "@/lib/auth";
import { failure } from "@/lib/api";

// Admin ditandai app_metadata.app_role (hanya bisa diset service role). RPC admin
// memeriksa ulang klaim yang sama di database.
export async function adminRequest() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth;
  if (auth.user.app_metadata?.app_role !== "admin")
    return {
      response: failure("ADMIN_REQUIRED", "Akun ini tidak memiliki akses admin.", 403),
      supabase: null,
      user: null,
    } as const;
  return auth;
}

const MESSAGES: Record<string, string> = {
  query_too_short: "Ketik minimal 3 karakter email.",
  cannot_change_own_account: "Anda tidak dapat mengubah status akun sendiri.",
  reason_required: "Tulis alasan perubahan (5 sampai 500 karakter).",
  profile_not_found: "Akun ini belum memiliki profil.",
  status_locked: "Akun sedang atau sudah dihapus; statusnya tidak dapat diubah.",
  no_change: "Status akun sudah sesuai.",
  invalid_status: "Status tujuan tidak valid.",
};

export function adminDatabaseFailure(error: { message?: string }) {
  const key = Object.keys(MESSAGES).find((k) => error.message?.includes(k));
  return key
    ? failure("ADMIN_RULE", MESSAGES[key], 422)
    : failure("DATABASE_ERROR", "Permintaan admin belum dapat diproses.", 500);
}
