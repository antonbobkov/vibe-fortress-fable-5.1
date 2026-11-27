/**
 * 10 Dwarves: the system. `02-systems/10-dwarves.md` § Skills and experience, § Behavior selection
 * (steps 7 and 9), § Movement, § Titles (commands), § State, § Interfaces; `algorithms/creature-
 * brains.md` § Dwarf brain. Needs, activities, relationships and the other behaviors join in M4.
 */

import { C, type Needs } from '@core/components';
import { NEED_MAX, TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext, type ThoughtSource, type WorldLike } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { CARRIED_ACTIVITY, tickDwarf, UNCONSCIOUS_ACTIVITY, type BrainHost } from './brain';
import type { HealthReader } from '@systems/health/reader';
import type { JobsReader } from '@systems/jobs';
import { makeReader, type DwarvesReader } from './reader';
import { dwarfSpeed, jobXp } from './rules/skills';
import { grantXp } from './skills';
import { movementEffects, type MoveFacts } from './movement-effects';
import type { DwarvesStateV1, ThreatMemory, TitleName } from './state';
import { TileFlag } from '@core/map3d';
import type { WeatherReader } from '@systems/weather';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import { SLEEP_NEED_MIN, advanceNeeds, crossed, firstCritical, type NeedName } from './needs';
import { ADULT_AGE_YEARS, DEHYDRATE_DAYS, STARVE_DAYS, HEAVY_ITEM_DENSITY, THREAT_RADIUS, TIPSY_SLOW_PERCENT } from './constants';
import { Activities, hallStand } from './activities';
import { wagonOutOfCold } from './shelter';
import { SMOKE_RADIUS } from '@systems/materials/constants';
import { TALLOW_SMOKE_PERMILLE } from '@systems/buildings/constants';
import { SMOKEHOUSE_HUNGER } from '@systems/workshops/constants';
import { SMOKEHOUSE_RECIPES, dwarvesNear } from '@systems/morale/thoughts';
import { keptDrinkMaterials, WHIMS_STREAM, whimFacts, whimKeepsDrink, whimMet, whimPossible, whimProgress, whimRows, type Whim } from './whims';
import type { WhimView } from './reader';

export { makeReader, type DwarvesReader, type WhimView } from './reader';
export { CARRIED_ACTIVITY, NO_JOB, select, tickDwarf, UNCONSCIOUS_ACTIVITY, type BrainHost } from './brain';
export { grantXp } from './skills';
export {
  advanceNeeds,
  crossed,
  WANT,
  CRITICAL,
  NEED_NAMES,
  HUNGER_PER_HOUR,
  THIRST_PER_HOUR,
  REST_AWAKE_PER_HOUR,
  REST_ASLEEP_PER_HOUR,
  SOCIAL_PER_HOUR,
  COMFORT_PER_HOUR,
  PURPOSE_IDLE_PER_HOUR,
  PURPOSE_WORK_PER_HOUR,
  JOY_PER_HOUR,
  type NeedName,
} from './needs';
export { equipStartingClothes, isUnclothed } from './clothing';
export * from './rules/skills';
export { dwarfComponents, freshBrain, SLEEP_START_MAX, SLEEP_START_MIN, type DwarfComponents } from './rules/components';
export type { TitleName } from './state';

export const DWARVES_ID = '10';

const TITLES: readonly TitleName[] = ['thane', 'warden', 'broker', 'chief_medic'];

/** `RenameDwarf`: 1–24 characters. */
export const DWARF_NAME_MAX = 24;

interface SpeciesRow {
  readonly speed: number;
  readonly size: number;
}

interface JobTypeRow {
  readonly id: string;
  readonly name: string;
  readonly skill: string | null;
  readonly xp: number;
}

export class DwarvesSystem extends BaseSystem<DwarvesStateV1> {
  readonly id = DWARVES_ID;
  readonly order = 10;
  override readonly subscribes: readonly EventType[] = ['HourPassed', 'DayPassed', 'YearPassed', 'JobCompleted', 'CreatureDied', 'CreatureUnconscious', 'PatientAdmitted', 'PatientDischarged', 'EntitiesMoved', 'SulkHappened', 'ThreatNearby', 'AttackResolved', 'AlertChanged', 'BuildingStateChanged', 'ItemCrafted', 'SeasonChanged', 'TrainingSession'];
  override readonly ownsCommands: readonly CommandType[] = ['AssignTitle', 'RenameDwarf', 'SetSchedule'];

  private world: WorldLike | null = null;
  private rng: RngStream | null = null;
  private readerRef: DwarvesReader | null = null;
  private host: BrainHost | null = null;
  private readersRef: InitContext['readers'] | null = null;
  private registryRef: InitContext['registry'] | null = null;
  private titles: Record<TitleName, EntityId> = { thane: 0, warden: 0, broker: 0, chief_medic: 0 };
  private titlesSeeded = false;
  private populationCached = 0;
  private children: EntityId[] = [];
  /** The wagon tile of the arrival, the idle anchor until there is a hearth hall (D-057). */
  wagonTile: TileIndex = -1;
  /** The wagon's stand-in out of the cold, found once a tick (§ Behavior selection, step 9); derived, not saved. */
  private wagonWarmth: { tick: number; tile: TileIndex } | undefined;
  readonly interruptFlags = new Set<EntityId>();
  readonly shutOut = new Set<EntityId>();
  private shelterRevision = -1;
  private connectivityRevision = (): number => -1;
  private shelterRestored = false;
  private shelterCheckPending = false;
  readonly threatened = new Map<EntityId, ThreatMemory>();
  readonly hungerMaxSince = new Map<EntityId, number>();
  readonly thirstMaxSince = new Map<EntityId, number>();
  readonly starvingAnnounced = new Map<EntityId, number>();
  readonly activities = new Activities((ctx) => this.keptForThane(ctx));
  readonly idleAnnounced = new Set<EntityId>();
  readonly sawMasterworks = new Set<string>();
  /** `10` § Movement: a fortress dwarf has stood in the `starfall` crater (saved; absent while false). */
  craterEntered = false;
  /** `10` § The Thane's whim: the whim of the season, judged at the next `SeasonChanged` (saved; absent: none). */
  whim: Whim | null = null;

  hasInterrupt(id: EntityId): boolean { return this.interruptFlags.has(id); }
  takeInterrupt(id: EntityId): boolean { return this.interruptFlags.delete(id); }

