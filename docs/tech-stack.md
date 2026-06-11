# tf-dashboard 技术选型

> 决策日期: 2026-06-11

## 技术栈总览

| 层 | 选型 | 版本 |
|----|------|------|
| **运行时** | Bun | v1.3.14 |
| **后端框架** | Hono | latest |
| **ORM** | Drizzle ORM | latest |
| **数据库** | PostgreSQL | 100.125.148.23 |
| **前端框架** | React + TypeScript | latest |
| **构建工具** | Vite | latest |
| **图表库** | Recharts / ECharts | latest |
| **样式** | Tailwind CSS | v4 |
| **定时任务** | Bun.Cron | 内置 |
| **动画** | Motion (framer-motion) | latest |

## 选型理由

### Bun 作为运行时
- 环境已预装（v1.3.14），零额外安装
- 内置 `bun:sqlite` 可直接只读读取 OpenCode 的 SQLite 数据库
- 内置 `Bun.Cron` 做定时抓取任务
- 原生 TypeScript 支持，无需编译步骤
- 单进程即可承载 ETL + API Server，部署极简

### Hono 作为后端框架
- 极轻量（~12KB），专为 Bun/Node/Deno/Edge 设计
- 良好的中间件生态（cors、logger、jwt）
- TypeScript 原生支持
- 路由简洁，适合 REST API 场景

### Drizzle ORM
- TypeScript 原生，类型安全
- 零运行时依赖，体积小
- PostgreSQL 优先设计
- 支持 SQL-like query API，学习成本低
- 相比 Prisma：更轻量、更接近 SQL、无 generator 步骤

### React + Vite + TypeScript
- React 生态最成熟，图表库选择最多
- Vite 启动和热更新速度快
- TS 全栈统一语言，前后端共享类型定义

### Tailwind CSS v4
- 快速构建 UI，无需写大量自定义 CSS
- `dark:` 变体天然支持暗色主题
- 配合设计 tokens 保持一致性

## PostgreSQL 连接信息

```
地址:     100.125.148.23
端口:     5432
数据库:   tf_dashboard
用户名:   zhangyuan
密码:     zhangyuan
连接串:   postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard
```

## 数据源接入方案

### OpenCode（本地 SQLite，只读）

```
路径: ~/.local/share/opencode/opencode.db

核心表 session:
- cost, tokens_input, tokens_output, tokens_reasoning
- tokens_cache_read, tokens_cache_write
- model, agent, time_created, project_id

接入方式:
1. Bun 定时任务（默认 60s）通过 bun:sqlite 读取 session 表
2. 聚合后 upsert 到 PostgreSQL opencode_usage 表
3. 前端通过 REST API 查询 PostgreSQL
```

### DeepSeek（HTTP API）

```
基础 URL: https://api.deepseek.com
认证: Authorization: Bearer ${DEEPSEEK_API_KEY}

可用端点:
- POST /chat/completions → usage 对象（需本地拦截/记录）
- GET /user/balance → 仅返回余额，无用量明细

接入方式:
1. 定时轮询 GET /user/balance 记录余额快照
2. 如后续需要跟踪用量，需在代理层拦截 completion 响应
```

### 服务器指标（HTTP Metrics 端点）

```
每台目标服务器上部署轻量 HTTP 端点，暴露 /metrics 接口。

端点协议:
  GET http://<server>:<port>/metrics
  → 返回 JSON (CPU / 内存 / 磁盘 / 网络 / OS 信息)

接入方式:
1. 在 Settings 中配置各服务器的 metrics URL
2. Bun 定时任务（默认 30s）向各服务器发起 GET /metrics
3. 解析 JSON，写入 PostgreSQL server_metrics 表
4. 前端通过 REST API 查询

对比其他方案:
  - SSH 直连: 需管理 SSH 凭据，连接开销大
  - 本地 Agent: 需额外部署维护
  - HTTP Metrics ✅: 最轻量，标准协议，无侵入
```

## PostgreSQL Schema（初步）

```sql
-- 服务器注册表
CREATE TABLE servers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,                      -- 显示名称，如 sv-01
  metrics_url TEXT NOT NULL,               -- HTTP /metrics 端点 URL
  labels TEXT[],                           -- 标签数组，如 {'prod','web'}
  is_active BOOLEAN DEFAULT TRUE,          -- 是否启用采集
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_servers_name ON servers(name);

-- OpenCode 用量聚合（按小时）
CREATE TABLE opencode_usage (
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

CREATE INDEX idx_opencode_bucket ON opencode_usage(bucket_start, model);

-- DeepSeek 余额快照
CREATE TABLE deepseek_balance (
  id SERIAL PRIMARY KEY,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  balance_total DECIMAL(12,2),
  balance_granted DECIMAL(12,2),
  balance_topped_up DECIMAL(12,2),
  currency TEXT DEFAULT 'CNY'
);

-- 服务器指标时序数据
CREATE TABLE server_metrics (
  id SERIAL PRIMARY KEY,
  server_id INT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

CREATE INDEX idx_server_metrics_server_time ON server_metrics(server_id, collected_at DESC);
```

## 架构图

```
┌──────────────────────────────────────────────────────────────┐
│                     Bun Runtime                               │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Hono API Server (:3000)                     │  │
│  │  GET /api/opencode/usage                                │  │
│  │  GET /api/deepseek/balance                              │  │
│  │  GET /api/servers                                       │  │
│  │  GET /api/servers/:id/metrics                           │  │
│  └────────────────────┬────────────────────────────────────┘  │
│                        │                                       │
│  ┌────────────────────┼────────────────────────────────────┐  │
│  │    Bun.Cron        │                                     │  │
│  │                     ▼                                     │  │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────────────────┐ │  │
│  │  │ OpenCode   │  │ DeepSeek │  │ Server Metrics       │ │  │
│  │  │ SQLite ETL │  │ Balance  │  │ HTTP Poller          │ │  │
│  │  └─────┬──────┘  └────┬─────┘  └──┬────┬────┬────┬───┘ │  │
│  └────────┼──────────────┼────────────┼────┼────┼────┼─────┘  │
│           │              │            │    │    │    │         │
│           ▼              ▼            ▼    ▼    ▼    ▼         │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL                                             │   │
│  │  servers  │  opencode_usage  │  deepseek_balance       │   │
│  │           │  server_metrics (server_id FK)                │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Vite + React (Frontend :5173)                         │   │
│  │  Dashboard │ OpenCode │ DeepSeek │ Server │ Settings   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─ 目标服务器 (HTTP /metrics) ─────────────────────────────┐ │
│  │                                                           │ │
│  │  sv-01 ─── http://192.168.1.10:9100/metrics              │ │
│  │  sv-02 ─── http://192.168.1.11:9100/metrics  ◄── Cron 30s│ │
│  │  sv-03 ─── http://192.168.1.12:9100/metrics              │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```
