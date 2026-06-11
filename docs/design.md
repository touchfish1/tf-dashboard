# tf-dashboard 前端设计

> 设计日期: 2026-06-11
> 技术栈: Bun + Hono + React + TypeScript + Vite + Tailwind CSS v4 + Recharts

---

## 0. Design Read

> **Reading this as:** developer-facing internal dashboard for LLM token usage monitoring, with a dark-tech minimalist language, leaning toward Tailwind utilities + dark theme + data-dense charts + restrained motion.

**Audience**: 开发者自身（技术用户），需要快速查看用量趋势和费用

**设计目标**:
- 一目了然的总览（Dashboard）
- 清晰的数据分层（概览 → 明细）
- 暗色主题优先（LLM 开发工具标配）
- 克制动效，专注数据可读性

---

## 1. Three Dials

| Dial | Value | 含义 |
|------|-------|------|
| **DESIGN_VARIANCE** | 4 | 对称网格为主，少量偏移制造层次 |
| **MOTION_INTENSITY** | 3 | 仅 hover/transition，无 scroll 驱动动画 |
| **VISUAL_DENSITY** | 6 | 数据面板紧凑，图表区域留白适度 |

---

## 2. Design Tokens

### 2.1 色板（暗色主题优先）

```
背景层:
  surface-base:     zinc-950 (#09090b)   — 最底层背景
  surface-elevated: zinc-900 (#18181b)   — 卡片/面板背景
  surface-hover:    zinc-800 (#27272a)   — hover 状态
  surface-border:   zinc-800 (#27272a)   — 分割线/边框

文字:
  text-primary:     zinc-100 (#f4f4f5)   — 主要文字
  text-secondary:   zinc-400 (#a1a1aa)   — 辅助文字
  text-muted:       zinc-500 (#71717a)   — 弱化文字
  text-inverse:     zinc-950 (#09090b)   — 反转色（用在 accent 背景上）

强调色:
  accent-blue:      blue-500  (#3b82f6)  — 主要强调（OpenCode 面板）
  accent-emerald:   emerald-500(#10b981) — 正向指标（运行中、连接正常）
  accent-amber:     amber-500 (#f59e0b)  — 警告/关注
  accent-red:       red-500   (#ef4444)  — 错误/异常
  accent-purple:    violet-500(#8b5cf6)  — DeepSeek 面板标识色

渐变:
  gradient-opencode:  from-blue-500 to-violet-600
  gradient-deepseek:  from-violet-500 to-purple-600
  gradient-server:    from-emerald-500 to-teal-600

图表色板（8色循环）:
  chart-1:  #3b82f6  (blue-500)
  chart-2:  #8b5cf6  (violet-500)
  chart-3:  #10b981  (emerald-500)
  chart-4:  #f59e0b  (amber-500)
  chart-5:  #ef4444  (red-500)
  chart-6:  #06b6d4  (cyan-500)
  chart-7:  #ec4899  (pink-500)
  chart-8:  #f97316  (orange-500)
```

### 2.2 字体

```css
/* 标题/数字显示 */
font-family: 'Geist', system-ui, sans-serif;
/* 代码/数据 */
font-family: 'Geist Mono', 'JetBrains Mono', monospace;
/* 正文 */
font-family: 'Geist', system-ui, sans-serif;
```

- **数字/指标** 强制使用 `font-mono` 等宽
- **标题** `font-semibold tracking-tight`
- **正文** `text-sm leading-relaxed text-zinc-400`

### 2.3 圆角与阴影

```
卡片圆角: rounded-lg (8px)
按钮圆角: rounded-md (6px)
徽章圆角: rounded-full

阴影方案（暗色）:
  card:       shadow-[0_1px_2px_rgba(0,0,0,0.3)]
  elevated:   shadow-[0_4px_12px_rgba(0,0,0,0.4)]
  modal:      shadow-[0_8px_32px_rgba(0,0,0,0.5)]
```

---

