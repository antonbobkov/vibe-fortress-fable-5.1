/**
 * T-583's second probe: a player who orders Making Do on top of the three-year fortress.
 *
 * Plays one seed of the three-year script (unchanged) and, from day `START_DAY`, does what a player
 * reading the build menu and the workshop lists would do: places a kiln, a smokehouse, a drying
 * rack, candle stands, a compost heap, beehives and lanterns once their items exist; adds standing
 * orders for every Making Do recipe at every workshop the fortress has; turns `fertilize` on for
 * its farm plots and `cellar` on for its stockpiles; zones a gather zone over the wild reed beds and
 * nettles; and cuts ice in winter. It records which recipes complete, which buildings stand, which
 * items and thoughts appear, and why the rest did not (blocked workshops, cancelled jobs, refused
 * commands).
 *
 * Run on GitHub: `gh workflow run measure.yml --ref <branch> -f suite=making_do -f probe_seeds=...`
 * with `PROBE_PLAYER=1`, or locally with `PROBE_DAYS` for a short look. Not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { C, ItemFlag } from '@core/components';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { Command } from '@core/commands';
import type { BuildingsReader } from '@systems/buildings';
import type { PlantsReader } from '@systems/plants/reader';
import { saveGame } from '@app/game-save';
import type { TestWorld } from '../scenarios/test-world';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
  type FortressState,
} from '../scenarios/three_years_fortress';

const SEED = process.env['PROBE_SEED'] ?? 'three-years-p0-1';
const SHIFT = Number(process.env['PROBE_SHIFT'] ?? '0');
const OUT = process.env['PROBE_OUT'];
const DAYS = Number(process.env['PROBE_DAYS'] ?? String(3 * DAYS_PER_YEAR));
const START_DAY = Number(process.env['PROBE_START_DAY'] ?? '40');

/** Standing orders a Making Do player adds, by workshop type: recipe and the stock it keeps. */
const ORDERS: Record<string, readonly (readonly [string, number])[]> = {
  kiln: [['burn_potash', 6], ['fire_bricks', 5], ['make_pot', 2], ['make_jug', 1], ['make_mugs_clay', 3], ['make_hive_clay', 1],
    ['make_glass_block', 6], ['make_glass_block_potash', 6], ['make_mugs_glass', 3], ['make_lantern', 2], ['burn_bone_ash', 3], ['crush_fossil', 3]],
  kitchen: [['crush_halite', 10], ['salt_meat', 10], ['salt_fish', 5], ['make_soap', 4], ['cook_feast', 1]],
  craftdwarf: [['make_candles_tallow', 10], ['make_candles_wax', 10], ['make_firebrand', 2], ['carve_fossil', 2], ['make_splint_bone', 4], ['make_crutch_bone', 1],
    ['make_mug_horn', 3], ['weave_basket', 2], ['twist_reed_rope', 2], ['weave_hive', 1], ['weave_wicker_shield', 1], ['craft_ivory', 2], ['carve_ivory_statue', 1]],
  still: [['brew_mead', 20], ['distill', 10]],
  farmers_workshop: [['press_honeycomb', 2]],
  // The chest is the clothier's: a player who wants bedding builds one.
  carpenter: [['make_hive_wood', 2], ['make_chest_wood', 2], ['make_bucket', 2]],
  clothier: [['make_bedding', 3], ['make_pillow', 3]],
  mason: [['cut_bone_blocks', 4], ['make_table_bone', 1], ['make_chair_bone', 1], ['make_door_bone', 1], ['make_coffin_bone', 1], ['make_statue_bone', 1],
    ['mount_skull', 1], ['make_stone_bed', 1], ['make_stone_bed_straw', 1]],
  leatherworks: [['make_scale_shirt', 1], ['make_scale_skirt', 1], ['cut_leather_rope', 1]],
  bowyer: [['make_horn_bow', 1], ['set_ammo_fletched', 1]],
  smokehouse: [['smoke_meat', 10], ['smoke_fish', 5]],
  smelter: [['make_steel_bone_ash', 1], ['make_steel_shell', 1], ['smelt_bog_iron', 2], ['alloy_pewter', 2], ['smelt_star_iron', 1]],
  forge: [['forge_crutch', 1]],
  loom: [['spin_coarse_thread', 2]],
};

