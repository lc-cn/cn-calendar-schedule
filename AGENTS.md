# AGENTS.md — cn-calendar-schedule

面向 AI Agent 与贡献者的项目指南。

## 一句话

**中国日历语义调度器**：零 runtime 依赖，在国历 / 农历 / 法定假日 / 休息日 / 工作日上定任务。

## 开发依赖

| 包 | 版本 |
|----|------|
| vitest | ^4.1.9 |
| @vitest/coverage-v8 | ^4.1.9 |
| typescript | ^5.9.3 |
| @types/node | ^24.x |
| tsup | ^8.5.x |

## 常用命令

| 命令 | 用途 |
|------|------|
| `pnpm install` | 安装依赖（需 pnpm 11+，见 `packageManager` 字段） |
| `pnpm test` | 运行 Vitest（180 项，提交前必须通过） |
| `pnpm run test:coverage` | 覆盖率报告（lines/functions/statements ≥90%，branches ≥88%） |
| `pnpm run build` | tsup 构建 `dist/`（ESM/CJS/UMD + 类型） |
| `pnpm exec tsc --noEmit` | 类型检查 |
| `pnpm run sync-holidays` | 批量同步 bundled 节假日 JSON + 重建 registry（CI 同款） |
| `pnpm run sync-holiday -- 2027` | 从 holiday-cn 同步单年 bundled JSON（维护者） |
| `pnpm run generate-holiday-registry` | 根据 `holidays/*.json` 重建 `holiday-registry.ts` imports |

## CI/CD

GitHub Actions 见 [`.github/PUBLISHING.md`](.github/PUBLISHING.md)：

| Workflow | 触发 | 作用 |
|----------|------|------|
| `ci.yml` | push / PR | 覆盖率测试 + build |
| `publish.yml` | tag `v*` / 手动 | npm 可信发布（OIDC provenance） |
| `holiday-sync.yml` | 每周一 10:00 北京时间 / 手动 | 同步国务院节假日 → 有变更则 minor 发版 |

npm 需在包 Settings 为 `publish.yml` 配置 **Trusted Publisher**（GitHub Actions OIDC，无需 `NPM_TOKEN`）。

## 目录结构

```
src/
├── scheduler.ts          # CalendarScheduler：任务注册、TimerWheel、store、handlers
├── types.ts              # 公开类型
├── resolve-job.ts        # solar/lunar/holiday/freeDay/workday → ResolvedJob
├── dispatch.ts           # getNextRun / isJobDue 按 kind 分发
├── context.ts            # JobContext（solarText, lunarText, festival）
├── job.ts                # InternalJob、JobHeap
├── resolvers/            # 各 kind 的 next-run 实现
├── parsers/cron.ts       # 6 段 cron 解析
├── data/
│   ├── holiday-registry.ts   # 内存 registry、updateData、loadHolidayOverrides
│   ├── holiday-fetcher.ts    # holiday-cn 拉取与转换
│   ├── holidays/*.json       # bundled 年度数据（2019–2026）
│   └── lunar-table.ts        # 农历年表 1900–2100
├── store/                # JobStore、LocalJsonJobStore、HandlerRegistry
└── timer/timer-wheel.ts  # 单定时器 min-heap 调度

tests/                    # Vitest；临时文件在 tests/.tmp/
scripts/sync-holiday.mjs  # 维护者同步 bundled JSON
```

## 架构要点

### 调度流程

1. `schedule.solar/lunar/holiday/freeDay/workday(cron|input, handler|options)` 注册任务
2. `resolve*Job` 产出扁平 `ResolvedJob`
3. `getNextRun` 按 `kind` 调用对应 resolver
4. `TimerWheel` 按 `nextRunAt` 触发 → `buildJobContext` → handler
5. 周期性任务重算 next run；一次性任务 nextRun=null 时移除

### CalendarScheduler 持久化

```typescript
const scheduler = new CalendarScheduler({
  store: createLocalJsonStore({ path: '.cn-calendar-schedule/jobs.json' }),
  handlers: { daily: (ctx) => {} },  // 可选初始化
});
await scheduler.ready;  // 有 store 时异步恢复已持久化任务

scheduler.registerHandler('daily', handler);  // 或 scheduler.handlers.register
scheduler.solar('0 0 9 * * *', { handlerKey: 'daily', id: '...' });
scheduler.solar('0 0 9 * * *', { handlerKey: 'daily', handler, id: '...' }); // 自动 register
```

- inline handler → 内存任务（ephemeral），不写入 store
- `handlerKey` → 持久化任务配置；handler 从内置 registry 查找
- `reconcile` 循环（默认 1s）处理 store 中 overdue 任务
- `CalendarScheduler.create()` = `new` + `await ready`

### 节假日数据

三层，勿混用：

| 层 | 路径/机制 | 谁写 |
|----|-----------|------|
| Bundled | 编译进 dist | `pnpm run sync-holiday` |
| Override | `.cn-calendar-schedule/holiday-overrides.json` | `updateData(..., { persist: true })` |
| 内存 | `holiday-registry` Map | `updateData` / `loadHolidayOverrides` |

主路径：`await updateData(year, { force: true, persist: true })`

变更后 `onHolidayDataUpdate` 通知 scheduler 重算所有 job 的 `nextRunAt`。

### 语义速查

- **holiday**：仅法定假日；`festivals` 过滤；`everyDayOfHoliday` 控制连休区间
- **freeDay**：`!isWorkday`（含周末 + 法定假日，排除补班）
- **workday**：`isWorkday`（含补班）
- **lunar cron**：6 段同 solar，日/月按农历；秒分时须为精确值

## 开发原则

### 先 UX/API，后实现

1. 明确主路径示例（README 片段）
2. 明确非目标（如运行时不可写 bundled 路径）
3. 实现 + 测试
4. 同步 README、`package.json` description/keywords、`src/index.ts` 导出

### 代码风格

- 零 runtime 依赖；最小 diff；不 over-engineer
- ESM + `.js` import 后缀；strict TypeScript
- 注释只解释非 obvious 逻辑

### 测试

- 新行为必须有 meaningful 测试
- 持久化/reconcile 用 fake timers + 隔离 tmp 目录
- holiday-fetcher 用 mock fetch，不依赖网络

## 公开 API 入口

所有对外导出经 `src/index.ts`。新增公开符号时同步：

- `dist/index.d.ts`（build 产出）
- README「公开 API」表
- 必要时 AGENTS.md 与 `.cursor/rules/`

## Cursor Rules

细则见 `.cursor/rules/`：

| 文件 | 范围 |
|------|------|
| `project.mdc` | 定位、分层、语义边界（always） |
| `api-ux.mdc` | API/UX 原则与检查清单（always） |
| `typescript.mdc` | TS 实现约定 |
| `holiday-data.mdc` | 节假日数据与 updateData |
| `tests-and-docs.mdc` | 测试与 README 同步 |

## 非目标（当前版本）

- 分布式任务队列（BullMQ 为 optional peer，接口预留）
- 多进程安全写同一 JSON store
- 浏览器端完整调度（UMD 存在但非主场景）
