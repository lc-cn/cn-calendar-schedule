# cn-calendar-schedule

> **中国日历语义调度器** — 在国历、农历、法定假日、休息日、工作日这些概念上定任务，而不是在 cron 里拼补班和连休逻辑。

零运行时依赖的 TypeScript 模块。同一 `CalendarScheduler` 可混用五种调度；handler 自带国历/农历文本与节日名；节假日数据内置并可从国务院公示（gov.cn）自动拉取更新。

| 对比 | 通用 cron 库 | cn-calendar-schedule |
|------|-------------|----------------------|
| 触发语义 | 仅公历 cron | 国历 / 农历 / 法定假日 / 休息日 / 工作日 |
| 中国节假日 | 需自行对接数据 + 判断补班 | 内置数据 + `updateData({ force: true })` |
| 回调上下文 | 通常只有 `Date` | `solarText`、`lunarText`、可选 `festival` |

## 安装

```bash
npm install cn-calendar-schedule
```

## 快速开始

```typescript
import { CalendarScheduler, updateData, loadHolidayOverrides } from 'cn-calendar-schedule';

// 节假日：启动时加载 override，或从 gov.cn 公示数据拉取并持久化
await loadHolidayOverrides('.cn-calendar-schedule/holiday-overrides.json');
// await updateData(2027, { force: true, persist: true });

const schedule = new CalendarScheduler({
  timezone: 'Asia/Shanghai',
  onError: (err, job) => console.error(job.kind, err),
});

// 国历：6 段 cron — 秒 分 时 日 月 周
schedule.solar('0 0 9 * * 1', () => console.log('周报'));

// 农历：同样 6 段，日/月按农历解读
schedule.lunar('0 0 0 1 1 *', () => console.log('春节'));
schedule.lunar('0 0 9 15 1 *', () => console.log('元宵'));

// 法定假日 / 休息日 / 工作日：time 为 HH:mm 或 HH:mm:ss（省略秒时默认为 00）
schedule.holiday('09:00', () => {}); // 09:00:00
schedule.holiday('09:00:30', () => {}); // 精确到秒
schedule.holiday(
  { time: '09:00', festivals: ['春节', '国庆节'], everyDayOfHoliday: true },
  () => {},
); // 需 festivals 等选项时用对象

schedule.freeDay('09:00', () => console.log('休息日提醒'));
schedule.workday('09:00', (ctx) => {
  console.log(ctx.solarText, ctx.lunarText); // 2025年6月27日 乙巳年六月初三
});
```

`holiday` / `freeDay` / `workday` 按**日历日 + 时刻**触发（`HH:mm` 或 `HH:mm:ss`）；`solar` / `lunar` 则用 **6 段 cron（含秒）**。

