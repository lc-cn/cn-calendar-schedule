import { getFestivalForDate } from './resolvers/holiday.js';
import type { JobContext, ScheduleKind } from './types.js';
import { formatLunarText, formatSolarText } from './utils/calendar-text.js';

export function buildJobContext(
  jobId: string,
  kind: ScheduleKind,
  scheduledAt: Date,
  timezone: string,
): JobContext {
  return {
    jobId,
    kind,
    scheduledAt,
    solarText: formatSolarText(scheduledAt, timezone),
    lunarText: formatLunarText(scheduledAt, timezone),
    festival: getFestivalForDate(scheduledAt, timezone),
  };
}
