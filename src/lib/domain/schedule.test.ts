import { describe, expect, test } from "bun:test";
import { scheduleErrorMessage, todayIn, validateScheduleInput, weekDays, weekStart } from "./schedule";

const base = { category: "medicine", title: " Minum obat ", localDate: "2026-10-08", localTime: "07:30" };

describe("validateScheduleInput", () => {
  test("accepts free-text medicine and dose for medicine", () => {
    const r = validateScheduleInput({ ...base, medicineName: " Metformin ", doseNote: "1 tablet" });
    expect(r.data).toEqual({
      category: "medicine",
      title: "Minum obat",
      localDate: "2026-10-08",
      localTime: "07:30",
      medicineName: "Metformin",
      doseNote: "1 tablet",
    });
  });

  test("drops medicine fields for other categories", () => {
    const r = validateScheduleInput({ ...base, category: "glucose_check", medicineName: "x", doseNote: "y" });
    expect(r.data?.medicineName).toBeNull();
    expect(r.data?.doseNote).toBeNull();
  });

  test("rejects bad category, blank title, impossible date and time", () => {
    const r = validateScheduleInput({ category: "vitamin", title: "  ", localDate: "2026-02-30", localTime: "24:00" });
    expect(r.data).toBeNull();
    expect(Object.keys(r.errors).sort()).toEqual(["category", "localDate", "localTime", "title"]);
  });

  test("limits lengths", () => {
    const r = validateScheduleInput({ ...base, title: "a".repeat(121), doseNote: "b".repeat(201) });
    expect(Object.keys(r.errors).sort()).toEqual(["doseNote", "title"]);
  });
});

describe("week helpers", () => {
  test("week starts on Monday", () => {
    expect(weekStart("2026-10-06")).toBe("2026-10-05"); // Selasa
    expect(weekStart("2026-10-11")).toBe("2026-10-05"); // Minggu
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
    expect(weekDays("2026-10-05")).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });

  test("today follows the profile zone", () => {
    const now = new Date("2026-10-06T16:30:00Z"); // 23.30 WIB, 00.30 WITA, 01.30 WIT
    expect(todayIn("WIB", now)).toBe("2026-10-06");
    expect(todayIn("WITA", now)).toBe("2026-10-07");
    expect(todayIn("WIT", now)).toBe("2026-10-07");
  });

  test("maps database errors to user messages", () => {
    expect(scheduleErrorMessage("schedule_in_past")).toContain("setelah saat ini");
    expect(scheduleErrorMessage(undefined)).toBe("Jadwal belum dapat disimpan.");
  });
});
