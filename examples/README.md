# Examples

仓库内示例，需先构建 `dist/`：

```bash
pnpm run example:basic              # 注册任务 + 打印下次触发时间
pnpm run example:persist            # 本地 JSON 持久化与 handlerKey 恢复
pnpm run example:sqlite-persist     # SQLite 持久化（Node 22.5+ node:sqlite）
pnpm run example:scatter            # scatter 基础预览
pnpm run example:scatter-advanced   # minGap + quietHours + misfire
pnpm run example:holiday-eve        # 节前/节后 helper + scatter holidayEve
pnpm run example:scheduler-ops      # list / pause / resume + simulateNextRuns
pnpm run next-runs                  # CLI：模拟未来 N 次触发
```

| 文件 | 说明 |
|------|------|
| [basic.mjs](./basic.mjs) | `solar` / `workday` / `freeDay` / `holiday` 与 `getNextRun` |
| [persist.mjs](./persist.mjs) | `createLocalJsonStore` + 三段式 `(cron, handler, key)` |
| [sqlite-persist.mjs](./sqlite-persist.mjs) | `createSqliteStore` 单节点生产 store |
| [scatter.mjs](./scatter.mjs) | scatter 确定性 slot 预览 |
| [scatter-advanced.mjs](./scatter-advanced.mjs) | minGap / quietHours / listScatterSlotsForDay |
| [holiday-eve.mjs](./holiday-eve.mjs) | `isHolidayEve` / `afterHoliday` scatter 与 `simulateNextRuns` |
| [scheduler-ops.mjs](./scheduler-ops.mjs) | `list()` / `pause()` / `resume()` / `expiresAt` |

临时文件写入 `examples/.tmp/`（已 gitignore）。
