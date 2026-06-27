# Examples

仓库内示例，需先构建 `dist/`：

```bash
pnpm run example:basic    # 注册任务 + 打印下次触发时间
pnpm run example:persist  # 本地 JSON 持久化与 handlerKey 恢复
```

| 文件 | 说明 |
|------|------|
| [basic.mjs](./basic.mjs) | `solar` / `workday` / `freeDay` / `holiday` 与 `getNextRun` |
| [persist.mjs](./persist.mjs) | `createLocalJsonStore` + 三段式 `(cron, handler, key)` |

临时文件写入 `examples/.tmp/`（已 gitignore）。
