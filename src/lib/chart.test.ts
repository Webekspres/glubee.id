import { describe, expect, test } from "bun:test";
import { valueAxis, timeTicks } from "./chart";

describe("valueAxis", () => {
  test("zooms to the data range instead of starting at zero", () => {
    const a = valueAxis([85, 164]);
    expect(a.min).toBeGreaterThan(0);
    expect(a.min).toBeLessThanOrEqual(85);
    expect(a.max).toBeGreaterThanOrEqual(164);
    expect(a.ticks[0]).toBe(a.min);
    expect(a.ticks.at(-1)).toBe(a.max);
    expect(a.ticks.length).toBeGreaterThanOrEqual(3);
    expect(a.ticks.length).toBeLessThanOrEqual(7);
  });
  test("uses round step values", () => {
    for (const t of valueAxis([85, 164]).ticks) expect(t % 10).toBe(0);
  });
  test("keeps a readable span for a single or flat value", () => {
    const a = valueAxis([100]);
    expect(a.min).toBeLessThan(100);
    expect(a.max).toBeGreaterThan(100);
  });
  test("never goes below zero", () => {
    expect(valueAxis([5, 12]).min).toBeGreaterThanOrEqual(0);
  });
});

describe("timeTicks", () => {
  test("spreads the requested number of ticks from start to end", () => {
    const t = timeTicks(0, 1000, 5);
    expect(t).toEqual([0, 250, 500, 750, 1000]);
  });
  test("returns one tick when the range is empty", () => {
    expect(timeTicks(42, 42, 5)).toEqual([42]);
  });
});
