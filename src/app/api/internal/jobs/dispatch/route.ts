import { failure, success } from "@/lib/api";
import { appUrl } from "@/lib/config";
import { classifySend, dispatchAuthorized, reminderSettings, reminderWhen } from "@/lib/domain/reminder";
import { sendEmail } from "@/lib/email";
import { createScheduleReminderEmail } from "@/lib/email-templates";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Timezone } from "@/lib/ui";

// GLB-019 / FR-REMINDER-001: dipanggil cron VPS tiap menit lewat 127.0.0.1 (nginx menolak
// /api/internal/ dari luar). Klaim batch kecil dengan lease; worker lain yang berjalan
// bersamaan tidak mendapat job yang sama (skip locked).

const BATCH = 10;
const LEASE_SECONDS = 300;

type ClaimedJob = {
  job_id: string;
  email: string;
  recipient_name: string | null;
  title: string;
  local_date: string;
  local_time: string;
  timezone_code: Timezone;
};

export async function POST(request: Request) {
  if (!dispatchAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return failure("NOT_FOUND", "Tidak ditemukan.", 404);
  const settings = reminderSettings();
  if (!settings.enabled) return success({ enabled: false, claimed: 0 });

  const db = createSupabaseAdminClient();
  const { data, error } = await db.rpc("claim_reminder_jobs", {
    p_limit: BATCH,
    p_lease_seconds: LEASE_SECONDS,
    p_daily_cap: settings.dailyCap,
  });
  if (error) return failure("REQUEST_FAILED", "Klaim job gagal.", 500);

  const counts = { sent: 0, retry: 0, failed: 0 };
  for (const job of (data ?? []) as ClaimedJob[]) {
    const shortTime = `${job.local_time.slice(0, 5).replace(":", ".")} ${job.timezone_code}`;
    const mail = createScheduleReminderEmail({
      recipientName: job.recipient_name ?? "Pengguna Glubee",
      title: job.title,
      when: reminderWhen(job.local_date, job.local_time, job.timezone_code),
      shortTime,
      scheduleUrl: `${appUrl()}/schedule`,
    });
    const sent = await sendEmail({ to: job.email, subject: mail.subject, html: mail.html });
    const outcome = classifySend(sent);
    // Bila pencatatan hasil gagal, lease habis dan job diklaim ulang (maksimal 3 percobaan).
    await db.rpc("complete_reminder_job", {
      p_job_id: job.job_id,
      p_result: outcome.result,
      p_provider_message_id: sent.messageId ?? null,
      p_error_class: outcome.errorClass,
    });
    counts[outcome.result] += 1;
  }
  return success({ enabled: true, claimed: (data ?? []).length, ...counts });
}
