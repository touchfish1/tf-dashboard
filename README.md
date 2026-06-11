# tf-dashboard

LLM Token 用量监控面板，支持 OpenCode 和 DeepSeek 数据源，以及多服务器指标采集。

## 技术栈

| 层 | 技术 |
|----|------|
| 运行环境 | Bun 1.3 |
| 后端框架 | Hono |
| ORM | Drizzle ORM |
| 数据库 | PostgreSQL |
| 前端 | React + TypeScript + Vite + Tailwind CSS v4 |
| 图表 | Recharts |
| 图标 | Phosphor Icons |
| 容器化 | Docker + Docker Compose |

## 目录结构

```
tf-dashboard/
├── agent/                    # Metrics Agent — 部署在被监控的服务器上
│   └── src/
│       ├── index.ts          # HTTP 服务（端口 9100）
│       └── collector.ts      # CPU/内存/磁盘/网络/OS 采集
├── backend/                  # Dashboard API — 核心后端
│   └── src/
│       ├── index.ts          # Hono 服务 + 定时轮询器
│       ├── db/schema.ts      # 数据库表定义
│       ├── routes/           # REST API 路由
│       ├── pollers/          # 数据采集器
│       └── scripts/setup-db.ts
├── frontend/                 # React SPA — 前端页面
│   └── src/pages/
│       ├── DashboardPage    # 导航首页（网址导航 + 用量图表）
│       ├── OpenCodePage     # OpenCode 用量明细
│       ├── DeepSeekPage     # DeepSeek 余额监控
│       ├── ServerPage       # 多服务器监控
│       └── SettingsPage     # 配置（数据源/服务器/链接管理）
├── docker-compose.yml
├── Dockerfile.agent
├── Dockerfile.server
└── .env.example
```

## 快速开始

### 1. 初始化数据库

```bash
bun run setup-db
```

自动连接 PostgreSQL（100.125.148.23:5432），创建 `tf_dashboard` 库和所有表。

### 2. 本地开发

```bash
# 启动 Agent（系统指标采集，端口 9100）
bun run agent

# 启动后端 API（端口 3000）
DEEPSEEK_API_KEY=sk-xxx bun run backend

# 启动前端开发服务器（端口 5173）
bun run frontend:dev
```

### 3. Docker 部署

```bash
# 构建并启动所有服务
docker compose up -d

# 查看日志
docker compose logs -f

# 只启动特定服务
docker compose up -d server
docker compose up -d agent

# 停止
docker compose down
```

#### 服务说明

| 服务 | 端口 | 说明 |
|------|------|------|
| **server** | 3000 | 后端 API + 前端静态页面（二合一） |
| **agent** | 9100 | 系统指标采集端点（部署在每台被监控的服务器上） |

#### 环境变量

编辑 `docker-compose.yml` 或在同级创建 `.env` 文件：

```bash
# 必填：数据库连接
DATABASE_URL=postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard

# 选填：DeepSeek API 密钥（可在设置页面配置）
DEEPSEEK_API_KEY=sk-your-key-here

# 选填：轮询间隔（秒）
POLL_SERVERS_INTERVAL=30
POLL_OPENCODE_INTERVAL=60
POLL_DEEPSEEK_INTERVAL=300
```

#### 多服务器部署

每台被监控的服务器上运行 Agent：

```bash
docker compose up -d agent
```

然后在 Dashboard 设置页面添加服务器，填写 Agent 地址 `http://<ip>:9100/metrics`。

## 数据源配置

### OpenCode

两种方式：

1. **本地 SQLite**（默认）— 自动读取 `~/.local/share/opencode/opencode.db`
2. **远程 API** — 在设置页面配置，Agent 暴露的端点：
   ```
   http://<agent-host>:9100/api/opencode/sessions
   ```

### DeepSeek

在设置页面配置 API Key，后端自动轮询 `GET /user/balance` 获取余额。

### 服务器指标

目标服务器运行 Agent，Dashboard 定时拉取 `GET /metrics`，返回标准 JSON 格式：

```json
{
  "hostname": "sv-01",
  "cpu": { "percent": 45.2, "load_1m": 2.5 },
  "memory": { "total_mb": 32768, "used_mb": 8192 },
  "disk": [{ "mount": "/", "device": "/dev/sda1", "total_gb": 500, "used_gb": 120 }],
  "network": { "rx_bytes": 1500000000000, "tx_bytes": 800000000000 },
  "os": { "platform": "linux", "kernel": "6.8.0" },
  "uptime_seconds": 1234500,
  "timestamp": "2026-06-11T10:00:00Z"
}
```

## API 概览

| 路径 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/servers` | GET/POST | 服务器管理 |
| `/api/servers/:id` | PATCH/DELETE | 编辑/删除服务器 |
| `/api/servers/:id/metrics` | GET | 服务器指标时序数据 |
| `/api/servers/:id/summary` | GET | 服务器指标聚合 |
| `/api/opencode/summary` | GET | 用量汇总 |
| `/api/opencode/usage` | GET | 用量明细 |
| `/api/opencode/by-model` | GET | 各模型费用 |
| `/api/deepseek/balance` | GET | 最新余额 |
| `/api/deepseek/history` | GET | 余额历史 |
| `/api/settings/:key` | GET/PUT/DELETE | 键值配置 |
| `/api/links` | GET/POST | 网址导航链接 |
| `/api/links/:id` | PUT/DELETE | 编辑/删除链接 |

## 安全

- API 端点支持 `x-api-key` 认证（通过 `API_KEY` 环境变量启用）
- Agent 支持 `?api_key=` 参数保护 OpenCode 端点
- SSRF 防护：云端 metadata 端点被拦截
- CORS 限制：仅允许本地开发域名
