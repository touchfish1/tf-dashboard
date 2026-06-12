import { describe, expect, test } from "bun:test";
import { buildCSV } from "./export";

describe("CSV generation logic", () => {
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