## 3. 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────────────────────────────────────┐ │
│  │          │  │  Top Bar                                 │ │
│  │  Sidebar │  │  [tf-dashboard]  [Status] [时间范围]    │ │
│  │          │  ├──────────────────────────────────────────┤ │
│  │  ◉ 总览  │  │                                          │ │
│  │  ○ 代码  │  │        Content Area                      │ │
│  │  ○ 深度  │  │                                          │ │
│  │  ○ 服务器│  │                                          │ │
│  │  ○ 设置  │  │                                          │ │
│  │          │  │                                          │ │
│  │          │  │                                          │ │
│  │          │  │                                          │ │
│  └──────────┘  └──────────────────────────────────────────┘ │
│  w-56 fixed     flex-1 overflow-auto                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.1 Sidebar（左侧导航）

```
┌─────────────────────┐
│  tf-dashboard       │  ← 品牌标识 + 项目名
│  ————————————————  │
│  ◆  Dashboard       │  ← 激活态：accent 左侧条 + 高亮
│  ○  OpenCode        │  ← 默认态：text-secondary
│  ○  DeepSeek        │
│  ▼  Server     ←展开│  ← 可展开/收起
│       ◆ sv-01  ←当前│       服务器子菜单
│       ○ sv-02       │       在线状态绿点前缀
│       ○ sv-03       │
│       ────          │
│       ＋ Add Server │       添加服务器入口
│  ○  Settings        │
│  ————————————————  │
│  v0.1.0             │  ← 版本号，底部固定
└─────────────────────┘
```

- 宽度: `w-56`
- 固定定位，不随内容滚动
- 导航项: 图标 + 标签，激活态左侧 2px accent 色条
- **Server 为可展开菜单**，点击展开/收起服务器列表
- 服务器子项前缀绿点(● online) / 灰点(○ offline)
- 底部显示版本号

### 3.2 Top Bar（顶部栏）

```
┌────────────────────────────────────────────────────────────┐
│  Dashboard                    ● Live    ┌────────┐ ┌────┐ │
│  (页面标题)                    2s ago    │ 7 days │ │ 🔄 │ │
│                                               └────────┘ └────┘ │
└────────────────────────────────────────────────────────────┘
```

- 左侧：当前页面标题
- 右侧：
  - 实时状态指示器（绿点 + "Live" + 上次更新秒数）
  - 时间范围选择器（下拉: 24h / 7d / 30d / 90d / All）
  - 手动刷新按钮

### 3.3 Content Area（内容区）

- `flex-1 overflow-auto`
- 内边距 `p-6`
- 响应式：`lg` 以上多列，`md` 以下单列堆叠

---

## 4. 页面设计

### 4.1 Dashboard（总览页）

```
┌───────────────────────────────────────────────────────────────┐
│  Dashboard                                                    │
│  ● Live · 2s ago                                      [7d] 🔄 │
│                                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ $3.98    │ │ 5.4M     │ │ 949K     │ │ ¥110.00      │    │
│  │ Total    │ │ Input    │ │ Output   │ │ DeepSeek     │    │
│  │ Cost     │ │ Tokens   │ │ Tokens   │ │ Balance      │    │
│  │ ▲ 12%    │ │ ▲ 8%     │ │ ▲ 15%    │ │ ▼ 5%         │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │
│                                                               │
│  ┌─────────────────────────┐ ┌──────────────────────────┐    │
│  │  Token Usage Trend      │ │  Cost by Model           │    │
│  │  ┌───────────────────┐  │ │  ┌──────────────────┐   │    │
│  │  │  Area/Line Chart  │  │ │  │  Pie/Donut Chart │   │    │
│  │  │  (7d sparkline)   │  │ │  │                  │   │    │
│  │  └───────────────────┘  │ │  └──────────────────┘   │    │
│  └─────────────────────────┘ └──────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────┐ ┌──────────────────────────────┐│
│  │  Recent Sessions        │ │  Server Status (3 nodes)     ││
│  │  ┌───────────────────┐  │ │  ┌────────────────────────┐ ││
│  │  │  Session list     │  │ │  │ sv-01 ● ████████░░ 45% │ ││
│  │  │  (last 5)         │  │ │  │ sv-02 ● ██░░░░░░░░ 22% │ ││
│  │  └───────────────────┘  │ │  │ sv-03 ○ Offline       │ ││
│  │                         │ │  │                        │ ││
│  │                         │ │  │ 2/3 online · Avg 34%  │ ││
│  │                         │ │  └────────────────────────┘ ││
│  └─────────────────────────┘ └──────────────────────────────┘│
└───────────────────────────────────────────────────────────────┘
```