/** Buildings placed from day START_DAY: type, offset from the wagon, the level (surface or hall), and how many. */
const PLACE: readonly { type: string; dx: number; dy: number; hall: boolean; n: number; needsItem?: string; ifMissing?: boolean }[] = [
  { type: 'kiln', dx: -8, dy: 6, hall: false, n: 1 },
  { type: 'smokehouse', dx: 8, dy: -6, hall: false, n: 1 },
  { type: 'clothier', dx: -8, dy: -6, hall: false, n: 1, ifMissing: true },
  { type: 'farmers_workshop', dx: 8, dy: 6, hall: false, n: 1, ifMissing: true },
  { type: 'leatherworks', dx: 12, dy: 0, hall: false, n: 1, ifMissing: true },
  { type: 'bowyer', dx: -12, dy: 0, hall: false, n: 1, ifMissing: true },
  { type: 'loom', dx: 0, dy: 12, hall: false, n: 1, ifMissing: true },
  { type: 'drying_rack', dx: 3, dy: 0, hall: true, n: 2 },
  { type: 'candle_stand', dx: 0, dy: 2, hall: true, n: 2 },
  { type: 'beehive', dx: -10, dy: -8, hall: false, n: 2, needsItem: 'beehive' },
  { type: 'lantern', dx: 2, dy: 2, hall: true, n: 2, needsItem: 'lantern' },
];

interface Seen { n: number; first: number }
type Tally = Record<string, Seen>;
function bump(t: Tally, key: string, day: number, by = 1): void {
  const s = t[key];
  if (s) s.n += by;
  else t[key] = { n: by, first: day };
}

class MakingDoPlayer {
  readonly placed = new Map<string, number[]>();
  readonly ordered = new Set<string>();
  readonly refused: Tally = {};
  readonly log: string[] = [];
  private compost = 0;
  private gather = 0;
  private lastGatherDay = -1;
  private lastIceDay = -1;

  constructor(readonly w: TestWorld, readonly state: FortressState) {}

  private day(): number { return Math.floor(this.w.tick / TICKS_PER_DAY) + 1; }

  private apply(cmd: Command, what: string): boolean {
    const r = this.w.game.world.applyCommand(cmd);
    if (!r.ok) bump(this.refused, `${what}:${r.reason}`, this.day());
    return r.ok;
  }

  private ownedItem(type: string): boolean {
    const ent = this.w.game.world.entities;
    const idx = this.w.game.registry.table('items').index(type);
    return ent.with(C.Item).some((id) => {
      const it = ent.get(id, C.Item)!;
      return it.type === idx && (it.flags & (ItemFlag.Merchant | ItemFlag.Foreign | ItemFlag.Installed)) === 0;
    });
  }

  /**
   * The nearest site to the offset where the ghost fits, off zones and creatures: on the hall's level,
   * or on each column's surface (the fixture's ground is not level).
   */
  private site(type: string, dx: number, dy: number, hall: boolean): number | undefined {
    const w = this.w;
    const buildings = w.readers.of<BuildingsReader>('14');
    const cands: number[] = [];
    for (let y = 2; y <= w.map.h - 4; y += 1) for (let x = 2; x <= w.map.w - 4; x += 1) cands.push(w.index(x, y, hall ? this.state.hallZ : w.map.columnSurfaceZ(x, y)));
    const dist = (t: number): number => Math.abs(w.map.xOf(t) - this.state.cx - dx) + Math.abs(w.map.yOf(t) - this.state.cy - dy) + 3 * Math.abs(w.map.zOf(t) - this.state.z);
    // A hive goes where the most flowers are within six tiles on its level, as its panel and hint ask.
    const plants = w.readers.of<PlantsReader>('07');
    const flowers = (t: number): number => {
      let n = 0;
      for (let y = w.map.yOf(t) - 6; y <= w.map.yOf(t) + 6; y += 1) for (let x = w.map.xOf(t) - 6; x <= w.map.xOf(t) + 6; x += 1) {
        if (w.map.inBounds(x, y, w.map.zOf(t)) && plants.flowerAt(w.index(x, y, w.map.zOf(t)))) n += 1;
      }
      return n;
    };
    const score = new Map<number, number>();
    if (type === 'beehive') for (const t of cands) score.set(t, -flowers(t) * 1000 + dist(t));
    const key = (t: number): number => score.get(t) ?? dist(t);
    cands.sort((a, b) => key(a) - key(b) || a - b);
    const ent = w.game.world.entities;
    const occupied = new Set<number>();
    for (const id of ent.with(C.Creature)) {
      const p = ent.get(id, C.Position);
      if (p) occupied.add(w.index(p.x, p.y, p.z));
    }
    return cands.find((t) => {
      const g = buildings.ghost(type, t, 0);
      return g.reason === null && g.tiles.every((tile) => buildings.zoneAt(tile) === 0 && !occupied.has(tile) && buildings.at(tile) === 0);
    });
  }

