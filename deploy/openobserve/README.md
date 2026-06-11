# OpenObserve — 日志收集服务

部署在中间件服务器 `100.125.148.23:5080`，接收 tf-dashboard 后端和 Agent 的日志。

## 当前配置

| 项 | 值 |
|---|---|
| URL | `http://100.125.148.23:5080` |
| 管理员邮箱 | `admin@example.com` |
| 管理员密码 | `Cheng1008611.` |
| Organization | `default` |
| Stream | `tf_dashboard`（OpenObserve 自动将 `-` 转 `_`）|

## 访问

浏览器打开 `http://100.125.148.23:5080`，用以上邮箱密码登录。

左侧 **Streams** → 选择 `tf_dashboard` → 点击 **Search** 查看日志。

### 常用 SQL 查询

```sql
-- 最近的日志
SELECT event, message, level, method, path, status, _timestamp
FROM "tf_dashboard"
ORDER BY _timestamp DESC
LIMIT 50

-- 按事件类型统计
SELECT event, COUNT(*) as cnt
FROM "tf_dashboard"
GROUP BY event
ORDER BY cnt DESC

-- 只看错误
SELECT _timestamp, event, message, err
FROM "tf_dashboard"
WHERE level = 'error'
ORDER BY _timestamp DESC

-- 按请求路径统计
SELECT path, method, COUNT(*) as cnt, AVG(durationMs) as avg_ms
FROM "tf_dashboard"
WHERE path IS NOT NULL
GROUP BY path, method
ORDER BY cnt DESC
```

## Dashboard 端配置

配置已在 `backend/src/lib/openobserve-transport.ts` 中**硬编码**（内网地址，可提交），无需额外设置。

如需覆盖，在 `.env` 中设置对应环境变量即可：

```bash
# 全部为可选，不设置则使用代码中的默认值
OPENOBSERVE_URL=http://100.125.148.23:5080
OPENOBSERVE_ORG=default
OPENOBSERVE_STREAM=tf-dashboard
OPENOBSERVE_AUTH=admin@example.com:Cheng1008611.
```

## 数据流向

```
backend Pino ──→ multistream ──┬── stdout (pino-pretty / JSON)
                               └── OpenObserve HTTP POST (每 2 秒批量)
agent Pino   ──→ multistream ──┬── stdout
                               └── OpenObserve HTTP POST (每 2 秒批量)
```

## 端口

| 端口 | 用途 |
|------|------|
| 5080 | Web UI + HTTP API（日志上报用此端口）|
| 5081 | OTLP gRPC（暂未使用）|

## 运维

```bash
# 查看日志（OpenObserve 自身日志）
docker compose logs -f

# 升级
docker compose pull && docker compose up -d

# 数据目录
./data/     # Parquet 文件，日志数据持久化在此
