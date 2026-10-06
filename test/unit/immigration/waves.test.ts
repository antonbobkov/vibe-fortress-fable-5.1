import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { RngStream, seedFor } from '@core/rng';
import { KEY_PROFESSIONS } from '@systems/immigration/constants';
import { coverage, planWave, waveSize } from '@systems/immigration/waves';

describe('T-M7-04 immigration waves', () => {
  const registry = contentRegistry();

  it('F-17d: clamps the computed size, then halves a winter wave (21 § Wave size, in the written order)', () => {
    expect(waveSize(12000, 3, 50, 40, false)).toBe(10);
    expect(waveSize(12000, 3, 50, 40, true)).toBe(5);
    expect(waveSize(60000, 4, 100, 3, false)).toBe(3);
    expect(waveSize(0, 2, 0, 0, false)).toBe(0);
    // The two orders differ once the clamp bites. Wealth 39,000, Content, reputation 0, 68 open
    // slots: 2 + 13 + 2 = 17, clamped to WAVE_MAX 12, halved to 6 (halving first gave 9).
    expect(waveSize(39000, 3, 0, 68, false)).toBe(12);
    expect(waveSize(39000, 3, 0, 68, true)).toBe(6);
    // Three open slots: 30 clamps to 3, and the winter wave is 2 (halving first gave 3).
    expect(waveSize(60000, 4, 100, 3, true)).toBe(2);
    // The lower clamp is applied before the halving too: IMMIGRANT_BASE 2 becomes a winter wave of 1.
    expect(waveSize(0, 2, 0, 40, false)).toBe(2);
    expect(waveSize(0, 2, 0, 40, true)).toBe(1);
  });

  it('gives children child ages and keeps every generated name unique', () => {
    const taken = new Set(['Domas Stonestar']);
    let children = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      const wave = planWave(registry, new RngStream(seed), 12, new Set(), taken);
      expect(wave).toHaveLength(12);
      children += wave.filter((member) => member.parentIndex >= 0 && member.record.ageYears < 12).length;
      for (const member of wave) {
        expect(member.record.needs).toBe(30);
        if (member.parentIndex >= 0) expect(member.record.ageYears).toBeLessThan(12);
      }
    }
    expect(children).toBeGreaterThan(0);
    expect(taken.size).toBe(1 + 30 * 12);
  });

  it('weights a missing medic over two typical waves', () => {
    const covered = coverage(registry, [Object.fromEntries(KEY_PROFESSIONS.filter((p) => p.id !== 'medic').map((p) => [p.primary, 5]))]);
    expect(covered.has('medic')).toBe(false);
    let successes = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const rng = new RngStream(seedFor(`im-composition-${seed}`, '21'));
      const taken = new Set<string>();
      const size = waveSize(18000, 3, 0, 80, false);
      const first = planWave(registry, rng, size, covered, taken);
      const second = planWave(registry, rng, size, covered, taken);
      if ([...first, ...second].some((member) => member.profession === 'medic')) successes += 1;
    }
    expect(successes).toBeGreaterThanOrEqual(18);
  });
});
