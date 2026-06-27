const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseTimeOfDay(value: string): number {
  const match = TIME_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid time: ${value}`);
  }
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const second = match[3] ? parseInt(match[3], 10) : 0;
  if (hour > 23 || minute > 59 || second > 59) {
    throw new Error(`Invalid time: ${value}`);
  }
  return hour * 3600 + minute * 60 + second;
}

export function seedFrom(jobId: string, dateKey: string): number {
  let hash = 2166136261;
  const input = `${jobId}:${dateKey}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDailySlots(
  jobId: string,
  dateKey: string,
  windowStartSec: number,
  windowEndSec: number,
  count: number,
): number[] {
  const span = windowEndSec - windowStartSec + 1;
  if (count > span) {
    throw new Error('count exceeds window capacity');
  }

  const rand = mulberry32(seedFrom(jobId, dateKey));
  const pool: number[] = [];
  for (let sec = windowStartSec; sec <= windowEndSec; sec++) {
    pool.push(sec);
  }

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count).sort((a, b) => a - b);
}
