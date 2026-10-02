import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function mailSubjects(to: string) {
  const res = await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + to));
  return ((await res.json()).messages ?? []).map((m: { Subject: string }) => m.Subject);
}

async function activeUser(page: Page) {
  const email = `hapus-${Date.now()}@example.test`;
  const password = "Synthetic-delete-9!" + Date.now();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.request.post("/api/auth/login", { data: { email, password } });
  for (const consentType of ["age_and_region", "legal_documents", "health_data"])
    await page.request.post("/api/consents", { data: { consentType, decision: "accept", method: "onboarding" } });
  await page.request.patch("/api/profile", {
    data: { name: "Uji Hapus", birthDate: "1972-02-02", sex: "female", timezoneCode: "WITA" },
  });
  await page.request.post("/api/glucose-entries", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: { originalValue: 130, originalUnit: "mg/dL", measurementContext: "random", measuredAt: new Date(Date.now() - 36e5).toISOString(), note: "" },
  });
  return { email, password };
}

test("user requests account deletion, sees the schedule, and cancels", async ({ page, browser }) => {
  const me = await activeUser(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Hapus akun saya" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Semua catatan gula darah");
  await expect(dialog).toContainText("WITA");
  await expect(dialog).toContainText("UTC");
  await dialog.getByLabel("Password akun").fill("salah-password");
  await dialog.getByLabel(/Saya mengerti/).check();
  await dialog.getByRole("button", { name: "Ya, hapus akun saya" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Password tidak sesuai");
  await dialog.getByLabel("Password akun").fill(me.password);
  await dialog.getByRole("button", { name: "Ya, hapus akun saya" }).click();

  await expect(page).toHaveURL(/\/account-status$/);
  await expect(page.getByRole("status").filter({ hasText: "Dijadwalkan dihapus" })).toContainText("WITA");
  await expect(page.getByText(/UTC$/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Unduh data saya" })).toBeVisible();
  // Mode terbatas: dasbor mengarah ke Status akun, data kesehatan tertutup.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/account-status$/);
  const closed = await page.request.get("/api/glucose-entries?period=7");
  expect(closed.ok() ? (await closed.json()).data.length : 0).toBe(0);
  await expect.poll(() => mailSubjects(me.email)).toContain("Permintaan penghapusan akun Glubee.id diterima");

  // Admin diberi tahu, tanpa tombol tunda/batal.
  const adminEmail = `admin-hapus-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email: adminEmail, password: me.password, email_confirm: true, app_metadata: { app_role: "admin" } });
  const adminPage = await browser.newPage();
  await adminPage.request.post("/api/auth/login", { data: { email: adminEmail, password: me.password } });
  await adminPage.goto("/admin-xyz");
  const row = adminPage.getByRole("region", { name: "Permintaan penghapusan akun" }).getByRole("row", { name: new RegExp(me.email) });
  await expect(row).toContainText("Menunggu masa jeda");
  await expect(row.getByRole("button")).toHaveCount(0);
  await adminPage.close();

  // Batalkan.
  await page.goto("/account-status");
  await page.getByRole("button", { name: "Batalkan penghapusan" }).click();
  await page.getByRole("dialog").getByLabel("Password akun").fill(me.password);
  await page.getByRole("dialog").getByRole("button", { name: "Batalkan penghapusan" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /Ringkasan Anda|Halo/ }).first()).toBeVisible();
  await expect.poll(() => mailSubjects(me.email)).toContain("Penghapusan akun Glubee.id dibatalkan");
});