  private threatTile(id: EntityId): TileIndex {
    const world = this.world;
    const memory = this.threatened.get(id);
    if (world === null || memory === undefined || !world.entities.alive(memory.hostileId)) return -1;
    const pos = world.entities.get(memory.hostileId, C.Position);
    if (pos === undefined) return -1;
    const tile = memory.tile ?? world.map.index(pos.x, pos.y, pos.z);
    return pos.z === world.map.zOf(tile) && Math.max(Math.abs(pos.x - world.map.xOf(tile)), Math.abs(pos.y - world.map.yOf(tile))) <= THREAT_RADIUS ? tile : -1;
  }

  /**
   * `10` § Behavior selection: a fleeing civilian hit in melee by a wild animal or a cavern monster
   * that is hunting it, at least as fast as itself, is caught; from then on it fights that attacker
   * instead of fleeing. An animal defending its ground (`defendFrom` set, `08` § Wild behavior) and a
   * hostile of a party do not catch it. A soldier off duty is caught by any hit in melee, flight or
   * no flight, and fights with the gear it carries.
   */
  private caughtFleeing(ctx: TickContext, attacker: EntityId, id: EntityId, outcome: unknown): void {
    const entities = ctx.world.entities;
    if (outcome !== 'hit' || !entities.alive(attacker) || !entities.alive(id)) return;
    const soldier = entities.get(id, C.Soldier);
    if (soldier?.onDuty === true) return;
    if (soldier === undefined && entities.get(id, C.Brain)?.behavior !== 'flee') return;
    if (entities.get(id, C.Creature)?.faction !== 'fortress') return;
    const mine = entities.get(id, C.Position);
    const theirs = entities.get(attacker, C.Position);
    if (mine === undefined || theirs === undefined || mine.z !== theirs.z ||
      Math.max(Math.abs(mine.x - theirs.x), Math.abs(mine.y - theirs.y)) > 1) return;
    if (soldier === undefined) {
      if ((entities.get(attacker, C.Motion)?.speed ?? 0) < (entities.get(id, C.Motion)?.speed ?? 0)) return;
      // A hunt, or the attack a hunt led to; a defence keeps `defendFrom` (creature-brains.md).
      const wild = entities.get(attacker, C.Wild);
      const hunting = wild !== undefined && (wild.state === 'hunt' || (wild.state === 'attack' && wild.defendFrom === undefined));
      if (!hunting && entities.get(attacker, C.Hostile)?.role !== 'cavern_monster') return;
    }
    this.threatened.set(id, { hostileId: attacker, tick: ctx.tick, tile: ctx.world.map.index(theirs.x, theirs.y, theirs.z), caught: true });
    this.interruptFlags.add(id);
  }

  /** The embark Thane is written by the spawn API before 10's first tick. */
  private seedTitles(): void {
    if (this.titlesSeeded || this.world === null) return;
    for (const id of this.world.entities.with(C.Title)) {
      const title = this.world.entities.get(id, C.Title)?.title;
      if (title !== undefined && title !== 'none') this.titles[title] = id;
    }
    this.titlesSeeded = true;
  }

  private refreshTitleCache(id: EntityId): void {
    if (this.world === null || !this.world.entities.alive(id)) return;
    const title = TITLES.find((name) => this.titles[name] === id) ?? 'none';
    this.world.entities.add(id, C.Title, { title });
  }

  /** The full title set; the singular `Title` component is a display cache (D-121). */
  titlesOf(id: EntityId): TitleName[] {
    this.seedTitles();
    return TITLES.filter((name) => this.titles[name] === id);
  }

  /**
   * 12 § Smoke, salt and the smokehouse: a smokehouse's batch done makes every dwarf within
   * `SMOKE_RADIUS` of it but its worker `SMOKEHOUSE_HUNGER` hungrier (15 gives `smelled_smokehouse`).
   */
  private smelledSmokehouse(event: GameEvent, ctx: TickContext): void {
    if (!SMOKEHOUSE_RECIPES.includes(String(event['recipeId']))) return;
    const footprint = ctx.readers.of<BuildingsReader>('14').get(Number(event['workshopId']))?.footprint ?? [];
    const centre = footprint[4] ?? footprint[0];
    if (centre === undefined) return;
    for (const id of dwarvesNear(ctx, centre, SMOKE_RADIUS)) {
      if (id === event['crafterId']) continue;
      const before = ctx.world.entities.get(id, C.Needs);
      if (before === undefined) continue;
      const after: Needs = { ...before, hunger: Math.min(NEED_MAX, before.hunger + SMOKEHOUSE_HUNGER) };
      ctx.world.entities.add(id, C.Needs, after);
      this.recordCrossings(id, before, after, (e) => ctx.emit(e));
      this.updateMaxSince(id, after, ctx.tick);
    }
  }

  /**
   * `10` § The Thane's whim: on `SeasonChanged`, the whim of the season ending is judged
   * (`WhimJudged`; 15 gives everyone `thane_pleased` or the Thane alone `thane_grumbled`), then, if the
   * fortress has a Thane, one possible whim is drawn on `WHIMS_STREAM` (`WhimSet`): not the whim
   * just judged while another is possible. A `tier` whim keeps the tier wished for.
   */
  private seasonWhim(ctx: TickContext): void {
    this.seedTitles();
    const thane = this.titles.thane !== 0 && ctx.world.entities.alive(this.titles.thane) ? this.titles.thane : 0;
    const rows = whimRows(ctx.registry);
    const previous = this.whim?.id ?? null;
    if (this.whim !== null) {
      const row = rows.find((r) => r.id === this.whim?.id);
      const met = row !== undefined && whimMet(ctx.readers, ctx.registry, row, thane, this.whim);
      ctx.emit({ type: 'WhimJudged', thaneId: thane, whimId: this.whim.id, met });
      this.whim = null;
    }
    if (thane === 0) return;
    const facts = whimFacts(this.reader(), ctx.world.entities);
    const all = rows.filter((row) => whimPossible(ctx.readers, ctx.registry, row, facts, thane));
    const possible = all.length > 1 ? all.filter((row) => row.id !== previous) : all;
    if (possible.length === 0) return;
    const row = possible[ctx.world.rngFor(WHIMS_STREAM).int(0, possible.length - 1)] as (typeof possible)[number];
    const target = row.kind === 'tier' ? whimProgress(ctx.readers, ctx.registry, row, thane).count : undefined;
    this.whim = { id: row.id, setTick: ctx.tick, ...(target === undefined ? {} : { target }) };
    ctx.emit({ type: 'WhimSet', thaneId: thane, whimId: row.id });
  }

