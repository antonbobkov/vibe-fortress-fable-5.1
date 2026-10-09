import { describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const api = (await import(new URL('../../scripts/seed-hashes.mjs', import.meta.url).href)) as {
  seedHashes(text: string): Record[];
  previousSeedGate(directory: string): { name: string; records: Record[] } | null;
  compareSeedHashes(
    current: Record[],
    previous: Record[],
  ): (Record & { previous: string | null; result: string })[];
};
type Record = { seed: string; peril: number; tick: number; hash: string };
const record = { seed: 'three-years-p2-1', peril: 2, tick: 403200, hash: 'abc' };
const line = `[three_years_hash] ${JSON.stringify(record)}`;

describe('T-176 gate seed hash comparison', () => {
  it('extracts hash records from noisy perf output', () => {
    expect(api.seedHashes(`Tests 20 passed\n${line}\nother output`)).toEqual([record]);
  });
  it('rejects a malformed record instead of treating it as a baseline', () => {
    expect(() => api.seedHashes('[three_years_hash] {"seed":"x"}')).toThrow('invalid');
  });
  it('reports equal and changed hashes, and never compares a different tick or peril', () => {
    expect(api.compareSeedHashes([record], [record])[0]?.result).toBe('equal');
    expect(api.compareSeedHashes([record], [{ ...record, hash: 'def' }])[0]?.result).toBe(
      'CHANGED',
    );
    for (const old of [
      { ...record, tick: 100 },
      { ...record, peril: 4 },
    ])
      expect(api.compareSeedHashes([record], [old])[0]?.result).toBe('no comparable baseline');
  });
  it('uses the most recent recorded gate with hashes, leaving frozen reports untouched', () => {
    const directory = join('.vite', 't176-gate-controls');
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(join(directory, 'new-gate.md'), `Recorded: 2026-10-09T01:00:00.000Z\n${line}`);
      writeFileSync(join(directory, 'old-gate.md'), `Recorded: 2026-10-08T01:00:00.000Z\n${line}`);
      writeFileSync(join(directory, 'no-perf-gate.md'), 'Recorded: 2026-10-10T01:00:00.000Z');
      expect(api.previousSeedGate(directory)?.name).toBe('new-gate.md');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
