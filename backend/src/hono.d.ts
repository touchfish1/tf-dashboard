import type { pino } from "pino";

declare module "hono" {
  interface ContextVariableMap {
    logger: pino.Logger;
    requestMeta: Record<string, string>;
    user: { userId: number | null; role: string; email: string };
  }
}
