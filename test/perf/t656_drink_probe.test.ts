/**
 * T-656's probe of the drink a fortress keeps: plays a three-year seed (`PROBE_SEED`, default
 * `three-years-p4-1`) at `THREE_YEARS_SHIFT` (default 100) as the sweep plays it to tick `PROBE_TO`
 * (default the end of day 300) and writes one line a day: the dwarves, the drink in stock (all and
 * available), the brewable plants, the empty barrels, the stills (their order's threshold and job),
 * the brewer and what he does, the alert, the dwarves at want and critical thirst and on the surface,
 * and the day's drinks (alcohol, water below, water outdoors); and the alerts and the deaths as they
 * come. Local diagnosis only (set `T656_PROBE=1`); not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import { watchInvariants } from '../scenarios/invariants';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p4-1';
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '4');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '100');
const TO = Number(process.env['PROBE_TO'] ?? String(300 * TICKS_PER_DAY));
const DIR = '.vite/t656';

describe('T-656 probe: the drink in stock', () => {
  it.runIf(process.env['T656_PROBE'] === '1')(`${SEED} shift ${SHIFT} to ${TO}`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    const stop = watchInvariants(w.game, () => {});
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const jobs = w.readers.of<JobsReader>('11');
    const plants = w.game.registry.table<{ id: string; brew?: string }>('plants');
    const materials = w.game.registry.table<{ id: string }>('materials');
    const itemTypes = w.game.registry.table<{ id: string }>('items');
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const brewable = new Set(plants.ids().filter((id) => plants.byId(id)?.brew !== undefined && materials.has(id)).map((id) => materials.index(id)));
    const plantFood = itemTypes.index('plant_food');
    const barrel = itemTypes.index('barrel');
    const lines: string[] = [];
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const out = (s: string): void => { lines.push(`d${day()} t${w.tick} ${s}`); };
    const fortress = (): number[] => ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress');
    let alc = 0, waterIn = 0, waterOut = 0;
    let gone: Record<string, number> = {};
    let brews = 0;
    let doing: Record<string, number> = {};
    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'DrankAlcohol') alc += 1;
        else if (e.type === 'ItemDestroyed' && e['itemType'] === 'barrel') { const k = String(e['reason']); gone[k] = (gone[k] ?? 0) + 1; }
        else if (e.type === 'ItemCrafted' && e['recipeId'] === 'brew') brews += 1;
        else if (e.type === 'DrankWater') {
          const q = ent.get(Number(e['id']), C.Position);
          if (q && w.map.hasFlag(w.index(q.x, q.y, q.z), TileFlag.Outdoor)) waterOut += 1; else waterIn += 1;
        } else if (e.type === 'AlertChanged') out(`AlertChanged ${JSON.stringify(e)}`);
        else if (e.type === 'CreatureDied' && e['faction'] === 'fortress') {
          const q = ent.get(Number(e['id']), C.Position);
          out(`DIED ${String(e['id'])} ${String(e['cause'])} thirst ${dwarves.need(Number(e['id']), 'thirst')} at ${q ? `${q.x - state.cx},${q.y - state.cy},${q.z - state.z}` : '-'}`);
        }
      }
    });
    const shop = (key: string): string => {
      const id = state.placedIds[key] ?? 0;
      const ws = ent.get(id, C.Workshop);
      if (!ws) return `${key}:-`;
      const job = ws.currentJobId;
      const j = job ? (jobs.get(job) as unknown as Record<string, unknown> | undefined) : undefined;
      const o = ws.orders.map((x) => `${recipes.byIndex(x.recipe)?.id}>${x.threshold}`).join(',');
      return `${key}:[${o}] job ${j ? `${String((j['data'] as Record<string, unknown> | undefined)?.['recipe'] ?? '?')}/${String(j['state'])}` : '-'} blocked ${ws.lastBlockedReason ?? '-'}`;
    };
    const carpenters = (): string => {
      const ws = ent.get(state.placedIds['carpenter'] ?? 0, C.Workshop);
      const holders = (jobs as unknown as { workersWithLabor: (l: string) => number[] }).workersWithLabor('carpentry');
      return `assigned ${ws?.assignedWorker ?? '-'} ` + holders.map((id) => {
        const sq = ent.get(id, C.Soldier);
        return `${id}:${dwarves.activityText(id)}${sq && sq.squadId !== 0 ? `[sq${sq.squadId}]` : ''}`;
      }).join(',');
    };
    const timber = (): string => {
      const standing = state.timberTiles.filter((t) => w.map.kindAt(t) === TileKind.Tree);
      let trees = 0;
      for (let y = 0; y < w.map.h; y += 1) for (let x = 0; x < w.map.w; x += 1) {
        const top = w.map.columnSurfaceZ(x, y);
        for (const z of [top - 1, top, top + 1]) if (z >= 0 && z < w.map.d && w.map.kindAt(w.index(x, y, z)) === TileKind.Tree) trees += 1;
      }
      return `timber ${standing.length}/${state.timberTiles.length} chops ${standing.filter((t) => w.map.designationAt(t)).length} trees ${trees} charcoal ${items.count('charcoal_bar')}`;
    };
    let lastDay = -1;
    let lastSample = -1;
    const daily = (): void => {
      const b = state.economy.brewer;
      if (b !== undefined && w.tick - lastSample >= 50) {
        lastSample = w.tick;
        const k = dwarves.activityText(b).split(' ')[0]!;
        doing[k] = (doing[k] ?? 0) + 1;
      }
      if (day() === lastDay) return;
      lastDay = day();
      let brew = 0, plantAll = 0, empty = 0;
      const held: Record<string, number> = {};
      for (const id of ent.with(C.Item)) {
        const it = ent.get(id, C.Item)!;
        if (it.type === plantFood) { plantAll += it.count; if (brewable.has(it.material)) brew += it.count; }
        else if (it.type === barrel) {
          const inside = items.inContainer(id);
          if (inside.length === 0) empty += 1;
          const what = inside.length === 0 ? 'empty' : itemTypes.byIndex(ent.get(inside[0]!, C.Item)!.type)?.id ?? '?';
          const k = `${what}${it.reservedBy ? '*' : ''}`;
          held[k] = (held[k] ?? 0) + 1;
        }
      }
      const f = fortress();
      const thirst = f.map((id) => dwarves.need(id, 'thirst'));
      const surface = f.filter((id) => (ent.get(id, C.Position)?.z ?? -1) >= state.z).length;
      const brewer = state.economy.brewer;
      const bq = brewer ? ent.get(brewer, C.Position) : undefined;
      out(`pop ${f.length} drink ${items.count('drink')}/${items.available('drink')} brewable ${brew} plants ${plantAll} emptyBarrels ${empty} ` +
        `${shop('still')} ${shop('still2')} brewer ${brewer ?? '-'} ${brewer ? `${dwarves.activityText(brewer)}@${bq ? bq.z - state.z : '-'}` : ''} ` +
        `alert ${w.game.world.fortress.alert} thirst>=50 ${thirst.filter((t) => t >= 50).length} >=85 ${thirst.filter((t) => t >= 85).length} surface ${surface} ` +
        `drank alc ${alc} waterIn ${waterIn} waterOut ${waterOut} meals ${items.count('lavish_meal') + items.count('easy_meal')} ` +
        `brews ${brews} brewerDay ${JSON.stringify(doing)} barrels ${JSON.stringify(held)} lost ${JSON.stringify(gone)} ${shop('carpenter')} logs ${items.available('log')} ${timber()} carpenters ${carpenters()}`);
      alc = 0; waterIn = 0; waterOut = 0; gone = {}; brews = 0; doing = {};
    };
    const boot = 20 * TICKS_PER_DAY;
    while (w.tick < boot) {
      playThreeYears(w, state, Math.min(100, boot - w.tick), daily);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
    }
    try {
      while (w.tick < TO) {
        playThreeYears(w, state, Math.min(300, TO - w.tick), daily);
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
      }
    } catch (e) {
      out(`THROWN ${String(e)}`);
    }
    stop();
    mkdirSync(DIR, { recursive: true });
    writeFileSync(`${DIR}/${SEED}-${SHIFT}.txt`, lines.join('\n') + '\n');
    console.log(`[t656] ${SEED} shift ${SHIFT}: living ${fortress().length}; trace in ${DIR}/${SEED}-${SHIFT}.txt`);
    expect(w.tick).toBeGreaterThan(0);
  }, 7_200_000);
});
