import { describe, expect, it } from 'vitest';
import { getNextRun, isJobDue } from '../src/dispatch.js';
import { isWorkday } from '../src/resolvers/holiday.js';
import { resolveWorkdayJob } from '../src/resolve-job.js';

const TZ = 'Asia/Shanghai';

function at(iso: string): Date {
  return new Date(iso);
}

describe('WorkdayResolver', () => {
  it('triggers on regular weekday', () => {
    const job = resolveWorkdayJob({ time: '09:00' }, TZ);
    expect(isJobDue(job, at('2024-09-23T09:00:00+08:00'))).toBe(true);
  });

  it('triggers on makeup workday Sunday', () => {
    const job = resolveWorkdayJob({ time: '09:00' }, TZ);
    expect(isJobDue(job, at('2024-09-29T09:00:00+08:00'))).toBe(true);
    expect(isWorkday(at('2024-09-29T09:00:00+08:00'), TZ)).toBe(true);
  });

  it('does not trigger on regular weekend', () => {
    const job = resolveWorkdayJob({ time: '09:00' }, TZ);
    expect(isJobDue(job, at('2024-09-22T09:00:00+08:00'))).toBe(false);
    const next = getNextRun(job, at('2024-09-20T10:00:00+08:00'));
    expect(next?.toISOString()).toBe(at('2024-09-23T09:00:00+08:00').toISOString());
  });

  it('does not trigger on statutory holiday weekday', () => {
    const job = resolveWorkdayJob({ time: '09:00' }, TZ);
    expect(isJobDue(job, at('2024-10-01T09:00:00+08:00'))).toBe(false);
    const next = getNextRun(job, at('2024-09-30T10:00:00+08:00'));
    expect(next?.toISOString()).toBe(at('2024-10-08T09:00:00+08:00').toISOString());
  });

  it('skips to next workday after holiday block', () => {
    const job = resolveWorkdayJob({ time: '09:00' }, TZ);
    const next = getNextRun(job, at('2024-02-08T10:00:00+08:00'));
    expect(next?.toISOString()).toBe(at('2024-02-09T09:00:00+08:00').toISOString());
  });
});
