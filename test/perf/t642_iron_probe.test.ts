import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { TerrainReader } from '@systems/terrain/reader';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

/**
 * T-642: where the iron goes. Plays one three-year seed at a sweep shift on the sweep's own cadence
 * (three_years_seeds.test.ts) to `T642_DAYS` and prints, every `T642_EVERY` days from `T642_FROM`:
 * the iron ore faces the script has opened (designated) and the ore tiles dug, the drift tiles
 * designated with them, the dig designations still open, the iron ore and bars in stock, the
 * smelter's and forge's jobs done by recipe, and what the smelter's worker did (shares of samples
 * every 20 ticks). A measurement, not a gate: it runs only with `T642_PROBE=1`, e.g.
 *   T642_PROBE=1 T642_SEED=three-years-p2-1 T642_PERIL=2 T642_SHIFT=0 T642_DAYS=336 npx vitest run -c vitest.perf.config.ts test/perf/t642_iron_probe.test.ts
 */
const RUN = process.env['T642_PROBE'] === '1';
const SEED = process.env['T642_SEED'] ?? 'three-years-p2-1';
const PERIL = Number(process.env['T642_PERIL'] ?? '2');
const SHIFT = Number(process.env['T642_SHIFT'] ?? '0');
const DAYS = Number(process.env['T642_DAYS'] ?? '336');
const FROM = Number(process.env['T642_FROM'] ?? '0');
const EVERY = Number(process.env['T642_EVERY'] ?? '14');
const IRON_ORES = ['hematite', 'limonite', 'magnetite'];

