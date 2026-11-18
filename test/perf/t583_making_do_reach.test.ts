/**
 * T-583's probe: how much of Making Do (reports/designs/2026-11-06-making-do-content-and-scarcity.md)
 * a three-year fortress reaches.
 *
 * Plays one seed of the twenty-seed sweep (the three-year script, unchanged) and records:
 * - the map as generated: wild plant species, the Making Do minerals and soils in walls, bat roosts,
 *   flowers on the surface;
 * - every event's count and first day, and for the events that name a thing (an item made, a recipe
 *   crafted, a building completed, a job done, a butchery's yields, an animal's product, a bed slept
 *   in, a treatment, a drink) the count and first day of each thing;
 * - every thought a dwarf held, sampled every 100 ticks, counted once per gain;
 * - what each caravan brought to the depot;
 * - at the end: the fortress's items by type and material, its buildings, zones and tame animals.
 *
 * Run on GitHub: `gh workflow run measure.yml --ref <branch> -f suite=making_do` (one job per seed;
 * `PROBE_SEED`, `PROBE_SHIFT` and `PROBE_OUT` set by the job). Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C, ItemFlag } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { PlantsReader } from '@systems/plants/reader';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p0-1';
const SHIFT = Number(process.env['PROBE_SHIFT'] ?? '0');
const OUT = process.env['PROBE_OUT'];
const DAYS = Number(process.env['PROBE_DAYS'] ?? String(3 * DAYS_PER_YEAR));

/** A count and the day it was first seen. */
interface Seen { n: number; first: number }
type Tally = Record<string, Seen>;

function bump(t: Tally, key: string, day: number, by = 1): void {
  const s = t[key];
  if (s) s.n += by;
  else t[key] = { n: by, first: day };
}

