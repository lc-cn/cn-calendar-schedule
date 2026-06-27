import { buildJobContext } from './context.js';
import { onHolidayDataUpdate } from './data/holiday-registry.js';
import { getNextRun } from './dispatch.js';
import {
  createJobId,
  resolveHandlerKey,
  toJobInfo,
  type InternalJob,
} from './job.js';
import {
  resolveHolidayJob,
  resolveFreeDayJob,
  resolveLunarJob,
  resolveSolarJob,
  resolveWorkdayJob,
} from './resolve-job.js';
import {
  createHandlerRegistry,
  type HandlerRegistry,
  type RegisteredHandler,
} from './store/handler-registry.js';
import { createLocalJsonStore } from './store/local-json-store.js';
import type { JobStore, StoredJob } from './store/types.js';
import { TimerWheel } from './timer/timer-wheel.js';
import type {
  HolidayInput,
  JobHandler,
  JobInfo,
  JobRegisterExtras,
  ResolvedJob,
  SchedulerOptions,
  TimeInput,
} from './types.js';
import { DEFAULT_TIMEZONE } from './types.js';

const DEFAULT_RECONCILE_INTERVAL_MS = 1_000;

export class CalendarScheduler {
  private readonly timezone: string;
  private readonly onError?: SchedulerOptions['onError'];
  private readonly store?: JobStore;
  readonly handlers: HandlerRegistry;
  private readonly reconcileIntervalMs: number;
  private readonly jobs = new Map<string, InternalJob>();
  private readonly timer: TimerWheel;
  private running = true;
  private started = false;
  private startPromise: Promise<void> | null = null;
  readonly ready: Promise<void>;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;
  private readonly executing = new Set<string>();
  private readonly unsubscribeHolidayUpdate: () => void;

  constructor(options: SchedulerOptions = {}) {
    this.timezone = options.timezone ?? DEFAULT_TIMEZONE;
    this.onError = options.onError;
    this.handlers = createHandlerRegistry(options.handlers);
    this.reconcileIntervalMs = options.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;

    if (options.store) {
      this.store = options.store;
    } else if (options.storePath) {
      this.store = createLocalJsonStore({ path: options.storePath });
    }

    this.timer = new TimerWheel((job) => this.executeJob(job));
    this.unsubscribeHolidayUpdate = onHolidayDataUpdate(() => {
      void this.recalculateAllJobs();
    });

    if (this.store) {
      this.ready = this.start();
    } else {
      this.ready = Promise.resolve();
    }
  }

  /** 等价于 `new CalendarScheduler(options)` 后 `await scheduler.ready` */
  static async create(options: SchedulerOptions = {}): Promise<CalendarScheduler> {
    const scheduler = new CalendarScheduler(options);
    await scheduler.ready;
    return scheduler;
  }

  registerHandler(key: string, handler: RegisteredHandler): this {
    this.handlers.register(key, handler);
    return this;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStart();
    return this.startPromise;
  }

  private async doStart(): Promise<void> {
    if (this.store) {
      const stored = await this.store.load();
      for (const record of stored) {
        if (record.cancelled) {
          continue;
        }
        const job = this.fromStoredJob(record);
        this.jobs.set(job.id, job);
        this.timer.add(job);
      }
    }

    this.started = true;
    if (this.store) {
      this.reconcileTimer = setInterval(() => {
        void this.reconcile();
      }, this.reconcileIntervalMs);
    }
  }

