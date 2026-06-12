import { describe, it, expect, afterEach } from "bun:test";
import {
  createPoller,
  markPollerStart,
  markPollerSuccess,
  markPollerError,
  getAllPollerStatus,
  clearPollerHealth,
} from "../src/lib/poller-health";

describe("poller-health", () => {
  afterEach(() => {
    clearPollerHealth();
  });

  it("should create a poller with initial state", () => {
    createPoller("test-poller");
    const status = getAllPollerStatus();
    expect(status).toHaveLength(1);
    expect(status[0].name).toBe("test-poller");
    expect(status[0].runCount).toBe(0);
    expect(status[0].errorCount).toBe(0);
    expect(status[0].isRunning).toBe(false);
  });

  it("should track start", () => {
    createPoller("test");
    markPollerStart("test");
    const s = getAllPollerStatus()[0];
    expect(s.isRunning).toBe(true);
    expect(s.runCount).toBe(1);
    expect(s.lastRunAt).not.toBeNull();
  });

  it("should track success", () => {
    createPoller("test");
    markPollerStart("test");
    markPollerSuccess("test");
    const s = getAllPollerStatus()[0];
    expect(s.isRunning).toBe(false);
    expect(s.lastError).toBeNull();
    expect(s.lastSuccessAt).not.toBeNull();
  });

  it("should track error", () => {
    createPoller("test");
    markPollerStart("test");
    markPollerError("test", "connection refused");
    const s = getAllPollerStatus()[0];
    expect(s.isRunning).toBe(false);
    expect(s.lastError).toBe("connection refused");
    expect(s.errorCount).toBe(1);
  });

  it("should handle unknown poller gracefully", () => {
    // Should not throw
    markPollerStart("nonexistent");
    markPollerSuccess("nonexistent");
    markPollerError("nonexistent", "err");
  });
});
