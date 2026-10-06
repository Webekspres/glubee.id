import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// GLB-019: producer pg_cron lokal (tiap menit) → endpoint dispatch → email di Mailpit.
// Butuh REMINDER_EMAIL_ENABLED=true dan CRON_SECRET di .env.local (lokal saja).

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function scheduleDueNow(userId: string, title: string, active: boolean) {
  const { data: s } = await admin
    .from("schedules")
    .insert({
      user_id: userId, category: "medicine", title, medicine_name: "Metformin rahasia", dose_note: "1 tablet",
      local_date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date()),
      local_time: "07:30", timezone_code: "WIB", active,
    })
    .select("id")
    .single();
  const { data: o } = await admin
    .from("schedule_occurrences")
    .insert({ schedule_id: s!.id, due_at: new Date(Date.now() - 30_000).toISOString() })
    .select("id")
    .single();
  return o!.id as string;
}

const dispatch = (request: import("@playwright/test").APIRequestContext, auth?: string) =>
  request.post("/api/internal/jobs/dispatch", {
    headers: { "Content-Type": "application/json", ...(auth && { Authorization: auth }) },
    data: {},
  });

test("due reminder is queued by cron and sent once by the protected dispatcher", async ({ request }) => {
  test.setTimeout(180_000);
  const email = `pengingat-${Date.now()}@example.test`;
  const { data: created } = await admin.auth.admin.createUser({ email, password: "Synthetic-reminder-9!" + Date.now(), email_confirm: true });
  const userId = created.user!.id;
  await admin.from("profiles").update({ name: "Bu Ani", birth_date: "1960-01-01", sex: "female", timezone_code: "WIB", account_status: "active" }).eq("user_id", userId);
  const due = await scheduleDueNow(userId, "Obat pagi uji", true);
  const paused = await scheduleDueNow(userId, "Jadwal dijeda", false);

  // Endpoint internal tanpa secret yang benar tidak terlihat ada.
  expect((await dispatch(request)).status()).toBe(404);
  expect((await dispatch(request, "Bearer salah")).status()).toBe(404);
  expect((await dispatch(request, process.env.CRON_SECRET)).status()).toBe(404);

  // Producer pg_cron membuat job dalam ±1 menit.
  const job = () => admin.from("notification_jobs").select("id,state,attempt_count").eq("occurrence_id", due).maybeSingle();
  await expect.poll(async () => (await job()).data?.state ?? null, { timeout: 90_000, intervals: [5_000] }).not.toBeNull();

  const secret = `Bearer ${process.env.CRON_SECRET}`;
  await expect
    .poll(async () => {
      await dispatch(request, secret);
      return (await job()).data?.state;
    }, { timeout: 30_000 })
    .toBe("sent");
  const { data: attempts } = await admin.from("notification_attempts").select("outcome,provider").eq("job_id", (await job()).data!.id);
  expect(attempts).toEqual([{ outcome: "sent", provider: "brevo" }]);

  // Jadwal dijeda tidak pernah mendapat job.
  expect((await admin.from("notification_jobs").select("id").eq("occurrence_id", paused)).data).toEqual([]);

  // Email: subjek generik + jam, isi nama kegiatan, tanpa nama obat/dosis.
  let id = "";
  await expect
    .poll(async () => {
      const body = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + email))).json();
      id = body.messages?.[0]?.ID ?? "";
      return body.messages?.length ?? 0;
    })
    .toBe(1);
  const mail = await (await fetch("http://127.0.0.1:54324/api/v1/message/" + id)).json();
  expect(mail.Subject).toBe("Pengingat jadwal Glubee pukul 07.30 WIB");
  expect(mail.HTML).toContain("Obat pagi uji");
  expect(mail.HTML).toContain("/schedule");
  expect(mail.HTML).not.toContain("Metformin rahasia");

  // Panggilan berikutnya tidak mengirim ulang.
  await dispatch(request, secret);
  const again = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + email))).json();
  expect(again.messages.length).toBe(1);
});
