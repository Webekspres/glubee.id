import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, readJson, success } from "@/lib/api";
import { APP_CONFIG } from "@/lib/config";
import {
  contactErrorMessage,
  contactSettings,
  newInviteToken,
  validateContactInput,
} from "@/lib/domain/contact";
import { sendInvitation } from "@/lib/contact-invite";
import { fromBytea, keyedHash, openText, sealText, toBytea } from "@/lib/secret-box";

// GLB-021 / FR-CONTACT-001: daftar dan undang kontak darurat (maksimal dua aktif/menunggu).

type Row = {
  id: string;
  name: string;
  email_ciphertext: string;
  state: string;
  created_at: string;
  invitation_expires_at: string | null;
  decided_at: string | null;
};

type Supabase = NonNullable<Awaited<ReturnType<typeof authenticatedRequest>>["supabase"]>;

async function shareConsented(supabase: Supabase) {
  const { data } = await supabase
    .from("consent_receipts")
    .select("decision,document_version")
    .eq("consent_type", "contact_share")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.decision === "accept" && data.document_version === APP_CONFIG.noticeVersions.contactShare;
}

export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "contact.read", 60))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const { data, error } = await auth.supabase.rpc("my_emergency_contacts");
  if (error) return failure("REQUEST_FAILED", "Kontak darurat belum dapat dimuat.", 400);
  const contacts = ((data ?? []) as Row[]).map((c) => ({
    id: c.id,
    name: c.name,
    email: openText(fromBytea(c.email_ciphertext)),
    state: c.state,
    createdAt: c.created_at,
    invitationExpiresAt: c.invitation_expires_at,
    decidedAt: c.decided_at,
  }));
  return success(contacts, 200, {
    enabled: contactSettings().enabled,
    shareConsented: await shareConsented(auth.supabase),
  });
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (!contactSettings().enabled) return failure("CONTACTS_DISABLED", "Undangan kontak darurat belum tersedia.", 409);
  if (await rateLimited(auth.supabase, "contact.write", 10))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan.", 429);
  const validated = validateContactInput(await readJson(request), auth.user.email);
  if (!validated.data) return failure("VALIDATION_ERROR", "Periksa kembali data kontak.", 422, validated.errors);
  const input = validated.data;

  if (!(await shareConsented(auth.supabase))) {
    if (!input.shareAccepted)
      return failure("VALIDATION_ERROR", "Periksa kembali data kontak.", 422, {
        shareAccepted: "Centang persetujuan untuk mengirim undangan.",
      });
    const { error } = await auth.supabase.rpc("record_consent", {
      p_type: "contact_share",
      p_decision: "accept",
      p_method: "contact_invite",
    });
    if (error) return failure("REQUEST_FAILED", "Persetujuan belum dapat dicatat.", 400);
  }

  const { token, hash } = newInviteToken();
  const { data: id, error } = await auth.supabase.rpc("invite_emergency_contact", {
    p_name: input.name,
    p_email_ciphertext: toBytea(sealText(input.email)),
    p_email_hash: toBytea(keyedHash(input.email)),
    p_token_hash: toBytea(hash),
  });
  if (error) return failure("REQUEST_FAILED", contactErrorMessage(error.message), 400);

  if (!(await sendInvitation(auth.supabase, input, token))) {
    await auth.supabase.rpc("discard_contact_invitation", { p_contact_id: id });
    return failure("EMAIL_FAILED", "Email undangan belum dapat dikirim. Coba lagi nanti.", 502);
  }
  return success({ id, state: "pending" }, 201);
}
