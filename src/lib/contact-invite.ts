import "server-only";

import { appUrl } from "@/lib/config";
import { INVITE_DAYS, inviteExpiresText } from "@/lib/domain/contact";
import { sendEmail } from "@/lib/email";
import { createContactInviteEmail } from "@/lib/email-templates";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Timezone } from "@/lib/ui";

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

// Kirim email undangan; kembalikan false bila gagal agar pemanggil bisa membatalkan.
export async function sendInvitation(supabase: Supabase, contact: { name: string; email: string }, token: string) {
  const { data: profile } = await supabase.from("profiles").select("name,timezone_code").single();
  const inviter = profile?.name?.trim() || "Pengguna Glubee";
  const mail = createContactInviteEmail({
    recipientName: contact.name,
    inviterName: inviter,
    // Token di fragment (#): tidak terkirim ke server, tidak tercatat di log nginx.
    inviteUrl: `${appUrl()}/invite#${token}`,
    expiresText: inviteExpiresText(
      new Date(Date.now() + INVITE_DAYS * 864e5),
      (profile?.timezone_code as Timezone | undefined) ?? "WIB",
    ),
  });
  const sent = await sendEmail({ to: contact.email, subject: mail.subject, html: mail.html });
  return sent.success;
}

