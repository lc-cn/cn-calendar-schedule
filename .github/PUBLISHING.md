# npm 发布与 CI/CD

## GitHub Actions

| Workflow | 触发 | 作用 |
|----------|------|------|
| [ci.yml](./workflows/ci.yml) | push / PR | `pnpm test:coverage` + build |
| [publish.yml](./workflows/publish.yml) | 打 tag `v*` / 手动 | npm 可信发布（provenance） |
| [holiday-sync.yml](./workflows/holiday-sync.yml) | 每周一 10:00 北京时间 / 手动 | 同步国务院节假日 → minor 版本 → 发布 |

## npm Trusted Publishing（可信发布）

在 [npmjs.com](https://www.npmjs.com/) 完成一次性配置：

1. 创建 npm 账号（首次可选 `npm login`）
2. 进入包 **Settings → Trusted Publisher → GitHub Actions**
3. 添加 Trusted Publisher（workflow 文件名 **`publish.yml`**）
4. 填写 **Organization or user**、**Repository**（与 `package.json` 的 `repository` 一致）

配置完成后，`publish.yml` 通过 **OIDC** 发布，无需 `NPM_TOKEN`。`holiday-sync.yml` 打 tag 后会自动触发 `publish.yml`。

## 节假日定时同步

`holiday-sync.yml` 每周执行：

1. `scripts/sync-holidays-auto.mjs` — 同步当前年、下一年及本地已有年份（≥ 去年）
2. 若有 JSON 变更 → 测试 → `pnpm version minor` → push + tag → 由 `publish.yml` 发布

本地预览：`pnpm run sync-holidays`

## 手动发版

```bash
pnpm version minor
git push origin main --follow-tags
```

推送 `v*` tag 触发 `publish.yml`，或在 Actions 手动 Run **Publish**。
