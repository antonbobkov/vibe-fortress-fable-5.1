import { describe, it, expect } from 'vitest';
import * as constants from '@core/constants';
// The parser is the only reader of the Markdown; see scripts/parse-constants.mjs.
// @ts-expect-error -- a plain .mjs script without type declarations
import { parseConstants } from '../../scripts/parse-constants.mjs';

interface DocRow {
  name: string;
  value: number | string | (number | string)[];
  section: string;
}

const rows: DocRow[] = parseConstants();
const exported = constants as unknown as Record<string, unknown>;

describe('T-M0-03 constants: every documented row exists in code with the documented value', () => {
  it('the document has rows', () => {
    expect(rows.length).toBeGreaterThan(60);
  });

  for (const row of rows) {
    it(`${row.name} = ${JSON.stringify(row.value)} (${row.section})`, () => {
      expect(Object.prototype.hasOwnProperty.call(exported, row.name)).toBe(true);
      const actual = exported[row.name];
      if (Array.isArray(row.value)) {
        expect(Array.isArray(actual)).toBe(true);
        expect([...(actual as unknown[])]).toEqual(row.value);
      } else {
        expect(actual).toBe(row.value);
      }
    });
  }
});

describe('T-M0-03 constants: no code constant is missing from the document', () => {
  it('the exported names are exactly the documented names', () => {
    const documented = rows.map((r) => r.name).sort();
    const code = Object.keys(exported)
      .filter((k) => /^[A-Z][A-Z0-9_]*$/.test(k))
      .sort();
    expect(code).toEqual(documented);
  });
});

describe('T-M0-03 constants: the documented derivations hold', () => {
  it('TICKS_PER_DAY = TICKS_PER_HOUR x HOURS_PER_DAY', () => {
    expect(constants.TICKS_PER_DAY).toBe(constants.TICKS_PER_HOUR * constants.HOURS_PER_DAY);
  });

  it('DAYS_PER_YEAR = DAYS_PER_SEASON x SEASONS_PER_YEAR', () => {
    expect(constants.DAYS_PER_YEAR).toBe(constants.DAYS_PER_SEASON * constants.SEASONS_PER_YEAR);
  });

  it('TICKS_PER_YEAR = TICKS_PER_DAY x DAYS_PER_YEAR', () => {
    expect(constants.TICKS_PER_YEAR).toBe(constants.TICKS_PER_DAY * constants.DAYS_PER_YEAR);
  });

  it('the map is a whole number of chunks', () => {
    expect(constants.LOCAL_MAP_W % constants.CHUNK_SIZE).toBe(0);
    expect(constants.LOCAL_MAP_H % constants.CHUNK_SIZE).toBe(0);
  });

  it('the z bands do not overlap and fit inside the map', () => {
    const bands: [number, number][] = [
      [0, constants.MAGMA_SEA_TOP_Z],
      [constants.CAVERN_3_Z_MIN, constants.CAVERN_3_Z_MAX],
      [constants.CAVERN_2_Z_MIN, constants.CAVERN_2_Z_MAX],
      [constants.CAVERN_1_Z_MIN, constants.CAVERN_1_Z_MAX],
      [constants.SURFACE_Z_MIN, constants.SURFACE_Z_MAX],
    ];
    for (const [lo, hi] of bands) expect(lo).toBeLessThanOrEqual(hi);
    for (let i = 1; i < bands.length; i += 1) {
      expect(bands[i]![0]).toBeGreaterThan(bands[i - 1]![1]);
    }
    expect(constants.SKY_Z_MAX).toBe(constants.LOCAL_MAP_Z - 1);
    expect(constants.SURFACE_Z_MAX).toBeLessThanOrEqual(constants.SKY_Z_MAX);
  });

  it('the fluid thresholds are ordered', () => {
    expect(constants.FLUID_WADE_LEVEL).toBeLessThan(constants.FLUID_DEEP_LEVEL);
    expect(constants.FLUID_DEEP_LEVEL).toBeLessThanOrEqual(constants.FLUID_MAX_LEVEL);
    expect(constants.FLUID_MAX_LEVEL).toBe(7); // must fit the 3-bit level field of the fluid byte
  });

  it('the priority default lies inside the priority range', () => {
    expect(constants.PRIORITY_DEFAULT).toBeGreaterThanOrEqual(constants.PRIORITY_MIN);
    expect(constants.PRIORITY_DEFAULT).toBeLessThanOrEqual(constants.PRIORITY_MAX);
    expect(constants.PRIORITY_MAX).toBeLessThanOrEqual(15); // the designation high nibble
  });

  it('the mood baseline lies inside the mood range', () => {
    expect(constants.MOOD_BASELINE).toBeGreaterThanOrEqual(constants.MOOD_MIN);
    expect(constants.MOOD_BASELINE).toBeLessThanOrEqual(constants.MOOD_MAX);
  });
});
