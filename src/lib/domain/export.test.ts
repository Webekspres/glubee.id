import { expect, test } from "bun:test";
import { exportFileName, reauthMethod, RECENT_LOGIN_MS } from "./export";

const now = new Date("2026-10-02T03:00:00Z");

test("email accounts confirm with their password", () => {
  expect(reauthMethod({ providers: ["email"], lastSignInAt: now.toISOString() }, now)).toBe("password");
  expect(reauthMethod({ providers: ["email", "google"], lastSignInAt: null }, now)).toBe("password");
});

test("google-only accounts need a sign-in within the last 10 minutes", () => {
  const recent = new Date(now.valueOf() - RECENT_LOGIN_MS + 1000).toISOString();
  const stale = new Date(now.valueOf() - RECENT_LOGIN_MS - 1000).toISOString();
  expect(reauthMethod({ providers: ["google"], lastSignInAt: recent }, now)).toBe("recent_login");
  expect(reauthMethod({ providers: ["google"], lastSignInAt: stale }, now)).toBe("relogin_required");
  expect(reauthMethod({ providers: ["google"], lastSignInAt: null }, now)).toBe("relogin_required");
});

test("file name carries the local date in the user's zone", () => {
  expect(exportFileName(new Date("2026-10-01T18:30:00Z"), "WIB")).toBe("glubee-data-2026-10-02.json");
  expect(exportFileName(new Date("2026-10-01T16:30:00Z"), "WIB")).toBe("glubee-data-2026-10-01.json");
});
