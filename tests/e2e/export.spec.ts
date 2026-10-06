import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function activeUser(page: Page, tag: string, values: number[]) {
  const email = `ekspor-${tag}-${Date.now()}@example.test`;
  const password = "Synthetic-export-9!" + Date.now();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.request.post("/api/auth/login", { data: { email, password } });
  for (const consentType of ["age_and_region", "legal_documents", "health_data"])
    await page.request.post("/api/consents", { data: { consentType, decision: "accept", method: "onboarding" } });
  await page.request.patch("/api/profile", {
    data: { name: "Uji Ekspor", birthDate: "1975-03-03", sex: "male", timezoneCode: "WITA" },
  });
  for (const [i, v] of values.entries())
    await page.request.post("/api/glucose-entries", {
      headers: { "Idempotency-Key": crypto.randomUUID() },
      data: { originalValue: v, originalUnit: "mg/dL", measurementContext: "random", measuredAt: new Date(Date.now() - (i + 1) * 36e5).toISOString(), note: "" },
    });
  return { email, password };
}

test("user downloads own data as JSON after confirming password", async ({ page, browser }) => {
  const other = await browser.newPage();
  await activeUser(other, "lain", [333]);
  await other.close();
  const me = await activeUser(page, "pemilik", [101, 102, 103]);

  // Tanpa sesi: ditolak.
  const anon = await browser.newContext();
  expect((await anon.request.post("/api/account/export", { data: {} })).status()).toBe(401);
  await anon.close();

  await page.goto("/profile");
  await page.getByRole("button", { name: "Unduh data saya" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Password akun").fill("password-salah");
  await dialog.getByRole("button", { name: "Unduh file JSON" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Password tidak sesuai");

  await dialog.getByLabel("Password akun").fill(me.password);
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Unduh file JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^glubee-data-\d{4}-\d{2}-\d{2}\.json$/);
  const data = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(data.schemaVersion).toBe(2);
  expect(data.account.email).toBe(me.email);
  expect(data.account.timezone).toBe("WITA");
  expect(data.glucoseEntries.map((e: { valueMgDl: number }) => Number(e.valueMgDl)).sort()).toEqual([101, 102, 103]);
  expect(JSON.stringify(data)).not.toContain("333");
  expect(data.consentReceipts.length).toBe(3);
  await expect(page.getByRole("status")).toContainText("sudah diunduh");

  // Sesi pengguna tetap utuh setelah verifikasi password.
  expect((await page.request.get("/api/profile")).status()).toBe(200);

  // Akun dinonaktifkan admin tetap bisa mengunduh dari halaman Status akun (UU PDP).
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const id = list.users.find((u) => u.email === me.email)!.id;
  await admin.from("profiles").update({ account_status: "suspended" }).eq("user_id", id);
  await page.goto("/account-status");
  await page.getByRole("button", { name: "Unduh data saya" }).click();
  await page.getByRole("dialog").getByLabel("Password akun").fill(me.password);
  const again = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Unduh file JSON" }).click();
  const suspended = JSON.parse(await readFile((await (await again).path())!, "utf8"));
  expect(suspended.account.accountStatus).toBe("suspended");
  expect(suspended.glucoseEntries.length).toBe(3);
});
