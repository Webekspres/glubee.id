import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// GLB-021 / FR-CONTACT-001: undang kontak dari profil, kontak menerima/menolak tanpa akun.
// Butuh CONTACT_INVITES_ENABLED=true dan DATA_ENCRYPTION_KEY di .env.local (lokal saja).

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

async function activeUser(page: Page, tag: string) {
  const email = `undang-${tag}-${Date.now()}@example.test`;
  const password = "Synthetic-contact-9!" + Date.now();
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  await page.request.post("/api/auth/login", { data: { email, password } });
  for (const consentType of ["age_and_region", "legal_documents", "health_data"])
    await page.request.post("/api/consents", { data: { consentType, decision: "accept", method: "onboarding" } });
  await page.request.patch("/api/profile", {
    data: { name: "Ibu Wati", birthDate: "1962-03-03", sex: "female", timezoneCode: "WIB" },
  });
}

async function inviteLink(to: string) {
  let id = "";
  await expect
    .poll(async () => {
      const body = await (await fetch("http://127.0.0.1:54324/api/v1/search?query=" + encodeURIComponent("to:" + to))).json();
      id = body.messages?.[0]?.ID ?? "";
      return body.messages?.length ?? 0;
    })
    .toBe(1);
  const mail = await (await fetch("http://127.0.0.1:54324/api/v1/message/" + id)).json();
  expect(mail.Subject).toBe("Ibu Wati mengundang Anda sebagai kontak darurat di Glubee");
  expect(mail.HTML).not.toMatch(/mg\/dL/);
  return { url: mail.HTML.match(/href="([^"]*\/invite#[^"]+)"/)[1] as string };
}

test("user invites two contacts; one accepts, one declines, without accounts", async ({ page, browser }) => {
  await activeUser(page, "pemilik");
  await page.goto("/profile");
  const section = page.getByRole("region", { name: "Kontak darurat" });
  await expect(section.getByText("Belum ada kontak darurat.")).toBeVisible();
  await expect(section.getByText(/belum mengirim pemberitahuan apa pun/)).toBeVisible();

  const ts = Date.now();
  const andi = `andi-${ts}@example.test`, budi = `budi-${ts}@example.test`;
  for (const [name, email, first] of [["Andi", andi, true], ["Budi", budi, false]] as const) {
    await section.getByRole("button", { name: "+ Undang kontak darurat" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nama kontak").fill(name);
    await dialog.getByLabel("Email kontak").fill(email);
    const consent = dialog.getByRole("checkbox");
    // Persetujuan berbagi hanya diminta sekali.
    await expect(consent).toHaveCount(first ? 1 : 0);
    if (first) {
      await dialog.getByRole("button", { name: "Kirim undangan" }).click();
      await expect(dialog.getByText("Centang untuk melanjutkan.")).toBeVisible();
      await consent.check();
    }
    await dialog.getByRole("button", { name: "Kirim undangan" }).click();
    await expect(section.getByText(`Undangan dikirim ke ${email}`)).toBeVisible();
  }
  await expect(section.getByText("Menunggu jawaban")).toHaveCount(2);
  // Dua kontak menunggu: tombol undang hilang.
  await expect(section.getByRole("button", { name: "+ Undang kontak darurat" })).toHaveCount(0);

  // Email disimpan terenkripsi.
  const { data: rows } = await admin.from("emergency_contacts").select("email_ciphertext").eq("name", "Andi").order("created_at", { ascending: false }).limit(1);
  expect(Buffer.from(rows![0].email_ciphertext.slice(2), "hex").toString("latin1")).not.toContain(andi);

  // Kontak membuka tautan tanpa akun.
  const guest = await browser.newPage();
  const a = await inviteLink(andi);
  await guest.goto(a.url);
  await expect(guest.getByText("Ibu Wati mengundang Anda sebagai kontak darurat Glubee.")).toBeVisible();
  expect(guest.url()).not.toContain("#");
  await guest.getByRole("button", { name: "Terima undangan" }).click();
  await expect(guest.getByText("Anda kini kontak darurat Ibu Wati")).toBeVisible();
  // Tautan sekali pakai (about:blank dulu: dari /invite, navigasi hash saja tidak memuat ulang).
  await guest.goto("about:blank");
  await guest.goto(a.url);
  await expect(guest.getByText("Undangan ini sudah dijawab.")).toBeVisible();

  const b = await inviteLink(budi);
  await guest.goto("about:blank");
  await guest.goto(b.url);
  await guest.getByRole("button", { name: "Tolak" }).click();
  await expect(guest.getByText("Undangan ditolak.")).toBeVisible();
  await guest.close();

  await page.reload();
  await expect(section.getByText("Menerima")).toBeVisible();
  await expect(section.getByText("Menolak")).toBeVisible();

  // Kontak yang menolak tidak bisa diundang ulang.
  const again = await page.request.post("/api/emergency-contacts", { data: { name: "Budi", email: budi, shareAccepted: true } });
  expect(again.status()).toBe(400);
  expect((await again.json()).error.message).toContain("sudah menolak");
});

test("invalid or tampered tokens reveal nothing", async ({ page }) => {
  await page.goto("/invite#" + "A".repeat(43));
  await expect(page.getByText("Undangan tidak ditemukan.")).toBeVisible();
  const r = await page.request.post("/api/contact-invitations", { data: { token: "short" } });
  expect(r.status()).toBe(404);
});