**组件**:
1. **Summary Cards** (x4) — 总消耗、输入Token、输出Token、DeepSeek余额
   - 数字用 `font-mono text-2xl font-bold`
   - 标签用 `text-xs text-zinc-500 uppercase tracking-wider`
   - 趋势箭头（▲/▼）用 `text-emerald-500` / `text-red-500`
2. **Token Usage Trend** — 面积图，展示 7 天内的 Input/Output 趋势
3. **Cost by Model** — 环形饼图，展示各模型费用占比
4. **Recent Sessions** — 最近 5 条 session 简述列表（model, cost, time）
5. **Server Status** — 迷你进度条组

### 4.2 OpenCode 详情页

```
┌───────────────────────────────────────────────────────────────┐
│  OpenCode Usage                                         [7d] 🔄 │
│                                                               │
│  ┌──────────────────────────┐ ┌───────────────────────────┐   │
│  │  Token Usage (Daily)     │ │  Cost Trend               │   │
│  │  ┌────────────────────┐  │ │  ┌─────────────────────┐ │   │
│  │  │  Stacked Area      │  │ │  │  Bar Chart          │ │   │
│  │  │  Input/Output/     │  │ │  │  by model color     │ │   │
│  │  │  Reasoning/Cache   │  │ │  └─────────────────────┘ │   │
│  │  └────────────────────┘  │ └───────────────────────────┘   │
│  └──────────────────────────┘                                 │
│                                                               │
│  ┌──────────────────────────┐ ┌───────────────────────────┐   │
│  │  Cost by Agent           │ │  Cache Hit Ratio          │   │
│  │  ┌────────────────────┐  │ │  ┌─────────────────────┐ │   │
│  │  │  Horizontal Bar    │  │ │  │  Gauge / Progress   │ │   │
│  │  │  (top 5 agents)    │  │ │  │  85% cached         │ │   │
│  │  └────────────────────┘  │ │  └─────────────────────┘ │   │
│  └──────────────────────────┘ └───────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Sessions Table                                        │   │
│  │  ┌────┬──────────┬───────┬──────┬───────┬──────┬────┐ │   │
│  │  │ #  │ Model    │ Agent │Input │Output │ Cost │Time│ │   │
│  │  ├────┼──────────┼───────┼──────┼───────┼──────┼────┤ │   │
│  │  │ 1  │ deepseek │ sisyp │ 73K  │ 6.9K  │$0.01 │6/11│ │   │
│  │  │ 2  │ claude   │ oracle│ 12K  │ 2.1K  │$0.05 │6/10│ │   │
│  │  └────┴──────────┴───────┴──────┴───────┴──────┴────┘ │   │
│  │  [← Prev]  1 - 10 of 84  [Next →]                      │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

**组件**:
1. **Token Usage (Daily)** — 堆叠面积图，展示每天各类 token 消耗
2. **Cost Trend** — 分组柱状图，按模型着色，展示费用趋势
3. **Cost by Agent** — 横向条形图，Top 5 agent 的费用排行
4. **Cache Hit Ratio** — 环形进度条，展示缓存命中率
5. **Sessions Table** — 可排序、可分页的 session 明细表

### 4.3 DeepSeek 页

```
┌───────────────────────────────────────────────────────────────┐
│  DeepSeek API                                           [7d] 🔄 │
│                                                               │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │ ¥110.00      │ │ ¥10.00      │ │ ¥100.00     │          │
│  │ Total        │ │ Granted      │ │ Topped Up   │          │
│  │ Balance      │ │ Balance      │ │ Balance     │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Balance History (30d)                                 │   │
│  │  ┌────────────────────────────────────────────────┐    │   │
│  │  │  Line chart — balance over time                │    │   │
│  │  │  Markers on top-up events                      │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Recent API Calls (proxy logs)                         │   │
│  │  ┌──────┬──────────┬──────┬──────────┬────────┬────┐   │   │
│  │  │ Time │ Model    │Input │ Output   │  Cost  │200?│   │   │
│  │  ├──────┼──────────┼──────┼──────────┼────────┼────┤   │   │
│  │  │ 12:30│ deepseek │ 1.2K │ 456      │$0.0003 │ ✅ │   │   │
│  │  └──────┴──────────┴──────┴──────────┴────────┴────┘   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  📌 Note: DeepSeek 暂无官方用量 API。当前展示余额信息。         │
│     完整 token 用量需在代理层拦截 /chat/completions 响应。    │
└───────────────────────────────────────────────────────────────┘
```

### 4.4 Server 页（多服务器）

```
┌─────────────────────────────────────────────────────────────────────┐
│  Server                                           ● Live   [24h] 🔄 │
│                                                                     │
│  ┌──────┬──────┬──────┬──────────┐                                 │
│  │ sv-01│ sv-02│ sv-03│ ＋ Add   │  ← 标签页切换当前查看的服务器      │
│  └──────┴──────┴──────┴──────────┘                                 │
│                                                                     │
│  sv-01  ● Online  ·  uptime 14d 3h  ·  AMD EPYC 24C/48T           │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                │
│  │    45%       │ │  8.2 / 32GB  │ │ 120 / 500GB  │                │
│  │  CPU Avg     │ │   Memory     │ │    Disk      │                │
│  │  ▲ +5%       │ │  ▲ +2%      │ │  ▼ -1%       │                │
│  └──────────────┘ └──────────────┘ └──────────────┘                │
│                                                                     │
│  ┌──────────────────────────╮  ┌──────────────────────────╮         │
│  │ CPU Usage (24h)          │  │ Memory Usage (24h)       │         │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │         │
│  │  │   ╱╲    ╱╲         │  │  │  │   ╱╲    ╱╲         │  │         │
│  │  │  ╱  ╲  ╱  ╲        │  │  │  │  ╱  ╲  ╱  ╲        │  │         │
│  │  │ ╱    ╲╱    ╲       │  │  │  │ ╱    ╲╱    ╲       │  │         │
│  │  └────────────────────┘  │  │  └────────────────────┘  │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
│                                                                     │
│  ┌──────────────────────────╮  ┌──────────────────────────╮         │
│  │ Disk Usage               │  │ System Info              │         │
│  │                          │  │                          │         │
│  │ /dev/sda1 ████████░░ 45%│  │ OS:   Debian 12 x86_64  │         │
│  │ /dev/sdb1 ██████████ 80%│  │ Kern: 6.8.0             │         │
│  │ /dev/sdc1 ██░░░░░░░░ 15%│  │ Host: tf-sv-01          │         │
│  │                          │  │ CPU:  AMD EPYC 24C/48T │         │
│  └──────────────────────────┘  └──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

