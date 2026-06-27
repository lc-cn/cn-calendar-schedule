import { afterEach, describe, expect, it, vi } from 'vitest';
import * as cronParser from '../src/parsers/cron.js';
import {
  resolveHolidayJob,
  resolveLunarJob,
  resolveSolarJob,
} from '../src/resolve-job.js';
import * as timezone from '../src/utils/timezone.js';
import { InvalidScheduleError } from '../src/types.js';

describe('resolve-job branch coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps non-Error parseCron failures for solar', () => {
    vi.spyOn(cronParser, 'parseCron').mockImplementation(() => {
      throw 'bad cron';
    });
    expect(() => resolveSolarJob('0 0 9 * * *')).toThrow(InvalidScheduleError);
    expect(() => resolveSolarJob('0 0 9 * * *')).toThrow('Invalid cron expression');
  });

  it('wraps non-Error parseCron failures for lunar', () => {
    vi.spyOn(cronParser, 'parseCron').mockImplementation(() => {
      throw 'bad lunar cron';
    });
    expect(() => resolveLunarJob('0 0 9 1 1 *')).toThrow(InvalidScheduleError);
    expect(() => resolveLunarJob('0 0 9 1 1 *')).toThrow('Invalid lunar cron expression');
  });

  it('wraps non-Error parseTimeString failures for holiday', () => {
    vi.spyOn(timezone, 'parseTimeString').mockImplementation(() => {
      throw 'bad time';
    });
    expect(() => resolveHolidayJob({ time: '09:00' })).toThrow(InvalidScheduleError);
    expect(() => resolveHolidayJob({ time: '09:00' })).toThrow('Invalid time format');
  });

  it('rethrows InvalidScheduleError from lunar wildcard validation', () => {
    expect(() => resolveLunarJob('0 0 * 1 1 *')).toThrow(/exact hour/);
  });
});
