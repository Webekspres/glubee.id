import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { mkdir } from "node:fs/promises";
import { APP_CONFIG } from "../../src/lib/config";
const password = "Synthetic-test-9!" + Date.now();
const fixtureDate = new Date();
fixtureDate.setUTCDate(10);
fixtureDate.setUTCMonth(fixtureDate.getUTCMonth() - 1);
const month = fixtureDate.toISOString().slice(0, 7);
async function selectFixtureRange(page: Page) {
  await page
    .getByRole("button", { name: "Rentang tanggal", exact: true })
    .click();
  await page.getByLabel("Dari tanggal").fill(month + "-01");
  await page.getByLabel("Sampai tanggal").fill(month + "-28");
  await page.getByRole("button", { name: "Terapkan", exact: true }).click();
}
test("Sprint 2 user journey, isolation, three zones, PDF and privacy", async ({
  page,
  browser,
}) => {
  const email = "sprint2-" + Date.now() + "@example.test";
  const external = new Set<string>();
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (
      u.protocol.startsWith("http") &&
      !["localhost", "127.0.0.1"].includes(u.hostname)
    )
      external.add(u.hostname);
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Setiap catatan,", exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tolak non-esensial", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Pilihan cookie" }),
  ).toHaveCount(0);
  const cookies = await page.context().cookies();
  expect(cookies.some((c) => c.name === "glubee_privacy" && c.httpOnly)).toBe(
    true,
  );
  await page
    .getByRole("button", { name: "Pengaturan Cookie", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Tarik non-esensial", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel("Konfirmasi password", { exact: true }).fill(password);
  await page.getByLabel(/^Tanggal lahir/).fill("1990-01-01");
  for (const c of await page.locator('input[type="checkbox"]').all())
    await c.check();
  await page.getByRole("button", { name: "Daftar akun", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/verify(\?email=.+)?$/);
  let messageId = "";
  await expect
    .poll(async () => {
      const res = await fetch(
        "http://127.0.0.1:54324/api/v1/search?query=" +
          encodeURIComponent("to:" + email),
      );
      const body = await res.json();
      messageId = body.messages?.[0]?.ID ?? "";
      return Boolean(messageId);
    })
    .toBe(true);
  const mail = await (
    await fetch("http://127.0.0.1:54324/api/v1/message/" + messageId)
  ).json();
  const verification = (mail.HTML as string)
    .match(/href="([^"]+)"/)?.[1]
    ?.replaceAll("&amp;", "&");
  if (!verification) throw new Error("Synthetic confirmation link missing");
  await page.goto(verification);
  await expect(page).toHaveURL(/\/onboarding/);
  await page
    .getByLabel("Nama", { exact: true })
    .fill("Pengguna Uji Sprint Dua");
  await page
    .getByRole("combobox", { name: "Jenis kelamin" })
    .selectOption("female");
  await page.getByRole("combobox", { name: "Zona waktu" }).selectOption("WIB");
  await page
    .getByRole("button", { name: "Simpan & lanjutkan", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Ringkasan Anda", exact: true }),
  ).toBeVisible();
  await page.goto("/log");
  await page.getByLabel("Hasil pengukuran", { exact: true }).fill("5.5");
  await page.getByRole("combobox", { name: "Satuan" }).selectOption("mmol/L");
  await page
    .getByRole("combobox", { name: /Kondisi pengukuran/ })
    .selectOption("random");
  await page
    .getByLabel("Waktu pengukuran", { exact: false })
    .fill(month + "-10T08:30");
  await page
    .locator('textarea[name="note"]')
    .fill("Catatan sintetis untuk koreksi.");
  await page
    .getByRole("button", { name: "Simpan catatan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Catatan berhasil disimpan" }),
  ).toBeVisible();
  const history = await (
    await page.request.get("/api/glucose-entries?month=" + month)
  ).json();
  const entry = history.data[0];
  expect(Number(entry.normalized_mg_dl)).toBe(99);
  await page.goto("/history");
  await selectFixtureRange(page);
  await page
    .getByRole("button", { name: "Koreksi catatan", exact: true })
    .click();
  await page.getByLabel("Alasan koreksi (opsional)").fill("Salah salin angka.");
  await page
    .getByRole("button", { name: "Tandai salah & lanjutkan", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Hasil pengukuran", { exact: true })
    .fill("6");
  await page
    .getByRole("button", { name: "Simpan catatan pengganti", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const corrected = await (
    await page.request.get("/api/glucose-entries?month=" + month)
  ).json();
  expect(corrected.data).toHaveLength(2);
  expect(
    corrected.data.find((e: { status: string }) => e.status === "valid")
      .replacement_for_id,
  ).toBe(entry.id);
  const sum = await (
    await page.request.get("/api/glucose-summary?month=" + month)
  ).json();
  expect(sum.data.count).toBe(1);
  expect(sum.data.averageMgDl).toBe(108);
  const body = {
    originalValue: 90,
    originalUnit: "mg/dL",
    measurementContext: "random",
    measuredAt: month + "-10T16:30:00Z",
    note: "Batas zona sintetis",
  };
  const key = crypto.randomUUID();
  const headers = { "Idempotency-Key": key };
  const first = await page.request.post("/api/glucose-entries", {
    data: body,
    headers,
  });
  const second = await page.request.post("/api/glucose-entries", {
    data: body,
    headers,
  });
  expect((await first.json()).data.id).toBe((await second.json()).data.id);
  const csrf = await page.request.post("/api/glucose-entries", {
    data: body,
    headers: { ...headers, origin: "https://invalid.example" },
  });
  expect(csrf.status()).toBe(403);
  for (const zone of ["WIB", "WITA", "WIT"]) {
    const p = await page.request.patch("/api/profile", {
      data: {
        name: "Pengguna Uji Sprint Dua",
        birthDate: "1990-01-01",
        sex: "female",
        timezoneCode: zone,
      },
    });
    expect(p.ok()).toBe(true);
    const r = await (
      await page.request.get(
        "/api/glucose-summary?from=" + month + "-11&to=" + month + "-11",
      )
    ).json();
    expect(r.data.count).toBe(zone === "WIB" ? 0 : 1);
  }
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  const ownerId = (await login.json()).data.userId;
  const otherEmail = "other-" + Date.now() + "@example.test";
  const { data: other, error: createError } = await admin.auth.admin.createUser(
    { email: otherEmail, password, email_confirm: true },
  );
  expect(createError).toBeNull();
  const otherContext = await browser.newContext({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
  });
  await otherContext.request.post("/api/auth/login", {
    data: { email: otherEmail, password },
  });
  for (const consentType of [
    "age_and_region",
    "legal_documents",
    "health_data",
  ])
    await otherContext.request.post("/api/consents", {
      data: { consentType, decision: "accept", method: "e2e" },
    });
  await otherContext.request.patch("/api/profile", {
    data: {
      name: "Other Synthetic User",
      birthDate: "1991-01-01",
      sex: "male",
      timezoneCode: "WIB",
    },
  });
  const isolated = await (
    await otherContext.request.get("/api/glucose-summary?month=" + month)
  ).json();
  expect(isolated.data.count).toBe(0);
  expect(
    (
      await otherContext.request.post(
        "/api/glucose-entries/" + entry.id + "/replacement",
        { data: body, headers: { "Idempotency-Key": crypto.randomUUID() } },
      )
    ).ok(),
  ).toBe(false);
  const unauth = await browser.newContext({
    baseURL: process.env.NEXT_PUBLIC_APP_URL,
  });
  expect(
    (await unauth.request.post("/api/reports", { data: { month } })).status(),
  ).toBe(401);
  await unauth.close();
  await otherContext.close();
  expect(other.user?.id).toBeTruthy();
  const rows = Array.from({ length: 45 }, (_, i) => ({
    user_id: ownerId,
    original_value: 85 + (i % 30),
    original_unit: "mg/dL",
    normalized_mg_dl: 85 + (i % 30),
    measurement_context: "random",
    measured_at: new Date(
      Date.UTC(
        fixtureDate.getUTCFullYear(),
        fixtureDate.getUTCMonth(),
        10,
        2,
        i,
      ),
    ).toISOString(),
    note:
      i === 0
        ? "Catatan panjang sintetis. ".repeat(35)
        : "Contoh pengukuran sintetis " + (i + 1),
  }));
  const { error: seedError } = await admin.from("glucose_entries").insert(rows);
  expect(seedError).toBeNull();
  await page.goto("/history");
  await selectFixtureRange(page);
  await expect(page.locator("tbody tr")).toHaveCount(20);
  await page.getByRole("button", { name: "Muat catatan berikutnya" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(40);
  await page.getByRole("button", { name: "Muat catatan berikutnya" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(48);
  await page.goto("/dashboard");
  await selectFixtureRange(page);
  await expect(
    page.getByRole("heading", { name: "Tren gula darah", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Buka menu navigasi", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Navigasi utama" }),
  ).toBeVisible();
  await page.goto("/reports");
  await selectFixtureRange(page);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Unduh laporan PDF", exact: true })
    .click();
  const download = await downloadPromise;
  await mkdir("test-results", { recursive: true });
  await download.saveAs("test-results/laporan-glubee.pdf");
  const pdf = await PDFDocument.load(
    await (await page.request.post("/api/reports", { data: { month } })).body(),
  );
  expect(pdf.getPageCount()).toBeGreaterThan(1);
  expect(external.size).toBe(0);
  expect(
    await page.evaluate(() => localStorage.length + sessionStorage.length),
  ).toBe(0);
  const consent = (await (await page.request.get("/api/consents")).json()).data;
  expect(
    consent.some(
      (r: { document_version: string }) =>
        r.document_version === APP_CONFIG.noticeVersions.legalDocuments,
    ),
  ).toBe(true);
  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { name: "Bukti persetujuan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Buka menu navigasi", exact: true }).click();
  await page.getByRole("button", { name: "Keluar", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Same-browser PKCE recovery through the real local mail service.
  await page.request.post("/api/auth/logout", { data: {} });
  await page.goto("/reset-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Kirim tautan", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Jika akun tersedia");
  let recoveryId = "";
  await expect
    .poll(async () => {
      const res = await fetch(
        "http://127.0.0.1:54324/api/v1/search?query=" +
          encodeURIComponent("to:" + email),
      );
      const body = await res.json();
      recoveryId =
        body.messages?.find((m: { ID: string }) => m.ID !== messageId)?.ID ??
        "";
      return Boolean(recoveryId);
    })
    .toBe(true);
  const recoveryMail = await (
    await fetch("http://127.0.0.1:54324/api/v1/message/" + recoveryId)
  ).json();
  const recoveryLink = (recoveryMail.HTML as string)
    .match(/href="([^"]+)"/)?.[1]
    ?.replaceAll("&amp;", "&");
  if (!recoveryLink) throw new Error("Synthetic recovery link missing");
  await page.goto(recoveryLink);
  await expect(page).toHaveURL(/\/update-password/);
  const nextPassword = password + "-updated";
  await page.getByLabel(/^Password/).fill(nextPassword);
  await page
    .getByLabel("Konfirmasi password", { exact: true })
    .fill(nextPassword);
  await page
    .getByRole("button", { name: "Simpan password baru", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?updated=1/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel(/^Password/).fill(nextPassword);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/log");
  await page.getByLabel("Hasil pengukuran", { exact: true }).fill("95");
  await page
    .getByRole("combobox", { name: /Kondisi pengukuran/ })
    .selectOption("random");
  await page
    .locator('textarea[name="note"]')
    .fill("Input tetap ada saat jaringan gagal.");
  const attemptedKeys: string[] = [];
  await page.route("**/api/glucose-entries", async (route) => {
    attemptedKeys.push(route.request().headers()["idempotency-key"]);
    if (attemptedKeys.length === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "SYNTHETIC_FAILURE",
            message: "Gangguan jaringan sintetis.",
          },
        }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Simpan catatan", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Gangguan jaringan sintetis",
  );
  await expect(
    page.getByLabel("Hasil pengukuran", { exact: true }),
  ).toHaveValue("95");
  await expect(page.locator('textarea[name="note"]')).toHaveValue(
    "Input tetap ada saat jaringan gagal.",
  );
  await page
    .getByRole("button", { name: "Simpan catatan", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Catatan berhasil disimpan" }),
  ).toBeVisible();
  expect(attemptedKeys).toHaveLength(2);
  expect(attemptedKeys[0]).toBe(attemptedKeys[1]);
});

test("public legal versions, untrusted cookie and expired session states", async ({
  page,
}) => {
  await page.context().addCookies([
    {
      name: "glubee_privacy",
      value: "forged-receipt",
      url: process.env.NEXT_PUBLIC_APP_URL!,
    },
  ]);
  await page.goto("/login?authError=invalid_link");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Tautan tidak valid",
  );
  await expect(
    page.getByRole("region", { name: "Pilihan cookie" }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/consents/cookie")).json()).data
      .current,
  ).toBe(false);
  await page.goto("/terms");
  await expect(page.locator("main")).toContainText(
    "PT Webekspres Teknologi Indonesia",
  );
  await expect(page.locator("main")).toContainText("0.2-draft");
  await page.goto("/terms?version=0.1-draft");
  await expect(page.locator("main")).toContainText("0.1-draft");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?expired=1/);
  await expect(
    page.getByText("Silakan masuk untuk melanjutkan.", { exact: true }),
  ).toBeVisible();
});
