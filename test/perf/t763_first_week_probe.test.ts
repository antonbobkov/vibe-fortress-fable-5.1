/**
 * T-763's probe: the first fourteen days of a busy fortress on the default embark, and its moods.
 *
 * The site is the one the world map starts on: the embarkable region nearest the centre of the
 * standard world of the seed, with the Balanced preset. On day 1 the probe gives the orders a
 * newcomer gives: a stair shaft down four levels and a 5 × 5 room at its foot, a chop box over the
 * twelve trees nearest the wagon, a carpenter's workshop with an order for four beds, a 4 × 4
 * stockpile that takes everything and a 4 × 4 farm plot. The variant `meeting` also zones a 3 × 3
 * meeting area beside the wagon on day 1.
 *
 * Recorded hourly for each dwarf: its mood and tier, its thoughts, its social need, and what its
 * mood would be if `lonely` counted once (as a thought, not as need pressure), recomputed from the
 * same thoughts. Reported by day: the dwarf-hours at Miserable, the dwarves that were Miserable, the
 * talks; for each dwarf's first Miserable hour, its three strongest negative thoughts, traits and
 * social need.
 *
 * Local measurement only (`T763_PROBE=1`, `T763_SEEDS=a,b,c`, `T763_DAYS`, `T763_OUT`); not part of
 * `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { contentRegistry } from '@content/loader';
import { localMapSpec } from '@systems/embark';
import { TICKS_PER_DAY, TICKS_PER_HOUR, WORLD_SIZE_STANDARD } from '@core/constants';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { generate as generateWorld } from '@systems/worldgen';
import type { BuildingsReader } from '@systems/buildings';
import type { MoraleReader } from '@systems/morale/reader';
import { moodValue } from '@systems/morale/mood';
import { NEED_PRESSURE_THOUGHTS } from '@systems/morale/standing';
import { personalityBase, personalityMultiplier, type ThoughtDef } from '@systems/morale/thoughts';
import { TestWorld } from '../scenarios/test-world';

const SEEDS = (process.env['T763_SEEDS'] ?? 'deep-5589-1,probe-2,probe-3,probe-4,probe-5').split(',');
const DAYS = Number(process.env['T763_DAYS'] ?? '14');
const OUT = process.env['T763_OUT'];

interface FirstMiserable {
  readonly name: string;
  readonly day: number;
  readonly hour: number;
  readonly mood: number;
  readonly traits: readonly string[];
  readonly social: number;
  readonly top: readonly string[];
  readonly onceMood: number;
  /** The mood's parts at that hour: negatives (capped), need pressure, lonely's share of it, raw. */
  readonly parts: string;
}

interface DayRow {
  day: number;
  dwarfHours: number;
  miserableHours: number;
  miserableDwarves: number;
  onceMiserableHours: number;
  onceMiserableDwarves: number;
  lonelyHours: number;
  talks: number;
  meanMood: number;
  minMood: number;
  alive: number;
  /** Miserable dwarf-hours that lonely counted once would have kept at 20 or more. */
  lonelyMadeHours: number;
}

/**
 * T-767: the needs-met floor. For each dwarf-hour whose mood is held up by the floor (raw mood under
 * 20 − need pressure), the hour of the day and the pressure; and what candidate rules would give.
 * A need is *pressing* when it is at least halfway from its want threshold to its critical one:
 * hunger and thirst 67.5 (an unscaled thought of 3.5), rest 75 (3). `lonely` has no critical
 * threshold; rule `half` counts it in full, `half+social` counts it from social 75 (2.5).
 */
interface FloorStats {
  /** By hour of the day: hours held at exactly 20 (no pressure), Miserable hours, their summed pressure. */
  heldByHour: number[];
  miserableByHour: number[];
  pressureByHour: number[];
  /** Miserable hours each candidate rule would keep at 20 or more, by hour of day. */
  rescued: Record<string, number[]>;
  /** Miserable hours by floored pressure (1 … 20). */
  pressureHist: number[];
  /** Miserable hours by the need thoughts present (sorted ids), and by whether any is pressing. */
  composition: Record<string, number>;
  /** Miserable hours whose raw mood is above 20 − pressure (not floor-bound but raw-bound). */
  rawBound: number;
  /** Days 1–4 only: Miserable hours and those each rule rescues. */
  early: { miserable: number; rescued: Record<string, number> };
}

