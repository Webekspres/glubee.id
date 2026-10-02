import { expect, test } from "bun:test";
import { deletionSchedule } from "./deletion";

test("deletion date is shown in the user's zone and in UTC", () => {
  const s = deletionSchedule("2026-10-04T09:40:00Z", "WITA");
  expect(s.local).toBe("Minggu, 4 Oktober 2026 pukul 17.40 WITA");
  expect(s.utc).toBe("4 Oktober 2026 pukul 09.40 UTC");
});

test("zones that cross midnight show the local date", () => {
  expect(deletionSchedule("2026-10-04T20:30:00Z", "WIT").local).toBe("Senin, 5 Oktober 2026 pukul 05.30 WIT");
});
