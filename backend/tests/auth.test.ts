import { describe, it, expect } from "bun:test";
import { hashPassword, verifyPassword, signAccessToken, verifyAccessToken, generateRefreshToken, hashToken } from "../src/lib/auth";

describe("auth", () => {
  describe("password hashing", () => {
    it("should hash and verify password", async () => {
      const password = "test-password-123";
      const hash = await hashPassword(password);
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);

      const valid = await verifyPassword(password, hash);
      expect(valid).toBe(true);
    });

    it("should reject wrong password", async () => {
      const hash = await hashPassword("correct-password");
      const valid = await verifyPassword("wrong-password", hash);
      expect(valid).toBe(false);
    });

    it("should produce different hashes for same password", async () => {
      const password = "same-password";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("JWT tokens", () => {
    it("should sign and verify access token", async () => {
      const payload = { userId: 1, role: "admin", email: "admin@test.com" };
      const token = await signAccessToken(payload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");

      const decoded = await verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(1);
      expect(decoded!.role).toBe("admin");
      expect(decoded!.email).toBe("admin@test.com");
    });

    it("should return null for invalid token", async () => {
      const result = await verifyAccessToken("invalid-token");
      expect(result).toBeNull();
    });

    it("should handle different roles", async () => {
      const adminToken = await signAccessToken({ userId: 1, role: "admin", email: "admin@test.com" });
      const viewerToken = await signAccessToken({ userId: 2, role: "viewer", email: "viewer@test.com" });

      const admin = await verifyAccessToken(adminToken);
      const viewer = await verifyAccessToken(viewerToken);

      expect(admin!.role).toBe("admin");
      expect(viewer!.role).toBe("viewer");
    });
  });

  describe("refresh tokens", () => {
    it("should generate a token and hash it", async () => {
      const token = generateRefreshToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      // UUIDs are 36 chars each, double is 72 chars
      expect(token.length).toBeGreaterThanOrEqual(64);
    });

    it("should produce unique tokens", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateRefreshToken()));
      expect(tokens.size).toBe(100);
    });

    it("should hash token to a consistent length", async () => {
      const token = generateRefreshToken();
      const hash1 = await hashToken(token);
      const hash2 = await hashToken(token);
      expect(hash1).toBe(hash2); // Same token -> same hash
      expect(hash1.length).toBeGreaterThanOrEqual(32); // SHA-256 hex is 64 chars
    });

    it("should produce different hashes for different tokens", async () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      const h1 = await hashToken(token1);
      const h2 = await hashToken(token2);
      expect(h1).not.toBe(h2);
    });
  });
});