**交互**:
- 顶部标签页切换服务器，激活标签 accent 色下划线
- 切换后所有图表/数据刷新为选中服务器的数据
- 标签右侧"＋ Add"按钮跳转到 Settings 添加服务器
- 服务器名旁绿点(●) / 红点(○) 表示在线状态

**HTTP Metrics 端点协议**:

每台服务器上部署一个轻量 HTTP 端点，暴露 `/metrics` 路径，返回如下 JSON：

```json
GET http://<server>:<port>/metrics

{
  "hostname": "tf-sv-01",
  "uptime_seconds": 1234500,
  "cpu": {
    "percent": 45.2,
    "load_1m": 2.5,
    "load_5m": 1.8,
    "load_15m": 1.2
  },
  "memory": {
    "total_mb": 32768,
    "used_mb": 8192,
    "available_mb": 22528,
    "percent": 25.0
  },
  "disk": [
    {
      "mount": "/",
      "device": "/dev/sda1",
      "total_gb": 500,
      "used_gb": 120,
      "percent": 24.0
    }
  ],
  "network": {
    "rx_bytes": 1500000000000,
    "tx_bytes": 800000000000
  },
  "os": {
    "platform": "linux",
    "distro": "Debian GNU/Linux 12",
    "kernel": "6.8.0-x86_64"
  },
  "cpu_info": {
    "model": "AMD EPYC 7763 24-Core Processor",
    "cores": 24,
    "threads": 48
  },
  "timestamp": "2026-06-11T10:00:00Z"
}
```

