import { describe, it, expect, afterEach } from "bun:test";
import { subscribe, emit, clearSubscribers } from "../src/lib/event-bus";

describe("event-bus", () => {
  afterEach(() => {
    clearSubscribers();
  });

  it("should deliver event to subscriber", () => {
    return new Promise<void>((done) => {
      subscribe((event) => {
        expect(event).toEqual({
          type: "deepseek_balance",
          balanceTotal: 100,
          balanceGranted: 50,
          balanceToppedUp: 50,
        });
        done();
      });
      emit({
        type: "deepseek_balance",
        balanceTotal: 100,
        balanceGranted: 50,
        balanceToppedUp: 50,
      });
    });
  });

  it("should deliver to multiple subscribers", () => {
    let count = 0;
    const unsub1 = subscribe(() => {
      count++;
    });
    const unsub2 = subscribe(() => {
      count++;
    });
    emit({ type: "server_offline", serverId: 1, serverName: "test" });
    expect(count).toBe(2);
    unsub1();
    unsub2();
  });

  it("should not deliver to unsubscribed handlers", () => {
    let count = 0;
    const unsub = subscribe(() => {
      count++;
    });
    unsub();
    emit({ type: "server_offline", serverId: 1, serverName: "test" });
    expect(count).toBe(0);
  });

  it("should clear all subscribers", () => {
    let count = 0;
    subscribe(() => {
      count++;
    });
    subscribe(() => {
      count++;
    });
    clearSubscribers();
    emit({ type: "server_offline", serverId: 1, serverName: "test" });
    expect(count).toBe(0);
  });
});