  /**
   * `10` § The Thane's whim, the Thane's drink: the drink materials a standing whim keeps from the
   * dwarves' drinking now (`whims.ts` `keptDrinkMaterials`); [] with no whim.
   */
  keptForThane(ctx: TickContext): number[] {
    if (this.whim === null) return [];
    const row = whimRows(ctx.registry).find((r) => r.id === this.whim?.id);
    return row === undefined ? [] : keptDrinkMaterials(ctx.readers, ctx.registry, row);
  }

  /** The whim of the season, how much of it there is now and whether it is met (the units panel's Thane line), or null. */
  private whimView(): WhimView | null {
    const world = this.world;
    if (this.whim === null || world === null || this.readersRef === null || this.registryRef === null) return null;
    const row = whimRows(this.registryRef).find((r) => r.id === this.whim?.id);
    if (row === undefined) return null;
    this.seedTitles();
    const { have, count } = whimProgress(this.readersRef, this.registryRef, row, this.titles.thane, this.whim);
    return { id: row.id, text: row.text, met: count > 0 && have >= count, kind: row.kind, count, have, kept: whimKeepsDrink(this.registryRef, row) };
  }

  /** TestWorld's direct setup helper uses the same crossing rule as an hourly update. */
  setNeed(id: EntityId, name: NeedName, value: number): void {
    if (this.world === null) throw new Error('10 dwarves: used before init');
    const before = this.world.entities.get(id, C.Needs);
    if (before === undefined || !Number.isFinite(value)) throw new Error(`setNeed: invalid dwarf or value ${id}`);
    const after: Needs = { ...before, [name]: Math.max(0, Math.min(NEED_MAX, value)) };
    this.world.entities.add(id, C.Needs, after);
    this.recordCrossings(id, before, after, (event) => this.world?.emit(event));
    this.updateMaxSince(id, after, this.world.calendar.tick);
  }

  private recordCrossings(id: EntityId, before: Needs, after: Needs, emit: (event: GameEvent) => void): void {
    const change = crossed(before, after);
    if (change.want.length > 0 || change.critical.length > 0) this.interruptFlags.add(id);
    for (const need of change.critical) emit({ type: 'NeedCritical', id, need });
  }

  private updateMaxSince(id: EntityId, n: Needs, tick: number): void {
    for (const [name, map] of [['hunger', this.hungerMaxSince], ['thirst', this.thirstMaxSince]] as const) {
      if (n[name] >= NEED_MAX) {
        if (!map.has(id)) map.set(id, tick);
      } else map.delete(id);
    }
  }

  private hourly(ctx: TickContext, hour: number): void {
    const entities = ctx.world.entities;
    const thirstPercent = ctx.readers.has('06') ? ctx.readers.of<WeatherReader>('06').thirstModifier() : 100;
    const day = Math.floor(ctx.tick / TICKS_PER_DAY);
    for (const id of this.reader().list()) {
      const before = entities.get(id, C.Needs);
      if (before === undefined) continue;
      const brain = entities.get(id, C.Brain);
      const schedule = entities.get(id, C.Schedule);
      const end = entities.get(id, C.Attributes)?.end ?? 50;
      const asleep = brain?.behavior === 'need' && brain.activity === 'sleep';
      const working = brain?.behavior === 'work' && (entities.get(id, C.Worker)?.jobId ?? 0) !== 0;
      const after = advanceNeeds(before, end, thirstPercent, asleep, working, asleep ? this.activities.restPercent(ctx, id) : 100);
      entities.add(id, C.Needs, after);
      this.recordCrossings(id, before, after, (e) => ctx.emit(e));
      // 10 § Sleeping: a sleeper whose hunger or thirst is further over its critical mark than any other
      // need wakes to eat or drink (the brain abandons the sleep for the critical need, rest kept).
      if (asleep && after.rest > 0) {
        const first = firstCritical(after);
        if (first === 'hunger' || first === 'thirst') this.interruptFlags.add(id);
      }
      if (schedule?.sleepStartHour === hour && after.rest > SLEEP_NEED_MIN) this.interruptFlags.add(id);
      this.updateMaxSince(id, after, ctx.tick);
      this.announceStarving(id, after, day, (e) => ctx.emit(e));
    }
    this.tallowSmoke(ctx);
  }

  /**
   * 14 § Candle stands and lanterns, Tallow smokes: each dwarf standing on a tile lit only by stands
   * burning tallow gets `smoky_hall` at `TALLOW_SMOKE_PERMILLE`, on this stream; the draw is made only
   * for such a dwarf, so a fortress with no tallow stand draws nothing new.
   */
  private tallowSmoke(ctx: TickContext): void {
    if (!ctx.readers.has('14')) return;
    const buildings = ctx.readers.of<BuildingsReader>('14');
    if (buildings.byType('candle_stand').length === 0) return;
    const map = ctx.world.map;
    for (const id of this.reader().list()) {
      const p = ctx.world.entities.get(id, C.Position);
      if (p === undefined) continue;
      const tile = map.index(p.x, p.y, p.z);
      if (!buildings.tallowSmokeAt(tile)) continue;
      if (this.stream.chance(TALLOW_SMOKE_PERMILLE)) ctx.emit({ type: 'SmokyFuelBurned', workshopId: 0, tile, dwarfId: id });
    }
  }

  private announceStarving(id: EntityId, n: Needs, day: number, emit: (e: GameEvent) => void): void {
    if (this.starvingAnnounced.get(id) === day) return;
    for (const name of ['hunger', 'thirst'] as const) {
      if (n[name] >= NEED_MAX) {
        this.starvingAnnounced.set(id, day);
        emit({ type: 'Starving', id, need: name });
        break;
      }
    }
  }

  private daily(ctx: TickContext): void {
    for (const id of this.reader().list()) {
      const brain = ctx.world.entities.get(id, C.Brain);
      const pos = ctx.world.entities.get(id, C.Position);
      if (brain !== undefined && pos !== undefined) {
        const tile = ctx.world.map.index(pos.x, pos.y, pos.z);
        ctx.world.entities.add(id, C.Brain, { ...brain,
          daysUnderground: ctx.world.map.hasFlag(tile, TileFlag.Outdoor) ? 0 : brain.daysUnderground + 1 });
      }
      const n = ctx.world.entities.get(id, C.Needs);
      if (n === undefined) continue;
      this.announceStarving(id, n, Math.floor(ctx.tick / TICKS_PER_DAY), (e) => ctx.emit(e));
      const hungry = this.hungerMaxSince.get(id);
      const thirsty = this.thirstMaxSince.get(id);
      if ((hungry !== undefined && ctx.tick - hungry >= STARVE_DAYS * TICKS_PER_DAY)
        || (thirsty !== undefined && ctx.tick - thirsty >= DEHYDRATE_DAYS * TICKS_PER_DAY)) ctx.emit({ type: 'Starvation', id });
    }
  }