describe('T-583 probe: Making Do reach', () => {
  it(`${SEED} shift ${SHIFT}`, () => {
    const peril = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '0');
    const w = threeYearsWorld(SEED, peril);
    const reg = w.game.registry;
    const mat = (i: number): string => reg.table<{ id: string }>('materials').byIndex(i)?.id ?? `#${i}`;
    const itemId = (i: number): string => reg.table<{ id: string }>('items').byIndex(i)?.id ?? `#${i}`;
    const nameOf = (table: string, v: unknown): string =>
      typeof v === 'number' ? reg.table<{ id: string }>(table).byIndex(v)?.id ?? `#${v}` : String(v);

    // The map as generated.
    const plants = w.readers.of<PlantsReader>('07');
    const map = { plants: {} as Record<string, number>, walls: {} as Record<string, number>, flowers: 0, roosts: w.animals.roosts.length };
    for (let t = 0; t < w.map.tileCount; t += 1) {
      const sp = plants.speciesAt(t);
      if (sp) map.plants[sp] = (map.plants[sp] ?? 0) + 1;
      if (plants.flowerAt(t)) map.flowers += 1;
      if (w.map.kindAt(t) === TileKind.Wall) {
        const m = mat(w.map.materialAt(t));
        map.walls[m] = (map.walls[m] ?? 0) + 1;
      }
    }

    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);

    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const events: Tally = {};
    const detail: Record<string, Tally> = {};
    const d = (k: string): Tally => (detail[k] ??= {});
    const caravanGoods: Record<string, Tally> = {};
    const ent = w.game.world.entities;

    const unsub = w.game.world.onEvents((evs) => {
      const today = day();
      for (const e of evs) {
        bump(events, e.type, today);
        switch (e.type as string) {
          case 'ItemCreated': {
            // A caravan's goods are created at its arrival: they are counted apart from what the fortress made.
            const flags = ent.get(Number(e['id']), C.Item)?.flags ?? 0;
            const where = (flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0 ? 'merchantCreated' : 'itemCreated';
            bump(d(where), `${String(e['itemType'])}:${String(e['material'])}`, today, Number(e['count'] ?? 1));
            break;
          }
          case 'ItemCrafted': bump(d('recipe'), String(e['recipeId']), today); break;
          case 'BuildingPlaced': bump(d('buildingPlaced'), String(e['buildingType']), today); break;
          case 'BuildingCompleted': bump(d('buildingCompleted'), String(e['buildingType']), today); break;
          case 'JobCompleted': bump(d('job'), nameOf('jobTypes', e['jobType']), today); break;
          case 'JobCancelled': bump(d('jobCancelled'), nameOf('jobTypes', e['jobType']), today); break;
          case 'ButcheryDone': {
            const y = e['yields'] as Record<string, number> | undefined;
            for (const [k, v] of Object.entries(y ?? {})) bump(d('butchery'), k, today, Number(v));
            bump(d('butcheredSpecies'), nameOf('creatures', e['species']), today);
            break;
          }
          case 'ProductReady': bump(d('product'), String(e['product']), today); break;
          case 'Slept': bump(d('slept'), `${String(e['bedType'] || 'floor')}:${String(e['bedding'] ?? 'none')}`, today); break;
          case 'TreatmentDone': bump(d('treatment'), String(e['kind']), today); break;
          case 'DrankAlcohol': bump(d('drank'), `${nameOf('materials', e['material'])}${e['aged'] ? `:aged${String(e['aged'])}` : ''}`, today); break;
          case 'MealEaten': bump(d('meal'), String(e['kind'] ?? ''), today); break;
          case 'MineralMined': bump(d('mineral'), nameOf('materials', e['material']), today); break;
          case 'CropHarvested': bump(d('harvest'), nameOf('plants', e['species']), today); break;
          case 'CropPlanted': {
            // T-588: whether the crop was planted with fertilizer (07 § Fertilizer), read off the crop.
            const fertilized = plants.cropInfo(plants.cropAt(Number(e['tile'])))?.fertilized === true;
            bump(d('planted'), `${nameOf('plants', e['species'])}${fertilized ? ':fertilized' : ''}`, today);
            break;
          }
          case 'AnimalSpawned': bump(d('animalSpawned'), nameOf('creatures', e['species']), today); break;
          case 'AnimalTamed': bump(d('tamed'), nameOf('creatures', ent.get(Number(e['id']), C.Creature)?.species ?? -1), today); break;
          case 'CreatureCaged': bump(d('caged'), nameOf('creatures', ent.get(Number(e['creatureId']), C.Creature)?.species ?? -1), today); break;
          case 'WhimSet': bump(d('whimSet'), String(e['whimId']), today); break;
          case 'WhimJudged': bump(d('whimJudged'), `${String(e['whimId'])}:${e['met'] ? 'met' : 'missed'}`, today); break;
          case 'ItemAged': bump(d('aged'), String(e['stage']), today); break;
          case 'TradeCompleted': bump(d('trade'), String(e['civ']), today); break;
          case 'CaravanAtDepot': {
            const civ = String(e['civ'] ?? '?');
            const goods = (caravanGoods[civ] ??= {});
            for (const id of ent.with(C.Item)) {
              const it = ent.get(id, C.Item)!;
              if ((it.flags & ItemFlag.Merchant) === 0) continue;
              bump(goods, `${itemId(it.type)}:${mat(it.material)}`, today, it.count);
            }
            break;
          }
          default: break;
        }
      }
    });

    // Thoughts, sampled: one gain per (dwarf, thought, start tick).
    const thoughts: Tally = {};
    const gains = new Set<string>();
    let lastSample = -Infinity;
    const sampleThoughts = (): void => {
      if (w.tick - lastSample < 100) return;
      lastSample = w.tick;
      for (const id of ent.with(C.Mood)) {
        for (const t of ent.get(id, C.Mood)!.thoughts) {
          const key = `${id}:${t.thought}:${t.startTick}`;
          if (gains.has(key)) continue;
          gains.add(key);
          bump(thoughts, nameOf('thoughts', t.thought), Math.floor(t.startTick / TICKS_PER_DAY) + 1);
        }
      }
    };

    const ticks = DAYS * TICKS_PER_DAY;
    while (w.tick < ticks) {
      playThreeYears(w, state, Math.min(w.tick < 20 * TICKS_PER_DAY ? 100 : 300, ticks - w.tick), sampleThoughts);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    unsub();

    // The end.
    const items: Record<string, number> = {};
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if ((it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
      const k = `${itemId(it.type)}:${mat(it.material)}`;
      items[k] = (items[k] ?? 0) + it.count;
    }
    const buildings: Record<string, number> = {};
    for (const id of ent.with(C.Building)) {
      const b = ent.get(id, C.Building)!;
      const k = `${nameOf('buildings', b.type)}${b.state === 'built' ? '' : `:${b.state}`}`;
      buildings[k] = (buildings[k] ?? 0) + 1;
    }
    const zones: Record<string, number> = {};
    for (const id of ent.with(C.Zone)) {
      const z = ent.get(id, C.Zone)!;
      const k = `${nameOf('zoneTypes', z.type)}${z.settings['cellar'] ? ':cellar' : ''}${z.settings['fertilize'] ? ':fertilize' : ''}`;
      zones[k] = (zones[k] ?? 0) + 1;
    }
    const creatures: Record<string, number> = {};
    for (const id of ent.with(C.Creature)) {
      const c = ent.get(id, C.Creature)!;
      const k = `${nameOf('creatures', c.species)}:${c.faction}${ent.has(id, C.Tame) ? ':tame' : ''}`;
      creatures[k] = (creatures[k] ?? 0) + 1;
    }
    const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;

    const result = { seed: SEED, shift: SHIFT, days: DAYS, population, map, events, detail, thoughts, caravanGoods, end: { items, buildings, zones, creatures } };
    console.log(`[t583] ${SEED} shift ${SHIFT}: population ${population}, ${Object.keys(events).length} event types, ${Object.keys(detail['recipe'] ?? {}).length} recipes, ${Object.keys(thoughts).length} thoughts`);
    if (OUT) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
    }
    expect(Object.keys(events).length).toBeGreaterThan(0);
  });
});
