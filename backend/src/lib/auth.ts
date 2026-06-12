import { Jwt } from "hono/utils/jwt";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES_IN = "15m";
const REFRESH_TOKEN_DAYS = 7;

export type JwtPayload = {
  userId: number;
  role: string;
  email: string;
};

export type UserInfo = {
  id: number;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean | null;
  lastLogin: Date | null;
};

/**
 * Hash a password using Bun's built-in bcrypt implementation.
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

/**
 * Verify a password against a hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}

/**
 * Sign a JWT access token (15 minute expiry).
 */
export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return Jwt.sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 min
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    "HS256",
  );
}

/**
 * Verify and decode a JWT access token.
 * Returns null for any invalid/expired token.
 */
export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = await Jwt.verify(token, JWT_SECRET, "HS256");
    if (payload && typeof payload.userId === "number" && typeof payload.role === "string") {
      return { userId: payload.userId, role: payload.role, email: (payload.email as string) || "" };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a cryptographically random refresh token string.
 */
export function generateRefreshToken(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

/**
 * Hash a token for secure DB storage using SHA-256.
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { JWT_SECRET, REFRESH_TOKEN_DAYS };
