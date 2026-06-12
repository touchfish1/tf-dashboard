import { Hono } from "hono";
import { db } from "../db";
import { scheduledReports } from "../db/schema";
import { desc } from "drizzle-orm";

const router = new Hono();

router.get("/", async (c) => {
  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const rows = await db
    .select()
    .from(scheduledReports)
    .orderBy(desc(scheduledReports.createdAt))
    .limit(limit);
  return c.json(rows);
});

export default router;