tf-dashboard 后端定时（默认 30s）请求各服务器的 `/metrics` 端点，写入 `server_metrics` 表。

对比采集方式：

| 方式 | 优点 | 缺点 |
|------|------|------|
| **HTTP Metrics**（选用） | 部署简单，标准协议，无侵入 | 需在目标服务器上跑一个轻量进程 |
| SSH 直连 | 无需部署 Agent | 需管理 SSH 凭据，连接开销大 |
| 本地 Agent 上报 | 灵活，可推可拉 | 部署维护复杂 |

### 4.5 Settings 页

```
┌───────────────────────────────────────────────────────────────┐
│  Settings                                                     │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Data Sources                                           │   │
│  │                                                         │   │
│  │  OpenCode DB Path ────────────────────────────────┐    │   │
│  │  │ ~/.local/share/opencode/opencode.db        [✓] │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                         │   │
│  │  DeepSeek API Key ────────────────────────────────┐    │   │
│  │  │ sk-*******************************ox1A      [✓] │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  │                                                         │   │
│  │  PostgreSQL ───────────────────────────────────────┐    │   │
│  │  │ postgresql://zhangyuan:zhangyuan@100.125.148.23:5432/tf_dashboard    [✓] │    │   │
│  │  └────────────────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Servers                                                │   │
│  │                                                         │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │ Name │ Endpoint                   │ Status │  ✎  │   │   │
│  │  ├─────────────────────────────────────────────────┤   │   │
│  │  │sv-01 │ http://192.168.1.10:9100/metrics │ ● Onl │  ✎ ✕│   │   │
│  │  │sv-02 │ http://192.168.1.11:9100/metrics │ ● Onl │  ✎ ✕│   │   │
│  │  │sv-03 │ http://192.168.1.12:9100/metrics │ ○ Off │  ✎ ✕│   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                          [＋ Add Server] │   │
│  │                                                         │   │
│  │  添加服务器:                                            │   │
│  │  名称 ─────────┐   Metrics URL ────────────────────┐   │   │
│  │  │ sv-04    │   │ http://10.0.0.1:9100/metrics │   │   │
│  │  └──────────────┘   └──────────────────────────────┘   │   │
│  │  标签(可选) ────────┐                      [Test] [Save]│   │
│  │  │ prod,web     │                                   │   │
│  │  └──────────────────┘                                   │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Polling Interval                                       │   │
│  │                                                         │   │
│  │  OpenCode: [60s ▼]  Server: [30s ▼]  DeepSeek: [5m ▼] │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  About                                                  │   │
│  │  tf-dashboard v0.1.0 · Built with Bun + React          │   │
│  │  Data: OpenCode SQLite · DeepSeek API · HTTP /metrics  │   │
│  └────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. 组件树

```
App
├── Sidebar
│   ├── Logo (项目标识)
│   ├── NavItem (×5: Dashboard/OpenCode/DeepSeek/Server/Settings)
│   └── VersionBadge
├── TopBar
│   ├── PageTitle
│   ├── LiveIndicator
│   │   ├── StatusDot (绿/黄/红)
│   │   └── LastUpdated (文本)
│   ├── TimeRangeSelector (下拉: 24h / 7d / 30d / 90d / All)
│   └── RefreshButton
└── ContentArea
    ├── DashboardPage
    │   ├── SummaryCards (Grid 2×2)
    │   │   └── SummaryCard (×4)
    │   ├── TokenUsageTrend (AreaChart)
    │   ├── CostByModel (PieChart)
    │   ├── RecentSessions (MiniTable)
    │   └── ServerStatus (MiniProgressBars)
    ├── OpenCodePage
    │   ├── TokenUsageDaily (StackedAreaChart)
    │   ├── CostTrend (BarChart)
    │   ├── CostByAgent (HorizontalBarChart)
    │   ├── CacheHitRatio (RadialGauge)
    │   └── SessionsTable
    │       ├── TableHeader (sortable)
    │       ├── TableRow (×N)
    │       └── Pagination
    ├── DeepSeekPage
    │   ├── BalanceCards (Grid 1×3)
    │   ├── BalanceHistory (LineChart)
    │   └── RecentCalls (MiniTable)
    ├── ServerPage
    │   ├── ServerTabs (标签页切换)
    │   │   ├── ServerTab (×N, 激活态下划线)
    │   │   └── AddServerButton
    │   ├── ServerMeta (在线状态+主机信息)
    │   ├── MetricCards (Grid 1×3)
    │   ├── CpuChart (AreaChart)
    │   ├── MemoryChart (AreaChart)
    │   ├── DiskUsage (ProgressBar)
    │   └── SystemInfo (KeyValueList)
    └── SettingsPage
        ├── DataSourcesSection
        │   ├── ConfigInput (OpenCode DB Path)
        │   ├── ConfigInput (DeepSeek API Key, masked)
        │   └── ConfigInput (PostgreSQL URL)
        ├── ServersSection
        │   ├── ServerList
        │   │   └── ServerRow (×N: name, endpoint, status, edit/delete)
        │   ├── AddServerForm
        │   │   ├── TextInput (name)
        │   │   ├── TextInput (metrics URL)
        │   │   ├── TextInput (labels)
        │   │   ├── TestButton
        │   │   └── SaveButton
        │   └── ServerHealthIndicator
        ├── PollingSection
        │   └── PollIntervalPicker (×3)
        └── AboutSection