  step(): void {
    const w = this.w;
    if (w.tick < START_DAY * TICKS_PER_DAY) return;
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    const reg = w.game.registry;

    // Buildings.
    for (const p of PLACE) {
      const ids = this.placed.get(p.type) ?? [];
      const alive = ids.filter((id) => buildings.get(id) !== undefined);
      this.placed.set(p.type, alive);
      if (alive.length >= p.n) continue;
      if (p.needsItem && !this.ownedItem(p.needsItem)) continue;
      const typeIdx = reg.table('buildings').index(p.type);
      if (p.ifMissing && alive.length === 0 && ent.with(C.Building).some((id) => ent.get(id, C.Building)!.type === typeIdx)) continue;
      const origin = this.site(p.type, p.dx + alive.length * 2, p.dy, p.hall);
      if (origin === undefined) { bump(this.refused, `place:${p.type}:no_site`, this.day()); continue; }
      if (this.apply({ type: 'PlaceBuilding', buildingType: p.type, origin, orientation: 0, materialChoice: 0, priority: 4 } as Command, `place:${p.type}`)) {
        const id = (w.game.world.scheduler.byId('14') as unknown as { lastPlacedBuilding: number }).lastPlacedBuilding;
        alive.push(id);
        this.log.push(`day ${this.day()}: placed ${p.type} ${id}`);
      }
    }

    // Standing orders at every built workshop, once each.
    for (const id of ent.with(C.Workshop)) {
      const b = ent.get(id, C.Building);
      if (!b || b.state !== 'built') continue;
      const type = reg.table<{ id: string }>('buildings').byIndex(b.type)?.id ?? '';
      for (const [recipeId, threshold] of ORDERS[type] ?? []) {
        const key = `${id}:${recipeId}`;
        if (this.ordered.has(key)) continue;
        this.ordered.add(key);
        // A transform recipe (fletching) is ordered `once` (12 § Work orders).
        const transform = reg.table<{ id: string; transform?: boolean }>('recipes').byId(recipeId)?.transform === true;
        const order = transform ? { recipeId, mode: 'once', remaining: 4, priority: 3 } : { recipeId, mode: 'maintain', threshold, priority: 3 };
        if (this.apply({ type: 'AddWorkOrder', workshopId: id, order } as Command, `order:${type}:${recipeId}`)) {
          this.log.push(`day ${this.day()}: ordered ${recipeId} at ${type} ${id}`);
        }
      }
    }

    // Settings: fertilize every plot, cellar every stockpile below the surface.
    for (const z of buildings.zonesOfType('farm_plot')) {
      const zone = ent.get(z, C.Zone);
      if (zone && !zone.settings['fertilize']) this.apply({ type: 'SetZoneSetting', zoneId: z, key: 'fertilize', value: true } as Command, 'fertilize');
    }
    for (const z of buildings.zonesOfType('stockpile')) {
      const zone = ent.get(z, C.Zone);
      const t = zone?.tiles[0];
      if (zone && t !== undefined && w.map.zOf(t) < this.state.z && !zone.settings['cellar']) this.apply({ type: 'SetStockpileCellar', zoneId: z, on: true } as Command, 'cellar');
    }

    // A compost heap on the surface, 3 by 3, once.
    if (this.compost === 0 || ent.get(this.compost, C.Zone) === undefined) {
      const origin = this.site('drying_rack', -6, -10, false);
      if (origin !== undefined) {
        const tiles: number[] = [];
        for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
          const t = w.map.offset(origin, dx, dy, 0);
          if (t >= 0 && w.map.kindAt(t) === TileKind.Floor && buildings.zoneAt(t) === 0) tiles.push(t);
        }
        if (tiles.length > 0 && this.apply({ type: 'CreateZone', zoneType: 'compost', tiles } as Command, 'compost')) {
          this.compost = (w.game.world.scheduler.byId('14') as unknown as { lastCreatedZone: number }).lastCreatedZone;
          this.log.push(`day ${this.day()}: compost heap ${this.compost} (${tiles.length} tiles)`);
        }
      }
    }

