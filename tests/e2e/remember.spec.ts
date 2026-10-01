import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function login(page: Page, email: string, password: string, remember: boolean) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  if (remember) await page.getByLabel("Ingat saya di perangkat ini").check();
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return (await page.context().cookies()).filter((c) => c.name.includes("auth-token"));
}

test("remember-me decides whether the session survives closing the browser", async ({ browser }) => {
  const email = `ingat-${Date.now()}@example.test`;
  const password = "Synthetic-remember-9!" + Date.now();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });

  const plain = await browser.newPage();
  const sessionCookies = await login(plain, email, password, false);
  expect(sessionCookies.length).toBeGreaterThan(0);
  for (const c of sessionCookies) expect(c.expires).toBe(-1);
  expect((await plain.context().cookies()).some((c) => c.name === "glubee_remember")).toBe(false);
  await plain.close();

  const remembered = await browser.newPage();
  const persistent = await login(remembered, email, password, true);
  const thirtyDays = Date.now() / 1000 + 30 * 86400;
  for (const c of persistent) expect(Math.abs(c.expires - thirtyDays)).toBeLessThan(120);
  // "Tutup browser": hanya cookie bertanggal yang bertahan, lalu buka beranda lagi.
  const kept = (await remembered.context().cookies()).filter((c) => c.expires !== -1);
  const reopened = await browser.newContext();
  await reopened.addCookies(kept);
  const home = await reopened.newPage();
  await home.goto("/");
  await expect(home).toHaveURL(/\/(dashboard|onboarding|account-status)$/);
  await home.goto("/login");
  await expect(home).toHaveURL(/\/(dashboard|onboarding|account-status)$/);
  await reopened.close();
  // Tanpa "Ingat saya", beranda tetap beranda setelah browser ditutup.
  const fresh = await browser.newContext();
  await fresh.addCookies(sessionCookies.filter((c) => c.expires !== -1));
  const anon = await fresh.newPage();
  await anon.goto("/");
  await anon.waitForTimeout(1000);
  await expect(anon).toHaveURL(/\/$/);
  await fresh.close();
  // Google login membawa pilihan yang sama.
  await remembered.goto("/login");
  await remembered.getByLabel("Ingat saya di perangkat ini").check();
  await expect(remembered.getByRole("link", { name: "Lanjutkan dengan Google" })).toHaveAttribute(
    "href",
    "/api/auth/google?remember=1",
  );
  // Keluar menghapus pilihan "Ingat saya".
  await remembered.request.post("/api/auth/logout", { data: {} });
  expect((await remembered.context().cookies()).some((c) => c.name === "glubee_remember")).toBe(false);
  await remembered.close();
});