```

---

## 6. 交互模式

| 交互 | 行为 |
|------|------|
| **导航切换** | 点击 sidebar 项，路由切换，URL 更新，无刷新 |
| **时间范围** | 下拉选择器，切换后所有图表统一刷新到该范围 |
| **排序** | 表格列头点击，升序/降序/无循环 |
| **刷新** | 手动刷新按钮 + 自动轮询（websocket 或轮询） |
| **Hover 图表** | tooltip 显示精确数值 |
| **点击图表图例** | 切换显示/隐藏该系列 |
| **响应式** | `< 768px` 侧边栏折叠为汉堡菜单，图表单列堆叠 |

### 刷新策略

```
页面加载 → 立即拉取数据
        → 每 30s 自动轮询（可配置）
        → 手动刷新忽略缓存
        → 切换时间范围重新请求
```

---

## 7. 路由设计

```
/                     → 重定向到 /dashboard
/dashboard            → 总览页
/opencode             → OpenCode 用量详情
/deepseek             → DeepSeek 用量和余额
/server               → 服务器列表（默认选中第一台在线服务器）
/server/:id           → 指定服务器详情
/settings             → 配置页
```

---

## 8. Tailwind 暗色主题配置

```css
/* tailwind.config 中的主题色 */
:root {
  --color-surface-base: #09090b;
  --color-surface-elevated: #18181b;
  --color-surface-hover: #27272a;
  --color-surface-border: #27272a;
  --color-text-primary: #f4f4f5;
  --color-text-secondary: #a1a1aa;
  --color-text-muted: #71717a;
  --color-accent-blue: #3b82f6;
  --color-accent-emerald: #10b981;
  --color-accent-amber: #f59e0b;
  --color-accent-red: #ef4444;
  --color-accent-purple: #8b5cf6;
}
```

---

## 9. 后续可能考虑的设计增强

- **实时 WebSocket** 推送用量更新（而非轮询）
- **导出报表** (PDF/CSV)
- **多服务器** 切换和管理
- **告警规则** 配置（费用超限、Token 用量异常）
- **自定义时间范围** 日历选择器
- **移动端** 适配（当前优先桌面）