    // A gather zone over the wild reed beds, nettles and salt crusts, once every 28 days.
    const day = this.day();
    if (day - this.lastGatherDay >= 28) {
      this.lastGatherDay = day;
      const plants = w.readers.of<PlantsReader>('07');
      const wanted = new Set(['reed_bed', 'wild_nettle', 'salt_crust', 'barrel_cactus', 'rock_lichen', 'wild_rye', 'wild_wyrmtongue']);
      const tiles: number[] = [];
      for (let t = 0; t < w.map.tileCount; t += 1) if (wanted.has(plants.speciesAt(t)) && buildings.zoneAt(t) === 0) tiles.push(t);
      if (tiles.length > 0 && this.apply({ type: 'CreateZone', zoneType: 'gather', tiles } as Command, 'gather')) {
        this.gather += tiles.length;
        this.log.push(`day ${day}: gather zone over ${tiles.length} wild Making Do plants`);
      }
    }

    // Ice: every 7 days in winter, cut the frozen outdoor water.
    if (day - this.lastIceDay >= 7) {
      this.lastIceDay = day;
      const tiles: number[] = [];
      for (let t = 0; t < w.map.tileCount; t += 1) if (w.map.fluidFrozenAt(t) && w.map.fluidLevelAt(t) > 0) tiles.push(t);
      if (tiles.length > 0) {
        const chosen = tiles.slice(0, 12);
        if (this.apply({ type: 'Designate', kind: 'harvest_ice', tiles: chosen, priority: 4 } as Command, 'harvest_ice')) {
          this.log.push(`day ${day}: harvest_ice on ${chosen.length} of ${tiles.length} frozen tiles`);
        }
      }
    }
  }
}

