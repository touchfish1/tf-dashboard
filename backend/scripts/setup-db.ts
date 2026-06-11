/**
 * tf-dashboard Database Setup
 *
 * Run this script to initialize the PostgreSQL database schema.
 *
 * Usage:
 *   bun run scripts/setup-db.ts
 *
 * Environment variables:
 *   DATABASE_URL - PostgreSQL connection string (default: postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard)
 */

import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard";

// First connect to 'postgres' database to create tf_dashboard if needed
const adminUrl = connectionString.replace(/\/[^/]+$/, "/postgres");

async function setup() {
  console.log("🔧 tf-dashboard database setup");
  console.log(`   Target: ${connectionString}`);

  // Step 1: Create database if not exists
  try {
    const adminClient = postgres(adminUrl, { max: 1 });
    const [exists] = await adminClient`SELECT 1 FROM pg_database WHERE datname = 'tf_dashboard'`;
    if (!exists) {
      await adminClient`CREATE DATABASE tf_dashboard`;
      console.log("   ✅ Created database: tf_dashboard");
    } else {
      console.log("   ✓ Database tf_dashboard already exists");
    }
    await adminClient.end();
  } catch (err) {
    console.error("   ❌ Failed to create database:", err);
    console.log("   ℹ️  You may need to create it manually:");
    console.log("      CREATE DATABASE tf_dashboard;");
    return;
  }

  // Step 2: Run schema migrations
  try {
    const client = postgres(connectionString, { max: 1 });

    console.log("   Creating tables...");

    await client`
      CREATE TABLE IF NOT EXISTS servers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        metrics_url TEXT NOT NULL,
        labels TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("   ✅ servers");

    await client`
      CREATE TABLE IF NOT EXISTS opencode_usage (
        id SERIAL PRIMARY KEY,
        bucket_start TIMESTAMPTZ NOT NULL,
        bucket_end TIMESTAMPTZ NOT NULL,
        model TEXT,
        agent TEXT,
        tokens_input BIGINT DEFAULT 0,
        tokens_output BIGINT DEFAULT 0,
        tokens_reasoning BIGINT DEFAULT 0,
        tokens_cache_read BIGINT DEFAULT 0,
        tokens_cache_write BIGINT DEFAULT 0,
        cost DECIMAL(12,6) DEFAULT 0,
        session_count INT DEFAULT 0
      );
    `;
    console.log("   ✅ opencode_usage");

    await client`
      CREATE INDEX IF NOT EXISTS idx_opencode_bucket
        ON opencode_usage(bucket_start, model);
    `;

    await client`
      CREATE TABLE IF NOT EXISTS deepseek_balance (
        id SERIAL PRIMARY KEY,
        recorded_at TIMESTAMPTZ DEFAULT NOW(),
        balance_total DECIMAL(12,2),
        balance_granted DECIMAL(12,2),
        balance_topped_up DECIMAL(12,2),
        currency TEXT DEFAULT 'CNY'
      );
    `;
    console.log("   ✅ deepseek_balance");

    await client`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("   ✅ settings");

    await client`
      CREATE TABLE IF NOT EXISTS nav_links (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT DEFAULT '',
        category TEXT DEFAULT '',
        sort_order INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("   ✅ nav_links");

    await client`
      CREATE TABLE IF NOT EXISTS server_metrics (
        id SERIAL PRIMARY KEY,
        server_id INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        collected_at TIMESTAMPTZ DEFAULT NOW(),
        cpu_percent DECIMAL(5,2),
        cpu_load_1m DECIMAL(5,2),
        cpu_load_5m DECIMAL(5,2),
        cpu_load_15m DECIMAL(5,2),
        memory_used_mb INT,
        memory_total_mb INT,
        memory_percent DECIMAL(5,2),
        disk_total_gb DECIMAL(10,2),
        disk_used_gb DECIMAL(10,2),
        network_rx_bytes BIGINT,
        network_tx_bytes BIGINT,
        uptime_seconds BIGINT
      );
    `;
    console.log("   ✅ server_metrics");

    await client`
      CREATE INDEX IF NOT EXISTS idx_server_metrics_server_time
        ON server_metrics(server_id, collected_at DESC);
    `;

    await client`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'warning',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        ref_id TEXT,
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    console.log("   ✅ alerts");

    await client`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT DEFAULT 'system',
        resource TEXT,
        resource_id TEXT,
        detail TEXT,
        ip TEXT,
        user_agent TEXT,
        status INT,
        duration_ms INT
      );
    `;
    console.log("   ✅ audit_log");

    await client`
      CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
        ON audit_log(timestamp DESC);
    `;

    await client.end();
    console.log("\n🎉 Database setup complete!");
  } catch (err) {
    console.error("   ❌ Migration failed:", err);
  }
}

setup();
