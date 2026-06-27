import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  addSeconds,
  formatDateKey,
  getDatePartsInTimezone,
  parseTimeString,
  startOfNextSecond,
  zonedTimeToUtc,
} from '../src/utils/timezone.js';

const TZ = 'Asia/Shanghai';

describe('timezone utils', () => {
  it('parseTimeString accepts HH:mm and HH:mm:ss', () => {
    expect(parseTimeString('09:00')).toEqual({ hour: 9, minute: 0, second: 0 });
    expect(parseTimeString(' 23:59 ')).toEqual({ hour: 23, minute: 59, second: 0 });
    expect(parseTimeString('09:30:45')).toEqual({ hour: 9, minute: 30, second: 45 });
  });

  it('parseTimeString rejects invalid format and values', () => {
    expect(() => parseTimeString('9am')).toThrow(/Invalid time format/);
    expect(() => parseTimeString('25:00')).toThrow(/Invalid time value/);
    expect(() => parseTimeString('12:60')).toThrow(/Invalid time value/);
    expect(() => parseTimeString('09:00:60')).toThrow(/Invalid time value/);
  });

  it('zonedTimeToUtc converts local wall time', () => {
    const utc = zonedTimeToUtc(2025, 6, 27, 9, 0, 0, TZ);
    expect(getDatePartsInTimezone(utc, TZ)).toMatchObject({
      year: 2025,
      month: 6,
      day: 27,
      hour: 9,
      minute: 0,
    });
  });

  it('addSeconds/addMinutes/startOfNextSecond adjust dates', () => {
    const base = new Date('2025-06-27T09:00:00+08:00');
    expect(addSeconds(base, 30).getTime()).toBe(base.getTime() + 30_000);
    expect(addMinutes(base, 2).getTime()).toBe(base.getTime() + 120_000);
    expect(startOfNextSecond(base).getTime()).toBe(base.getTime() + 1_000);
  });

  it('formatDateKey returns YYYY-MM-DD in timezone', () => {
    expect(formatDateKey(new Date('2025-06-27T23:00:00+08:00'), TZ)).toBe('2025-06-27');
  });
});
