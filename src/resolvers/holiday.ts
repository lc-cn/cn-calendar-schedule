import type { FestivalFilter, FestivalName, ResolvedJob } from '../types.js';
import {
  expandRange,
  getHolidaySet,
  getWorkdaySet,
  getYearData,
  iterateYears,
} from '../data/holiday-registry.js';
import { matchesFestivalFilter, normalizeFestivalKey } from '../utils/festival-map.js';
import {
  formatDateKey,
  getDatePartsInTimezone,
  parseTimeString,
  zonedTimeToUtc,
} from '../utils/timezone.js';

export type ResolvedHolidayJob = Extract<ResolvedJob, { kind: 'holiday' }>;

export type { HolidayRange, HolidayYearData } from '../data/holiday-registry.js';
export {
  MIN_HOLIDAY_YEAR,
  MAX_HOLIDAY_YEAR,
  getMinHolidayYear,
  getMaxHolidayYear,
  onHolidayDataUpdate,
} from '../data/holiday-registry.js';

function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map((v) => parseInt(v, 10));
  return { year: y, month: m, day: d };
}

function isDateInRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export function isWorkday(date: Date, timezone = 'Asia/Shanghai'): boolean {
  const parts = getDatePartsInTimezone(date, timezone);
  const key = formatDateKey(date, timezone);

  const holidays = getHolidaySet(parts.year);
  const workdays = getWorkdaySet(parts.year);
  if (!holidays || !workdays) {
    return parts.dayOfWeek >= 1 && parts.dayOfWeek <= 5;
  }

  if (holidays.has(key)) {
    return false;
  }
  if (workdays.has(key)) {
    return true;
  }
  return parts.dayOfWeek >= 1 && parts.dayOfWeek <= 5;
}

export function getFestivalForDate(
  date: Date,
  timezone = 'Asia/Shanghai',
): FestivalName | undefined {
  const parts = getDatePartsInTimezone(date, timezone);
  const key = formatDateKey(date, timezone);
  const data = getYearData(parts.year);
  if (!data) {
    return undefined;
  }

  for (const range of data.holidayRanges) {
    if (isDateInRange(key, range.start, range.end)) {
      return normalizeFestivalKey(range.festival);
    }
  }

  return undefined;
}

function collectHolidayTriggerDates(
  festivals: FestivalFilter,
  everyDayOfHoliday: boolean,
): string[] {
  const dates = new Set<string>();

  iterateYears((_year, data) => {
    for (const range of data.holidayRanges) {
      if (!matchesFestivalFilter(range.festival, festivals)) {
        continue;
      }
      if (everyDayOfHoliday) {
        for (const date of expandRange(range.start, range.end)) {
          dates.add(date);
        }
      } else {
        dates.add(range.start);
      }
    }
  });

  return [...dates].sort();
}

function dateKeyToUtc(
  dateKey: string,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return zonedTimeToUtc(year, month, day, hour, minute, 0, timezone);
}

export function getHolidayNextRun(from: Date, job: ResolvedHolidayJob): Date | null {
  const { hour, minute } = parseTimeString(job.time);
  const candidates = collectHolidayTriggerDates(job.festivals, job.everyDayOfHoliday);

  for (const dateKey of candidates) {
    const runAt = dateKeyToUtc(dateKey, hour, minute, job.timezone);
    if (runAt > from) {
      return runAt;
    }
  }
  return null;
}

export function isHolidayDue(at: Date, job: ResolvedHolidayJob): boolean {
  const { hour, minute } = parseTimeString(job.time);
  const parts = getDatePartsInTimezone(at, job.timezone);
  if (parts.hour !== hour || parts.minute !== minute) {
    return false;
  }
  const key = formatDateKey(at, job.timezone);
  const candidates = collectHolidayTriggerDates(job.festivals, job.everyDayOfHoliday);
  return candidates.includes(key);
}
