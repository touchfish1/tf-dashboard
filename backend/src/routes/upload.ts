import { Hono } from "hono";
import { serveStatic } from "hono/serve-static";

const router = new Hono();

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

// Ensure upload directory exists
import { mkdir } from "fs/promises";
mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

// File upload
router.post("/upload", async (c) => {
  const body = await c.req.parseBody();
  const file = body["file"] as File | null;
  if (!file) return c.json({ error: "no file provided" }, 400);

  // Validate file type
  const type = file.type;
  if (!type.startsWith("image/")) return c.json({ error: "only image files allowed" }, 400);

  // Max 5MB
  if (file.size > 5 * 1024 * 1024) return c.json({ error: "file too large (max 5MB)" }, 400);

  // Save file
  const ext = type.split("/").pop() || "jpg";
  const filename = `bg_${Date.now()}.${ext}`;
  const filepath = `${UPLOAD_DIR}/${filename}`;
  await Bun.write(filepath, file);

  const url = `/uploads/${filename}`;
  return c.json({ url });
});

// Serve uploaded files
router.use("/uploads/*", serveStatic({ root: "." }));

export default router;
