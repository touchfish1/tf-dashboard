import { describe, expect, test } from "bun:test";
import {
  CreateServerBody, UpdateServerBody,
  CreateLinkBody, UpdateLinkBody,
  SettingValue,
  IdParam, DaysQuery, LimitQuery,
  DeepSeekHistoryQuery,
  formatZodError,
} from "../src/lib/validation";

describe("IdParam", () => {
  test("parses valid positive integer", () => {
    expect(IdParam.parse("1")).toBe(1);
    expect(IdParam.parse("999")).toBe(999);
  });

  test("rejects non-numeric", () => {
    expect(() => IdParam.parse("abc")).toThrow();
    expect(() => IdParam.parse("")).toThrow();
  });

  test("rejects zero and negative", () => {
    expect(() => IdParam.parse("0")).toThrow();
    expect(() => IdParam.parse("-1")).toThrow();
  });
});

describe("DaysQuery", () => {
  test("defaults to 7", () => {
    expect(DaysQuery.parse(undefined as any)).toBe(7);
  });

  test("parses valid days", () => {
    expect(DaysQuery.parse("1")).toBe(1);
    expect(DaysQuery.parse("30")).toBe(30);
    expect(DaysQuery.parse("365")).toBe(365);
  });

  test("rejects out of range", () => {
    expect(() => DaysQuery.parse("0")).toThrow();
    expect(() => DaysQuery.parse("366")).toThrow();
    expect(() => DaysQuery.parse("-1")).toThrow();
  });
});

describe("LimitQuery", () => {
  test("defaults to 100", () => {
    expect(LimitQuery.parse(undefined as any)).toBe(100);
  });

  test("parses valid limits", () => {
    expect(LimitQuery.parse("50")).toBe(50);
    expect(LimitQuery.parse("500")).toBe(500);
  });

  test("rejects zero and excessive", () => {
    expect(() => LimitQuery.parse("0")).toThrow();
    expect(() => LimitQuery.parse("2001")).toThrow();
  });
});

describe("CreateServerBody", () => {
  test("accepts valid server", () => {
    const result = CreateServerBody.parse({
      name: "my-server",
      metricsUrl: "http://localhost:9100/metrics",
    });
    expect(result.name).toBe("my-server");
    expect(result.labels).toBeUndefined();
  });

  test("accepts server with labels", () => {
    const result = CreateServerBody.parse({
      name: "prod-db",
      metricsUrl: "http://10.0.0.1:9100/metrics",
      labels: ["prod", "db"],
    });
    expect(result.labels).toEqual(["prod", "db"]);
  });

  test("rejects empty name", () => {
    expect(() =>
      CreateServerBody.parse({ name: "", metricsUrl: "http://x.com" })
    ).toThrow();
  });

  test("rejects invalid URL", () => {
    expect(() =>
      CreateServerBody.parse({ name: "test", metricsUrl: "not-a-url" })
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() => CreateServerBody.parse({})).toThrow();
    expect(() => CreateServerBody.parse({ name: "x" })).toThrow();
  });
});

describe("UpdateServerBody", () => {
  test("accepts partial update", () => {
    const result = UpdateServerBody.parse({ name: "new-name" });
    expect(result.name).toBe("new-name");
  });

  test("accepts empty object (no fields to update)", () => {
    const result = UpdateServerBody.parse({});
    expect(Object.keys(result).length).toBe(0);
  });

  test("rejects invalid URL in update", () => {
    expect(() =>
      UpdateServerBody.parse({ metricsUrl: "bad" })
    ).toThrow();
  });
});

describe("CreateLinkBody", () => {
  test("accepts valid link", () => {
    const result = CreateLinkBody.parse({
      title: "DeepSeek",
      url: "https://chat.deepseek.com",
    });
    expect(result.title).toBe("DeepSeek");
  });

  test("rejects empty title", () => {
    expect(() =>
      CreateLinkBody.parse({ title: "", url: "https://x.com" })
    ).toThrow();
  });

  test("rejects invalid URL", () => {
    expect(() =>
      CreateLinkBody.parse({ title: "test", url: "not-a-url" })
    ).toThrow();
  });
});

describe("SettingValue", () => {
  test("accepts string value", () => {
    expect(SettingValue.parse({ value: "hello" }).value).toBe("hello");
  });

  test("rejects missing value", () => {
    expect(() => SettingValue.parse({})).toThrow();
  });
});

describe("DeepSeekHistoryQuery", () => {
  test("parses with default", () => {
    expect(DeepSeekHistoryQuery.parse({}).days).toBe(7);
  });

  test("parses custom days", () => {
    expect(DeepSeekHistoryQuery.parse({ days: "14" }).days).toBe(14);
  });
});

describe("formatZodError", () => {
  test("formats Zod errors concisely", () => {
    try {
      CreateServerBody.parse({ name: "", metricsUrl: "bad" });
    } catch (e) {
      const msg = formatZodError(e);
      expect(msg).toContain("Too small");
      expect(msg).toContain("Invalid URL");
      expect(msg).not.toContain("[");
    }
  });
});