  /** A birthday is counted at each year boundary; children gain the adult labor grid at 12. */
  private yearly(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const laborCount = ctx.registry.table('labors').size;
    for (const id of this.reader().list()) {
      const creature = entities.get(id, C.Creature);
      if (creature === undefined) continue;
      const ageTicks = creature.ageTicks + TICKS_PER_YEAR;
      entities.add(id, C.Creature, { ...creature, ageTicks });
      if (creature.ageTicks >= ADULT_AGE_YEARS * TICKS_PER_YEAR || ageTicks < ADULT_AGE_YEARS * TICKS_PER_YEAR) continue;
      const labors = entities.get(id, C.Labors);
      if (labors !== undefined) {
        const enabled = new Uint8Array((laborCount >> 3) + 1);
        for (let labor = 1; labor <= laborCount; labor += 1) enabled[labor >> 3] = (enabled[labor >> 3] as number) | (1 << (labor & 7));
        entities.add(id, C.Labors, { enabled });
      }
      ctx.emit({ type: 'DwarfBecameAdult', id });
    }
    this.children = this.reader().children();
  }

  override init(ctx: InitContext): void {
    this.world = ctx.world;
    this.connectivityRevision = () => ctx.readers.pathing.connectivityRevision();
    this.rng = ctx.rng;
    this.readersRef = ctx.readers;
    this.registryRef = ctx.registry;
    this.readerRef = makeReader(ctx.world.entities, ctx.registry, () => { this.seedTitles(); return this.titles; },
      (id) => {
        const mood = ctx.readers.has('15') ? ctx.readers.of<{ productivity(id: EntityId): number }>('15').productivity(id) : 100;
        const health = ctx.readers.has('17') ? ctx.readers.of<{ productivityModifier(id: EntityId): number }>('17').productivityModifier(id) : 100;
        const rate = Math.floor((mood * health) / 100);
        // `10` § Tipsy: a tipsy dwarf works `TIPSY_SLOW_PERCENT` slower.
        return this.activities.isTipsy(id, ctx.world.calendar.tick) ? Math.floor((rate * (100 - TIPSY_SLOW_PERCENT)) / 100) : rate;
      }, (id) => ctx.world.entities.get(id, C.Soldier)?.onDuty ? -1 : this.threatTile(id), (bedId) => {
        if (bedId === 0) return 0;
        let holder = 0;
        for (const [id, plan] of this.activities.plans) {
          if (plan.need === 'rest' && plan.itemId === bedId && ctx.world.entities.alive(id) &&
              ctx.world.entities.get(id, C.Brain)?.behavior === 'need' && (holder === 0 || id < holder)) holder = id;
        }
        return holder;
      }, () => ctx.world.calendar.tick, (id) => this.activities.isTipsy(id, ctx.world.calendar.tick), () => this.whimView(),
      () => ctx.world.fortress.alert !== 'hearth' ? [] : Array.from(this.shutOut).filter((id) => ctx.world.entities.alive(id)).sort((a, b) => a - b),
      (id) => ctx.world.fortress.alert === 'hearth' && this.shutOut.has(id), () => this.wagonTile,
      (id) => {
        // § Player-facing behavior: a dwarf that is down does not think, so its brain's word is stale.
        if (!ctx.readers.has('17') || ctx.readers.of<HealthReader>('17').isConscious(id)) return null;
        const carry = ctx.readers.has('11') ? ctx.readers.of<JobsReader>('11').byKey(`carry_patient:${id}`) : undefined;
        return carry !== undefined && carry.workerId !== 0 ? CARRIED_ACTIVITY : UNCONSCIOUS_ACTIVITY;
      },
      (id) => (ctx.world.entities.get(id, C.Soldier)?.onDuty || this.threatTile(id) < 0 ? 0 : this.threatened.get(id)?.hostileId ?? 0));
    const jobTypes = ctx.registry.table<JobTypeRow>('jobTypes');
    this.host = {
      get hasJobs(): boolean {
        return ctx.readers.has('11');
      },
        idleGoal: (id) => {
          if (!ctx.readers.has('14')) return this.wagonTile;
          const from = ctx.world.services.movement?.tileOf(id) ?? -1;
          if (from < 0) return this.wagonTile;
          // § Behavior selection, step 9, Out of the cold: the wagon's stand-in, found once a tick.
          const wagon = (): TileIndex => {
            const tick = ctx.world.calendar.tick;
            const warmth = this.wagonWarmth?.tick === tick ? this.wagonWarmth : { tick, tile: wagonOutOfCold(ctx.world.map, ctx.readers, this.wagonTile) };
            this.wagonWarmth = warmth;
            const tile = warmth.tile;
            return tile !== this.wagonTile && ctx.readers.pathing.reachable(from, tile, 'walker') ? tile : this.wagonTile;
          };
          const map = ctx.world.map;
          const hall = ctx.readers.of<BuildingsReader>('14').hearthHallTiles()
            .filter((tile) => ctx.readers.pathing.passable(tile, 'walker') && ctx.readers.pathing.reachable(from, tile, 'walker'));
          hall.sort((a, b) => Math.max(Math.abs(map.xOf(from) - map.xOf(a)), Math.abs(map.yOf(from) - map.yOf(a)))
            - Math.max(Math.abs(map.xOf(from) - map.xOf(b)), Math.abs(map.yOf(from) - map.yOf(b))) || a - b);
          return hall[0] ?? wagon();
        },
        idleStand: (id) => hallStand(ctx, id),
      jobName: (id) => {
        if (!ctx.readers.has('11')) return '';
        const t = ctx.readers.of<{ forWorker(id: EntityId): { type: number } | undefined }>('11').forWorker(id);
        return t === undefined ? '' : (jobTypes.byIndex(t.type)?.name ?? '');
      },
      activities: this.activities,
      dayOff: (id) => ctx.readers.has('15') && ctx.readers.of<{ dayOff(id: EntityId): boolean }>('15').dayOff(id),
      takeInterrupt: (id) => this.takeInterrupt(id),
      dwarfIds: () => this.reader().list(),
      idleAnnounced: (id) => this.idleAnnounced.has(id),
      markIdle: (id) => { this.idleAnnounced.add(id); },
      clearIdle: (id) => { this.idleAnnounced.delete(id); },
      threatOf: (id) => this.threatened.get(id)?.hostileId ?? 0,
      threatTile: (id) => this.threatTile(id),
      clearThreat: (id) => { this.threatened.delete(id); },
      caught: (id) => this.threatened.get(id)?.caught === true,
      release: (id) => {
        const memory = this.threatened.get(id);
        if (memory?.caught !== true) return;
        const { caught: _caught, ...rest } = memory;
        this.threatened.set(id, rest);
      },
      setCombatTarget: (id, targetId) => { ctx.world.services.combat?.setTarget(id, targetId); },
      watchShelter: (id, shutOut) => { if (shutOut) this.shutOut.add(id); else this.shutOut.delete(id); },
    };
    ctx.register.panel({ id: 'units', title: 'Units', hotkey: 'u' });
    ctx.register.inspector('creature', { id: 'dwarf', order: 10 });
    // `10` § Registrations: "announcements: starving (alert), passed out (note), title assigned
    // (note), came of age (note), legendary (note)"; 17 owns "passed out" (`CreatureUnconscious`),
    // whose severity its own document gives (D-201).
    ctx.register.announcement('Starving', { severity: 'alert', stringKey: 'announce.starving' });
    ctx.register.announcement('TitleAssigned', { severity: 'note', stringKey: 'announce.title_assigned', atLeast: { field: 'dwarfId', value: 1 } });
    ctx.register.announcement('TitleAssigned', { severity: 'note', stringKey: 'announce.title_vacated', atLeast: { field: 'previousId', value: 1 } });
    ctx.register.announcement('DwarfBecameAdult', { severity: 'note', stringKey: 'announce.came_of_age' });
    ctx.register.announcement('LegendaryReached', { severity: 'note', stringKey: 'announce.legendary' });
    // `10` § Movement: the first dwarf in a `starfall` crater makes a note, once a fortress.
    ctx.register.announcement('CraterEntered', { severity: 'note', stringKey: 'announce.crater_entered', oneOf: { field: 'first', values: [true] } });
    // `10` § Movement: the first dwarf in each boneyard's ribs makes a note.
    ctx.register.announcement('RibsEntered', { severity: 'note', stringKey: 'announce.ribs_entered' });
    // `10` § The Thane's whim: the wish and its judgement are notes.
    ctx.register.announcement('WhimSet', { severity: 'note', stringKey: 'announce.thane_whim' });
    ctx.register.announcement('WhimJudged', { severity: 'note', stringKey: 'announce.thane_whim_met', oneOf: { field: 'met', values: [true] } });
    ctx.register.announcement('WhimJudged', { severity: 'note', stringKey: 'announce.thane_whim_missed', oneOf: { field: 'met', values: [false] } });
    // `15` § Thoughts: relationship-dependent triggers are facts of 10, not inferred from event ids.
    const source: ThoughtSource = {
      on: ['CreatureDied', 'Buried'],
      trigger: (event, tick) => {
        const dead = Number(event['dwarfId'] ?? event['id'] ?? 0);
        const all = this.reader().list().filter((id) => id !== dead);
        if (event.type === 'CreatureDied') {
          const dwarf = event['species'] === tick.registry.table('creatures').index('dwarf');
          return dwarf ? all.filter((id) => this.reader().isFriend(id, dead))
            .map((id) => ({ thoughtId: 'friend_died', id }))
            : all.filter((id) => tick.world.entities.get(id, C.Relationships)?.pets.includes(dead) === true)
              .map((id) => ({ thoughtId: 'pet_died', id }));
        }
        const friends = all.filter((id) => this.reader().isFriend(id, dead));
        return friends.flatMap((id) => event['coffinId'] === 0
          ? [{ thoughtId: 'buried_friend', id }, { thoughtId: 'memorial_placed', id }]
          : [{ thoughtId: 'buried_friend', id }]);
      },
    };
    ctx.register.thoughtSource(source);
  }

