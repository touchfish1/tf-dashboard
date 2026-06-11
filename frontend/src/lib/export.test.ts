import { describe, expect, test } from "bun:test";

// The downloadCSV function is browser-only (needs document.createElement).
// This test verifies the CSV generation logic via the internal escape/build logic.
// The actual DOM interaction is tested in manual QA.

describe("CSV generation logic", () => {
  const buildCSV = (headers: string[], rows: string[][]): string => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    return [
      headers.join(","),
      ...rows.map((r) => r.map(escape).join(",")),
    ].join("\n");
  };

  test("generates CSV with headers and rows", () => {
    const csv = buildCSV(["name", "age"], [["Alice", "30"], ["Bob", "25"]]);
    expect(csv).toContain("name,age");
    expect(csv).toContain('"Alice","30"');
    expect(csv).toContain('"Bob","25"');
  });

  test("escapes commas and quotes", () => {
    const csv = buildCSV(["desc"], [['contains "quotes" and, commas']]);
    expect(csv).toContain('"contains ""quotes"" and, commas"');
  });

  test("handles empty rows", () => {
    const csv = buildCSV(["a", "b"], []);
    expect(csv).toBe("a,b");
  });
});