五种调度方法签名统一为 **`(cron | time | input, handler, key?, extras?)`**：`key` 默认取 `handler.name`；匿名函数需显式传 `key` 才能持久化。详见 [注册与持久化](#注册与持久化)。

所有 `handler` 均收到 [`JobContext`](#jobcontext-handler-上下文)（含国历/农历文本、可选节日名等），详见下文。

## 注册与持久化

```typescript
function dailyReport(ctx) {
  console.log(ctx.solarText, ctx.lunarText);
}

// 命名函数：key 默认为 'dailyReport'，配置 store 时自动持久化
schedule.solar('0 0 9 * * 1', dailyReport);
schedule.lunar('0 0 9 15 1 *', dailyReport);
schedule.holiday('09:00', dailyReport);
schedule.freeDay('09:00', dailyReport);
schedule.workday('09:00', dailyReport);

// 显式 key + 任务 id
schedule.solar('0 0 9 * * *', dailyReport, 'daily-report', { id: 'daily' });

// 匿名 handler：仅内存，进程退出即丢失
schedule.solar('0 0 9 * * *', (ctx) => console.log(ctx.jobId));

// 匿名 handler 但需持久化：必须显式 key
schedule.workday('09:00', (ctx) => {}, 'workday-reminder', { id: 'wd-1' });
```

| 模式 | 写法 | 重启后 |
|------|------|--------|
| 内存 | `(…, 匿名 fn)` 且无 key | 任务丢失 |
| 持久化 | `(…, fn, key?, { id?, payload? })` | 从 store 恢复，handler 按 key 查 registry |
| 预注册 | 构造时 `handlers: { key: fn }` | 启动时须再次注入同名 handler |

配置 `store` 后 `await scheduler.ready` 恢复任务；也可 `await CalendarScheduler.create(options)`。

```typescript
import { CalendarScheduler, createLocalJsonStore } from 'cn-calendar-schedule';

const scheduler = await CalendarScheduler.create({
  timezone: 'Asia/Shanghai',
  store: createLocalJsonStore({ path: '.cn-calendar-schedule/jobs.json' }),
  handlers: { 'daily-report': dailyReport },
  reconcileIntervalMs: 1000,
});

scheduler.solar('0 0 9 * * *', dailyReport, 'daily-report');
scheduler.registerHandler('weekly', (ctx) => console.log(ctx.jobId));
```

**注意**：本地 JSON 适用于单进程；多进程写同一文件不安全。分布式场景预留 `JobStore.claim/release`，后续可通过 optional `peerDependencies`（`bullmq` / `ioredis`）扩展。

## holiday 法定假日调度

`schedule.holiday(time | input, handler, …)` 仅在**国务院法定假日**触发，不含普通周六、周日（普通周末请用 `freeDay`）。

第一个参数支持 **`'HH:mm'` / `'HH:mm:ss'` 字符串**或 **`HolidayInput` 对象**（需 `festivals`、`everyDayOfHoliday` 时用对象）：

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `time` | `string` | — | 触发时刻，**`HH:mm` 或 `HH:mm:ss`**（省略秒时默认为 `00`） |
| `festivals` | `'all'` 或 `FestivalName[]` | `'all'` | 过滤参与调度的法定假日类型（见下表） |
| `everyDayOfHoliday` | `boolean` | `false` | 是否覆盖整个连休区间，而非仅节日当天 |

### `festivals` 可选值

类型为 `FestivalName`，对应国务院节假日数据里各假期的**首日（锚点）**：

| 值 | 典型锚点示例（2024） |
|----|----------------------|
| `'元旦'` | 1 月 1 日 |
| `'春节'` | 农历正月初一所在公历日 |
| `'清明节'` | 4 月 4 日或 5 日 |
| `'劳动节'` | 5 月 1 日 |
| `'端午节'` | 农历五月初五所在公历日 |
| `'中秋节'` | 农历八月十五所在公历日 |
| `'国庆节'` | 10 月 1 日 |

可传单个或多个，例如 `festivals: ['春节', '国庆节']`。

### 触发规则

| `festivals` | `everyDayOfHoliday` | 行为 |
|-------------|---------------------|------|
| `'all'`（默认） | `false`（默认） | 每个法定假日的**节日当天**均触发（全年约 7 个锚点日） |
| `'all'` | `true` | **所有**法定假日日期均触发（各 `holidayRanges` 区间内每一天） |
| `['国庆节']` 等 | `false`（默认） | 仅对应节日的**当天**触发（如国庆仅 10/1） |
| `['国庆节']` 等 | `true` | 对应节日的**整个连休区间**均触发（如国庆 10/1–10/7） |

```typescript
// 每个法定假日的节日当天 09:00
schedule.holiday('09:00', handler);

// 仅国庆当天 09:00
schedule.holiday({ time: '09:00', festivals: ['国庆节'] }, handler);

// 国庆整个连休区间每天 09:00
schedule.holiday(
  { time: '09:00', festivals: ['国庆节'], everyDayOfHoliday: true },
  handler,
);
```

## freeDay 休息日调度

`schedule.freeDay(time, handler, …)` 在**休息日**触发。休息日 = 法定假日 + 正常周六、周日，**不含**补班日。

第一个参数支持 **`'HH:mm'` / `'HH:mm:ss'` 字符串**或 `{ time: 'HH:mm' }`。

与 `holiday` / `workday` 的关系：

| 方法 | 触发日 |
|------|--------|
| `holiday` | 仅法定假日（可过滤节日类型） |
| `freeDay` | 所有休息日（`!isWorkday`） |
| `workday` | 所有工作日（`isWorkday`，含补班） |

```typescript
schedule.freeDay('09:00', handler);
schedule.workday('09:00', handler);
```

辅助函数 `isFreeDay(date, timezone?)` 与 `isWorkday` 互为补集。

## updateData（节假日数据）

内置节假日数据为 2019–2026 年。可通过 `updateData` 在运行时扩展或覆盖。

### 推荐：自动拉取国务院公示数据

```typescript
import { updateData, loadHolidayOverrides } from 'cn-calendar-schedule';

// 从 holiday-cn（溯源 gov.cn 通知）拉取指定年份，强制覆盖内存，并持久化到本地
await updateData(2027, { force: true, persist: true });
// persist: true  → 默认写入 .cn-calendar-schedule/holiday-overrides.json
// persist: '/path/to/overrides.json'  → 自定义路径
```

| 选项 | 类型 | 说明 |
|------|------|------|
| `force` | `true` | 从 `holiday-cn` 拉取该年数据，**强制覆盖**内存中的节假日 |
| `persist` | `true \| string` | 写入 override 文件；`true` 使用默认路径 |

启动时加载已持久化的 override：

```typescript
await loadHolidayOverrides('.cn-calendar-schedule/holiday-overrides.json');
```

`updateData` 后已注册任务的 `nextRunAt` 会自动重算。

### 手动更新

```typescript
// 单年手动传入
await updateData(2027, {
  holidayRanges: [
    { start: '2027-01-01', end: '2027-01-03', festival: '元旦' },
    { start: '2027-10-01', end: '2027-10-07', festival: '国庆节' },
  ],
  workdays: ['2027-01-04'],
});

// 批量更新
await updateData({
  2027: { holidayRanges: [...], workdays: [...] },
  2028: { holidayRanges: [...], workdays: [...] },
});

// 手动更新并持久化
await updateData(
  2027,
  { holidayRanges: [...], workdays: [] },
  { persist: true },
);
```

### 维护内置 JSON（开发用）

运行时 `persist` 只写 override 文件，不会修改 npm 包内的 `src/data/holidays/`。维护者可使用 CLI 同步内置数据：

```bash
pnpm run sync-holiday -- 2027
```

## cron 格式（solar / lunar）

**6 段：`秒 分 时 日 月 周`**

| 段 | solar | lunar |
|----|-------|-------|
| 秒 分 时 | 触发时刻 | 触发时刻 |
| 日 月 | 公历日/月 | **农历日/月** |
| 周 | 星期匹配 | 写 `*`（忽略） |

```typescript
schedule.solar('0 0 9 * * 1', handler);   // 每周一 09:00:00
schedule.lunar('0 0 9 15 1 *', handler);  // 农历正月十五 09:00:00
```

农历 cron 要求秒/分/时为精确值（不支持 `*`）。

## 三种引入方式

```typescript
// ESM
import { CalendarScheduler } from 'cn-calendar-schedule';

// CJS
const { CalendarScheduler } = require('cn-calendar-schedule');

// UMD
// <script src="https://unpkg.com/cn-calendar-schedule/dist/index.global.js"></script>
// const s = new CnCalendarSchedule.CalendarScheduler();
```

## 公开 API

| 导出 | 说明 |
|------|------|
| `CalendarScheduler` | 调度器；内置 `handlers` 注册表；配置 `store` 时构造末尾异步恢复任务 |
| `.ready` | `Promise`，store 恢复完成后 resolve |
| `.registerHandler(key, handler)` | 向内置 registry 注册 handler |
| `.handlers` | 内置 `HandlerRegistry`，可 `.handlers.register(...)` |
| `.solar(cron, handler, key?, extras?)` | 国历 cron 任务 |
| `.lunar(cron, handler, key?, extras?)` | 农历 cron 任务 |
| `.holiday(time \| input, handler, key?, extras?)` | 法定假日；`time` 可传 `'HH:mm'` 或 `HolidayInput` |
| `.freeDay(time, handler, key?, extras?)` | 休息日；`time` 可传 `'HH:mm'` 或 `{ time }` |
| `.workday(time, handler, key?, extras?)` | 工作日；`time` 可传 `'HH:mm'` 或 `{ time }` |
| `.cancel(id)` / `.stop()` | 取消 / 停止 |
| `resolveSolarJob` / `resolveLunarJob` / … | 纯函数，构建 `ResolvedJob` |
| `getNextRun(job, from?)` | 计算下次触发时间 |
| `parseCron(expr)` | 解析 6 段 cron |
| `isWorkday(date, timezone?)` | 判断是否为中国法定工作日 |
| `isFreeDay(date, timezone?)` | 判断是否为休息日（`!isWorkday`） |
| `buildJobContext(...)` | 手动构建 `JobContext`（含日历文本） |
| `formatSolarText` / `formatLunarText` | 国历 / 农历文本格式化 |
| `getFestivalForDate(date, timezone?)` | 查询某日所属法定假日（连休区间内有效） |
| `updateData` | 运行时更新节假日；`{ force: true }` 自动拉取 gov.cn 公示数据 |
| `loadHolidayOverrides` | 启动时加载持久化的 override 文件 |
| `fetchHolidayYearData` | 仅拉取指定年份数据（不写入内存） |
| `getMinHolidayYear` / `getMaxHolidayYear` | 当前已加载节假日的年份范围 |
| `onHolidayDataUpdate` | 监听节假日数据变更（内部用于重算 nextRunAt） |
| `createLocalJsonStore` / `LocalJsonJobStore` | 本地 JSON 持久化驱动 |
| `HandlerRegistry` / `createHandlerRegistry` | 独立 registry（高级用法；通常直接用 `scheduler.handlers`） |

## JobContext（handler 上下文）

每个调度方法的 `handler` 类型为 `(ctx: JobContext) => void | Promise<void>`。任务到点触发时传入 `ctx`，描述**本次计划执行**的时间与日历信息（不是 `new Date()` 的当前时刻）。

### 字段

| 字段 | 类型 | 必有 | 说明 |
|------|------|------|------|
| `jobId` | `string` | ✓ | 任务 ID，与 `JobInfo.id` 相同，可用于 `cancel(id)` |
| `kind` | `ScheduleKind` | ✓ | 调度类型：`'solar'` \| `'lunar'` \| `'holiday'` \| `'freeDay'` \| `'workday'` |
| `scheduledAt` | `Date` | ✓ | 计划触发时刻（cron 指定的秒，或 `time` 对应的时/分/秒） |
| `solarText` | `string` | ✓ | 国历文本，按调度器 `timezone` 格式化，如 `2024年10月1日` |
| `lunarText` | `string` | ✓ | 农历文本，如 `甲辰年八月廿九`；超出农历表范围（1900–2100）时为 `''` |
| `festival` | `FestivalName` | — | 节假日名；仅当 `scheduledAt` 落在法定假日连休区间内时有值 |

### `festival` 何时有值

与任务类型无关，只看触发日是否在国务院 `holidayRanges` 区间内：

| 触发日 | `festival` |
|--------|-------------|
| 法定假日连休区间内（如国庆 10/1–10/7 任意一天） | `'元旦'`、`'春节'`、… 等 |
| 普通周末、补班日、普通工作日 | `undefined` |

因此 `freeDay` 在周六触发时通常无 `festival`；若恰逢法定假日连休中的某一天，仍会有 `festival`。

### 示例

```typescript
// solar / lunar / workday — 同样有 solarText、lunarText
schedule.solar('0 0 9 * * 1', (ctx) => {
  ctx.jobId;       // 'job_abc123'
  ctx.kind;        // 'solar'
  ctx.scheduledAt; // Date: 本次周一 09:00:00
  ctx.solarText;   // '2025年6月30日'
  ctx.lunarText;   // '乙巳年六月初六'
  ctx.festival;    // undefined（普通周一）
});

// holiday — 法定假日触发，festival 通常有值
schedule.holiday('09:00', (ctx) => {
  ctx.solarText;   // '2024年10月1日'
  ctx.lunarText;   // '甲辰年八月廿九'
  ctx.festival;    // '国庆节'
});

// freeDay — 普通周末无 festival；法定假日区间内的休息日有 festival
schedule.freeDay('09:00', (ctx) => {
  ctx.festival;    // 周六 undefined；国庆 10/3 为 '国庆节'
});
```

### 手动构建

测试或非调度场景可用 `buildJobContext` 生成相同结构：

```typescript
import { buildJobContext } from 'cn-calendar-schedule';

const ctx = buildJobContext('job-1', 'holiday', new Date('2024-10-01T09:00:00+08:00'), 'Asia/Shanghai');
```

## 类型

- `SchedulerOptions` — `{ timezone?, onError?, store?, storePath?, handlers?, reconcileIntervalMs? }`
- `ScheduleKind` — `'solar' | 'lunar' | 'holiday' | 'freeDay' | 'workday'`
- `ResolvedJob` — 扁平五分支配置
- `HolidayInput` — `{ time, festivals?, everyDayOfHoliday? }`；`time` 为 `HH:mm` 或 `HH:mm:ss`；`.holiday()` 亦接受 time 字符串
- `TimeInput` / `FreeDayInput` — `{ time }`；`.freeDay()` / `.workday()` 亦接受 time 字符串
- `FestivalFilter` — `'all' | FestivalName[]`
- `FestivalName` — `'元旦' | '春节' | '清明节' | '劳动节' | '端午节' | '中秋节' | '国庆节'`
- `JobHandler` — `(ctx: JobContext) => void | Promise<void>`
- `JobContext` — handler 上下文，字段见 [JobContext（handler 上下文）](#jobcontext-handler-上下文)
- `JobStore` / `StoredJob` — 持久化存储抽象与记录结构
- `JobRegisterExtras` — `{ id?, payload? }`（schedule 方法第 4 参数）
- `UpdateDataOptions` — `{ persist?: boolean | string; force?: boolean }`
- `HolidayYearData` — `{ holidayRanges: HolidayRange[]; workdays: string[] }`
- `HolidayRange` — `{ start: string; end: string; festival: string }`

## 数据范围

| 数据 | 范围 |
|------|------|
| 农历年表 | 1900–2100 |
| 节假日 JSON | 2019–2026 内置；可用 `updateData(year, { force: true })` 从 gov.cn 公示数据扩展 |

节假日 JSON 按年存放，结构示例：

```json
{
  "holidayRanges": [
    { "start": "2024-01-01", "end": "2024-01-01", "festival": "元旦" },
    { "start": "2024-02-10", "end": "2024-02-17", "festival": "春节" },
    { "start": "2024-10-01", "end": "2024-10-07", "festival": "国庆节" }
  ],
  "workdays": ["2024-02-04", "2024-09-29"]
}
```

- `holidayRanges`：法定假日区间（`start`/`end` 含首尾，`festival` 为节日名）
- `workdays`：国务院补班日（单日列表）

## 开发

```bash
pnpm install
pnpm test
pnpm run test:coverage
pnpm run build
pnpm run sync-holiday -- 2027   # 单年同步
pnpm run sync-holidays          # 批量同步（CI 同款）
```

CI/CD 与 npm 可信发布见 [.github/PUBLISHING.md](.github/PUBLISHING.md)。

## License

MIT
