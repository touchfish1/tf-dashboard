import { pgTable, serial, text, integer, decimal, boolean, timestamp, bigint } from "drizzle-orm/pg-core";

// ─── Navigation links ───────────────────────────────────────────
export const navLinks = pgTable("nav_links", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  icon: text("icon").default(""),
  category: text("category").default(""),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Servers registry ────────────────────────────────────────────
export const servers = pgTable("servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  metricsUrl: text("metrics_url").notNull(),
  labels: text("labels").array(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── OpenCode usage aggregates ───────────────────────────────────
export const opencodeUsage = pgTable("opencode_usage", {
  id: serial("id").primaryKey(),
  bucketStart: timestamp("bucket_start").notNull(),
  bucketEnd: timestamp("bucket_end").notNull(),
  model: text("model"),
  agent: text("agent"),
  tokensInput: bigint("tokens_input", { mode: "number" }).default(0),
  tokensOutput: bigint("tokens_output", { mode: "number" }).default(0),
  tokensReasoning: bigint("tokens_reasoning", { mode: "number" }).default(0),
  tokensCacheRead: bigint("tokens_cache_read", { mode: "number" }).default(0),
  tokensCacheWrite: bigint("tokens_cache_write", { mode: "number" }).default(0),
  cost: decimal("cost", { precision: 12, scale: 6 }).default("0"),
  sessionCount: integer("session_count").default(0),
});

// ─── DeepSeek balance snapshots ──────────────────────────────────
export const deepseekBalance = pgTable("deepseek_balance", {
  id: serial("id").primaryKey(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  balanceTotal: decimal("balance_total", { precision: 12, scale: 2 }),
  balanceGranted: decimal("balance_granted", { precision: 12, scale: 2 }),
  balanceToppedUp: decimal("balance_topped_up", { precision: 12, scale: 2 }),
  currency: text("currency").default("CNY"),
});

// ─── Key-value settings store ────────────────────────────────────
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─── Alerts / notifications ──────────────────────────────────────
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),         // "balance_low" | "server_offline" | "opencode_error"
  severity: text("severity").default("warning"), // "info" | "warning" | "critical"
  title: text("title").notNull(),
  message: text("message").notNull(),
  refId: text("ref_id"),                // server id, etc.
  acknowledged: boolean("acknowledged").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── Server metrics time series ──────────────────────────────────
export const serverMetrics = pgTable("server_metrics", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull().references(() => servers.id, { onDelete: "cascade" }),
  collectedAt: timestamp("collected_at").defaultNow(),
  cpuPercent: decimal("cpu_percent", { precision: 5, scale: 2 }),
  cpuLoad1m: decimal("cpu_load_1m", { precision: 5, scale: 2 }),
  cpuLoad5m: decimal("cpu_load_5m", { precision: 5, scale: 2 }),
  cpuLoad15m: decimal("cpu_load_15m", { precision: 5, scale: 2 }),
  memoryUsedMb: integer("memory_used_mb"),
  memoryTotalMb: integer("memory_total_mb"),
  memoryPercent: decimal("memory_percent", { precision: 5, scale: 2 }),
  diskTotalGb: decimal("disk_total_gb", { precision: 10, scale: 2 }),
  diskUsedGb: decimal("disk_used_gb", { precision: 10, scale: 2 }),
  networkRxBytes: bigint("network_rx_bytes", { mode: "number" }),
  networkTxBytes: bigint("network_tx_bytes", { mode: "number" }),
  uptimeSeconds: bigint("uptime_seconds", { mode: "number" }),
});