  /** The random stream of 10, for the components it writes at spawn (D-057). */
  get stream(): RngStream {
    if (this.rng === null) throw new Error('10 dwarves: used before init');
    return this.rng;
  }

  override tick(ctx: TickContext): void {
    const revision = ctx.readers.pathing.connectivityRevision();
    if (revision !== this.shelterRevision || this.shelterCheckPending) {
      this.shelterRevision = revision;
      // Loading rebuilds labels once; replay only a check that was pending in the saved game.
      if (!this.shelterRestored || this.shelterCheckPending) this.checkShelters(ctx);
    }
    this.shelterRestored = false;
    this.shelterCheckPending = false;
    this.seedTitles();
    const reader = this.reader();
    const entities = ctx.world.entities;
    const species = ctx.registry.table<SpeciesRow & { id: string }>('creatures');
    const movement = ctx.world.services.movement;
    const dwarves = reader.list();
    this.activities.soberUp(ctx.tick, (id) => entities.alive(id));
    this.activities.passingTalks(ctx, dwarves);
    for (const id of dwarves) {
      // `10` § Movement: species speed × (50 + Agility) / 100 (wounds and carrying from M4/M6).
      const creature = entities.get(id, C.Creature);
      const attrs = entities.get(id, C.Attributes);
      if (movement !== null && creature !== undefined && attrs !== undefined) {
        const base = species.byIndex(creature.species)?.speed ?? 0;
        const carried = entities.get(id, C.Worker)?.carrying ?? 0;
        const corpseWeight = entities.get(carried, C.Corpse)?.weight ?? 0;
        const carryPercent = corpseWeight > HEAVY_ITEM_DENSITY * (species.byIndex(creature.species)?.size ?? 0) ? 50 : 100;
        const healthPercent = ctx.readers.has('17') ? ctx.readers.of<{ speedModifier(id: EntityId): number }>('17').speedModifier(id) : 100;
        const armorPercent = ctx.readers.has('16') && typeof ctx.readers.of<{ armorSpeedModifier?(id: EntityId): number }>('16').armorSpeedModifier === 'function'
          ? (ctx.readers.of<{ armorSpeedModifier(id: EntityId): number }>('16').armorSpeedModifier(id) ?? 100)
          : 100;
        const woundPercent = Math.floor((healthPercent * armorPercent) / 100);
        // `10` § Tipsy: a tipsy dwarf walks `TIPSY_SLOW_PERCENT` slower.
        const tipsyPercent = this.activities.isTipsy(id, ctx.tick) ? 100 - TIPSY_SLOW_PERCENT : 100;
        movement.setSpeed(id, dwarfSpeed(base, attrs.agi, Math.floor((woundPercent * tipsyPercent) / 100), carryPercent));
      }
      tickDwarf(this.host as BrainHost, ctx, id);
    }
    this.recount(dwarves);
    ctx.world.fortress.populationCached = this.populationCached;
  }

