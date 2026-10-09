import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createECDH, randomBytes } from "node:crypto";

// GLB-020 / FR-REMINDER-001: langganan push terenkripsi; push yang tidak bisa terkirim
// diteruskan ke email fallback. Butuh REMINDER_PUSH_ENABLED, REMINDER_EMAIL_ENABLED,
// kunci VAPID, DATA_ENCRYPTION_KEY dan CRON_SECRET di .env.local (lokal saja).

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function activeUser(page: Page, email: string) {
  const password = "Synthetic-push-9!" + Date.now();
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.request.post("/api/auth/login", { data: { email, password } });
  for (const consentType of ["age_and_region", "legal_documents", "health_data"])
    await page.request.post("/api/consents", { data: { consentType, decision: "accept", method: "onboarding" } });
  await page.request.patch("/api/profile", {
    data: { name: "Uji Push", birthDate: "1965-02-02", sex: "male", timezoneCode: "WIB" },
  });
  return data.user!.id;
}

const b64url = (b: Buffer) => b.toString("base64url");

test("push subscription is stored encrypted and a failing push falls back to email", async ({ page, request }) => {
  test.setTimeout(240_000);
  const email = `push-${Date.now()}@example.test`;
  const userId = await activeUser(page, email);

  const config = await (await page.request.get("/api/push-subscriptions")).json();
  expect(config.data).toMatchObject({ push: true });
  expect(config.data.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);

  // Bentuk subscription asli dari browser; endpoint .invalid tidak pernah bisa dihubungi.
  const endpoint = `https://push.invalid/glubee-e2e/${Date.now()}`;
  const sub = { endpoint, keys: { p256dh: b64url(createECDH("prime256v1").generateKeys()), auth: b64url(randomBytes(16)) } };
  expect((await page.request.post("/api/push-subscriptions", { data: { ...sub, endpoint: "http://plain.test" } })).status()).toBe(422);
  expect((await page.request.post("/api/push-subscriptions", { data: sub })).status()).toBe(201);
  const { data: rows } = await admin.from("push_subscriptions").select("subscription_ciphertext,active").eq("user_id", userId);
  expect(rows).toHaveLength(1);
  expect(Buffer.from(rows![0].subscription_ciphertext.slice(2), "hex").toString("latin1")).not.toContain("push.invalid");

  // Jadwal jatuh tempo → producer memilih kanal push.
  const { data: s } = await admin.from("schedules").insert({
    user_id: userId, category: "glucose_check", title: "Cek gula uji push",
    local_date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date()),
    local_time: "07:30", timezone_code: "WIB",
  }).select("id").single();
  const { data: o } = await admin.from("schedule_occurrences")
    .insert({ schedule_id: s!.id, due_at: new Date(Date.now() - 30_000).toISOString() }).select("id").single();
  const job = (channel: string) =>
    admin.from("notification_jobs").select("id,state,attempt_count").eq("occurrence_id", o!.id).eq("channel", channel).maybeSingle();
  await expect.poll(async () => (await job("push")).data?.state ?? null, { timeout: 90_000, intervals: [5_000] }).toBe("queued");

  // Push gagal jaringan → retry; percobaan ketiga gagal → email fallback terkirim.
  const secret = `Bearer ${process.env.CRON_SECRET}`;
  const dispatch = () => request.post("/api/internal/jobs/dispatch", { headers: { Authorization: secret }, data: {} });
  for (let i = 0; i < 3; i++) {
    await admin.from("notification_jobs").update({ next_attempt_at: new Date(Date.now() - 1000).toISOString() }).eq("id", (await job("push")).data!.id);
    expect((await dispatch()).status()).toBe(200);
  }
  expect((await job("push")).data).toMatchObject({ state: "failed", attempt_count: 3 });
  await expect.poll(async () => (await job("email")).data?.state ?? null, { timeout: 30_000 }).toBe("sent");
  const mails = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + email))).json();
  expect(mails.messages).toHaveLength(1);

  // Mematikan notifikasi menonaktifkan subscription.
  expect((await page.request.delete("/api/push-subscriptions", { data: { endpoint } })).status()).toBe(200);
  expect((await admin.from("push_subscriptions").select("active").eq("user_id", userId).single()).data?.active).toBe(false);
});

test("dashboard shows today's schedules without push or email", async ({ page }) => {
  const userId = await activeUser(page, `dasbor-${Date.now()}@example.test`);
  await admin.from("schedules").insert({
    user_id: userId, category: "medicine", title: "Obat malam uji",
    local_date: new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(new Date()),
    local_time: "23:59", timezone_code: "WIB",
  });
  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "Jadwal hari ini" });
  await expect(card.getByText("Obat malam uji")).toBeVisible();
  await expect(card.getByText("23.59 WIB")).toBeVisible();
});
