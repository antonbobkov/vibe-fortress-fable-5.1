import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { RngStream, seedFor } from '@core/rng';
import { KEY_PROFESSIONS } from '@systems/immigration/constants';
import { coverage, planWave, waveSize } from '@systems/immigration/waves';

describe('T-M7-04 immigration waves', () => {
  const registry = contentRegistry();

  it('clamps size at the cap and halves a winter wave before the clamp', () => {
    expect(waveSize(12000, 3, 50, 40, false)).toBe(10);
    expect(waveSize(12000, 3, 50, 40, true)).toBe(5);
    expect(waveSize(60000, 4, 100, 3, false)).toBe(3);
    expect(waveSize(0, 2, 0, 0, false)).toBe(0);
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
