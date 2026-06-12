import { describe, it, expect } from "bun:test";
import { isValidMetricsUrl } from "../src/pollers/servers";

describe("SSRF Protection", () => {
  it("allows valid http URLs", () => {
    expect(isValidMetricsUrl("http://192.168.1.1:9100/metrics")).toBe(true);
  });

  it("allows valid https URLs", () => {
    expect(isValidMetricsUrl("https://monitor.example.com/metrics")).toBe(true);
  });

  it("blocks non-http protocols", () => {
    expect(isValidMetricsUrl("file:///etc/passwd")).toBe(false);
    expect(isValidMetricsUrl("ftp://10.0.0.1/file")).toBe(false);
    expect(isValidMetricsUrl("gopher://internal:8080/")).toBe(false);
  });

  it("blocks AWS metadata IP", () => {
    expect(isValidMetricsUrl("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("blocks invalid URLs", () => {
    expect(isValidMetricsUrl("not-a-url")).toBe(false);
    expect(isValidMetricsUrl("")).toBe(false);
  });

  it("allows localhost for admin-configured agents", () => {
    expect(isValidMetricsUrl("http://localhost:9100/metrics")).toBe(true);
    expect(isValidMetricsUrl("http://127.0.0.1:9100/metrics")).toBe(true);
  });
});
