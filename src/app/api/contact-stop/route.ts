import { failure, objectValue, readJson, success } from "@/lib/api";
import { hashInviteToken, invitationErrorMessage, validToken } from "@/lib/domain/contact";
import { toBytea } from "@/lib/secret-box";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GLB-022 / FR-CONTACT-001: kontak berhenti lewat tautan aman dari email (tanpa akun).
// Tanpa `confirm` = baca; dengan `confirm: true` = berhenti (idempotent).
export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  if (!validToken(body?.token)) return failure("NOT_FOUND", "Tautan tidak ditemukan.", 404);
  const tokenHash = toBytea(hashInviteToken(body.token));
  const db = createSupabaseAdminClient();

  if (body.confirm !== true) {
    const { data, error } = await db.rpc("get_contact_stop", { p_token_hash: tokenHash });
    const row = (data as { status: string; inviter_name: string | null; contact_name: string }[] | null)?.[0];
    if (error || !row) return failure("NOT_FOUND", "Tautan tidak ditemukan.", 404);
    return success({ status: row.status, inviterName: row.inviter_name?.trim() || "Pengguna Glubee", contactName: row.contact_name });
  }
  const { error } = await db.rpc("stop_contact", { p_token_hash: tokenHash });
  if (error) return failure("NOT_FOUND", invitationErrorMessage(error.message), 404);
  return success({ state: "revoked" });
}