const RULES = ['half', 'half+social', 'flat3', 'flat4', 'flat5'] as const;
const HALF: Record<string, number> = { hungry: 3.5, thirsty: 3.5, tired: 3, lonely: 2.5 };

function newFloorStats(): FloorStats {
  const z = (): number[] => Array.from({ length: 24 }, () => 0);
  const rescued: Record<string, number[]> = {};
  const early: Record<string, number> = {};
  for (const r of RULES) { rescued[r] = z(); early[r] = 0; }
  return { heldByHour: z(), miserableByHour: z(), pressureByHour: z(), rescued, pressureHist: Array.from({ length: 21 }, () => 0), composition: {}, rawBound: 0, early: { miserable: 0, rescued: early } };
}

interface RunResult {
  readonly floor: FloorStats;
  readonly seed: string;
  readonly variant: string;
  readonly region: number;
  readonly biome: string;
  readonly dwarves: number;
  readonly days: DayRow[];
  readonly firstMiserable: FirstMiserable[];
  readonly firstOnceMiserable: { name: string; day: number }[];
  readonly thoughtHours: Record<string, number>;
  readonly orders: string[];
  readonly deaths: string[];
}

function siteRegion(seed: string): { spec: ReturnType<typeof localMapSpec>; region: number; biome: string } {
  const registry = contentRegistry();
  const world = generateWorld(seed, WORLD_SIZE_STANDARD, registry);
  const biomes = registry.table<{ id: string; embarkable: boolean }>('biomes');
  const size = world.size;
  const mid = Math.floor(size / 2);
  let best = -1;
  let bestD = Infinity;
  for (const r of world.regions) {
    if (biomes.byId(r.biome)?.embarkable !== true) continue;
    const d = Math.max(Math.abs((r.id % size) - mid), Math.abs(Math.floor(r.id / size) - mid));
    if (d < bestD) { best = r.id; bestD = d; }
  }
  if (best < 0) throw new Error(`no site on ${seed}`);
  return { spec: localMapSpec(world, best, registry), region: best, biome: world.regions[best]!.biome };
}

