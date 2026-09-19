import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { regionSpec } from '@app/headless';
import { TICKS_PER_DAY, TICKS_PER_HOUR, DAYS_PER_SEASON } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import * as K from '@systems/weather/constants';
import {
  allowed,
  constrain,
  growthModifier,
  isDaylightAt,
  seasonBase,
  surfaceTemp,
  temperSpread,
  transitionWeights,
  weightedIndex,
  type Climate,
} from '@systems/weather/transitions';
import type { WeatherReader } from '@systems/weather';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';

const grassland: Climate = { seasonTemp: [10, 22, 12, 0], referenceTempC: 10, tempC: 10, temper: 0, traits: [] };
const at = (c: Partial<Climate>): Climate => ({ ...grassland, ...c });

describe('T-M3-06 weather: tuning constants and tables', () => {
  it('every row of 06 § Tuning constants is in src/systems/weather/constants.ts', () => {
    const rows = tuningConstants('02-systems/06-weather-and-seasons.md');
    expect(rows.length).toBe(7);
    const values = K as unknown as Record<string, number>;
    for (const row of rows) expect([row.name, values[row.name]]).toEqual([row.name, row.value]);
  });

  it('D-101: the day curve is the straight lines from −6 at hour 4 to +6 at hour 15 and back, rounded', () => {
    expect(K.DAY_CURVE_C.length).toBe(24);
    for (let h = 0; h < 24; h += 1) {
      const rising = h >= 4 && h <= 15;
      const want = rising ? -6 + Math.round((12 * (h - 4)) / 11) : 6 - Math.round((12 * (((h - 15) + 24) % 24)) / 13);
      expect([h, K.DAY_CURVE_C[h]]).toEqual([h, want]);
    }
    expect(Math.min(...K.DAY_CURVE_C)).toBe(-6);
    expect(K.DAY_CURVE_C.indexOf(-6)).toBe(4);
    expect(Math.max(...K.DAY_CURVE_C)).toBe(6);
    expect(K.DAY_CURVE_C.indexOf(6)).toBe(15);
  });

  it('surfaceTempC = seasonBase + dayCurve + weatherDelta + temperSpread', () => {
    expect(seasonBase(0, at({ tempC: 14 }))).toBe(14);
    expect(temperSpread(1, at({ temper: 3 }))).toBe(3);
    expect(temperSpread(3, at({ temper: 3 }))).toBe(-3);
    expect(temperSpread(0, at({ temper: 3 }))).toBe(0);
    // Winter, temper 4, 04:00, cold snap: 0 − 6 − 12 − 4.
    expect(surfaceTemp(3, 4, 'cold_snap', at({ temper: 4 }))).toBe(-22);
    // Summer, 15:00, heatwave, temper 2: 22 + 6 + 10 + 2.
    expect(surfaceTemp(1, 15, 'heatwave', at({ temper: 2 }))).toBe(40);
    for (const s of K.WEATHER_STATES) expect(surfaceTemp(0, 15, s, grassland)).toBe(16 + K.WEATHER_DELTA_C[s]);
  });

  it('daylight windows per season and temper band', () => {
    expect(isDaylightAt(0, 5, grassland)).toBe(false);
    expect(isDaylightAt(0, 6, grassland)).toBe(true);
    expect(isDaylightAt(0, 18, grassland)).toBe(true);
    expect(isDaylightAt(0, 19, grassland)).toBe(false);
    expect(isDaylightAt(0, 6, at({ temper: 2 }))).toBe(false);
    expect(isDaylightAt(1, 5, grassland)).toBe(true);
    expect(isDaylightAt(1, 20, at({ temper: 4 }))).toBe(false);
    expect(isDaylightAt(3, 8, grassland)).toBe(true);
    expect(isDaylightAt(3, 8, at({ temper: 2 }))).toBe(false);
    expect(isDaylightAt(3, 16, at({ temper: 2 }))).toBe(false);
  });

  it('growth: season × state (overcast −10%)', () => {
    expect(growthModifier(0, 'clear', grassland)).toBe(100);
    expect(growthModifier(1, 'clear', grassland)).toBe(120);
    expect(growthModifier(1, 'overcast', grassland)).toBe(108);
    expect(growthModifier(2, 'clear', grassland)).toBe(80);
    expect(growthModifier(3, 'clear', grassland)).toBe(0);
  });
});