  private recount(dwarves: readonly EntityId[]): void {
    const reader = this.reader();
    this.populationCached = dwarves.length;
    this.children = dwarves.filter((id) => reader.isChild(id));
    for (const title of TITLES) if (this.titles[title] !== 0 && !dwarves.includes(this.titles[title])) this.titles[title] = 0;
  }

  /** `JobCompleted` → experience: `xp = jobDef.xp × (100 + Wits) / 150` to the job's skill. */
  private checkShelters(ctx: TickContext): void {
    if (ctx.world.fortress.alert !== 'hearth' || !ctx.readers.has('19')) return;
    const defense = ctx.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19');
    for (const id of Array.from(this.shutOut).sort((a, b) => a - b)) {
      if (defense.retreatTile(id) >= 0) this.interruptFlags.add(id);
    }
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'HourPassed') { this.hourly(ctx, event['hour'] as number); return; }
    if (event.type === 'DayPassed') { this.daily(ctx); return; }
    if (event.type === 'YearPassed') { this.yearly(ctx); return; }
    if (event.type === 'SeasonChanged') { this.seasonWhim(ctx); return; }
    if (event.type === 'SulkHappened') {
      const id = event['id'];
      if (typeof id !== 'number') return;
      if (event['kind'] === 'argue' && typeof event['partnerId'] === 'number') {
        for (const [a, b] of [[id, event['partnerId']] as [EntityId, EntityId], [event['partnerId'], id] as [EntityId, EntityId]]) {
          const rel = ctx.world.entities.get(a, C.Relationships);
          if (rel !== undefined) ctx.world.entities.add(a, C.Relationships, { ...rel,
            grudges: [...rel.grudges.filter((g) => g.id !== b), { id: b, untilTick: ctx.tick + 2 * TICKS_PER_DAY }] });
        }
      }
      if (event['kind'] === 'weep' && typeof event['targetTile'] === 'number') {
        const brain = ctx.world.entities.get(id, C.Brain);
        if (brain !== undefined) {
          this.activities.cancel(ctx, id);
          ctx.world.services.movement?.stopWalking(id);
          ctx.world.entities.add(id, C.Brain, { ...brain, behavior: 'idle',
            behaviorUntil: ctx.tick + TICKS_PER_DAY, targetTile: event['targetTile'] });
        }
      }
      return;
    }
    if (event.type === 'ThreatNearby') {
      const id = event['id'] as EntityId;
      const hostileId = event['hostileId'] as EntityId;
      const soldier = ctx.world.entities.get(id, C.Soldier);
      if (!soldier || !soldier.onDuty) {
        const pos = ctx.world.entities.get(hostileId, C.Position);
        const memory: ThreatMemory = { hostileId, tick: ctx.tick, ...(pos === undefined ? {} : { tile: ctx.world.map.index(pos.x, pos.y, pos.z) }) };
        const held = this.threatened.get(id);
        // A caught civilian keeps its attacker in mind while the attacker lives.
        if (held?.caught === true && ctx.world.entities.alive(held.hostileId)) {
          if (held.hostileId === hostileId) this.threatened.set(id, { ...memory, caught: true });
        } else this.threatened.set(id, memory);
        this.interruptFlags.add(id);
      }
      return;
    }
    if (event.type === 'AttackResolved') {
      this.caughtFleeing(ctx, event['attackerId'] as EntityId, event['defenderId'] as EntityId, event['outcome']);
      return;
    }
    if (event.type === 'AlertChanged') {
      this.shutOut.clear();
      for (const dwarfId of this.reader().list()) {
        this.interruptFlags.add(dwarfId);
        if (ctx.world.fortress.alert === 'hearth' && ctx.readers.has('19') &&
            !ctx.world.entities.get(dwarfId, C.Soldier)?.onDuty &&
            ctx.readers.of<{ retreatTile(id: EntityId): TileIndex }>('19').retreatTile(dwarfId) < 0) {
          this.shutOut.add(dwarfId);
        }
      }
      return;
    }
    if (event.type === 'BuildingStateChanged') { this.checkShelters(ctx); return; }
    if (event.type === 'ItemCrafted') { this.smelledSmokehouse(event, ctx); return; }
    if (event.type === 'TrainingSession') {
      // `10` § Social, comfort, joy: a sparring pair's session is a talk between the two.
      const members = event['members'];
      if (Array.isArray(members) && members.length === 2) this.activities.sparred(ctx, members[0] as EntityId, members[1] as EntityId);
      return;
    }
    if (event.type === 'PatientAdmitted' || event.type === 'PatientDischarged') {
      this.interruptFlags.add(event['id'] as EntityId);
      return;
    }
    if (event.type === 'CreatureUnconscious') {
      this.activities.cancel(ctx, event['id'] as EntityId);
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      if (ctx.world.entities.has(id, C.Worker)) {
        ctx.jobs.workerDied?.(id, typeof event['tile'] === 'number' ? event['tile'] : undefined);
      }
      this.threatened.delete(id);
      for (const dwarfId of this.reader().list()) {
        if (this.threatened.get(dwarfId)?.hostileId === id) this.threatened.delete(dwarfId);
      }
      this.seedTitles();
      // § Titles: a holder's death vacates each title it held, as a vacate does, with the event.
      for (const title of TITLES) {
        if (this.titles[title] !== id) continue;
        this.titles[title] = 0;
        ctx.emit({ type: 'TitleAssigned', dwarfId: 0, title, previousId: id });
      }
      this.activities.cancel(ctx, id);
      this.activities.forget(id);
      this.idleAnnounced.delete(id);
      this.interruptFlags.delete(id);
      this.shutOut.delete(id);
      this.hungerMaxSince.delete(id);
      this.thirstMaxSince.delete(id);
      this.starvingAnnounced.delete(id);
      if (ctx.world.entities.alive(id) && ctx.world.entities.has(id, C.Attributes)) {
        ctx.world.entities.destroy(id);
      }
      return;
    }
    if (event.type === 'EntitiesMoved') {
      this.moved(event['moves'] as readonly (readonly [EntityId, TileIndex, TileIndex])[], ctx);
      return;
    }
    if (event.type !== 'JobCompleted') return;
    const workerId = event['workerId'] as EntityId;
    const entities = ctx.world.entities;
    if (!entities.alive(workerId) || !entities.has(workerId, C.Brain)) return;
    const row = ctx.registry.table<JobTypeRow>('jobTypes').byId(event['jobType'] as string);
    if (row === undefined || row.skill === null || row.xp <= 0) return;
    // 14 § Beds: laying a pallet (a build of labor `hauling`) trains no skill.
    if (row.id === 'build' && ctx.readers.has('14')) {
      const b14 = ctx.readers.of<BuildingsReader>('14');
      const typeId = b14.get(event['target'] as EntityId)?.typeId;
      if (typeId !== undefined && b14.types().find((type) => type.id === typeId)?.labor === 'hauling') return;
    }
    const wits = entities.get(workerId, C.Attributes)?.wit ?? 0;
    grantXp(entities, ctx.registry, workerId, row.skill, jobXp(row.xp, wits), (e) => ctx.emit(e));
  }

  /** `10` § Movement: the events of dwarves entering tiles this tick (T-M3-07, D-102). */
  private moved(moves: readonly (readonly [EntityId, TileIndex, TileIndex])[], ctx: TickContext): void {
    const entities = ctx.world.entities;
    const readers = ctx.readers;
    const map = ctx.world.map;
    const fluids = readers.has('04') ? readers.of<{ isMisty(i: TileIndex): boolean }>('04') : null;
    const materials = readers.has('05') ? readers.of<{ isWarmSpring(i: TileIndex): boolean }>('05') : null;
    const terrain = readers.has('03')
      ? readers.of<{ isCrater?(i: TileIndex): boolean; boneyardAt?(i: TileIndex): number; boneyardEntered?(b: number): boolean }>('03')
      : null;
    // The boneyards whose ribs a dwarf entered in this batch: 03 marks its record on the event, next tick.
    const ribs = new Set<number>();
    const weather = readers.has('06') ? readers.of<{ state(): string }>('06') : null;
    const items = readers.has('13') ? readers.of<ItemsReader>('13') : null;
    const buildings = readers.has('14') ? readers.of<BuildingsReader>('14') : null;
    const facts: MoveFacts = {
      isMisty: (i) => fluids?.isMisty(i) === true,
      nearSpring: (i) => {
        if (materials === null || !map.validIndex(i)) return false;
        const x = map.xOf(i);
        const y = map.yOf(i);
        const z = map.zOf(i);
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (map.inBounds(x + dx, y + dy, z) && materials.isWarmSpring(map.index(x + dx, y + dy, z))) return true;
          }
        }
        return false;
      },
      isOutdoor: (i) => map.validIndex(i) && map.hasFlag(i, TileFlag.Outdoor),
      weather: () => weather?.state() ?? null,
    };
    for (const [id, from, to] of moves) {
      if (to < 0 || !entities.alive(id)) continue;
      const brain = entities.get(id, C.Brain);
      if (brain === undefined) continue;
      const next = movementEffects(id, from, to, ctx.tick, brain, facts, (e) => ctx.emit(e));
      if (next !== brain) entities.add(id, C.Brain, next);
      // `10` § Movement: stepping into the `starfall` crater from outside it; the first of the
      // fortress is a note (15's `saw_the_star` keeps itself from repeating while it lasts).
      if (terrain?.isCrater?.(to) === true && (from < 0 || terrain.isCrater?.(from) !== true)) {
        ctx.emit({ type: 'CraterEntered', id, first: !this.craterEntered });
        this.craterEntered = true;
      }
      // `10` § Movement: the first fortress dwarf to stand in a boneyard's ribs, once a boneyard.
      const boneyard = terrain?.boneyardAt?.(to) ?? -1;
      if (boneyard >= 0 && !ribs.has(boneyard) && terrain?.boneyardEntered?.(boneyard) !== true) {
        ribs.add(boneyard);
        ctx.emit({ type: 'RibsEntered', id, boneyard });
      }
      if (items !== null && buildings !== null) {
        const oldRooms = new Set(buildings.zonesAt(from).filter((zone) => buildings.room(zone) !== undefined));
        const entered = buildings.zonesAt(to).filter((zone) => buildings.room(zone) !== undefined && !oldRooms.has(zone));
        const seen = new Set<EntityId>();
        for (const zoneId of entered) for (const tile of buildings.zone(zoneId)?.tiles ?? []) {
          for (const itemId of items.at(tile)) {
            const item = items.get(itemId);
            if (item?.quality === 5 && item.crafterId !== id) seen.add(itemId);
          }
          const building = buildings.get(buildings.at(tile));
          const linked = building === undefined ? undefined : items.get(building.itemId);
          if (building?.state === 'built' && linked?.quality === 5 && linked.crafterId !== id) seen.add(building.itemId);
        }
        for (const itemId of Array.from(seen).sort((a, b) => a - b)) {
          const key = `${id}:${itemId}`;
          if (this.sawMasterworks.has(key)) continue;
          this.sawMasterworks.add(key);
          ctx.emit({ type: 'SawMasterwork', id, itemId });
          const needs = entities.get(id, C.Needs);
          if (needs !== undefined) entities.add(id, C.Needs, { ...needs, joy: Math.max(0, needs.joy - 10) });
        }
      }
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    this.seedTitles();
    const entities = ctx.world.entities;
    const reader = this.reader();
    const dwarfId = cmd['dwarfId'];
    const isDwarf = (id: unknown): id is EntityId => typeof id === 'number' && entities.alive(id) && entities.has(id, C.Brain);
    if (cmd.type === 'AssignTitle') {
      const title = cmd['title'];
      if (typeof title !== 'string' || !(TITLES as readonly string[]).includes(title)) return reject('not_found');
      if (dwarfId === 0) {
        const holder = this.titles[title as TitleName];
        this.titles[title as TitleName] = 0;
        if (holder !== 0) this.refreshTitleCache(holder);
        ctx.emit({ type: 'TitleAssigned', dwarfId: 0, title, previousId: holder });
        return OK;
      }
      if (!isDwarf(dwarfId)) return reject('not_found');
      if (reader.isChild(dwarfId)) return reject('not_adult');
      // One holder per title: the previous holder is vacated.
      const previous = this.titles[title as TitleName];
      this.titles[title as TitleName] = dwarfId;
      if (previous !== 0 && previous !== dwarfId) this.refreshTitleCache(previous);
      this.refreshTitleCache(dwarfId);
      ctx.emit({ type: 'TitleAssigned', dwarfId, title, previousId: previous === dwarfId ? 0 : previous });
      return OK;
    }
    if (cmd.type === 'RenameDwarf') {
      const name = cmd['name'];
      if (!isDwarf(dwarfId)) return reject('not_found');
      if (typeof name !== 'string' || name.length < 1 || name.length > DWARF_NAME_MAX) return reject('bad_name');
      const creature = entities.get(dwarfId, C.Creature);
      if (creature === undefined) return reject('not_found');
      entities.add(dwarfId, C.Creature, { ...creature, name });
      return OK;
    }
    if (cmd.type === 'SetSchedule') {
      const hour = cmd['sleepStartHour'];
      if (!isDwarf(dwarfId)) return reject('not_found');
      if (typeof hour !== 'number' || !Number.isInteger(hour) || hour < 0 || hour > 23) return reject('out_of_range');
      const schedule = entities.get(dwarfId, C.Schedule);
      if (schedule === undefined) return reject('not_found');
      entities.add(dwarfId, C.Schedule, { ...schedule, sleepStartHour: hour });
      return OK;
    }
    return reject('not_found');
  }

  override reader(): DwarvesReader {
    if (this.readerRef === null) throw new Error('10 dwarves: reader before init');
    return this.readerRef;
  }

  serialize(): DwarvesStateV1 {
    this.seedTitles();
    return {
      stateVersion: 1,
      titles: { ...this.titles },
      populationCached: this.populationCached,
      children: this.children.slice(),
      rng: this.stream.state(),
      wagonTile: this.wagonTile,
      interruptFlags: Array.from(this.interruptFlags).sort((a, b) => a - b),
      ...(this.threatened.size > 0 ? { threatened: Array.from(this.threatened).sort((a, b) => a[0] - b[0]) } : {}),
      hungerMaxSince: Array.from(this.hungerMaxSince).sort((a, b) => a[0] - b[0]),
      thirstMaxSince: Array.from(this.thirstMaxSince).sort((a, b) => a[0] - b[0]),
      starvingAnnounced: Array.from(this.starvingAnnounced).sort((a, b) => a[0] - b[0]),
      activities: Array.from(this.activities.plans).sort((a, b) => a[0] - b[0]),
      idleAnnounced: Array.from(this.idleAnnounced).sort((a, b) => a - b),
      ...(this.shutOut.size > 0 ? { shutOut: Array.from(this.shutOut).sort((a, b) => a - b) } : {}),
      ...(this.shutOut.size > 0 && (this.shelterCheckPending ||
        (!this.shelterRestored && this.connectivityRevision() !== this.shelterRevision)) ? { shelterCheckPending: true } : {}),
      ...(this.sawMasterworks.size > 0 ? { sawMasterworks: Array.from(this.sawMasterworks).sort()
        .map((key) => key.split(':').map(Number) as [EntityId, EntityId]) } : {}),
      ...(this.craterEntered ? { craterEntered: true } : {}),
      ...(this.whim !== null ? { whim: { ...this.whim } } : {}),
      ...(this.activities.serializeRetryUntil().length > 0 ? { needRetryUntil: this.activities.serializeRetryUntil() } : {}),
      ...(this.activities.talks.size > 0 ? { talks: this.activities.serializeTalks() } : {}),
      ...(this.activities.hearthTicks.size > 0 ? { hearthTicks: Array.from(this.activities.hearthTicks).sort((a, b) => a[0] - b[0]) } : {}),
      ...(this.activities.hallRetryUntil.size > 0 ? { hallRetryUntil: Array.from(this.activities.hallRetryUntil).sort((a, b) => a[0] - b[0]) } : {}),
      ...(this.activities.tipsyUntil.size > 0 ? { tipsyUntil: Array.from(this.activities.tipsyUntil).sort((a, b) => a[0] - b[0]) } : {}),
    };
  }

  deserialize(state: DwarvesStateV1, ctx: InitContext): void {
    if (this.world === null) this.init(ctx);
    this.titles = { ...state.titles };
    this.titlesSeeded = true;
    this.populationCached = state.populationCached;
    this.children = state.children.slice();
    this.stream.setState(state.rng);
    this.wagonTile = state.wagonTile;
    this.shutOut.clear();
    for (const id of state.shutOut ?? []) this.shutOut.add(id);
    this.shelterRevision = -1;
    this.shelterRestored = true;
    this.shelterCheckPending = state.shelterCheckPending ?? false;
    this.threatened.clear();
    for (const [id, threat] of state.threatened ?? []) {
      const pos = ctx.world.entities.get(threat.hostileId, C.Position);
      this.threatened.set(id, { ...threat, ...(threat.tile === undefined && pos !== undefined ? { tile: ctx.world.map.index(pos.x, pos.y, pos.z) } : {}) });
    }
    this.interruptFlags.clear();
    for (const id of state.interruptFlags ?? []) this.interruptFlags.add(id);
    this.hungerMaxSince.clear();
    for (const [id, tick] of state.hungerMaxSince ?? []) this.hungerMaxSince.set(id, tick);
    this.thirstMaxSince.clear();
    for (const [id, tick] of state.thirstMaxSince ?? []) this.thirstMaxSince.set(id, tick);
    this.starvingAnnounced.clear();
    for (const [id, day] of state.starvingAnnounced ?? []) this.starvingAnnounced.set(id, day);
    this.activities.plans.clear();
    for (const [id, p] of state.activities ?? []) this.activities.plans.set(id, { ...p });
    this.idleAnnounced.clear();
    for (const id of state.idleAnnounced ?? []) this.idleAnnounced.add(id);
    this.sawMasterworks.clear();
    for (const [id, itemId] of state.sawMasterworks ?? []) this.sawMasterworks.add(`${id}:${itemId}`);
    this.craterEntered = state.craterEntered === true;
    this.whim = state.whim === undefined ? null : { ...state.whim };
    this.activities.retryUntil.clear();
    for (const [id, need, until] of state.needRetryUntil ?? []) {
      this.activities.setRetryUntil(id, need, until);
    }
    this.activities.talks.clear();
    for (const [a, b, until] of state.talks ?? []) {
      this.activities.talks.set(a, { partner: b, until });
      this.activities.talks.set(b, { partner: a, until });
    }
    this.activities.hearthTicks.clear();
    for (const [id, ticks] of state.hearthTicks ?? []) this.activities.hearthTicks.set(id, ticks);
    this.activities.hallRetryUntil.clear();
    for (const [id, until] of state.hallRetryUntil ?? []) this.activities.hallRetryUntil.set(id, until);
    this.activities.tipsyUntil.clear();
    for (const [id, until] of state.tipsyUntil ?? []) this.activities.tipsyUntil.set(id, until);
  }
}
