import { describe, expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { createReport, type ReportEntry } from "./pdf-report";
import type { Profile } from "./ui";

const profile = { name: "Ibu Uji", birth_date: "1960-08-17", sex: "female", timezone_code: "WITA" } as Profile;
const range = { from: "2026-09-30T16:00:00Z", toExclusive: "2026-10-07T16:00:00Z" };
const entry = (i: number, ctx: ReportEntry["measurement_context"], note: string | null = null) =>
  ({
    id: String(i),
    original_value: 100 + i,
    original_unit: "mg/dL",
    normalized_mg_dl: 100 + i,
    measurement_context: ctx,
    measured_at: new Date(Date.parse("2026-10-01T00:00:00Z") + i * 36e5).toISOString(),
    note,
  }) as ReportEntry;

describe("createReport (GLB-048)", () => {
  test("empty period still produces a titled one-page report", async () => {
    const pdf = await PDFDocument.load(await createReport(profile, [], range));
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe("Laporan Pemantauan Gula Darah");
  });
  test("many entries with every context and long notes paginate", async () => {
    const ctx = ["fasting", "before_meal", "after_meal", "random", "other"] as const;
    const entries = Array.from({ length: 150 }, (_, i) => entry(i, ctx[i % 5], i % 10 ? null : "catatan panjang ".repeat(40)));
    const pdf = await PDFDocument.load(await createReport(profile, entries.reverse(), range));
    expect(pdf.getPageCount()).toBeGreaterThan(3);
  });
  test("a single entry draws without a time span", async () => {
    const pdf = await PDFDocument.load(await createReport(profile, [entry(1, "fasting")], range));
    expect(pdf.getPageCount()).toBe(1);
  });
  test("characters outside the font are rejected", async () => {
    expect(createReport({ ...profile, name: "测试" }, [], range)).rejects.toThrow("UNSUPPORTED_REPORT_CHARACTER");
  });
});
