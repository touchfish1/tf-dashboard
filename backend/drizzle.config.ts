import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ||
      "postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard",
  },
});
