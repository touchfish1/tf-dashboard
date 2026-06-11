import { describe, expect, test } from "bun:test";

// Replicate the linear regression helper from routes/opencode.ts
function linreg(values: number[]) {
  const n = values.length;
  if (n < 3) return { slope: 0, intercept: values[0] || 0, next: (steps: number) => values[0] || 0 };

  const indices = Array.from({ length: n }, (_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((a, _, i) => a + i * values[i], 0);
  const sumX2 = indices.reduce((a, _, i) => a + i * i, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return {
    slope,
    intercept,
    next: (steps: number) => Math.max(0, intercept + slope * (n - 1 + steps)),
  };
}

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
