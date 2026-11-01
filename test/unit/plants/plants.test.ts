/**
 * T-M4-01 unit tests for 07 plants: the tuning constants against the document, growth per hour
 * under each blocking condition, stage lengths per species, the yield formula with skill 0/5/10,
 * the `light_mismatch` rejection of `SetPlotCrop` and the refusal of a mixed plot at placement.
 */

import { describe, it, expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { HOURS_PER_DAY, SEASONS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import * as K from '@systems/plants/constants';
import {
  BASE_GROWTH,
  PlantFacts,
  advance,
  cropsOf,
  growthPerHour,
  harvestCount,
  isMature,
  lightMatches,
  lightOk,
  plotKindOf,
  progressPercent,
  seasonAllows,
  stageLength,
  tempOk,
  type PlantRow,
  type PlantsReader,
} from '@systems/plants';
import { TestWorld } from '../../scenarios/test-world';
import { tuningConstants } from '../system-constants';

const registry = contentRegistry();
const facts = new PlantFacts(registry);

function row(id: string): PlantRow {
  const r = facts.row(facts.indexOf(id));
  if (r === undefined) throw new Error(`no plant ${id}`);
  return r;
}

const ok = { season: 0, lit: true, tempC: 20, growthModifier: 100 };

describe('T-M4-01 plants: tuning constants', () => {
  it('every row of 07 § Tuning constants is in src/systems/plants/constants.ts', () => {
    const rows = tuningConstants('02-systems/07-plants-and-farming.md');
    expect(rows.length).toBe(9);
    const values = K as unknown as Record<string, number>;
    for (const r of rows) expect([r.name, values[r.name]]).toEqual([r.name, r.value]);
  });
});

describe('T-M4-01 plants: the species table', () => {
  it('every plant species is a material, and every crop names its four stage lengths', () => {
    for (let p = 1; p <= facts.size; p += 1) {
      const r = facts.row(p) as PlantRow;
      expect([r.id, facts.materialOf(p) > 0]).toEqual([r.id, true]);
      expect([r.id, facts.plantOfMaterial(facts.materialOf(p))]).toEqual([r.id, p]);
      if (!facts.isFarmed(p)) continue;
      // `plants.md`: "`stageDays` are days per stage at 100% growth (crops have four stages)".
      expect([r.id, stageLength(r)]).toEqual([r.id, (r.stageDays as number) * HOURS_PER_DAY * BASE_GROWTH]);
    }
  });

  it('the surface and cave crops of 07 § Species table are the farmed species', () => {
    const farmed = facts.farmedPlants().map((p) => (facts.row(p) as PlantRow).id);
    expect(farmed).toEqual(
      ['barley', 'cabbage', 'cavewheat', 'dimcap', 'flax', 'hops', 'pale_bell', 'pumpkin', 'sporecloth', 'strawberry', 'sweetroot', 'turnip'].sort(),
    );
  });
});

describe('T-M4-01 plants: growth per hour', () => {
  it('is BASE_GROWTH × growthModifier / 100 when nothing blocks it', () => {
    expect(growthPerHour(row('barley'), false, ok)).toBe(BASE_GROWTH);
    expect(growthPerHour(row('barley'), false, { ...ok, growthModifier: 60 })).toBe(60);
    expect(growthPerHour(row('barley'), false, { ...ok, growthModifier: 130 })).toBe(130);
  });

  it('is 0 out of season, in the wrong light and outside the temperature band', () => {
    const barley = row('barley');
    // barley grows in spring and summer only.
    expect(seasonAllows(barley, false, 0)).toBe(true);
    expect(seasonAllows(barley, false, 2)).toBe(false);
    expect(growthPerHour(barley, false, { ...ok, season: 3 })).toBe(0);
    expect(lightOk(barley, false)).toBe(false);
    expect(growthPerHour(barley, false, { ...ok, lit: false })).toBe(0);
    expect(tempOk(barley, 2)).toBe(false);
    expect(tempOk(barley, 31)).toBe(false);
    expect(growthPerHour(barley, false, { ...ok, tempC: 2 })).toBe(0);
    expect(growthPerHour(barley, false, { ...ok, tempC: 31 })).toBe(0);
  });

  it('a cave crop grows in every season, only in the dark, and ignores the weather modifier', () => {
    const dimcap = row('dimcap');
    for (let s = 0; s < SEASONS_PER_YEAR; s += 1) expect([s, seasonAllows(dimcap, true, s)]).toEqual([s, true]);
    expect(growthPerHour(dimcap, true, { ...ok, lit: false, growthModifier: 40 })).toBe(BASE_GROWTH);
    expect(growthPerHour(dimcap, true, { ...ok, lit: true })).toBe(0);
  });
});

describe('T-M4-01 plants: stages', () => {
  it('D-107: a crop is ready four stage lengths after planting, the cycle of plants.md', () => {
    const dimcap = row('dimcap');
    const len = stageLength(dimcap);
    let p = { stage: 0, growth: 0 };
    const hours: number[] = [];
    for (let h = 1; h <= 4 * (dimcap.stageDays as number) * HOURS_PER_DAY; h += 1) {
      const before = p.stage;
      p = advance(p, BASE_GROWTH, len);
      if (p.stage !== before) hours.push(h);
      if (isMature(p, len)) {
        hours.push(h);
        break;
      }
    }
    // Stage 1, 2 and 3 at days 4, 8 and 12; ready at day 16.
    expect(hours).toEqual([4, 8, 12, 16].map((d) => d * HOURS_PER_DAY));
    expect(p.stage).toBe(3);
  });

  it('the accumulator keeps the remainder and never runs past the mature stage', () => {
    const len = stageLength(row('dimcap'));
    const p = advance({ stage: 0, growth: len - 10 }, 30, len);
    expect(p).toEqual({ stage: 1, growth: 20 });
    expect(progressPercent(p, len)).toBe(Math.floor((20 * 100) / len));
    const mature = advance({ stage: 3, growth: len }, 10_000, len);
    expect(mature).toEqual({ stage: 3, growth: len });
    expect(progressPercent(mature, len)).toBe(100);
  });
});

describe('T-M4-01 plants: harvest yield', () => {
  it('count = roll + floor(skill / 5), capped at yieldMax + 2', () => {
    const dimcap = row('dimcap'); // yield 3–5
    expect(harvestCount(dimcap, 3, 0)).toBe(3);
    expect(harvestCount(dimcap, 5, 0)).toBe(5);
    expect(harvestCount(dimcap, 3, 5)).toBe(4);
    expect(harvestCount(dimcap, 5, 5)).toBe(6);
    expect(harvestCount(dimcap, 3, 10)).toBe(5);
    expect(harvestCount(dimcap, 5, 10)).toBe(7);
    // The cap: even a legendary farmer takes at most yieldMax + 2.
    expect(harvestCount(dimcap, 5, 20)).toBe(7);
    expect(harvestCount(row('flax'), 4, 20)).toBe(6);
  });

  it('D-104: a secondary yield that a recipe also makes is the workshop conversion, not a harvest drop', () => {
    // `plants.md`: barley's and cavewheat's secondary is "`flour` at the farmer's workshop";
    // flax's is the edible seed cake, which no recipe makes.
    expect(facts.secondaryOf(facts.indexOf('barley'))).toBeNull();
    expect(facts.secondaryOf(facts.indexOf('cavewheat'))).toBeNull();
    const flax = facts.secondaryOf(facts.indexOf('flax'));
    expect(flax?.item).toBe(registry.table('items').index('plant_food'));
    expect(flax?.material).toBe(registry.table('materials').index('flax'));
    expect(flax?.count).toBe(1);
  });
});

describe('T-M4-01 plants: plots', () => {
  const surface = (w: TestWorld, x: number, y: number, n: number): number[] => {
    const out: number[] = [];
    for (let dx = 0; dx < n; dx += 1) out.push(w.index(x + dx, y, FLAT_TEST_SURFACE_Z));
    return out;
  };

  it('a plot is surface when every tile is lit and cave when none is; a mixed plot is refused', () => {
    const w = new TestWorld({ seed: 'plots', embark: 'none' });
    const lit = surface(w, 20, 20, 3);
    w.digRoom(20, 24, FLAT_TEST_SURFACE_Z - 2, 3, 1);
    const dark = [0, 1, 2].map((dx) => w.index(20 + dx, 24, FLAT_TEST_SURFACE_Z - 2));
    expect(plotKindOf(w.map, lit)).toBe('surface');
    expect(plotKindOf(w.map, dark)).toBe('cave');
    expect(plotKindOf(w.map, [...lit, ...dark])).toBe('mixed');
    expect(w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'farm_plot', tiles: [...lit, ...dark] })).toEqual({
      ok: false,
      reason: 'bad_zone_tiles',
    });
    const zoneId = w.zone('farm_plot', lit);
    expect(w.readers.of<PlantsReader>('07').plotKind(zoneId)).toBe('surface');
  });

  it('SetPlotCrop stores one species per season on the zone and refuses a light mismatch', () => {
    const w = new TestWorld({ seed: 'plots-2', embark: 'none' });
    const zoneId = w.zone('farm_plot', surface(w, 30, 30, 2));
    const world = w.game.world;
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 2, speciesId: 'turnip' }).ok).toBe(true);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 1, speciesId: 'dimcap' })).toEqual({ ok: false, reason: 'light_mismatch' });
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 4, speciesId: 'barley' })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'oak' })).toEqual({ ok: false, reason: 'not_found' });
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId: 0, season: 0, speciesId: 'barley' })).toEqual({ ok: false, reason: 'not_found' });
    const settings = w.game.world.entities.get(zoneId, C.Zone)?.settings ?? {};
    expect(cropsOf(settings)).toEqual([facts.indexOf('barley'), 0, facts.indexOf('turnip'), 0]);
    expect(w.readers.of<PlantsReader>('07').plotSettings(zoneId)).toEqual(cropsOf(settings));
    // The light rule as a pure predicate.
    expect(lightMatches(row('barley'), 'surface')).toBe(true);
    expect(lightMatches(row('barley'), 'cave')).toBe(false);
    expect(lightMatches(row('dimcap'), 'cave')).toBe(true);
    expect(lightMatches(row('oak'), 'mixed')).toBe(false);
  });

  it('a plot with no seeds announces PlotNeedsSeeds once per season', () => {
    const w = new TestWorld({ seed: 'plots-3', embark: 'none' });
    const zoneId = w.zone('farm_plot', surface(w, 34, 34, 2));
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId, season: 0, speciesId: 'barley' }).ok).toBe(true);
    w.step(300);
    const notes = w.events('PlotNeedsSeeds');
    expect(notes).toHaveLength(1);
    expect(notes[0]?.['species']).toBe('barley');
    expect(notes[0]?.['zoneId']).toBe(zoneId);
  });
});

describe('T-M4-01 plants: DesignateHarvest', () => {
  it('marks only crops that are ready and rejects when none is', () => {
    const w = new TestWorld({ seed: 'harvest', embark: 'none' });
    const tiles = [0, 1].map((dx) => w.index(40 + dx, 60, FLAT_TEST_SURFACE_Z));
    w.zone('farm_plot', tiles);
    const young = w.plantCrop(tiles[0] as number, 'barley');
    expect(young).toBeGreaterThan(0);
    expect(w.game.world.applyCommand({ type: 'DesignateHarvest', tiles })).toEqual({ ok: false, reason: 'precondition_failed' });
    // A crop with its four stages behind it may be designated.
    const id = w.plantCrop(tiles[1] as number, 'barley', 3);
    const crop = w.game.world.entities.get(id, C.Crop);
    w.game.world.entities.add(id, C.Crop, { ...(crop as NonNullable<typeof crop>), growth: stageLength(row('barley')) });
    expect(w.readers.of<PlantsReader>('07').cropReady(tiles[1] as number)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'DesignateHarvest', tiles }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'DesignateHarvest', tiles: [] })).toEqual({ ok: false, reason: 'out_of_bounds' });
  });
});
