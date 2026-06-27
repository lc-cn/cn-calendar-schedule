import type { ResolvedJob } from '../types.js';
import { isWorkday } from './holiday.js';
import {
  getDatePartsInTimezone,
  parseTimeString,
  zonedTimeToUtc,
} from '../utils/timezone.js';

export type ResolvedFreeDayJob = Extract<ResolvedJob, { kind: 'freeDay' }>;

const MS_PER_DAY = 86_400_000;
const MAX_SCAN_DAYS = 400;

/** Rest day: official holidays + regular weekends, excluding makeup workdays. */
export function isFreeDay(date: Date, timezone = 'Asia/Shanghai'): boolean {
  return !isWorkday(date, timezone);
}

export function getFreeDayNextRun(from: Date, job: ResolvedFreeDayJob): Date | null {
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

    if (candidate > from && isFreeDay(candidate, job.timezone)) {
      return candidate;
    }

    cursor = new Date(cursor.getTime() + MS_PER_DAY);
  }
  return null;
}

export function isFreeDayDue(at: Date, job: ResolvedFreeDayJob): boolean {
  const { hour, minute, second } = parseTimeString(job.time);
  const parts = getDatePartsInTimezone(at, job.timezone);
  if (parts.hour !== hour || parts.minute !== minute || parts.second !== second) {
    return false;
  }
  return isFreeDay(at, job.timezone);
}
