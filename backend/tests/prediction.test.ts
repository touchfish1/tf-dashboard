import { describe, expect, test } from "bun:test";
import { linreg } from "../src/routes/opencode";

describe("linreg (linear regression)", () => {
  test("returns zero slope for constant values", () => {
    const r = linreg([5, 5, 5, 5, 5]);
    expect(r.slope).toBeCloseTo(0, 5);
    expect(r.next(1)).toBeCloseTo(5, 5);
    expect(r.next(7)).toBeCloseTo(5, 5);
  });

  test("detects upward trend", () => {
    const r = linreg([1, 2, 3, 4, 5]);
    expect(r.slope).toBeCloseTo(1, 2);
    expect(r.next(1)).toBeCloseTo(6, 2);
  });

  test("detects downward trend", () => {
    const r = linreg([10, 8, 6, 4, 2]);
    expect(r.slope).toBeCloseTo(-2, 2);
    expect(r.next(1)).toBe(0); // clamped to 0
  });

  test("handles 0-2 values (insufficient data)", () => {
    expect(linreg([]).slope).toBe(0);
    expect(linreg([42]).next(5)).toBe(42);
    expect(linreg([10, 20]).next(1)).toBe(10);
  });

  test("predicts multiple steps", () => {
    const r = linreg([100, 200, 300]);
    expect(r.next(7)).toBe(1000); // slope=100, intercept=100, n=3: 100 + 100*(2+7)=1000
  });
});