describe('T-M3-06 weather: transitions', () => {
  const row = { clear: 40, overcast: 30, rain: 20, storm: 3, snow: 2, fog: 5, heatwave: 5, cold_snap: 5 };

  it('snow ↔ rain by SNOW_C', () => {
    expect(constrain('snow', 1, grassland)).toBe('rain');
    expect(constrain('snow', 0, grassland)).toBe('snow');
    expect(constrain('rain', 0, grassland)).toBe('snow');
    expect(constrain('storm', -5, grassland)).toBe('snow');
    expect(constrain('storm', 5, grassland)).toBe('storm');
    expect(constrain('clear', -5, grassland)).toBe('clear');
  });

  it('heatwave only in summer at temper ≥ 2; cold snap only in autumn and winter at temper ≥ 2', () => {
    for (let s = 0; s < 4; s += 1) {
      for (let t = 0; t <= 4; t += 1) {
        expect(allowed('heatwave', s, at({ temper: t }))).toBe(s === 1 && t >= 2);
        expect(allowed('cold_snap', s, at({ temper: t }))).toBe((s === 2 || s === 3) && t >= 2);
      }
    }
    const w = transitionWeights(row, 1, at({ temper: 1 }));
    expect(w[K.WEATHER_STATES.indexOf('heatwave')]).toBe(0);
  });

  it('the temper rule scales storm, fog, heatwave, cold snap by (1 + t/2) and clear by (1 − t/10)', () => {
    const w0 = transitionWeights(row, 1, grassland);
    const w4 = transitionWeights(row, 1, at({ temper: 4 }));
    const idx = (s: K.WeatherStateId): number => K.WEATHER_STATES.indexOf(s);
    expect(w0[idx('clear')]).toBe(40 * 20);
    expect(w4[idx('clear')]).toBe(40 * 12);
    expect(w4[idx('storm')]).toBe(3 * 60);
    expect(w4[idx('fog')]).toBe(5 * 60);
    expect(w4[idx('heatwave')]).toBe(5 * 60);
    expect(w4[idx('rain')]).toBe(20 * 20);
  });

  it('thunderhead doubles storm; serene_vale removes storm, heatwave and cold snap', () => {
    const idx = (s: K.WeatherStateId): number => K.WEATHER_STATES.indexOf(s);
    const base = transitionWeights(row, 1, at({ temper: 2 }));
    const thunder = transitionWeights(row, 1, at({ temper: 2, traits: ['thunderhead'] }));
    expect(thunder[idx('storm')]).toBe(2 * (base[idx('storm')] as number));
    expect(thunder[idx('clear')]).toBe(base[idx('clear')]);
    const serene = transitionWeights(row, 2, at({ temper: 4, traits: ['serene_vale'] }));
    expect(serene[idx('storm')]).toBe(0);
    expect(serene[idx('heatwave')]).toBe(0);
    expect(serene[idx('cold_snap')]).toBe(0);
    expect(serene[idx('fog')]).toBeGreaterThan(0);
  });

  it('frostmarrow: winter values in spring and autumn, 80% summer growth, snow whenever precipitation', () => {
    const frost = at({ traits: ['frostmarrow'], seasonTemp: [-2, 8, 0, -16], referenceTempC: -6, tempC: -6 });
    expect(seasonBase(0, frost)).toBe(-16);
    expect(seasonBase(2, frost)).toBe(-16);
    expect(seasonBase(1, frost)).toBe(8);
    expect(growthModifier(0, 'clear', frost)).toBe(0);
    expect(growthModifier(1, 'clear', frost)).toBe(80);
    expect(isDaylightAt(0, 8, frost)).toBe(true);
    expect(isDaylightAt(0, 7, frost)).toBe(false);
    expect(constrain('rain', 20, frost)).toBe('snow');
    expect(constrain('storm', 20, frost)).toBe('snow');
    expect(constrain('snow', 20, frost)).toBe('snow');
  });

  it('weightedIndex walks the weights in order and gives -1 for none', () => {
    expect(weightedIndex([0, 0], () => 0)).toBe(-1);
    expect(weightedIndex([2, 3], () => 0)).toBe(0);
    expect(weightedIndex([2, 3], () => 1)).toBe(0);
    expect(weightedIndex([2, 3], () => 2)).toBe(1);
    expect(weightedIndex([2, 0, 3], () => 4)).toBe(2);
  });
});

