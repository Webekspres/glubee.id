import { expect, test } from "bun:test";
import { REMEMBER_MAX_AGE, sessionCookieOptions } from "./session";

const base: { path: string; httpOnly: boolean; maxAge?: number; expires?: Date } = {
  path: "/",
  httpOnly: true,
  maxAge: 400 * 86400,
};

test("without remember-me the auth cookie lives only until the browser closes", () => {
  const o = sessionCookieOptions(base, false, "token");
  expect(o.maxAge).toBeUndefined();
  expect(o.expires).toBeUndefined();
  expect(o.httpOnly).toBe(true);
});

test("with remember-me the auth cookie lasts 30 days", () => {
  expect(sessionCookieOptions(base, true, "token").maxAge).toBe(REMEMBER_MAX_AGE);
  expect(REMEMBER_MAX_AGE).toBe(30 * 24 * 60 * 60);
});

test("cookie deletion is never turned into a session cookie", () => {
  expect(sessionCookieOptions({ ...base, maxAge: 0 }, false, "").maxAge).toBe(0);
  expect(sessionCookieOptions({ ...base, maxAge: 0 }, true, "").maxAge).toBe(0);
});
