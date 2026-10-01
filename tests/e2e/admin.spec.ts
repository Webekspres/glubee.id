import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

test("admin searches, suspends with reason, creates verified demo account", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  const adminEmail = `admin-${stamp}@example.test`;
  const userEmail = `pasien-${stamp}@example.test`;
  const demoEmail = `demo-${stamp}@example.test`;
  const password = "Synthetic-admin-9!" + stamp;
  await admin.auth.admin.createUser({
    email: adminEmail,
    password,
    email_confirm: true,
    app_metadata: { app_role: "admin" },
  });
  const { data: patient } = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  await admin
    .from("profiles")
    .update({ name: "Pasien Uji", birth_date: "1970-01-01", sex: "male", timezone_code: "WIB" })
    .eq("user_id", patient.user!.id);

  // Pengguna biasa ditolak.
  const other = await browser.newPage();
  await other.goto("/admin-xyz");
  await other.getByLabel("Email", { exact: true }).fill(userEmail);
  await other.getByLabel("Password", { exact: true }).fill(password);
  await other.getByRole("button", { name: "Masuk sebagai admin" }).click();
  await expect(other.locator(".message.error")).toContainText("tidak memiliki akses admin");
  expect((await other.request.get("/api/admin/accounts?q=example")).status()).toBe(403);
  await other.close();

  await page.goto("/admin-xyz");
  await page.getByRole("button", { name: "Masuk sebagai admin" }).click();
  await expect(page.getByText("Wajib diisi.").first()).toBeVisible();
  await page.getByLabel("Email", { exact: true }).fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Masuk sebagai admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin akun" })).toBeVisible();

  await page.getByLabel(/^Email \(minimal 3 karakter\)/).fill(userEmail);
  await page.getByRole("button", { name: "Cari", exact: true }).click();
  const row = page.getByRole("row", { name: new RegExp(userEmail) });
  await expect(row).toBeVisible();
  const search = await (await page.request.get("/api/admin/accounts?q=" + encodeURIComponent(userEmail))).json();
  expect(Object.keys(search.data[0]).sort()).toEqual(
    ["account_status", "created_at", "email", "email_confirmed", "is_admin", "user_id"],
  );

  await row.getByRole("button", { name: "Nonaktifkan" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Nonaktifkan akun" })).toBeDisabled();
  await dialog.getByLabel(/Alasan/).fill("Uji penonaktifan oleh admin");
  await dialog.getByRole("button", { name: "Nonaktifkan akun" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(row.getByText("Dinonaktifkan")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Uji penonaktifan oleh admin" })).toBeVisible();

  await page.getByLabel("Email akun demo").fill(demoEmail);
  await page.getByLabel(/^Password \(minimal 12/).fill("pendek");
  await page.getByRole("button", { name: "Buat akun demo" }).click();
  await expect(page.getByText("Minimal 12 karakter.")).toBeVisible();
  await page.getByLabel(/^Password \(minimal 12/).fill(password);
  await page.getByRole("button", { name: "Buat akun demo" }).click();
  await expect(page.getByRole("status")).toContainText(`Akun demo ${demoEmail} siap dipakai`);
  await expect(page.getByRole("cell", { name: "Buat akun demo" })).toBeVisible();

  // Akun demo bisa langsung masuk tanpa tautan verifikasi, lalu diarahkan ke onboarding.
  const demo = await browser.newPage();
  await demo.goto("/login");
  await demo.getByLabel("Email", { exact: true }).fill(demoEmail);
  await demo.getByLabel(/^Password/).fill(password);
  await demo.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(demo).toHaveURL(/\/onboarding/);
  await demo.close();
});