function orderDayOne(w: TestWorld, meeting: boolean): string[] {
  const log: string[] = [];
  const map = w.map;
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('no wagon');
  const buildings = w.readers.of<BuildingsReader>('14');
  const apply = (cmd: Command, what: string): boolean => {
    const r = w.game.world.applyCommand(cmd);
    log.push(`${what}: ${r.ok ? 'ok' : r.reason}`);
    return r.ok;
  };
  const used = new Set<number>();
  const surface = (x: number, y: number): number => w.index(x, y, map.columnSurfaceZ(x, y));
  const ring = (radius: number, fn: (x: number, y: number) => boolean): void => {
    for (let r = 1; r <= radius; r += 1) {
      for (let y = wagon.y - r; y <= wagon.y + r; y += 1) for (let x = wagon.x - r; x <= wagon.x + r; x += 1) {
        if (Math.max(Math.abs(x - wagon.x), Math.abs(y - wagon.y)) !== r) continue;
        if (x < 3 || y < 3 || x > map.w - 8 || y > map.h - 8) continue;
        if (fn(x, y)) return;
      }
    }
  };
  // A box of `n × n` surface floor tiles, unzoned and unused, nearest the wagon past `minR`.
  const box = (n: number, minR: number, zoneType: string): number[] | null => {
    let found: number[] | null = null;
    ring(30, (x, y) => {
      if (Math.max(Math.abs(x - wagon.x), Math.abs(y - wagon.y)) < minR) return false;
      const tiles: number[] = [];
      for (let dy = 0; dy < n; dy += 1) for (let dx = 0; dx < n; dx += 1) {
        const t = surface(x + dx, y + dy);
        if (used.has(t) || map.kindAt(t) !== TileKind.Floor || !buildings.zoneTileQualifies(zoneType, t) || buildings.at(t) !== 0) return false;
        tiles.push(t);
      }
      found = tiles;
      return true;
    });
    if (found !== null) for (const t of found as number[]) used.add(t);
    return found;
  };

  // The stair shaft and a room at its foot.
  ring(12, (x, y) => {
    const z = map.columnSurfaceZ(x, y);
    const t = w.index(x, y, z);
    if (map.kindAt(t) !== TileKind.Floor || Math.abs(x - wagon.x) < 3) return false;
    const below = z - 4;
    if (!apply({ type: 'DesignateStairwell', x, y, zTop: z, zBottom: below, priority: 4 } as Command, `stairwell ${x},${y},${z}..${below}`)) return false;
    const room: number[] = [];
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = 1; dx <= 5; dx += 1) {
      const r = w.index(x + dx, y + dy, below);
      if (map.kindAt(r) === TileKind.Wall) room.push(r);
    }
    apply({ type: 'Designate', kind: 'dig', priority: 4, tiles: room } as Command, `dig room ${room.length}`);
    for (let k = 0; k <= 6; k += 1) used.add(surface(x + k, y));
    return true;
  });

  // The chop box: the twelve trees nearest the wagon.
  const trees: number[] = [];
  for (let y = wagon.y - 15; y <= wagon.y + 15; y += 1) for (let x = wagon.x - 15; x <= wagon.x + 15; x += 1) {
    if (!map.inBounds(x, y, 0)) continue;
    const z = map.columnSurfaceZ(x, y);
    for (const zz of [z, z + 1]) if (map.inBounds(x, y, zz) && map.kindAt(w.index(x, y, zz)) === TileKind.Tree) trees.push(w.index(x, y, zz));
  }
  trees.sort((a, b) => Math.hypot(map.xOf(a) - wagon.x, map.yOf(a) - wagon.y) - Math.hypot(map.xOf(b) - wagon.x, map.yOf(b) - wagon.y) || a - b);
  if (trees.length > 0) apply({ type: 'Designate', kind: 'chop', priority: 4, tiles: trees.slice(0, 12) } as Command, `chop ${Math.min(12, trees.length)}`);

  // The carpenter's workshop and its order.
  ring(20, (x, y) => {
    if (Math.max(Math.abs(x - wagon.x), Math.abs(y - wagon.y)) < 4) return false;
    const t = surface(x, y);
    const g = buildings.ghost('carpenter', t, 0);
    if (g.reason !== null || g.tiles.some((tile) => used.has(tile))) return false;
    if (!apply({ type: 'PlaceBuilding', buildingType: 'carpenter', origin: t, orientation: 0, materialChoice: 0, priority: 4 } as Command, 'carpenter')) return false;
    for (const tile of g.tiles) used.add(tile);
    apply({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId: 'make_bed', mode: 'once', remaining: 4, priority: 4 } } as Command, 'order beds');
    return true;
  });

  const pile = box(4, 3, 'stockpile');
  if (pile !== null) {
    const id = w.zone('stockpile', pile);
    apply({ type: 'SetStockpileFilter', zoneId: id, filter: 'everything' } as Command, 'stockpile everything');
  }
  const farm = box(4, 5, 'farm_plot');
  if (farm !== null) {
    const id = w.zone('farm_plot', farm);
    apply({ type: 'SetPlotCrop', zoneId: id, season: 0, speciesId: 'turnip' } as Command, 'farm turnip');
  } else log.push('farm: no site');
  if (meeting) {
    const area = box(3, 2, 'meeting_area');
    if (area !== null) { w.zone('meeting_area', area); log.push('meeting area: ok'); } else log.push('meeting area: no site');
  }
  return log;
}

