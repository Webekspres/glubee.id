import { describe, expect, test } from "bun:test";
import { isAdult, validateProfile } from "./profile";

describe("profile validation", () => {
  const now = new Date("2026-09-09T12:00:00Z");

  test("accepts an eighteenth birthday and rejects one day younger", () => {
    expect(isAdult("2008-09-09", now)).toBe(true);
    expect(isAdult("2008-09-10", now)).toBe(false);
    expect(isAdult("2008-09-09", new Date("2026-09-08T18:00:00Z"))).toBe(true);
  });

  test("only accepts the three Indonesian timezone codes", () => {
    expect(validateProfile({ name: "Ayu", birthDate: "1990-01-01", sex: "female", timezoneCode: "WIT" }, now).data).not.toBeNull();
    expect(validateProfile({ name: "Ayu", birthDate: "1990-01-01", sex: "female", timezoneCode: "UTC" }, now).errors.timezoneCode).toBeDefined();
  });
});
