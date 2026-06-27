import type { ResolvedJob } from '../types.js';
import { isWorkday } from './holiday.js';
import {
  getDatePartsInTimezone,
  parseTimeString,
  zonedTimeToUtc,
} from '../utils/timezone.js';

export type ResolvedWorkdayJob = Extract<ResolvedJob, { kind: 'workday' }>;

const MS_PER_DAY = 86_400_000;
const MAX_SCAN_DAYS = 400;

export function getWorkdayNextRun(from: Date, job: ResolvedWorkdayJob): Date | null {
  const { hour, minute, second } = parseTimeString(job.time);
  let cursor = from;

  for (let day = 0; day < MAX_SCAN_DAYS; day++) {
    const parts = getDatePartsInTimezone(cursor, job.timezone);
    const candidate = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      hour,
      minute,
      second,
      job.timezone,
    );

    if (candidate > from && isWorkday(candidate, job.timezone)) {
      return candidate;
    }

    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return null;
}

export function isWorkdayDue(at: Date, job: ResolvedWorkdayJob): boolean {
  const { hour, minute, second } = parseTimeString(job.time);
  const parts = getDatePartsInTimezone(at, job.timezone);
  return (
    parts.hour === hour &&
    parts.minute === minute &&
    parts.second === second &&
    isWorkday(at, job.timezone)
  );
}
