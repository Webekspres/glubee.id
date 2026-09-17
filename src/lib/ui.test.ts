import { expect, test } from "bun:test";
import { localInput, localToUtc } from "./ui";
test("date/time input round trips in all Indonesian zones regardless of device timezone", () => {
  for (const [zone, hour] of [
    ["WIB", 17],
    ["WITA", 16],
    ["WIT", 15],
  ] as const) {
    const iso = "2026-09-14T" + hour + ":30:00.000Z";
    expect(localToUtc("2026-09-15T00:30", zone)).toBe(iso);
    expect(localInput(new Date(iso), zone)).toBe("2026-09-15T00:30");
  }
  expect(localToUtc("2026-02-30T00:30", "WIB")).toBeNull();
  expect(localToUtc("invalid", "WIB")).toBeNull();
});
