import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { contactErrorMessage, contactSettings, newInviteToken } from "@/lib/domain/contact";
import { fromBytea, openText, toBytea } from "@/lib/secret-box";
import { sendInvitation } from "@/lib/contact-invite";

// GLB-021: kirim ulang undangan (token baru, token lama tidak berlaku) untuk kontak yang belum menjawab.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (!contactSettings().enabled) return failure("CONTACTS_DISABLED", "Undangan kontak darurat belum tersedia.", 409);
  if (await rateLimited(auth.supabase, "contact.write", 10))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const { id } = await params;
  const { data: contact } = await auth.supabase
    .from("emergency_contacts")
    .select("id,name,email_ciphertext")
    .eq("id", id)
    .maybeSingle();
  if (!contact) return failure("NOT_FOUND", "Kontak tidak ditemukan.", 404);
  const { token, hash } = newInviteToken();
  const { error } = await auth.supabase.rpc("reissue_contact_invitation", {
    p_contact_id: id,
    p_token_hash: toBytea(hash),
  });
  if (error) return failure("REQUEST_FAILED", contactErrorMessage(error.message), 400);
  const ok = await sendInvitation(
    auth.supabase,
    { name: contact.name, email: openText(fromBytea(contact.email_ciphertext)) },
    token,
  );
  return ok
    ? success({ id, state: "pending" })
    : failure("EMAIL_FAILED", "Email undangan belum dapat dikirim. Coba lagi nanti.", 502);
}