function run(seed: string, meeting: boolean, shift: number): RunResult {
  const site = siteRegion(seed);
  const w = new TestWorld({ seed, world: 'local', spec: site.spec, embark: 'default' });
  const registry = w.game.registry;
  // The player takes a moment over the orders: each shift is another timeline of the same site.
  if (shift > 0) w.step(shift);
  const orders = orderDayOne(w, meeting);
  const morale = w.readers.of<MoraleReader>('15');
  const traitTable = registry.table<{ id: string }>('personality');
  const entities = w.game.world.entities;
  const startTick = w.tick;
  const days: DayRow[] = [];
  const firstMiserable: FirstMiserable[] = [];
  const firstOnceMiserable: { name: string; day: number }[] = [];
  const seenMiserable = new Set<EntityId>();
  const seenOnce = new Set<EntityId>();
  const thoughtHours: Record<string, number> = {};
  let talks = 0;
  const deaths: string[] = [];
  w.game.world.onEvents((batch) => {
    for (const e of batch) {
      if (e.type === 'Talked') talks += 1;
      if (process.env['T763_DAMAGE'] === '1' && (e.type === 'WoundInflicted' || e.type === 'Fell' || e.type === 'AttackResolved' || e.type === 'ConstructionCollapsed' || e.type === 'BurnDamage')) {
        deaths.push(`ev day ${Math.floor((w.tick - startTick) / TICKS_PER_DAY) + 1} ${e.type} ${String(e['woundType'] ?? '')}/${String(e['severity'] ?? '')} on ${w.game.registry.table<{ id: string }>('creatures').byIndex(w.game.world.entities.get(e['id'] as number, C.Creature)?.species ?? -1)?.id ?? '?'}`);
      }
      if (e.type === 'DamageDealt' && process.env['T763_DAMAGE'] === '1') {
        const att = w.game.world.entities.get(e['attackerId'] as number, C.Creature);
        const def = w.game.world.entities.get(e['defenderId'] as number, C.Creature);
        const sp = (c: typeof att): string => (c === undefined ? 'none' : `${w.game.registry.table<{ id: string }>('creatures').byIndex(c.species)?.id ?? '?'}/${c.faction}`);
        deaths.push(`hit day ${Math.floor((w.tick - startTick) / TICKS_PER_DAY) + 1} ${sp(att)}>${sp(def)}`);
      }
      if (e.type === 'CreatureDied' && e['faction'] === 'fortress') deaths.push(`day ${Math.floor((w.tick - startTick) / TICKS_PER_DAY) + 1} ${String(e['cause'])}${e['killerSpecies'] === undefined ? '' : ` by ${String(e['killerSpecies'])}`}`);
    }
  });
  const dwarvesAtStart = entities.with(C.Brain).length;
  const floor = newFloorStats();
  const thoughtDefs = registry.table<ThoughtDef>('thoughts');
  for (let day = 1; day <= DAYS; day += 1) {
    const row: DayRow = { day, alive: 0, lonelyMadeHours: 0, dwarfHours: 0, miserableHours: 0, miserableDwarves: 0, onceMiserableHours: 0, onceMiserableDwarves: 0, lonelyHours: 0, talks: 0, meanMood: 0, minMood: 100 };
    const miserableToday = new Set<EntityId>();
    const onceToday = new Set<EntityId>();
    const talksBefore = talks;
    let moodSum = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      w.step(TICKS_PER_HOUR);
      for (const id of entities.with(C.Brain)) {
        if (!entities.alive(id) || !entities.has(id, C.Mood)) continue;
        const mood = morale.mood(id);
        const thoughts = morale.thoughts(id);
        const traits = (entities.get(id, C.Personality)?.traits ?? []) as readonly number[];
        const base = personalityBase(registry, traits);
        const once = moodValue(thoughts.map((t) => ({ value: t.value, need: NEED_PRESSURE_THOUGHTS.has(t.id) && t.id !== 'lonely' })), 0, base);
        const negatives = Math.min(35, thoughts.reduce((n, t) => n + Math.max(0, -t.value), 0));
        const pressure = thoughts.reduce((n, t) => n + (NEED_PRESSURE_THOUGHTS.has(t.id) ? Math.max(0, -t.value) : 0), 0);
        const lonelyP = Math.max(0, -(thoughts.find((t) => t.id === 'lonely')?.value ?? 0));
        const positives = Math.min(40, thoughts.reduce((n, t) => n + Math.max(0, t.value), 0));
        {
          // T-767: the floor, by hour of the day.
          const hod = Math.floor((w.tick % TICKS_PER_DAY) / TICKS_PER_HOUR);
          const P = Math.floor(Math.min(20, pressure));
          // The reader's mood was computed at the hour's recomputation, when event thoughts had
          // decayed less than now; the standing need thoughts have not changed since. So the
          // floor's part is read from the mood itself: it is floor-bound when it equals 20 − P.
          if (Math.abs(mood - 20) < 1e-9 && P === 0) floor.heldByHour[hod] = (floor.heldByHour[hod] ?? 0) + 1;
          if (mood < 20) {
            floor.miserableByHour[hod] = (floor.miserableByHour[hod] ?? 0) + 1;
            floor.pressureByHour[hod] = (floor.pressureByHour[hod] ?? 0) + P;
            floor.pressureHist[P] = (floor.pressureHist[P] ?? 0) + 1;
            if (mood > 20 - P + 1e-9) floor.rawBound += 1;
            if (day <= 4) floor.early.miserable += 1;
            const needs = thoughts.filter((t) => NEED_PRESSURE_THOUGHTS.has(t.id) && t.value < 0);
            const unscaled = (t: { id: string; value: number }): number => {
              const def = thoughtDefs.byId(t.id);
              const mult = def === undefined ? 1 : personalityMultiplier(registry, traits, def, t.value);
              return -t.value / (mult === 0 ? 1 : mult);
            };
            const pressing = (t: { id: string; value: number }, social: boolean): boolean => t.id === 'lonely' && !social ? true : unscaled(t) >= (HALF[t.id] ?? 0) - 1e-9;
            const key = needs.map((t) => `${t.id}${pressing(t, true) ? '!' : ''}`).sort().join('+');
            floor.composition[key] = (floor.composition[key] ?? 0) + 1;
            for (const rule of RULES) {
              let fp: number;
              if (rule === 'half' || rule === 'half+social') fp = needs.filter((t) => pressing(t, rule === 'half+social')).reduce((n, t) => n - t.value, 0);
              else fp = Math.max(0, pressure - Number(rule.slice(4)));
              // A Miserable mood has raw < 20, so a rule keeps it at 20 exactly when its floor pressure floors to 0.
              if (Math.floor(Math.min(20, fp)) === 0) {
                floor.rescued[rule]![hod] = (floor.rescued[rule]![hod] ?? 0) + 1;
                if (day <= 4) floor.early.rescued[rule] = (floor.early.rescued[rule] ?? 0) + 1;
              }
            }
          }
        }
        const parts = `+${positives.toFixed(1)} -${negatives.toFixed(1)} pressure ${pressure.toFixed(1)} (lonely ${lonelyP.toFixed(1)}) base ${base}`;
        row.dwarfHours += 1;
        moodSum += mood;
        row.minMood = Math.min(row.minMood, mood);
        for (const t of thoughts) if (t.value < 0) thoughtHours[t.id] = (thoughtHours[t.id] ?? 0) + 1;
        if (thoughts.some((t) => t.id === 'lonely')) row.lonelyHours += 1;
        if (mood < 20) {
          row.miserableHours += 1;
          if (once >= 20) row.lonelyMadeHours += 1;
          miserableToday.add(id);
          if (!seenMiserable.has(id)) {
            seenMiserable.add(id);
            firstMiserable.push({
              name: entities.get(id, C.Creature)?.name ?? String(id),
              day, hour, mood,
              traits: traits.map((k) => traitTable.byIndex(k)?.id ?? String(k)),
              social: Math.round(entities.get(id, C.Needs)?.social ?? 0),
              top: thoughts.filter((t) => t.value < 0).sort((a, b) => a.value - b.value).slice(0, 3).map((t) => `${t.id} ${Math.round(t.value * 10) / 10}`),
              onceMood: once,
              parts,
            });
          }
        }
        if (once < 20) {
          row.onceMiserableHours += 1;
          onceToday.add(id);
          if (!seenOnce.has(id)) { seenOnce.add(id); firstOnceMiserable.push({ name: String(id), day }); }
        }
      }
    }
    row.alive = entities.with(C.Brain).filter((id) => entities.alive(id)).length;
    row.miserableDwarves = miserableToday.size;
    row.onceMiserableDwarves = onceToday.size;
    row.talks = talks - talksBefore;
    row.meanMood = Math.round((moodSum / Math.max(1, row.dwarfHours)) * 10) / 10;
    days.push(row);
  }
  expect(w.tick - startTick).toBe(DAYS * TICKS_PER_DAY);
  return { floor, seed, variant: `${meeting ? 'meeting' : 'busy'}+${shift}`, region: site.region, biome: site.biome, dwarves: dwarvesAtStart, days, firstMiserable, firstOnceMiserable, thoughtHours, orders, deaths };
}

