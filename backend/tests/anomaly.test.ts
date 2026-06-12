import { describe, it, expect } from "bun:test";
import { detectAnomaly } from "../src/routes/opencode";

describe("Anomaly Detection Logic", () => {
  it("detects normal cost when ratio <= 1.5", () => {
    const { ratio, status } = detectAnomaly(1.0, 1.0);
    expect(status).toBe("normal");
    expect(ratio).toBe(1.0);
  });

  it("detects elevated cost when ratio between 1.5 and 2", () => {
    const { ratio, status } = detectAnomaly(1.8, 1.0);
    expect(status).toBe("elevated");
    expect(ratio).toBe(1.8);
  });

  it("detects anomaly when ratio > 2", () => {
    const { ratio, status } = detectAnomaly(3.0, 1.0);
    expect(status).toBe("anomaly");
    expect(ratio).toBe(3.0);
  });

  it("handles zero average cost gracefully", () => {
    const { ratio } = detectAnomaly(1.0, 0);
    expect(ratio).toBe(0);
  });

  it("triggers alert threshold correctly", () => {
    const { ratio } = detectAnomaly(2.01, 1.0);
    expect(ratio > 2).toBe(true);
  });
});
