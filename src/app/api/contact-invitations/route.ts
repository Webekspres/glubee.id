import { failure, objectValue, readJson, success } from "@/lib/api";
import { hashInviteToken, invitationErrorMessage, validToken } from "@/lib/domain/contact";
import { toBytea } from "@/lib/secret-box";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GLB-021 / FR-CONTACT-001: halaman undangan publik (kontak tanpa akun). Token dikirim di body,
// bukan URL, agar tidak masuk log akses. Tanpa `decision` = baca undangan; dengan = putuskan.
export async function POST(request: Request) {
  const body = objectValue(await readJson(request));
  if (!validToken(body?.token)) return failure("NOT_FOUND", "Undangan tidak ditemukan.", 404);
  const tokenHash = toBytea(hashInviteToken(body.token));
  const db = createSupabaseAdminClient();

  if (body.decision === undefined) {
    const { data, error } = await db.rpc("get_contact_invitation", { p_token_hash: tokenHash });
    const row = (data as { status: string; inviter_name: string | null; contact_name: string; notice_version: string }[] | null)?.[0];
    if (error || !row) return failure("NOT_FOUND", "Undangan tidak ditemukan.", 404);
    return success({
      status: row.status,
      inviterName: row.inviter_name?.trim() || "Pengguna Glubee",
      contactName: row.contact_name,
      noticeVersion: row.notice_version,
    });
  }

  if (body.decision !== "accept" && body.decision !== "decline")
    return failure("VALIDATION_ERROR", "Pilihan tidak valid.", 422);
  const { data, error } = await db.rpc("decide_contact_invitation", {
    p_token_hash: tokenHash,
    p_decision: body.decision,
    p_notice_version: typeof body.noticeVersion === "string" ? body.noticeVersion : "",
  });
  if (error) return failure("INVITATION_INVALID", invitationErrorMessage(error.message), 409);
  return success({ state: data });
}