describe('T-763 probe: a busy first fortnight', () => {
  it.runIf(process.env['T763_PROBE'] === '1')('moods by day on the default embark', () => {
    const results: RunResult[] = [];
    const variants = (process.env['T763_VARIANTS'] ?? 'busy,meeting').split(',');
    const shifts = (process.env['T763_SHIFTS'] ?? '0').split(',').map(Number);
    for (const seed of SEEDS) {
      for (const v of variants) for (const shift of shifts) {
        const r = run(seed, v === 'meeting', shift);
        results.push(r);
        const misDays = r.days.filter((d) => d.miserableDwarves > 0).map((d) => `${d.day}:${d.miserableDwarves}`).join(' ');
        const onceDays = r.days.filter((d) => d.onceMiserableDwarves > 0).map((d) => `${d.day}:${d.onceMiserableDwarves}`).join(' ');
        console.log(`${seed} ${r.variant} region ${r.region} ${r.biome} dwarves ${r.dwarves}`);
        console.log(`  orders: ${r.orders.join('; ')}`);
        console.log(`  miserable (day:dwarves) ${misDays || 'none'} | lonely once: ${onceDays || 'none'}`);
        console.log(`  mean mood ${r.days.map((d) => d.meanMood).join(' ')}`);
        console.log(`  min mood ${r.days.map((d) => Math.round(d.minMood)).join(' ')}`);
        console.log(`  lonely share ${r.days.map((d) => Math.round((100 * d.lonelyHours) / Math.max(1, d.dwarfHours))).join(' ')}`);
        console.log(`  talks ${r.days.map((d) => d.talks).join(' ')}`);
        console.log(`  alive ${r.days.map((d) => d.alive).join(' ')}${r.deaths.length > 0 ? ` | deaths: ${r.deaths.join(', ')}` : ''}`);
        console.log(`  miserable dwarf-hours ${r.days.map((d) => d.miserableHours).join(' ')} | of them lonely-made ${r.days.map((d) => d.lonelyMadeHours).join(' ')}`);
        for (const f of r.firstMiserable) console.log(`  first miserable ${f.name} day ${f.day} h${f.hour} mood ${f.mood.toFixed(1)} (once ${f.onceMood.toFixed(1)}) ${f.parts} social ${f.social} [${f.traits.join(',')}] ${f.top.join('; ')}`);
        const top = Object.entries(r.thoughtHours).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${Math.round((100 * n) / (r.dwarves * 24 * DAYS))}%`);
        console.log(`  negative thoughts (share of dwarf-hours) ${top.join(', ')}`);
      }
    }
    for (const v of variants) {
      const rs = results.filter((r) => r.variant.startsWith(v));
      const by = (n: number): number => rs.filter((r) => r.firstMiserable.some((f) => f.day <= n)).length;
      const hours = rs.reduce((n, r) => n + r.days.reduce((m, d) => m + d.miserableHours, 0), 0);
      const made = rs.reduce((n, r) => n + r.days.reduce((m, d) => m + d.lonelyMadeHours, 0), 0);
      const early = rs.reduce((n, r) => n + r.days.filter((d) => d.day <= 4).reduce((m, d) => m + d.miserableHours, 0), 0);
      const earlyMade = rs.reduce((n, r) => n + r.days.filter((d) => d.day <= 4).reduce((m, d) => m + d.lonelyMadeHours, 0), 0);
      const dh = rs.reduce((n, r) => n + r.days.reduce((m, d) => m + d.dwarfHours, 0), 0);
      const share = (day: number): number => {
        const all = rs.reduce((n, r) => n + (r.days[day - 1]?.dwarfHours ?? 0), 0);
        const mis = rs.reduce((n, r) => n + (r.days[day - 1]?.miserableHours ?? 0), 0);
        return Math.round((1000 * mis) / Math.max(1, all)) / 10;
      };
      console.log(`SUMMARY ${v}: runs ${rs.length}; a dwarf miserable by day 2 ${by(2)}, day 4 ${by(4)}, day 7 ${by(7)}, day 14 ${by(14)}`);
      console.log(`  miserable share of dwarf-hours by day ${Array.from({ length: DAYS }, (_, k) => share(k + 1)).join(' ')} (all ${Math.round((1000 * hours) / dh) / 10}%)`);
      console.log(`  miserable dwarf-hours ${hours}, lonely-made ${made}; days 1-4: ${early}, lonely-made ${earlyMade}`);
      // T-767: the floor.
      const sum24 = (f: (r: RunResult) => number[]): number[] => Array.from({ length: 24 }, (_, h) => rs.reduce((n, r) => n + (f(r)[h] ?? 0), 0));
      const held = sum24((r) => r.floor.heldByHour);
      const mis = sum24((r) => r.floor.miserableByHour);
      const pres = sum24((r) => r.floor.pressureByHour);
      console.log(`FLOOR ${v}: held at 20 by the floor ${held.reduce((a, b) => a + b, 0)} dwarf-hours of ${dh}; miserable ${mis.reduce((a, b) => a + b, 0)} (raw-bound ${rs.reduce((n, r) => n + r.floor.rawBound, 0)})`);
      console.log(`  by hour of day: held ${held.join(' ')}`);
      console.log(`  by hour of day: miserable ${mis.join(' ')}`);
      console.log(`  by hour of day: mean pressure when miserable ${pres.map((p, h) => (mis[h]! > 0 ? (p / mis[h]!).toFixed(1) : '-')).join(' ')}`);
      const hist = Array.from({ length: 21 }, (_, k) => rs.reduce((n, r) => n + (r.floor.pressureHist[k] ?? 0), 0));
      console.log(`  miserable hours by pressure 1..20: ${hist.slice(1).join(' ')}`);
      const comp: Record<string, number> = {};
      for (const r of rs) for (const [k, n] of Object.entries(r.floor.composition)) comp[k] = (comp[k] ?? 0) + n;
      console.log(`  by need thoughts (! = pressing): ${Object.entries(comp).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `${k || 'none'} ${n}`).join(', ')}`);
      const earlyMis = rs.reduce((n, r) => n + r.floor.early.miserable, 0);
      for (const rule of RULES) {
        const res = sum24((r) => r.floor.rescued[rule]!);
        console.log(`  rule ${rule}: keeps ${res.reduce((a, b) => a + b, 0)} of the miserable hours at 20+ (days 1-4: ${rs.reduce((n, r) => n + (r.floor.early.rescued[rule] ?? 0), 0)} of ${earlyMis}); by hour ${res.join(' ')}`);
      }
    }
    if (OUT !== undefined) writeFileSync(OUT, JSON.stringify(results, null, 2));
  });
});
