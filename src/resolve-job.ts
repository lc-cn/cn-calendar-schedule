import { parseCron } from './parsers/cron.js';
import {
  InvalidScheduleError,
  DEFAULT_TIMEZONE,
  type HolidayInput,
  type ResolvedJob,
  type TimeInput,
} from './types.js';
import { parseTimeString } from './utils/timezone.js';

function validateCron(cron: string): void {
  try {
    parseCron(cron);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid cron expression',
    );
  }
}

function validateLunarCron(cron: string): void {
  let fields;
  try {
    fields = parseCron(cron);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid lunar cron expression',
    );
  }
  for (const [name, values] of [
    ['second', fields.second],
    ['minute', fields.minute],
    ['hour', fields.hour],
  ] as const) {
    if (values.length !== 1) {
      throw new InvalidScheduleError(
        `Lunar cron requires exact ${name}; wildcards are not supported`,
      );
    }
  }
}

export function resolveSolarJob(
  cron: string,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  validateCron(cron);
  return { kind: 'solar', cron, timezone };
}

export function resolveLunarJob(
  cron: string,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  try {
    validateLunarCron(cron);
  } catch (err) {
    if (err instanceof InvalidScheduleError) {
      throw err;
    }
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid lunar cron expression',
    );
  }
  return { kind: 'lunar', cron, timezone };
}

export function resolveHolidayJob(
  input: HolidayInput,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  try {
    parseTimeString(input.time);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid time format',
    );
  }
  return {
    kind: 'holiday',
    time: input.time,
    festivals: input.festivals ?? 'all',
    everyDayOfHoliday: input.everyDayOfHoliday ?? false,
    timezone,
  };
}

export function resolveFreeDayJob(
  time: TimeInput,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  try {
    parseTimeString(time.time);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid time format',
    );
  }
  return { kind: 'freeDay', time: time.time, timezone };
}

export function resolveWorkdayJob(
  time: TimeInput,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  try {
    parseTimeString(time.time);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid time format',
    );
  }
  return { kind: 'workday', time: time.time, timezone };
}
