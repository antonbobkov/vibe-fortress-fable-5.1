/**
 * T-664's probe of the food a fortress grows: plays a three-year seed (`PROBE_SEED`, default
 * `three-years-p4-2`) at `THREE_YEARS_SHIFT` (default 0) as the sweep plays it to `PROBE_TO` (default
 * the end of day 220) and writes one line a day from `PROBE_FROM` (default day 1): the dwarves, the
 * food in stock (plants, meals, the rest), the drink, the seed by species, the crops by stage and the
 * plots' empty tiles, the plant and harvest jobs by state, the kitchen, every dwarf with the farming
 * or the cooking labor and what it does, the founding farmer's labors, and the day's harvests,
 * plantings, crop deaths, food destroyed by reason, meals eaten and `Starving` events. Local
 * diagnosis only (set `T664_PROBE=1`); not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import type { DwarvesReader } from '@systems/dwarves';
import type { JobsReader } from '@systems/jobs';
import type { PlantsReader } from '@systems/plants';
import type { BuildingsReader } from '@systems/buildings';
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

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p4-2';
const PERIL = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '4');
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const TO = Number(process.env['PROBE_TO'] ?? String(220 * TICKS_PER_DAY));
const FROM = Number(process.env['PROBE_FROM'] ?? '1');
const DIR = `.vite/t664/${process.env['PROBE_TAG'] ?? 'probe'}`;

describe('T-664 probe: the farm and the kitchen', () => {
  it.runIf(process.env['T664_PROBE'] === '1')(`${SEED} shift ${SHIFT} to ${TO}`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    const stop = PERIL === 2 || PERIL === 4 ? watchInvariants(w.game, () => {}) : () => {};
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const dwarves = w.readers.of<DwarvesReader>('10');
    const jobs = w.readers.of<JobsReader>('11');
    const plants = w.readers.of<PlantsReader>('07');
    const buildings = w.readers.of<BuildingsReader>('14');
    const itemTypes = w.game.registry.table<{ id: string; edible?: boolean }>('items');
    const materials = w.game.registry.table<{ id: string }>('materials');
    const jobTypes = w.game.registry.table<{ id: string }>('jobTypes');
    const recipes = w.game.registry.table<{ id: string }>('recipes');
    const edible = new Set(itemTypes.ids().filter((id) => itemTypes.byId(id)?.edible === true).map((id) => itemTypes.index(id)));
    const plantFood = itemTypes.index('plant_food');
    const seedType = itemTypes.index('seed');
    const meals = new Set(['easy_meal', 'fine_meal', 'lavish_meal', 'feast'].map((id) => itemTypes.index(id)));
    const lines: string[] = [];
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const out = (s: string): void => { if (day() >= FROM) lines.push(`d${day()} t${w.tick} ${s}`); };
    const fortress = (): number[] => ent.with(C.Labors).filter((id) => ent.alive(id) && ent.get(id, C.Creature)?.faction === 'fortress');
    const farmer = w.game.arrival?.dwarves[4];
    let tally: Record<string, number> = {};
    const add = (k: string, n = 1): void => { tally[k] = (tally[k] ?? 0) + n; };
    let farmerDid: Record<string, number> = {};
    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'CropHarvested') { add('harvests'); add('harvested', Number(e['count'] ?? 0)); }
        else if (e.type === 'CropPlanted') add('planted');
        else if (e.type === 'CropDied') add(`cropDied:${String(e['reason'])}`);
        else if (e.type === 'PlotNeedsSeeds') add(`needsSeeds:${String(e['species'])}`);
        else if (e.type === 'MealEaten') add('ate');
        else if (e.type === 'Starving') add(`starving:${String(e['need'])}`);
        else if (e.type === 'ItemDestroyed' && itemTypes.has(String(e['itemType'])) && (edible.has(itemTypes.index(String(e['itemType']))) || e['itemType'] === 'seed')) add(`lost:${String(e['itemType'])}:${String(e['reason'])}`);
        else if (e.type === 'ItemCrafted' && /^cook_|^brew/.test(String(e['recipeId']))) add(`made:${String(e['recipeId'])}`);
        else if (e.type === 'AlertChanged') out(`AlertChanged ${String(e['level'] ?? e['to'] ?? JSON.stringify(e))}`);
        else if (e.type === 'CreatureDied' && e['faction'] === 'fortress') {
          out(`DIED ${String(e['id'])} ${String(e['cause'])}${Number(e['id']) === farmer ? ' (the founding farmer)' : ''} hunger ${dwarves.need(Number(e['id']), 'hunger')}`);
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
      return `${key}:[${o}] worker ${ws.assignedWorker ?? '-'} job ${j ? `${String((j['data'] as Record<string, unknown> | undefined)?.['recipe'] ?? '?')}/${String(j['state'])}` : '-'} blocked ${ws.lastBlockedReason ?? '-'}`;
    };
    const who = (labor: string): string => (jobs as unknown as { workersWithLabor: (l: string) => number[] }).workersWithLabor(labor).filter((id) => ent.alive(id)).map((id) => {
      const sq = ent.get(id, C.Soldier);
      const j = jobs.forWorker(id);
      const r = j ? (j.data as Record<string, unknown>)['recipe'] : undefined;
      const jt = j ? `{${jobTypes.byIndex(j.type)?.id}${typeof r === 'number' ? `/${recipes.byIndex(r)?.id}` : ''} p${j.priority}}` : '';
      return `${id}${id === farmer ? '*' : ''}:${dwarves.activityText(id)}${jt}${sq && sq.squadId !== 0 ? '[sq]' : ''}`;
    }).join(', ');
    const jobLine = (type: string): string => {
      const counts: Record<string, number> = {};
      for (const j of jobs.list()) {
        if (jobTypes.byIndex(j.type)?.id !== type) continue;
        const t = typeof j.data['tile'] === 'number' ? j.data['tile'] : j.target.ref;
        const where = w.map.hasFlag(t, TileFlag.Outdoor) ? 'out' : 'in';
        const k = `${where}:p${j.priority}:` + (j.state === 'blocked' ? `blocked:${j.blockedReason ?? '?'}` : j.state);
        counts[k] = (counts[k] ?? 0) + 1;
      }
      return JSON.stringify(counts);
    };
    let lastDay = -1;
    let lastSample = -1;
    const daily = (): void => {
      if (farmer !== undefined && ent.alive(farmer) && w.tick - lastSample >= 50) {
        lastSample = w.tick;
        const j = jobs.forWorker(farmer);
        const k = j ? (jobTypes.byIndex(j.type)?.id ?? '?') : dwarves.activityText(farmer).split(' ')[0]!;
        farmerDid[k] = (farmerDid[k] ?? 0) + 1;
      }
      if (day() === lastDay) return;
      lastDay = day();
      let plantsN = 0, mealsN = 0, other = 0, rotting = 0;
      const seeds: Record<string, number> = {};
      for (const id of ent.with(C.Item)) {
        const it = ent.get(id, C.Item)!;
        if ((it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
        if (it.type === seedType) { const s = materials.byIndex(it.material)?.id ?? '?'; seeds[s] = (seeds[s] ?? 0) + it.count; continue; }
        if (!edible.has(it.type)) continue;
        if (it.type === plantFood) plantsN += it.count; else if (meals.has(it.type)) mealsN += it.count; else other += it.count;
        const r = items.rotOutlook(id);
        if (r && r.stage >= 2) rotting += it.count;
      }
      const stages: number[] = [0, 0, 0, 0, 0];
      const bySpecies: Record<string, number> = {};
      for (const c of plants.crops()) {
        const info = plants.cropInfo(c);
        if (!info) continue;
        bySpecies[info.species] = (bySpecies[info.species] ?? 0) + 1;
        stages[Math.min(4, info.stage)]! += 1;
      }
      let ready = 0;
      for (const c of plants.crops()) { const info = plants.cropInfo(c); if (info && plants.cropReady(info.tile)) ready += 1; }
      let plotTiles = 0, bare = 0;
      for (const z of plants.plots()) for (const t of buildings.zone(z)?.tiles ?? []) { plotTiles += 1; if (plants.cropAt(t) === 0) bare += 1; }
      const f = fortress();
      const hunger = f.map((id) => dwarves.need(id, 'hunger'));
      const labors = farmer !== undefined && ent.alive(farmer)
        ? ['farming', 'mining', 'woodcutting', 'hauling', 'brewing', 'cooking'].filter((l) => jobs.laborEnabled(farmer, l)).join('+') : 'dead';
      const openByType: Record<string, number> = {};
      for (const j of jobs.list('open')) { const k = `${jobTypes.byIndex(j.type)?.id}:p${j.priority}`; openByType[k] = (openByType[k] ?? 0) + 1; }
      const openTop = Object.entries(openByType).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `${k}=${n}`).join(',');
      out(`pop ${f.length} plants ${plantsN} meals ${mealsN} otherFood ${other} rotting ${rotting} drink ${items.count('drink')} seeds ${JSON.stringify(seeds)} ` +
        `crops ${JSON.stringify(bySpecies)} stages ${stages.join('/')} ready ${ready} plots ${plants.plots().length}/${plotTiles} bare ${bare} ` +
        `plantJobs ${jobLine('plant')} harvestJobs ${jobLine('harvest')} ${shop('kitchen')} ` +
        `alert ${w.game.world.fortress.alert} hunger>=50 ${hunger.filter((t) => t >= 50).length} >=85 ${hunger.filter((t) => t >= 85).length} ` +
        `day ${JSON.stringify(tally)} farmer ${farmer ?? '-'} [${labors}] did ${JSON.stringify(farmerDid)} ` +
        `strips ${state.economy.farmPlans.length}:${state.economy.farmPlans.filter((p) => p.zoneId > 0).length}:${state.economy.farmPlans.reduce((n, p) => n + p.tiles.length, 0)} ` +
        `caves ${state.economy.cavePlans.length}:${state.economy.cavePlans.filter((p) => p.zoneId > 0).length} famine ${state.economy.famine?.day ?? '-'} ` +
        `farmers ${who('farming')} | cooks ${who('cooking')} | open ${openTop} | chops ${jobLine('chop')} axes ${items.count('axe')}/${items.available('axe')} logs ${items.available('log')} | care ${jobLine('feed_patient')} ${jobLine('water_patient')} | dwarves ` +
        f.map((id) => `${id}:${ent.get(id, C.Brain)?.behavior ?? '?'}/h${Math.round(dwarves.need(id, 'hunger'))}/` +
          `${['farming', 'hauling', 'medicine', 'mining', 'woodcutting', 'carpentry'].filter((l) => jobs.laborEnabled(id, l)).map((l) => l.slice(0, 2)).join('')}${(ent.get(id, C.Soldier)?.squadId ?? 0) !== 0 ? '[sq]' : ''}`).join(' '));
      tally = {};
      farmerDid = {};
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
        if (fortress().length === 0) { out('EXTINCT'); break; }
      }
    } catch (e) {
      out(`THROWN ${String(e)}`);
    }
    stop();
    mkdirSync(DIR, { recursive: true });
    writeFileSync(`${DIR}/${SEED}-${SHIFT}.txt`, lines.join('\n') + '\n');
    console.log(`[t664] ${SEED} shift ${SHIFT}: living ${fortress().length}; trace in ${DIR}/${SEED}-${SHIFT}.txt`);
    expect(w.tick).toBeGreaterThan(0);
  }, 7_200_000);
});
