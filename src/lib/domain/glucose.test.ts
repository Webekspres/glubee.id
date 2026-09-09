import { describe, expect, test } from "bun:test";
import { decodeCursor, encodeCursor, glucoseSummary, resolveRange, toMgDl, validateGlucoseInput } from "./glucose";

describe("glucose domain", () => {
  test("converts mmol/L without changing the original value", () => {
    expect(toMgDl(5.5, "mmol/L")).toBe(99);
    expect(toMgDl(99, "mg/dL")).toBe(99);
  });

  test("rejects invalid and far-future measurements", () => {
    const result = validateGlucoseInput({
      originalValue: -1,
      originalUnit: "mg/dL",
      measurementContext: "random",
      measuredAt: "2026-09-09T12:06:00Z",
    }, new Date("2026-09-09T12:00:00Z"));
    expect(result.errors.originalValue).toBeDefined();
    expect(result.errors.measuredAt).toBeDefined();
  });

  test("uses local day boundaries for WIB, WITA, and WIT", () => {
    const params = new URLSearchParams({ from: "2026-09-09", to: "2026-09-09" });
    expect(resolveRange(params, "WIB")?.from).toBe("2026-09-08T17:00:00.000Z");
    expect(resolveRange(params, "WITA")?.from).toBe("2026-09-08T16:00:00.000Z");
    expect(resolveRange(params, "WIT")?.from).toBe("2026-09-08T15:00:00.000Z");
  });

  test("round-trips a pagination cursor", () => {
    const measuredAt = "2026-09-09T12:00:00.000Z";
    const id = "00000000-0000-4000-8000-000000000001";
    expect(decodeCursor(encodeCursor(measuredAt, id))).toEqual({ measuredAt, id });
  });

  test("rejects malformed date ranges without throwing", () => {
    expect(resolveRange(new URLSearchParams({ from: "2026-99-99", to: "2026-09-09" }), "WIB")).toBeNull();
  });

  test("returns null aggregates for an empty range", () => {
    expect(glucoseSummary([])).toEqual({ count: 0, minimumMgDl: null, maximumMgDl: null, averageMgDl: null, points: [] });
  });

  test("keeps original display data on graph points", () => {
    const summary = glucoseSummary([{
      normalized_mg_dl: 99,
      original_value: 5.5,
      original_unit: "mmol/L",
      measurement_context: "random",
      measured_at: "2026-09-09T12:00:00Z",
    }]);
    expect(summary.points[0]).toMatchObject({ originalValue: 5.5, originalUnit: "mmol/L", measurementContext: "random" });
  });
});
