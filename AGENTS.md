# tf-dashboard

LLM Token 用量监控面板（OpenCode + DeepSeek），多服务器指标采集。

## 仓库结构

Bun workspace monorepo（根 `package.json` 定义 workspaces）：

| workspace | 入口 | 端口 | 说明 |
|---|---|---|---|
| `agent/` | `agent/src/index.ts` | 9100 | Metrics Agent，部署在被监控服务器 |
| `backend/` | `backend/src/index.ts` | 3000 | Hono API + 定时轮询器 + 前端静态资源 |
| `frontend/` | React SPA via Vite | 5173 (dev) | shadcn/ui + @base-ui/react + Recharts |
| `packages/shared/` | `@tf-dashboard/shared` | - | 类型/工具/API 客户端 |
| `packages/mobile/` | Expo (RN) | - | 移动端 |

## 开发者命令

```bash
bun run setup-db          # 创建/迁移 PostgreSQL 表
bun run agent              # 启动 Metrics Agent
bun run agent:dev          # agent 热重载模式
bun run backend            # 启动后端 API
bun run backend:dev        # 后端热重载模式 (--hot)
bun run frontend:dev       # Vite dev server
bun run frontend:build     # tsc + vite build
bun run typecheck          # frontend → backend 依次 tsc --noEmit
bun run lint               # biome check .
bun run lint:fix           # biome check --apply .
bun run test               # bun test (根 workspace)
bun run test:backend       # bun test --cwd backend
bun run test:frontend      # bun test --cwd frontend
bun run ci                 # typecheck → test → frontend:build
```

**CI 流水线**：`bun run typecheck` → `bun run test` → `bun run frontend:build`（在 `package.json` 中定义为 `ci`）。

## Biome（lint + format）

- `indentStyle: space`, `indentWidth: 2`, `lineWidth: 140`
- `quoteStyle: "double"`, `semicolons: "always"`
- `noExplicitAny: off`, `noConsoleLog: off`, `noNonNullAssertion: off`
- `organizeImports: disabled`（不要自动重排 import）

## 测试

- Runner: `bun test`（bun 内置，支持 `--cwd` 指定 workspace）
- 前端 DOM 测试：`frontend/bunfig.toml` 中 `[test] dom = true`
- 后端测试在 `backend/tests/`，前端测试在 `frontend/src/lib/*.test.ts`
- 测试依赖 PostgreSQL 连接（部分测试可能跳过如 DB 不可用）

## 后端架构要点

- **入口** `backend/src/index.ts`：挂载路由 → 注册中间件 → 启动轮询器 → 启动定时任务
- **中间件顺序**：requestLogger → CORS → rateLimit → [auth/SSE/status 跳过 auth] → authMiddleware → cache → route handler
- **认证**：GET 请求免认证（/api/settings, /api/auth 除外）；POST/PUT/DELETE 需要 JWT Bearer 或 `x-api-key` 头
- **缓存**：内存缓存，按路由设置 TTL（`backend/src/index.ts:87-97`），轮询器更新时通过事件总线失效
- **轮询器**：3 个定时器（servers/opencode/deepseek），间隔通过 `POLL_*_INTERVAL` 环境变量控制
- **事件总线**：`backend/src/lib/event-bus.ts`，同步 pub/sub，用于 poller → alert engine → cache invalidation
- **Pino 日志**：`LOG_LEVEL` 控制级别，dev 模式用 pino-pretty，可选 OpenObserve 远程传输
- **数据清理**：server_metrics 30天 / deepseek 90天 / audit 90天 / alerts 30天（每日 03:00 Asia/Shanghai）

## Agent 架构要点

- 依赖 `opencode` CLI 二进制（通过 `Bun.spawnSync` 调用）提供 `/api/opencode/sessions`
- Agent `/metrics` 返回系统指标（cpu/内存/磁盘/网络/OS/uptime）
- `/api/opencode/sessions` 受 `?api_key=` 参数保护（通过 `OPENCODE_API_KEY` 环境变量启用）

## 前端架构要点

- 路径别名 `@/` → `./src/`（`frontend/vite.config.ts` 和 `tsconfig.json` 中定义）
- Vite dev server 代理 `/api`、`/health`、`/uploads` → `localhost:3000`
- 生产环境：后端通过 `serveStatic` 在 `/*` 路由提供 `frontend/dist` 目录
- Tailwind CSS v4（使用 `@tailwindcss/vite` 插件，不是 PostCSS 插件）
- shadcn/ui 组件（`npx shadcn@latest add ...`），依赖 `@base-ui/react` primitives
- Graph/library 拆分：`react-vendor`, `recharts-vendor`, `phosphor-icons` 在 vite 中手动 chunk

## 关键环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `DATABASE_URL` | 是 | PostgreSQL 连接串（代码中有默认值硬编码） |
| `DEEPSEEK_API_KEY` | 推荐 | 设置在 Settings 页面 |
| `API_KEY` | 推荐 | 全局 API 认证密钥 |
| `POLL_SERVERS_INTERVAL` | 否 | 默认 30s |
| `POLL_OPENCODE_INTERVAL` | 否 | 默认 60s |
| `POLL_DEEPSEEK_INTERVAL` | 否 | 默认 300s |
| `OPENCODE_DB_PATH` | 否 | 本地 SQLite 路径 |

完整清单见 `.env.example`。

## 部署

- Docker Compose（`docker-compose.yml`）：两个服务 `server`（3000）和 `agent`（9100）
- server 镜像多阶段构建：builder 阶段编译前端，runtime 阶段只装 backend 生产依赖
- agent 镜像：`bun install --frozen-lockfile --production`，纯生产模式
- OpenObserve 可选部署：`deploy/openobserve/docker-compose.yml`

## 约定

- 需求用中文，代码注释和标识符用英文
- `skills/`、`.omo/`、`.agents/` 是 OpenCode 技能目录，不应修改
- `node_modules/`、`dist/`、`.env`、`*.db`、`uploads/`、`.omo/` 在 `.gitignore` 中
- `backend/mobile-dist/`、`backend/mobile-web/` 在 `.gitignore` 中（Expo 产物）
- 没有 `.github/workflows/` 文件——CI 尚未配置
