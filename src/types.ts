import type { JobStore } from './store/types.js';

export type ScheduleKind = 'solar' | 'lunar' | 'holiday' | 'freeDay' | 'workday';

export type FestivalName =
  | '元旦'
  | '春节'
  | '清明节'
  | '劳动节'
  | '端午节'
  | '中秋节'
  | '国庆节';

export type FestivalFilter = 'all' | FestivalName[];

export interface JobContext {
  jobId: string;
  kind: ScheduleKind;
  scheduledAt: Date;
  /** 国历文本，如「2024年10月1日」 */
  solarText: string;
  /** 农历文本，如「甲辰年九月初一」 */
  lunarText: string;
  /** 节假日名（法定假日连休区间内时有值，普通周末为 undefined） */
  festival?: FestivalName;
}

export type JobHandler = (ctx: JobContext) => void | Promise<void>;

export interface JobInfo {
  id: string;
  kind: ScheduleKind;
  nextRunAt: Date | null;
  cancel: () => void;
}

export interface SchedulerOptions {
  timezone?: string;
  onError?: (err: Error, job: JobInfo) => void;
  store?: JobStore;
  storePath?: string;
  /** 初始化内置 handler 注册表 */
  handlers?: Record<string, JobHandler>;
  workerId?: string;
  reconcileIntervalMs?: number;
}

/** 可选任务元数据（第 4 参数） */
export interface JobRegisterExtras {
  id?: string;
  payload?: unknown;
}

export interface TimeInput {
  time: string;
}

export interface HolidayInput extends TimeInput {
  festivals?: FestivalFilter;
  everyDayOfHoliday?: boolean;
}

export type FreeDayInput = TimeInput;

export type ResolvedJob =
  | { kind: 'solar'; cron: string; timezone: string }
  | { kind: 'lunar'; cron: string; timezone: string }
  | {
      kind: 'holiday';
      time: string;
      festivals: FestivalFilter;
      everyDayOfHoliday: boolean;
      timezone: string;
    }
  | { kind: 'freeDay'; time: string; timezone: string }
  | { kind: 'workday'; time: string; timezone: string };

export class InvalidScheduleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidScheduleError';
  }
}

export const DEFAULT_TIMEZONE = 'Asia/Shanghai';