describe.skipIf(!RUN)('T-642 iron probe', () => {
  it(`plays ${SEED} at shift ${SHIFT} to day ${DAYS} and prints the iron`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const reg = w.game.registry;
    const materials = reg.table<{ id: string }>('materials');
    const ironOres = new Set(IRON_ORES.map((id) => materials.index(id)));
    const items = w.readers.of<ItemsReader>('13');
    const terrain = w.readers.of<TerrainReader>('03');
    const buildings = w.readers.of<BuildingsReader>('14');
    const oreType = reg.table('items').index('ore');
    const barType = reg.table('items').index('bar');
    const iron = materials.index('iron');
    const steel = materials.index('steel');
    // The map's iron ore by level, once: where the bands could find it.
    const census: Record<number, number> = {};
    for (let z = 0; z < w.map.d; z += 1) for (let y = 0; y < w.map.h; y += 1) for (let x = 0; x < w.map.w; x += 1) {
      const t = w.index(x, y, z);
      if (w.map.kindAt(t) === TileKind.Wall && ironOres.has(w.map.materialAt(t))) census[z] = (census[z] ?? 0) + 1;
    }
    console.log(`[t642census] ${JSON.stringify({ seed: SEED, shift: SHIFT, hallZ: state.hallZ, z: state.z, ironByLevel: census })}`);
    const made: Record<string, number> = {};
    let ironDug = 0;
    w.game.world.onEvents((batch) => {
      for (const e of batch) {
        if (e.type === 'ItemCrafted') {
          const r = String(e['recipeId']);
          const it = ent.get(Number(e['itemId']), C.Item);
          const m = it === undefined ? '' : materials.byIndex(it.material)?.id ?? '';
          if (r.startsWith('smelt_') || r.startsWith('alloy_') || r.startsWith('forge_') || r.startsWith('melt_')) made[`${r}:${m}`] = (made[`${r}:${m}`] ?? 0) + 1;
        }
        if (e.type === 'MineralMined' && ironOres.has(Number(e['material']))) ironDug += 1;
      }
    });
    const hist: Record<string, number> = {};
    // T-648: the samples at which a smelter skips an order as out of reach, by recipe and input.
    const skips: Record<string, number> = {};
    const sample = (): void => {
      if (w.tick < FROM * TICKS_PER_DAY) return;
      for (const key of ['smelter', 'smelter_2']) {
        for (const e of ent.get(state.placedIds[key] ?? 0, C.Workshop)?.outOfReach ?? []) {
          if (e.until > w.tick) skips[`${key}:${e.recipe}:${e.input}`] = (skips[`${key}:${e.recipe}:${e.input}`] ?? 0) + 1;
        }
      }
      const worker = ent.get(state.placedIds['smelter'] ?? 0, C.Workshop)?.assignedWorker ?? 0;
      const brain = worker ? ent.get(worker, C.Brain) : undefined;
      const job = ent.get(state.placedIds['smelter'] ?? 0, C.Workshop)?.currentJobId ? 'job' : 'idle';
      const a = brain === undefined ? 'none' : `${job} ${brain.behavior}:${brain.activity.split(' ')[0]}`;
      hist[a] = (hist[a] ?? 0) + 1;
    };
    let lastDay = -1;
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, Math.min(300, DAYS * TICKS_PER_DAY - w.tick), sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      const day = Math.floor(w.tick / TICKS_PER_DAY);
      if (day < FROM || day === lastDay || day % EVERY !== 0) continue;
      lastDay = day;
      const faces = [...state.economy.mined].filter((t) => ironOres.has(w.map.materialAt(t)) || !(w.map.kindAt(t) === TileKind.Wall));
      const ironFaces = [...state.economy.mined].filter((t) => ironOres.has(w.map.materialAt(t)));
      const designations = terrain.designations();
      const openIron = ironFaces.filter((t) => w.map.kindAt(t) === TileKind.Wall && terrain.designationAt(t) !== null).length;
      const undesignated = ironFaces.filter((t) => w.map.kindAt(t) === TileKind.Wall && terrain.designationAt(t) === null).length;
      // Where the free iron ore lies: in a stockpile or not, and how far from the smelter (steps plus four a level).
      const smelterAt = buildings.get(state.placedIds['smelter'] ?? 0)?.footprint[4] ?? -1;
      const where = (want: (type: number, material: number) => boolean): { stocked: number; loose: number; far: number; cut: number; mean: number | null; z: Record<number, number> } => {
        const lying = { stocked: 0, loose: 0, far: 0, sum: 0, n: 0, cut: 0, z: {} as Record<number, number> };
        for (const id of ent.with(C.Item)) {
          const it = ent.get(id, C.Item)!;
          if (!want(it.type, it.material) || it.flags !== 0) continue;
          const p = ent.get(id, C.Position);
          if (p === undefined || smelterAt < 0) continue;
          const t = w.index(p.x, p.y, p.z);
          if (buildings.zoneAt(t) !== 0) lying.stocked += it.count; else lying.loose += it.count;
          if (w.readers.pathing.labelOf(t, 'walker') !== w.readers.pathing.labelOf(smelterAt, 'walker')) lying.cut += it.count;
          lying.z[p.z] = (lying.z[p.z] ?? 0) + it.count;
          const d = Math.abs(p.x - w.map.xOf(smelterAt)) + Math.abs(p.y - w.map.yOf(smelterAt)) + 4 * Math.abs(p.z - w.map.zOf(smelterAt));
          lying.sum += d * it.count; lying.n += it.count; if (d > 30) lying.far += it.count;
        }
        return { stocked: lying.stocked, loose: lying.loose, far: lying.far, cut: lying.cut, mean: lying.n ? Math.round(lying.sum / lying.n) : null, z: lying.z };
      };
      const lying = where((type, material) => type === oreType && ironOres.has(material));
      const charcoalType = reg.table('items').index('charcoal_bar');
      const coalOres = new Set(['bituminous_coal', 'lignite'].map((id) => materials.index(id)));
      console.log(`[t642where] ${JSON.stringify({ day, charcoal: where((type) => type === charcoalType), coalOre: where((type, material) => type === oreType && coalOres.has(material)) })}`);
      const n = Object.values(hist).reduce((a, b) => a + b, 0) || 1;
      const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${Math.round((100 * v) / n)}%`).join(', ');
      const miners = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress' && w.readers.of<JobsReader>('11').laborEnabled(id, 'mining')).length;
      console.log(`[t642] ${JSON.stringify({ day, ironDug, ironFacesOpen: openIron, ironFacesUndesignated: undesignated, minedSet: faces.length, workings: state.economy.workings.size,
        digOpen: designations.length, ore: items.countAvailable({ type: oreType, materialIds: [...ironOres] }), oreAll: items.count('ore'),
        bars: items.countAvailable({ type: barType, materialId: iron }), steel: items.countAvailable({ type: barType, materialId: steel }),
        oreLying: lying, steelOwed: state.strong?.steelOwed ?? null, since: state.strong?.since ?? null, miners, made })}`);
      console.log(`[t642smelter] day ${day} ${top}`);
      console.log(`[t648skips] ${JSON.stringify({ day, samples: n, skips })}`);
      for (const k of Object.keys(skips)) delete skips[k];
      // The fuel and flux, and each smelter's orders, job and worker.
      const recipes = reg.table<{ id: string }>('recipes');
      const shop = (key: string): unknown => {
        const id = state.placedIds[key] ?? 0;
        const ws = ent.get(id, C.Workshop);
        if (ws === undefined) return { key, state: buildings.get(id)?.state ?? 'none' };
        const job = ws.currentJobId ? w.readers.of<JobsReader>('11').get(ws.currentJobId) : undefined;
        const at = buildings.get(id)?.footprint[4] ?? -1;
        return { key, z: at < 0 ? null : w.map.zOf(at), outdoor: at >= 0 && w.map.hasFlag(at, TileFlag.Outdoor), orders: ws.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode === 'maintain' ? o.threshold : o.remaining}`),
          job: job ? `${String(job.data['recipe'] ?? job.key)}:${job.state}${job.blockedReason ? `:${job.blockedReason}` : ''}` : null, blocked: ws.lastBlockedReason ?? null, worker: ws.assignedWorker,
          skipped: (ws.outOfReach ?? []).map((e) => `${e.recipe}:${e.input}`) };
      };
      const coalOre = items.countAvailable({ type: oreType, materialIds: ['bituminous_coal', 'lignite'].map((id) => materials.index(id)) });
      console.log(`[t642fuel] ${JSON.stringify({ day, charcoal: items.available('charcoal_bar'), coal: items.available('coal_bar'), coalOre, logs: items.available('log'),
        flux: ['limestone', 'marble', 'dolomite', 'chalk'].reduce((n, m) => n + items.countAvailable({ type: reg.table('items').index('raw_stone'), materialId: materials.index(m) }), 0),
        smelter: shop('smelter'), smelter2: shop('smelter_2'), burner: state.economy.specialists['charcoal'] ?? null, phases: ['ore store', 'fuel store', 'fed below'].filter((p) => state.economy.phases.has(p)) })}`);
      for (const k of Object.keys(made)) delete made[k];
      for (const k of Object.keys(hist)) delete hist[k];
      ironDug = 0;
    }
  }, 3_600_000);
});
