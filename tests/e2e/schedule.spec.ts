import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// GLB-018 / FR-SCHEDULE-001: buat, ubah, jeda, aktifkan, hapus jadwal mendatang; kalender mingguan.

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function activeUser(page: Page, tag: string) {
  const email = `jadwal-${tag}-${Date.now()}@example.test`;
  const password = "Synthetic-schedule-9!" + Date.now();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.request.post("/api/auth/login", { data: { email, password } });
  for (const consentType of ["age_and_region", "legal_documents", "health_data"])
    await page.request.post("/api/consents", { data: { consentType, decision: "accept", method: "onboarding" } });
  await page.request.patch("/api/profile", {
    data: { name: "Uji Jadwal", birthDate: "1968-04-04", sex: "female", timezoneCode: "WITA" },
  });
}

const witaDate = (days: number) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Makassar" }).format(new Date(Date.now() + days * 864e5));

test("user manages upcoming schedules on the weekly calendar", async ({ page, browser }) => {
  await activeUser(page, "pemilik");
  await page.goto("/schedule");
  await expect(page.getByRole("heading", { level: 1, name: "Jadwal" })).toBeVisible();
  await expect(page).toHaveTitle("Jadwal · Glubee");
  await expect(page.getByText("Belum ada jadwal minggu ini")).toBeVisible();

  // Buat jadwal obat besok 08.15 WITA.
  await page.getByRole("button", { name: "+ Tambah jadwal" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Obat", exact: true }).check();
  await dialog.getByLabel("Nama kegiatan").fill("Obat pagi");
  await dialog.getByLabel(/Nama obat/).fill("Metformin 500");
  await dialog.getByLabel(/Dosis atau catatan/).fill("1 tablet sesudah makan");
  await dialog.getByLabel("Tanggal").fill(witaDate(1));
  await dialog.getByLabel("Jam (WITA)").fill("08:15");
  await dialog.getByRole("button", { name: "Simpan jadwal" }).click();
  await expect(dialog).toBeHidden();
  const item = page.locator(".schedule-item", { hasText: "Obat pagi" });
  await expect(item).toContainText("08.15 WITA");
  await expect(item).toContainText("Metformin 500 · 1 tablet sesudah makan");
  await expect(page.getByRole("button", { name: /Sudah dilakukan/ })).toHaveCount(0);

  // Ubah menjadi insulin 21.00.
  await item.getByRole("button", { name: "Ubah Obat pagi" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "Insulin", exact: true }).check();
  await dialog.getByLabel("Nama kegiatan").fill("Insulin malam");
  await dialog.getByLabel("Jam (WITA)").fill("21:00");
  await dialog.getByRole("button", { name: "Simpan perubahan" }).click();
  await expect(dialog).toBeHidden();
  const edited = page.locator(".schedule-item", { hasText: "Insulin malam" });
  await expect(edited).toContainText("21.00 WITA");

  // Jeda lalu aktifkan lagi.
  await edited.getByRole("button", { name: "Jeda Insulin malam" }).click();
  await expect(edited).toContainText("Dijeda");
  await edited.getByRole("button", { name: "Aktifkan Insulin malam" }).click();
  await expect(edited).not.toContainText("Dijeda");

  // Jadwal minggu depan: kalender pindah ke minggu itu, lalu kembali.
  await page.getByRole("button", { name: "+ Tambah jadwal" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nama kegiatan").fill("Cek gula puasa");
  await dialog.getByLabel("Tanggal").fill(witaDate(8));
  await dialog.getByLabel("Jam (WITA)").fill("06:00");
  await dialog.getByRole("button", { name: "Simpan jadwal" }).click();
  await expect(page.locator(".schedule-item", { hasText: "Cek gula puasa" })).toContainText("Pemeriksaan gula darah");
  await page.getByRole("button", { name: "Kembali ke minggu ini" }).click();
  await expect(page.locator(".schedule-item", { hasText: "Insulin malam" })).toBeVisible();

  // Hapus dengan konfirmasi.
  await page.getByRole("button", { name: "Hapus Insulin malam" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Hapus jadwal" }).click();
  await expect(page.locator(".schedule-item", { hasText: "Insulin malam" })).toHaveCount(0);

  // Waktu yang sudah lewat ditolak server.
  const past = await page.request.post("/api/schedules", {
    headers: { "Idempotency-Key": crypto.randomUUID() },
    data: { category: "other", title: "Kemarin", localDate: witaDate(-1), localTime: "08:00" },
  });
  expect(past.status()).toBe(400);
  expect((await past.json()).error.message).toContain("setelah saat ini");

  // Pengguna lain tidak melihat jadwal ini; tanpa sesi ditolak.
  const other = await browser.newPage();
  await activeUser(other, "lain");
  const theirs = await other.request.get(`/api/schedules?week=${witaDate(8)}`);
  expect((await theirs.json()).data).toEqual([]);
  await other.close();
  const anon = await browser.newContext();
  expect((await anon.request.get("/api/schedules")).status()).toBe(401);
  await anon.close();

  // Ponsel: Jadwal ada di bar bawah, Laporan pindah ke Riwayat.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/history");
  const bar = page.getByRole("navigation", { name: "Navigasi Bawah" });
  await expect(bar.getByRole("link", { name: "Jadwal" })).toBeVisible();
  await expect(bar.getByRole("link", { name: "Laporan" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Unduh laporan" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
