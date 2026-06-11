# tf-dashboard

Dashboard for LLM backend token usage (OpenCode + DeepSeek) and server monitoring.

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun 1.3 |
| Backend | Hono + Drizzle ORM |
| Database | PostgreSQL (100.125.148.23) |
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Charts | Recharts |
| Metrics | HTTP /metrics agent (built-in) |

## Project Structure

```
tf-dashboard/
├── agent/          # metrics agent (exposes GET /metrics on each server)
│   └── src/
│       ├── index.ts       # Hono server, port 9100
│       └── collector.ts   # CPU/memory/disk/network/OS collector
├── backend/        # dashboard API server
│   └── src/
│       ├── index.ts           # Hono server + cron pollers
│       ├── db/
│       │   ├── index.ts       # PostgreSQL connection
│       │   └── schema.ts      # Drizzle schema
│       ├── routes/
│       │   ├── servers.ts     # Server CRUD
│       │   ├── opencode.ts    # OpenCode usage API
│       │   └── deepseek.ts    # DeepSeek balance API
│       ├── pollers/
│       │   ├── servers.ts     # HTTP metrics poller
│       │   ├── opencode.ts    # SQLite → PG ETL
│       │   └── deepseek.ts    # DeepSeek /user/balance poller
│       └── scripts/
│           └── setup-db.ts    # DB initialization script
├── frontend/       # React dashboard (TBD)
└── docs/
    ├── tech-stack.md
    └── design.md
```

## Quick Start

### 1. Initialize Database

```bash
bun run setup-db
```

This connects to PostgreSQL at `100.125.148.23:5432`, creates `tf_dashboard` database and all required tables.

### 2. Start Metrics Agent

```bash
bun run agent
# → http://0.0.0.0:9100/metrics
```

### 3. Start Backend API

```bash
# configure DeepSeek API key
export DEEPSEEK_API_KEY=sk-your-key

bun run backend
# → http://0.0.0.0:3000/health
```

### 4. Start Frontend (development)

```bash
bun run frontend:dev
# → http://localhost:5173
```

## Configuration

See `.env.example` for all available environment variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard` | PostgreSQL connection |
| `DEEPSEEK_API_KEY` | — | DeepSeek API key |
| `METRICS_PORT` | `9100` | Agent HTTP port |
| `API_PORT` | `3000` | Backend API port |
| `POLL_SERVERS_INTERVAL` | `30` | Server metrics poll interval (s) |
| `POLL_OPENCODE_INTERVAL` | `60` | OpenCode ETL interval (s) |
| `POLL_DEEPSEEK_INTERVAL` | `300` | DeepSeek balance poll interval (s) |
| `OPENCODE_DB_PATH` | `~/.local/share/opencode/opencode.db` | OpenCode SQLite path |
