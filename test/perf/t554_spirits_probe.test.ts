/**
 * T-554's probe: how much spirits slow a fortress that drinks them.
 *
 * The three-year fixture plays one seed twice, as it is (`base`) and with a standing `distill` order
 * at its first still (`spirits`, kept at `SPIRITS_STOCK` deepfire once the still has its brew order).
 * Every dwarf drinks the nearest drink, so a fortress that keeps spirits drinks some of them. The
 * probe counts the dwarf-ticks played and the dwarf-ticks tipsy (sampled at the script's watch
 * cadence), so the mean slowdown of walking and work is `TIPSY_SLOW_PERCENT` × the tipsy share, and
 * it writes the run's outcome beside them (population, wealth, deaths, drinks, jobs done).
 *
 * Run on GitHub: `gh workflow run measure.yml --ref <branch> -f suite=spirits` (one job per seed and
 * mode; `PROBE_SEED`, `PROBE_MODE` and `PROBE_OUT` set by the job). Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import type { DwarvesReader } from '@systems/dwarves';
import { TIPSY_SLOW_PERCENT } from '@systems/dwarves/constants';
import type { ItemsReader } from '@systems/items';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

/** The deepfire the spirits run keeps in stock. */
const SPIRITS_STOCK = 40;

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p0-1';
const MODE = process.env['PROBE_MODE'] ?? 'spirits';
const OUT = process.env['PROBE_OUT'];

export interface SpiritsProbeResult {
  readonly seed: string;
  readonly mode: string;
  readonly dwarfTicks: number;
  readonly tipsyTicks: number;
  /** Percent of dwarf-time tipsy, two decimals. */
  readonly tipsyPercent: number;
  /** The mean slowdown of walking and work, percent: `TIPSY_SLOW_PERCENT` × the tipsy share. */
  readonly slowdownPercent: number;
  readonly drinksAlcohol: number;
  readonly drinksSpirits: number;
  readonly drinksWater: number;
  readonly deepfireMade: number;
  readonly jobsCompleted: number;
  readonly y3Pop: number;
  readonly y3Wealth: number;
  readonly dwarfDeaths: number;
}

function fortressDwarves(w: ReturnType<typeof threeYearsWorld>): number[] {
  return w.game.world.entities.with(C.Labors).filter((id) => w.game.world.entities.get(id, C.Creature)?.faction === 'fortress');
}

export function runSpiritsProbe(seed: string, spirits: boolean): SpiritsProbeResult {
  const peril = Number(/-p(\d)-/.exec(seed)?.[1] ?? '0');
  const w = threeYearsWorld(seed, peril);
  const state = setupThreeYearsFortress(w);
  const dwarves = w.readers.of<DwarvesReader>('10');
  const deepfire = w.game.registry.table('materials').index('deepfire');
  let drinksAlcohol = 0;
  let drinksSpirits = 0;
  let drinksWater = 0;
  let deepfireMade = 0;
  let jobsCompleted = 0;
  let dwarfDeaths = 0;
  const dwarfSpecies = w.game.registry.table('creatures').index('dwarf');
  const unsub = w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'DrankAlcohol') {
        drinksAlcohol += 1;
        if (e['group'] === 'spirits') drinksSpirits += 1;
      } else if (e.type === 'DrankWater') drinksWater += 1;
      else if (e.type === 'JobCompleted') jobsCompleted += 1;
      else if (e.type === 'ItemCreated' && e['itemType'] === 'drink' && e['material'] === 'deepfire') deepfireMade += Number(e['count'] ?? 0);
      else if (e.type === 'CreatureDied' && e['species'] === dwarfSpecies) dwarfDeaths += 1;
    }
  });
  let dwarfTicks = 0;
  let tipsyTicks = 0;
  let last = w.tick;
  const watch = (): void => {
    const span = w.tick - last;
    last = w.tick;
    const living = fortressDwarves(w);
    dwarfTicks += span * living.length;
    tipsyTicks += span * living.filter((id) => dwarves.isTipsy(id)).length;
  };
  const ordered = (): boolean => {
    const still = state.placedIds['still'];
    const recipes = w.game.registry.table('recipes');
    return (w.game.world.entities.get(still ?? 0, C.Workshop)?.orders ?? []).some((o) => o.recipe === recipes.index('distill'));
  };
  const totalTicks = 3 * DAYS_PER_YEAR * TICKS_PER_DAY;
  while (w.tick < totalTicks) {
    // The bootstrap's first twenty days at the sweep's cadence (`three_years_seeds.test.ts`).
    playThreeYears(w, state, Math.min(w.tick < 20 * TICKS_PER_DAY ? 100 : 300, totalTicks - w.tick), watch);
    checkFortressWorkOrders(w, state);
    checkFortressRooms(w, state);
    checkFortressCaveFarm(w, state);
    checkFortressDefense(w, state);
    const still = state.placedIds['still'];
    if (spirits && still !== undefined && state.orderedWorkshops.has('still') && !ordered()) {
      const r = w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: still,
        order: { recipeId: 'distill', mode: 'maintain', threshold: SPIRITS_STOCK, priority: 5 } });
      if (!r.ok) throw new Error(`distill order refused: ${r.reason}`);
    }
  }
  unsub();
  const share = dwarfTicks === 0 ? 0 : tipsyTicks / dwarfTicks;
  const items = w.readers.of<ItemsReader>('13');
  expect(items.countMatching({ materialId: deepfire }) >= 0).toBe(true);
  return {
    seed,
    mode: spirits ? 'spirits' : 'base',
    dwarfTicks,
    tipsyTicks,
    tipsyPercent: Math.round(share * 10_000) / 100,
    slowdownPercent: Math.round(share * TIPSY_SLOW_PERCENT * 1000) / 1000,
    drinksAlcohol,
    drinksSpirits,
    drinksWater,
    deepfireMade,
    jobsCompleted,
    y3Pop: fortressDwarves(w).length,
    y3Wealth: items.wealth(),
    dwarfDeaths,
  };
}

describe('T-554 probe: spirits in the three-year fixture', () => {
  it(`${SEED} ${MODE}`, () => {
    const result = runSpiritsProbe(SEED, MODE === 'spirits');
    console.log(`[spirits_probe] ${JSON.stringify(result)}`);
    if (OUT !== undefined) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
    }
    if (MODE === 'spirits') expect(result.deepfireMade).toBeGreaterThan(0);
  }, 3_600_000);
});