describe('T-583 probe: a Making Do player', () => {
  it(`${SEED} shift ${SHIFT}`, async () => {
    const peril = Number(/-p(\d)-/.exec(SEED)?.[1] ?? '0');
    const w = threeYearsWorld(SEED, peril);
    const reg = w.game.registry;
    const nameOf = (table: string, v: unknown): string =>
      typeof v === 'number' ? reg.table<{ id: string }>(table).byIndex(v)?.id ?? `#${v}` : String(v);
    if (SHIFT > 0) w.step(SHIFT);
    const state = setupThreeYearsFortress(w);
    const player = new MakingDoPlayer(w, state);
    const ent = w.game.world.entities;
    const day = (): number => Math.floor(w.tick / TICKS_PER_DAY) + 1;

    const detail: Record<string, Tally> = {};
    const d = (k: string): Tally => (detail[k] ??= {});
    const wsType = (id: unknown): string => {
      const b = ent.get(Number(id), C.Building);
      return b ? nameOf('buildings', b.type) : '?';
    };
    const unsub = w.game.world.onEvents((evs) => {
      const today = day();
      for (const e of evs) {
        switch (e.type as string) {
          case 'ItemCrafted': bump(d('recipe'), String(e['recipeId']), today); break;
          case 'ItemCreated': {
            const flags = ent.get(Number(e['id']), C.Item)?.flags ?? 0;
            bump(d((flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0 ? 'merchantCreated' : 'itemCreated'), `${String(e['itemType'])}:${String(e['material'])}`, today, Number(e['count'] ?? 1));
            break;
          }
          case 'CropPlanted': bump(d('planted'), `${nameOf('plants', e['species'])}${e['fertilized'] ? ':fertilized' : ''}`, today); break;
          case 'TradeCompleted': bump(d('trade'), String(e['civ']), today); break;
          case 'CreatureDied':
            if (e['faction'] === 'fortress') bump(d('fortressDied'), `${nameOf('creatures', e['species'])}:${String(e['cause'] ?? 'unknown')}`, today);
            break;
          case 'BuildingCompleted': bump(d('buildingCompleted'), String(e['buildingType']), today); break;
          case 'JobCompleted': bump(d('job'), nameOf('jobTypes', e['jobType']), today); break;
          case 'JobCancelled': bump(d('jobCancelled'), `${nameOf('jobTypes', e['jobType'])}:${String(e['reason'] ?? '')}`, today); break;
          case 'WorkshopBlocked': bump(d('workshopBlocked'), `${wsType(e['workshopId'])}:${String(e['reason'] ?? '')}:${String(e['input'] ?? '')}`, today); break;
          case 'WorkshopIdle': bump(d('workshopIdle'), `${wsType(e['workshopId'])}:${String(e['reason'] ?? '')}:${String(e['input'] ?? '')}`, today); break;
          case 'Slept': bump(d('slept'), `${String(e['bedType'] || 'floor')}:${String(e['bedding'] ?? 'none')}`, today); break;
          case 'DrankAlcohol': bump(d('drank'), `${nameOf('materials', e['material'])}${e['aged'] ? `:aged${String(e['aged'])}` : ''}`, today); break;
          case 'TreatmentDone': bump(d('treatment'), String(e['kind']), today); break;
          case 'ItemAged': bump(d('aged'), String(e['stage']), today); break;
          case 'SmokyFuelBurned': bump(d('smoky'), wsType(e['workshopId']), today); break;
          case 'ProductReady': bump(d('product'), String(e['product']), today); break;
          case 'Stung': case 'SpatOn': case 'RoostFound': case 'FossilFound': case 'RibsEntered': case 'WhimSet': case 'WhimJudged': case 'TileIgnited': case 'IceMelted':
            bump(d('events'), e.type, today); break;
          default: break;
        }
      }
    });
    const thoughts: Tally = {};
    const gains = new Set<string>();
    let lastSample = -Infinity;
    const sample = (): void => {
      if (w.tick - lastSample < 100) return;
      lastSample = w.tick;
      for (const id of ent.with(C.Mood)) for (const t of ent.get(id, C.Mood)!.thoughts) {
        const key = `${id}:${t.thought}:${t.startTick}`;
        if (gains.has(key)) continue;
        gains.add(key);
        bump(thoughts, nameOf('thoughts', t.thought), Math.floor(t.startTick / TICKS_PER_DAY) + 1);
      }
    };

    const ticks = DAYS * TICKS_PER_DAY;
    while (w.tick < ticks) {
      playThreeYears(w, state, Math.min(w.tick < 20 * TICKS_PER_DAY ? 100 : 300, ticks - w.tick), sample);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      player.step();
    }
    unsub();

    const items: Record<string, number> = {};
    for (const id of ent.with(C.Item)) {
      const it = ent.get(id, C.Item)!;
      if ((it.flags & (ItemFlag.Merchant | ItemFlag.Foreign)) !== 0) continue;
      const k = `${nameOf('items', it.type)}:${nameOf('materials', it.material)}${(it.flags & ItemFlag.Installed) !== 0 ? ':installed' : ''}`;
      items[k] = (items[k] ?? 0) + it.count;
    }
    const buildingsEnd: Record<string, number> = {};
    for (const id of ent.with(C.Building)) {
      const b = ent.get(id, C.Building)!;
      const k = `${nameOf('buildings', b.type)}:${nameOf('materials', b.material)}${b.state === 'built' ? '' : `:${b.state}`}`;
      buildingsEnd[k] = (buildingsEnd[k] ?? 0) + 1;
    }
    const orders: Record<string, unknown> = {};
    for (const id of ent.with(C.Workshop)) {
      for (const o of ent.get(id, C.Workshop)!.orders) orders[`${wsType(id)}:${nameOf('recipes', o.recipe)}`] = { mode: o.mode, threshold: o.threshold, remaining: o.remaining };
    }
    const labors: Record<string, number> = {};
    const laborRows = reg.table<{ id: string }>('labors');
    for (const id of ent.with(C.Labors)) {
      if (ent.get(id, C.Creature)?.faction !== 'fortress') continue;
      const en = ent.get(id, C.Labors)!.enabled;
      for (let k = 0; k <= laborRows.size; k += 1) if (((en[k >> 3] ?? 0) & (1 << (k & 7))) !== 0) labors[laborRows.byIndex(k)?.id ?? String(k)] = (labors[laborRows.byIndex(k)?.id ?? String(k)] ?? 0) + 1;
    }
    const blocked: Record<string, string> = {};
    for (const id of ent.with(C.Workshop)) {
      const ws = ent.get(id, C.Workshop)!;
      if (ws.lastBlockedReason) blocked[`${wsType(id)}:${id}`] = ws.lastBlockedReason;
    }
    const population = ent.with(C.Labors).filter((id) => ent.get(id, C.Creature)?.faction === 'fortress').length;
    const result = { seed: SEED, shift: SHIFT, days: DAYS, startDay: START_DAY, population, log: player.log, refused: player.refused, detail, thoughts, end: { items, buildings: buildingsEnd, orders, labors, blocked } };
    console.log(`[t583 player] ${SEED}: population ${population}; recipes ${JSON.stringify(detail['recipe'] ?? {})}`);
    console.log(`[t583 player] log:\n${player.log.join('\n')}\nrefused: ${JSON.stringify(player.refused)}`);
    if (OUT) {
      mkdirSync(dirname(OUT), { recursive: true });
      writeFileSync(OUT, JSON.stringify(result, null, 1) + '\n');
    }
    const save = process.env['PROBE_SAVE'];
    if (save) writeFileSync(save, await saveGame(w.game, { kind: 'manual' }));
    expect(population).toBeGreaterThanOrEqual(0);
  });
});
