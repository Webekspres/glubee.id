import { failure, objectValue, readJson, success } from "@/lib/api";
import { appUrl } from "@/lib/config";
import { contactSettings, hashInviteToken, invitationErrorMessage, newInviteToken, validToken } from "@/lib/domain/contact";
import { sendEmail } from "@/lib/email";
import { createContactAcceptedEmail } from "@/lib/email-templates";
import { fromBytea, openText, toBytea } from "@/lib/secret-box";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GLB-021/022 / FR-CONTACT-001: halaman undangan publik (kontak tanpa akun). Token dikirim di body,
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
  if (data === "active" && contactSettings().enabled) await sendStopLink(db, tokenHash);
  return success({ state: data });
}

// GLB-022: kontak yang menerima mendapat email konfirmasi berisi tautan berhenti (token baru,
// tanpa kedaluwarsa). Gagal kirim tidak membatalkan penerimaan; pengguna tetap bisa mencabut.
async function sendStopLink(db: ReturnType<typeof createSupabaseAdminClient>, invitationHash: string) {
  const { data } = await db.rpc("contact_for_invitation", { p_token_hash: invitationHash });
  const c = (data as { contact_id: string; contact_name: string; inviter_name: string | null; email_ciphertext: string }[] | null)?.[0];
  if (!c) return;
  const { token, hash } = newInviteToken();
  const { error } = await db.rpc("issue_contact_stop_token", { p_contact_id: c.contact_id, p_token_hash: toBytea(hash) });
  if (error) return;
  const mail = createContactAcceptedEmail({
    contactName: c.contact_name,
    inviterName: c.inviter_name?.trim() || "Pengguna Glubee",
    stopUrl: `${appUrl()}/contact-stop#${token}`,
  });
  await sendEmail({ to: openText(fromBytea(c.email_ciphertext)), subject: mail.subject, html: mail.html });
}
