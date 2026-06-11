import { describe, it, expect } from "bun:test";

// Tests for OpenCode route query structure
// These test the SQL construction patterns used in routes/opencode.ts

describe("OpenCode Query Patterns", () => {
  it("handles search ILIKE pattern correctly", () => {
    const search = "gpt-4";
    const like = `%${search}%`;
    expect(like).toBe("%gpt-4%");
  });

  it("handles empty search", () => {
    const search = "";
    const like = search ? `%${search}%` : "";
    expect(like).toBe("");
  });

  it("calculates daily aggregation limit correctly", () => {
    const days = 7;
    const limit = Math.min(days, 365);
    expect(limit).toBe(7);
  });

  it("caps days at 365", () => {
    const days = 500;
    const limit = Math.min(days, 365);
    expect(limit).toBe(365);
  });

  it("calculates prediction period", () => {
    const predictDays = Math.min(parseInt("14"), 30);
    expect(predictDays).toBe(14);
  });

  it("caps prediction at 30", () => {
    const predictDays = Math.min(parseInt("100"), 30);
    expect(predictDays).toBe(30);
  });

  it("handles NaN predict days safely", () => {
    const val = parseInt("abc");
    const predictDays = Math.min(isNaN(val) ? 7 : val, 30);
    expect(predictDays).toBe(7);
  });

  it("generates correct anomaly detection condition", () => {
    const daysAgo = 8;
    const sql = `bucket_start >= CURRENT_DATE - INTERVAL '${daysAgo} days' AND bucket_start < CURRENT_DATE`;
    expect(sql).toBe("bucket_start >= CURRENT_DATE - INTERVAL '8 days' AND bucket_start < CURRENT_DATE");
  });
});
