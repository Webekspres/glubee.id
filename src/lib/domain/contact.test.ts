import { describe, expect, test } from "bun:test";
import {
  contactErrorMessage,
  contactSettings,
  hashInviteToken,
  inviteExpiresText,
  newInviteToken,
  validateContactInput,
  validToken,
} from "./contact";

describe("contact input", () => {
  test("normalizes; share consent only counts when explicitly true", () => {
    expect(validateContactInput({ name: " Andi ", email: " Andi@X.Test ", shareAccepted: true })).toEqual({
      data: { name: "Andi", email: "andi@x.test", shareAccepted: true },
    });
    expect(validateContactInput({ name: "Andi", email: "andi@x.test", shareAccepted: "true" }).data?.shareAccepted).toBe(false);
  });
  test("rejects bad email, empty name and own email", () => {
    expect(validateContactInput({ name: "", email: "x", shareAccepted: true }).errors).toMatchObject({ name: expect.any(String), email: expect.any(String) });
    expect(validateContactInput({ name: "A", email: "Me@x.test", shareAccepted: true }, "me@x.test").errors?.email).toContain("bukan email Anda");
  });
});

describe("invite token", () => {
  test("random, url-safe, stored only as hash", () => {
    const a = newInviteToken(), b = newInviteToken();
    expect(validToken(a.token)).toBe(true);
    expect(a.token).not.toBe(b.token);
    expect(a.hash.equals(hashInviteToken(a.token))).toBe(true);
    expect(a.hash).toHaveLength(32);
    expect(validToken("abc")).toBe(false);
    expect(validToken(a.token + "!")).toBe(false);
  });
});

describe("contact misc", () => {
  test("flag off by default", () => {
    expect(contactSettings({}).enabled).toBe(false);
    expect(contactSettings({ CONTACT_INVITES_ENABLED: "true" }).enabled).toBe(true);
  });
  test("database errors map to Indonesian messages", () => {
    expect(contactErrorMessage('new row ... "emergency_contact_limit_reached"')).toContain("Maksimal dua");
    expect(contactErrorMessage("boom")).toBe("Undangan belum dapat diproses.");
  });
  test("expiry text in the inviter's zone", () => {
    expect(inviteExpiresText(new Date("2026-10-16T03:00:00Z"), "WIB")).toBe("Jumat, 16 Oktober 2026 pukul 10.00 WIB");
    expect(inviteExpiresText(new Date("2026-10-16T03:00:00Z"), "WIT")).toBe("Jumat, 16 Oktober 2026 pukul 12.00 WIT");
  });
});
