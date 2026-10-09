import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { contactErrorMessage } from "@/lib/domain/contact";

// GLB-022 / FR-CONTACT-001: pengguna mencabut kontak (pending/aktif). Job kontak yang belum
// terkirim disuppress di database; semua tautan milik kontak ini berhenti berlaku.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "contact.write", 10))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const { id } = await params;
  const { error } = await auth.supabase.rpc("revoke_emergency_contact", { p_contact_id: id });
  return error ? failure("REQUEST_FAILED", contactErrorMessage(error.message), 400) : success({ id, state: "revoked" });
}
