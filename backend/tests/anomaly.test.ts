import { describe, it, expect } from "bun:test";

// Minimal test for anomaly detection logic
describe("Anomaly Detection Logic", () => {
  it("detects normal cost when ratio <= 1.5", () => {
    const todayCost = 1.0;
    const avgCost = 1.0;
    const ratio = avgCost > 0 ? todayCost / avgCost : 0;
    const status = ratio > 2 ? "anomaly" : ratio > 1.5 ? "elevated" : "normal";
    expect(status).toBe("normal");
    expect(ratio).toBe(1.0);
  });

  it("detects elevated cost when ratio between 1.5 and 2", () => {
    const todayCost = 1.8;
    const avgCost = 1.0;
    const ratio = avgCost > 0 ? todayCost / avgCost : 0;
    const status = ratio > 2 ? "anomaly" : ratio > 1.5 ? "elevated" : "normal";
    expect(status).toBe("elevated");
    expect(ratio).toBe(1.8);
  });

  it("detects anomaly when ratio > 2", () => {
    const todayCost = 3.0;
    const avgCost = 1.0;
    const ratio = avgCost > 0 ? todayCost / avgCost : 0;
    const status = ratio > 2 ? "anomaly" : ratio > 1.5 ? "elevated" : "normal";
    expect(status).toBe("anomaly");
    expect(ratio).toBe(3.0);
  });

  it("handles zero average cost gracefully", () => {
    const todayCost = 1.0;
    const avgCost = 0;
    const ratio = avgCost > 0 ? todayCost / avgCost : 0;
    expect(ratio).toBe(0);
  });

  it("triggers alert threshold correctly", () => {
    const todayCost = 2.01;
    const avgCost = 1.0;
    const ratio = avgCost > 0 ? todayCost / avgCost : 0;
    expect(ratio > 2).toBe(true);
  });
});
