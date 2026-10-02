import { authenticatedRequest, rateLimited } from "@/lib/auth";
import { failure, objectValue, readJson, success } from "@/lib/api";
import { appUrl } from "@/lib/config";
import { deletionSchedule } from "@/lib/domain/deletion";
import { sendEmail } from "@/lib/email";
import { createDeletionCancelledEmail, createDeletionRequestedEmail } from "@/lib/email-templates";
import { requireReauth } from "@/lib/reauth";
import type { Timezone } from "@/lib/ui";

// GLB-024 / FR-DELETE-001: ajukan (POST) atau batalkan (DELETE) penghapusan akun.
// Keduanya memerlukan re-authentication; email konfirmasi bersifat best-effort.

async function profileOf(auth: Exclude<Awaited<ReturnType<typeof authenticatedRequest>>, { supabase: null }>) {
  const { data } = await auth.supabase
    .from("profiles")
    .select("name,timezone_code")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return { name: data?.name ?? "Pengguna Glubee", zone: (data?.timezone_code ?? "WIB") as Timezone };
}

async function notify(to: string | undefined, mail: { subject: string; html: string }) {
  if (!to) return;
  try {
    await sendEmail({ to, subject: mail.subject, html: mail.html });
  } catch {
    // Kegagalan email tidak membatalkan permintaan; status tetap terlihat di aplikasi.
  }
}

export async function GET() {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  const { data } = await auth.supabase.rpc("get_my_deletion_request");
  return success(data ?? null);
}

export async function POST(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "account.deletion", 5))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi dalam satu menit.", 429);
  const body = objectValue(await readJson(request));
  if (body?.confirm !== true)
    return failure("VALIDATION_ERROR", "Centang pernyataan untuk melanjutkan.", 422, {
      confirm: "Centang untuk melanjutkan.",
    });
  const denied = await requireReauth(auth.user, body);
  if (denied) return denied;

  const { data, error } = await auth.supabase.rpc("request_account_deletion");
  if (error)
    return error.message?.includes("deletion_not_allowed")
      ? failure("DELETION_NOT_ALLOWED", "Akun ini sudah dalam proses penghapusan.", 409)
      : failure("DELETION_FAILED", "Permintaan belum dapat diproses. Coba lagi.", 500);

  const { name, zone } = await profileOf(auth);
  const schedule = deletionSchedule((data as { scheduledFor: string }).scheduledFor, zone);
  await notify(
    auth.user.email,
    createDeletionRequestedEmail({
      recipientName: name,
      scheduleLocal: schedule.local,
      scheduleUtc: schedule.utc,
      statusUrl: new URL("/account-status", appUrl()).toString(),
    }),
  );
  return success({ ...(data as object), schedule }, 201);
}

export async function DELETE(request: Request) {
  const auth = await authenticatedRequest();
  if (auth.response) return auth.response;
  if (await rateLimited(auth.supabase, "account.deletion", 5))
    return failure("RATE_LIMITED", "Terlalu banyak permintaan. Coba lagi dalam satu menit.", 429);
  const denied = await requireReauth(auth.user, objectValue(await readJson(request)));
  if (denied) return denied;

  const { data, error } = await auth.supabase.rpc("cancel_account_deletion");
  if (error)
    return error.message?.includes("deletion_window_closed")
      ? failure("DELETION_WINDOW_CLOSED", "Masa jeda sudah berakhir; penghapusan sedang diproses.", 409)
      : error.message?.includes("no_pending_deletion")
        ? failure("NO_PENDING_DELETION", "Tidak ada permintaan penghapusan yang aktif.", 409)
        : failure("CANCEL_FAILED", "Pembatalan belum dapat diproses. Coba lagi.", 500);

  const { name } = await profileOf(auth);
  await notify(
    auth.user.email,
    createDeletionCancelledEmail({ recipientName: name, dashboardUrl: new URL("/dashboard", appUrl()).toString() }),
  );
  return success({ accountStatus: data });
}