  solar(cron: string, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo {
    return this.register(resolveSolarJob(cron, this.timezone), handler, key, extras);
  }

  lunar(cron: string, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo {
    return this.register(resolveLunarJob(cron, this.timezone), handler, key, extras);
  }

  holiday(time: string, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  holiday(input: HolidayInput, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  holiday(
    input: string | HolidayInput,
    handler: JobHandler,
    key?: string,
    extras?: JobRegisterExtras,
  ): JobInfo {
    return this.register(
      resolveHolidayJob(typeof input === 'string' ? { time: input } : input, this.timezone),
      handler,
      key,
      extras,
    );
  }

  freeDay(time: string, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  freeDay(time: TimeInput, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  freeDay(
    time: string | TimeInput,
    handler: JobHandler,
    key?: string,
    extras?: JobRegisterExtras,
  ): JobInfo {
    return this.register(
      resolveFreeDayJob(typeof time === 'string' ? { time } : time, this.timezone),
      handler,
      key,
      extras,
    );
  }

  workday(time: string, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  workday(time: TimeInput, handler: JobHandler, key?: string, extras?: JobRegisterExtras): JobInfo;
  workday(
    time: string | TimeInput,
    handler: JobHandler,
    key?: string,
    extras?: JobRegisterExtras,
  ): JobInfo {
    return this.register(
      resolveWorkdayJob(typeof time === 'string' ? { time } : time, this.timezone),
      handler,
      key,
      extras,
    );
  }

  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job || job.cancelled) {
      return false;
    }
    job.cancelled = true;
    job.nextRunAt = null;
    this.timer.remove(id);
    this.jobs.delete(id);
    if (this.store && !job.ephemeral) {
      void this.store.remove(id);
    }
    return true;
  }

  stop(): void {
    this.running = false;
    this.unsubscribeHolidayUpdate();
    if (this.reconcileTimer != null) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    this.timer.stop();
    for (const job of this.jobs.values()) {
      job.cancelled = true;
      job.nextRunAt = null;
    }
    this.jobs.clear();
  }

  private register(
    resolved: ResolvedJob,
    handler: JobHandler,
    key?: string,
    extras?: JobRegisterExtras,
  ): JobInfo {
    if (!this.running) {
      throw new Error('Scheduler has been stopped');
    }

    const handlerKey = resolveHandlerKey(handler, key);

    if (handlerKey) {
      this.handlers.register(handlerKey, handler);
    }

    const id = extras?.id ?? createJobId();
    const nextRunAt = getNextRun(resolved, new Date());
    const ephemeral = !this.store || !handlerKey;

    const job: InternalJob = {
      id,
      resolved,
      handler: handlerKey ? undefined : handler,
      handlerKey,
      payload: extras?.payload,
      nextRunAt,
      cancelled: false,
      ephemeral,
    };

    this.jobs.set(id, job);
    this.timer.add(job);

    if (this.store && handlerKey) {
      void this.persistJob(job);
    }

    return toJobInfo(job, () => this.cancel(id));
  }

  private fromStoredJob(record: StoredJob): InternalJob {
    return {
      id: record.id,
      resolved: record.resolved,
      handlerKey: record.handlerKey,
      payload: record.payload,
      nextRunAt: record.nextRunAt ? new Date(record.nextRunAt) : null,
      cancelled: record.cancelled,
      ephemeral: false,
    };
  }

  private toStoredJob(job: InternalJob): StoredJob {
    return {
      id: job.id,
      resolved: job.resolved,
      handlerKey: job.handlerKey ?? '',
      payload: job.payload,
      nextRunAt: job.nextRunAt?.toISOString() ?? null,
      cancelled: job.cancelled,
      updatedAt: new Date().toISOString(),
    };
  }

  private async persistJob(job: InternalJob): Promise<void> {
    if (!this.store || job.ephemeral || !this.running) {
      return;
    }
    try {
      await this.store.upsert(this.toStoredJob(job));
    } catch {
      // persistence is best-effort (e.g. store path removed during shutdown)
    }
  }

  private async executeJob(job: InternalJob): Promise<void> {
    if (job.cancelled || !this.running || this.executing.has(job.id)) {
      return;
    }

    this.executing.add(job.id);
    this.timer.remove(job.id);

    try {
      const scheduledAt = job.nextRunAt ?? new Date();
      const ctx = buildJobContext(job.id, job.resolved.kind, scheduledAt, job.resolved.timezone);
      const handler = this.resolveHandler(job);

      if (!handler) {
        if (this.onError) {
          this.onError(
            new Error(`Handler not found for key: ${job.handlerKey ?? '(inline)'}`),
            toJobInfo(job, () => this.cancel(job.id)),
          );
        }
      } else {
        try {
          await handler(ctx);
        } catch (err) {
          if (this.onError) {
            this.onError(
              err instanceof Error ? err : new Error(String(err)),
              toJobInfo(job, () => this.cancel(job.id)),
            );
          }
        }
      }

      if (job.cancelled || !this.running) {
        return;
      }

      job.nextRunAt = getNextRun(job.resolved, new Date());
      if (job.nextRunAt == null) {
        job.cancelled = true;
        this.jobs.delete(job.id);
        if (this.store && !job.ephemeral) {
          void this.store.remove(job.id);
        }
        return;
      }

      if (this.store && !job.ephemeral) {
        await this.persistJob(job);
      }
      this.timer.update(job);
    } finally {
      this.executing.delete(job.id);
    }
  }

  private resolveHandler(job: InternalJob): JobHandler | undefined {
    if (job.handler) {
      return (ctx) => job.handler!(ctx);
    }
    if (job.handlerKey) {
      const registered = this.handlers.get(job.handlerKey);
      if (!registered) {
        return undefined;
      }
      return (ctx) => registered(ctx, job.payload);
    }
    return undefined;
  }

  private async recalculateAllJobs(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.cancelled) {
        continue;
      }
      job.nextRunAt = getNextRun(job.resolved, new Date());
      if (job.nextRunAt == null) {
        job.cancelled = true;
        this.timer.remove(job.id);
        this.jobs.delete(job.id);
        if (this.store && !job.ephemeral) {
          await this.store.remove(job.id);
        }
        continue;
      }
      this.timer.update(job);
      if (this.store && !job.ephemeral) {
        await this.persistJob(job);
      }
    }
  }

  private async reconcile(): Promise<void> {
    if (!this.store || !this.running) {
      return;
    }

    const dueRecords = await this.store.listDue(new Date());
    for (const record of dueRecords) {
      if (record.cancelled) {
        continue;
      }

      let job = this.jobs.get(record.id);
      if (!job) {
        job = this.fromStoredJob(record);
        this.jobs.set(job.id, job);
      }

      if (job.cancelled || job.nextRunAt == null) {
        continue;
      }

      if (job.nextRunAt.getTime() > Date.now()) {
        this.timer.update(job);
        continue;
      }

      if (this.executing.has(job.id)) {
        continue;
      }

      await this.executeJob(job);
    }
  }
}