describe('T-M3-06 weather: the system', () => {
  const registry = contentRegistry();

  function world(temper: number, startTick: number, traits: string[] = []): TestWorld {
    return new TestWorld({ seed: 'we-unit', world: 'local', spec: regionSpec('we-unit', { temper, traits }, registry), startTick });
  }
  const winter = 3 * DAYS_PER_SEASON * TICKS_PER_DAY;
  /** An outdoor soil floor on the surface. */
  function soilFloor(w: TestWorld): number {
    const soil = new Set(['loam', 'clay', 'silt', 'sand', 'peat'].map((id) => registry.table('materials').index(id)));
    for (let y = 10; y < 80; y += 1) {
      for (let x = 10; x < 80; x += 1) {
        const i = w.index(x, y, w.map.columnSurfaceZ(x, y));
        if (w.map.kindAt(i) === TileKind.Floor && soil.has(w.map.materialAt(i)) && w.map.hasFlag(i, TileFlag.Outdoor) && w.map.fluidLevelAt(i) === 0) return i;
      }
    }
    throw new Error('no soil floor');
  }

  it('starts clear, sets the calendar daylight, and feeds 05 its surface temperature', () => {
    const w = world(0, 0);
    const reader = w.readers.of<WeatherReader>('06');
    expect(reader.state()).toBe('clear');
    expect(w.readers.calendar.isDaylight).toBe(false);
    w.step(12 * TICKS_PER_HOUR);
    expect(w.readers.calendar.isDaylight).toBe(true);
    expect(w.readers.of<{ surfaceTempC(): number }>('05').surfaceTempC()).toBe(reader.surfaceTempC());
    expect(reader.forecast()).toBeGreaterThan(0);
    expect(reader.thirstModifier()).toBe(100);
    expect(reader.visibilityModifier()).toBe(100);
    w.forceWeather('fog');
    expect(reader.visibilityModifier()).toBe(50);
    w.forceWeather('heatwave');
    expect(reader.thirstModifier()).toBe(150);
  });

  it('rain wets the outdoor tiles, mud follows the second rain hour on soil floors, and the wet dries after WET_DURATION_HOURS', () => {
    const w = world(0, 12 * TICKS_PER_HOUR);
    const tile = soilFloor(w);
    w.forceWeather('rain');
    w.step(TICKS_PER_HOUR);
    expect(w.map.hasFlag(tile, TileFlag.Wet)).toBe(true);
    expect(w.readers.of<WeatherReader>('06').isWet(tile)).toBe(true);
    w.step(2 * TICKS_PER_HOUR);
    expect(w.map.hasFlag(tile, TileFlag.Mud)).toBe(true);
    w.forceWeather('clear');
    w.step((K.WET_DURATION_HOURS + 2) * TICKS_PER_HOUR);
    expect(w.map.hasFlag(tile, TileFlag.Wet)).toBe(false);
  });

  it('snow cover makes 05 recompute: a snow tile is SNOW_OVERRIDE × 5 °C colder', () => {
    const w = world(2, winter + 12 * TICKS_PER_HOUR);
    const tile = soilFloor(w);
    w.forceWeather('snow');
    w.until((ww) => ww.map.hasFlag(tile, TileFlag.Snow), 8 * TICKS_PER_HOUR);
    w.step(20);
    const m = w.readers.of<{ temperatureAt(i: number): number; surfaceTempC(): number }>('05');
    expect(w.map.tempOverride[tile]).toBe(-1);
    expect(m.temperatureAt(tile)).toBe(m.surfaceTempC() - 5);
    expect(w.events('SnowCoverChanged').length).toBeGreaterThan(0);
  });

  it('storms strike lightning; the season change emits SeasonEffectsChanged; a save continues identically', () => {
    const w = world(3, winter - 3 * TICKS_PER_HOUR, ['thunderhead']);
    w.forceWeather('storm');
    w.step(6 * TICKS_PER_HOUR);
    expect(w.events('SeasonEffectsChanged').map((e) => e['season'])).toEqual([3]);
    w.step(40 * TICKS_PER_HOUR);
    expect(w.events('LightningStrike').length).toBeGreaterThan(0);
    const system = w.weather;
    const saved = system.serialize();
    expect(saved.forced).toBe('storm');
    w.forceWeather(null);
    w.step(TICKS_PER_HOUR);
    expect(system.serialize().forced).toBeNull();
  });
});
