import webpush from "web-push";
import { failure, success } from "@/lib/api";
import { appUrl } from "@/lib/config";
import {
  classifyPush,
  classifySend,
  combinePush,
  dispatchAuthorized,
  reminderSettings,
  reminderWhen,
  type DispatchResult,
  type PushOutcome,
} from "@/lib/domain/reminder";
import { sendEmail } from "@/lib/email";
import { createScheduleReminderEmail } from "@/lib/email-templates";
import { fromBytea, openText } from "@/lib/secret-box";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Timezone } from "@/lib/ui";

// GLB-019/020 / FR-REMINDER-001: dipanggil cron VPS tiap menit lewat 127.0.0.1 (nginx menolak
// /api/internal/ dari luar). Klaim batch kecil dengan lease per kanal; worker lain yang berjalan
// bersamaan tidak mendapat job yang sama (skip locked). Push dulu, karena push yang gagal
// membuat job email fallback yang bisa langsung terkirim di putaran yang sama.

const BATCH = 10;
const LEASE_SECONDS = 300;

type ClaimedJob = {
  job_id: string;
  user_id: string;
  email: string;
  recipient_name: string | null;
  title: string;
  local_date: string;
  local_time: string;
  timezone_code: Timezone;
};

type Db = ReturnType<typeof createSupabaseAdminClient>;
type Settings = ReturnType<typeof reminderSettings>;

const shortTime = (job: ClaimedJob) => `${job.local_time.slice(0, 5).replace(":", ".")} ${job.timezone_code}`;

async function sendEmailJob(job: ClaimedJob) {
  const mail = createScheduleReminderEmail({
    recipientName: job.recipient_name ?? "Pengguna Glubee",
    title: job.title,
    when: reminderWhen(job.local_date, job.local_time, job.timezone_code),
    shortTime: shortTime(job),
    scheduleUrl: `${appUrl()}/schedule`,
  });
  const sent = await sendEmail({ to: job.email, subject: mail.subject, html: mail.html });
  return { ...classifySend(sent), messageId: sent.messageId ?? null };
}

// Isi notifikasi sama minimnya dengan email: nama kegiatan dan jam, tanpa obat/dosis/nilai.
async function sendPushJob(db: Db, settings: Settings, job: ClaimedJob) {
  const { data: subs } = await db
    .from("push_subscriptions")
    .select("id,subscription_ciphertext")
    .eq("user_id", job.user_id)
    .eq("active", true);
  const payload = JSON.stringify({
    title: "Pengingat Glubee",
    body: `${job.title}, ${shortTime(job)}`,
    url: "/schedule",
    tag: `reminder-${job.job_id}`,
  });
  const outcomes: PushOutcome[] = [];
  for (const sub of subs ?? []) {
    let outcome: PushOutcome;
    try {
      const target = JSON.parse(openText(fromBytea(sub.subscription_ciphertext)));
      const res = await webpush.sendNotification(target, payload, {
        vapidDetails: settings.vapid,
        TTL: 60 * 60,
        urgency: "high",
        timeout: 10_000,
      });
      outcome = classifyPush(res.statusCode);
    } catch (e) {
      outcome = classifyPush((e as { statusCode?: number }).statusCode);
    }
    if (outcome === "gone")
      await db.from("push_subscriptions").update({ active: false }).eq("id", sub.id);
    outcomes.push(outcome);
  }
  return { ...combinePush(outcomes), messageId: null };
}

async function run(
  db: Db,
  channel: "push" | "email",
  dailyCap: number,
  send: (job: ClaimedJob) => Promise<DispatchResult & { messageId: string | null }>,
) {
  const counts = { claimed: 0, sent: 0, retry: 0, failed: 0 };
  const { data, error } = await db.rpc("claim_reminder_jobs", {
    p_channel: channel,
    p_limit: BATCH,
    p_lease_seconds: LEASE_SECONDS,
    p_daily_cap: dailyCap,
  });
  if (error) return null;
  for (const job of (data ?? []) as ClaimedJob[]) {
    const outcome = await send(job);
    // Bila pencatatan hasil gagal, lease habis dan job diklaim ulang (maksimal 3 percobaan).
    await db.rpc("complete_reminder_job", {
      p_job_id: job.job_id,
      p_result: outcome.result,
      p_provider_message_id: outcome.messageId,
      p_error_class: outcome.errorClass,
    });
    counts.claimed += 1;
    counts[outcome.result] += 1;
  }
  return counts;
}

export async function POST(request: Request) {
  if (!dispatchAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET))
    return failure("NOT_FOUND", "Tidak ditemukan.", 404);
  const settings = reminderSettings();
  if (!settings.enabled && !settings.push) return success({ enabled: false, claimed: 0 });

  const db = createSupabaseAdminClient();
  const push = settings.push ? await run(db, "push", 0, (job) => sendPushJob(db, settings, job)) : undefined;
  const email = settings.enabled ? await run(db, "email", settings.dailyCap, sendEmailJob) : undefined;
  if (push === null || email === null) return failure("REQUEST_FAILED", "Klaim job gagal.", 500);
  return success({
    enabled: true,
    claimed: (push?.claimed ?? 0) + (email?.claimed ?? 0),
    ...(push && { push }),
    ...(email && { email }),
  });
}
