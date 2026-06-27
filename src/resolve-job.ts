import { parseCron, validateCalendarCron } from './parsers/cron.js';
import {
  InvalidScheduleError,
  DEFAULT_TIMEZONE,
  type HolidayInput,
  type ResolvedJob,
  type ScatterInput,
} from './types.js';
import { parseTimeOfDay } from './utils/scatter-slots.js';

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

function validateCalendarScheduleCron(cron: string): void {
  try {
    validateCalendarCron(cron);
  } catch (err) {
    throw new InvalidScheduleError(
      err instanceof Error ? err.message : 'Invalid calendar cron expression',
    );
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
  validateLunarCron(cron);
  return { kind: 'lunar', cron, timezone };
}

export function resolveHolidayJob(
  input: HolidayInput,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  validateCalendarScheduleCron(input.cron);
  return {
    kind: 'holiday',
    cron: input.cron,
    festivals: input.festivals ?? 'all',
    everyDayOfHoliday: input.everyDayOfHoliday ?? false,
    timezone,
  };
}

export function resolveFreeDayJob(
  cron: string,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  validateCalendarScheduleCron(cron);
  return { kind: 'freeDay', cron, timezone };
}

export function resolveWorkdayJob(
  cron: string,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  validateCalendarScheduleCron(cron);
  return { kind: 'workday', cron, timezone };
}

export function resolveScatterJob(
  input: ScatterInput,
  timezone: string = DEFAULT_TIMEZONE,
): ResolvedJob {
  let windowStartSec: number;
  let windowEndSec: number;
  try {
    windowStartSec = parseTimeOfDay(input.window.start);
    windowEndSec = parseTimeOfDay(input.window.end);
  } catch (err) {
    throw new InvalidScheduleError(err instanceof Error ? err.message : 'Invalid scatter window');
  }

  if (!Number.isInteger(input.count) || input.count < 1) {
    throw new InvalidScheduleError('Scatter count must be a positive integer');
  }

  if (windowStartSec >= windowEndSec) {
    throw new InvalidScheduleError('Scatter window start must be before end');
  }

  const span = windowEndSec - windowStartSec + 1;
  if (input.count > span) {
    throw new InvalidScheduleError('Scatter count exceeds window capacity');
  }

  if (typeof input.on === 'object' && input.on.kind !== 'holiday') {
    throw new InvalidScheduleError('Invalid scatter day filter');
  }

  if (
    input.on !== 'all' &&
    input.on !== 'workday' &&
    input.on !== 'freeDay' &&
    (typeof input.on !== 'object' || input.on.kind !== 'holiday')
  ) {
    throw new InvalidScheduleError('Invalid scatter day filter');
  }

  return {
    kind: 'scatter',
    window: input.window,
    windowStartSec,
    windowEndSec,
    count: input.count,
    on: input.on,
    timezone,
  };
}
