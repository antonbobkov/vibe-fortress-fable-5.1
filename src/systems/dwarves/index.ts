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
import { tickDwarf, type BrainHost } from './brain';
import { makeReader, type DwarvesReader } from './reader';
import { dwarfSpeed, jobXp } from './rules/skills';
import { grantXp } from './skills';
import { movementEffects, type MoveFacts } from './movement-effects';
import type { DwarvesStateV1, TitleName } from './state';
import { TileFlag } from '@core/map3d';
import type { WeatherReader } from '@systems/weather';
import type { ItemsReader } from '@systems/items';
import type { BuildingsReader } from '@systems/buildings';
import { SLEEP_NEED_MIN, advanceNeeds, crossed, type NeedName } from './needs';
import { ADULT_AGE_YEARS, DEHYDRATE_DAYS, STARVE_DAYS, HEAVY_ITEM_DENSITY } from './constants';
import { Activities } from './activities';

export { makeReader, type DwarvesReader } from './reader';
export { NO_JOB, select, tickDwarf, type BrainHost } from './brain';
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
  override readonly subscribes: readonly EventType[] = ['HourPassed', 'DayPassed', 'YearPassed', 'JobCompleted', 'CreatureDied', 'EntitiesMoved', 'SulkHappened', 'ThreatNearby', 'AlertChanged'];
  override readonly ownsCommands: readonly CommandType[] = ['AssignTitle', 'RenameDwarf', 'SetSchedule'];

  private world: WorldLike | null = null;
  private rng: RngStream | null = null;
  private readerRef: DwarvesReader | null = null;
  private host: BrainHost | null = null;
  private titles: Record<TitleName, EntityId> = { thane: 0, warden: 0, broker: 0, chief_medic: 0 };
  private titlesSeeded = false;
  private populationCached = 0;
  private children: EntityId[] = [];
  /** The wagon tile of the arrival, the idle anchor until there is a hearth hall (D-057). */
  wagonTile: TileIndex = -1;
  readonly interruptFlags = new Set<EntityId>();
  readonly threatened = new Map<EntityId, { hostileId: EntityId; tick: number }>();
  readonly hungerMaxSince = new Map<EntityId, number>();
  readonly thirstMaxSince = new Map<EntityId, number>();
  readonly starvingAnnounced = new Map<EntityId, number>();
  readonly activities = new Activities();
  readonly idleAnnounced = new Set<EntityId>();
  readonly sawMasterworks = new Set<string>();

  hasInterrupt(id: EntityId): boolean { return this.interruptFlags.has(id); }
  takeInterrupt(id: EntityId): boolean { return this.interruptFlags.delete(id); }

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
      const after = advanceNeeds(before, end, thirstPercent, asleep, working);
      entities.add(id, C.Needs, after);
      this.recordCrossings(id, before, after, (e) => ctx.emit(e));
      if (schedule?.sleepStartHour === hour && after.rest > SLEEP_NEED_MIN) this.interruptFlags.add(id);
      this.updateMaxSince(id, after, ctx.tick);
      this.announceStarving(id, after, day, (e) => ctx.emit(e));
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
    this.rng = ctx.rng;
    this.readerRef = makeReader(ctx.world.entities, ctx.registry, () => { this.seedTitles(); return this.titles; },
      (id) => {
        const mood = ctx.readers.has('15') ? ctx.readers.of<{ productivity(id: EntityId): number }>('15').productivity(id) : 100;
        const health = ctx.readers.has('17') ? ctx.readers.of<{ productivityModifier(id: EntityId): number }>('17').productivityModifier(id) : 100;
        return Math.floor((mood * health) / 100);
      });
    const jobTypes = ctx.registry.table<JobTypeRow>('jobTypes');
    this.host = {
      get hasJobs(): boolean {
        return ctx.readers.has('11');
      },
        idleGoal: (id) => {
          if (!ctx.readers.has('14')) return this.wagonTile;
          const from = ctx.world.services.movement?.tileOf(id) ?? -1;
          if (from < 0) return this.wagonTile;
          const map = ctx.world.map;
          const hall = ctx.readers.of<BuildingsReader>('14').hearthHallTiles()
            .filter((tile) => ctx.readers.pathing.passable(tile, 'walker') && ctx.readers.pathing.reachable(from, tile, 'walker'));
          hall.sort((a, b) => Math.max(Math.abs(map.xOf(from) - map.xOf(a)), Math.abs(map.yOf(from) - map.yOf(a)))
            - Math.max(Math.abs(map.xOf(from) - map.xOf(b)), Math.abs(map.yOf(from) - map.yOf(b))) || a - b);
          return hall[0] ?? this.wagonTile;
        },
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
      clearThreat: (id) => { this.threatened.delete(id); },
      setCombatTarget: (id, targetId) => { ctx.world.services.combat?.setTarget(id, targetId); },
    };
    ctx.register.panel({ id: 'units', title: 'Units', hotkey: 'u' });
    ctx.register.inspector('creature', { id: 'dwarf', order: 10 });
    // `10` § Registrations: "announcements: starving (alert), passed out (note), title assigned
    // (note), came of age (note), legendary (note)"; 17 owns "passed out" (`CreatureUnconscious`),
    // whose severity its own document gives (D-201).
    ctx.register.announcement('Starving', { severity: 'alert', stringKey: 'announce.starving' });
    ctx.register.announcement('TitleAssigned', { severity: 'note', stringKey: 'announce.title_assigned' });
    ctx.register.announcement('DwarfBecameAdult', { severity: 'note', stringKey: 'announce.came_of_age' });
    ctx.register.announcement('LegendaryReached', { severity: 'note', stringKey: 'announce.legendary' });
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
    this.seedTitles();
    const reader = this.reader();
    const entities = ctx.world.entities;
    const species = ctx.registry.table<SpeciesRow & { id: string }>('creatures');
    const movement = ctx.world.services.movement;
    const dwarves = reader.list();
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
        movement.setSpeed(id, dwarfSpeed(base, attrs.agi, Math.floor((healthPercent * armorPercent) / 100), carryPercent));
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
  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'HourPassed') { this.hourly(ctx, event['hour'] as number); return; }
    if (event.type === 'DayPassed') { this.daily(ctx); return; }
    if (event.type === 'YearPassed') { this.yearly(ctx); return; }
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
        if (brain !== undefined) ctx.world.entities.add(id, C.Brain, { ...brain, behavior: 'idle',
          behaviorUntil: ctx.tick + TICKS_PER_DAY, targetTile: event['targetTile'] });
      }
      return;
    }
    if (event.type === 'ThreatNearby') {
      const id = event['id'] as EntityId;
      const hostileId = event['hostileId'] as EntityId;
      const soldier = ctx.world.entities.get(id, C.Soldier);
      if (!soldier || !soldier.onDuty) {
        this.threatened.set(id, { hostileId, tick: ctx.tick });
        this.interruptFlags.add(id);
      }
      return;
    }
    if (event.type === 'AlertChanged') {
      for (const dwarfId of this.reader().list()) {
        this.interruptFlags.add(dwarfId);
      }
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      this.threatened.delete(id);
      for (const dwarfId of this.reader().list()) {
        if (this.threatened.get(dwarfId)?.hostileId === id) this.threatened.delete(dwarfId);
      }
      this.seedTitles();
      for (const title of TITLES) if (this.titles[title] === id) this.titles[title] = 0;
      this.activities.plans.delete(id);
      this.idleAnnounced.delete(id);
      this.interruptFlags.delete(id);
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
        ctx.emit({ type: 'TitleAssigned', dwarfId: 0, title });
        return OK;
      }
      if (!isDwarf(dwarfId)) return reject('not_found');
      if (reader.isChild(dwarfId)) return reject('not_adult');
      // One holder per title: the previous holder is vacated.
      const previous = this.titles[title as TitleName];
      this.titles[title as TitleName] = dwarfId;
      if (previous !== 0 && previous !== dwarfId) this.refreshTitleCache(previous);
      this.refreshTitleCache(dwarfId);
      ctx.emit({ type: 'TitleAssigned', dwarfId, title });
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
      hungerMaxSince: Array.from(this.hungerMaxSince).sort((a, b) => a[0] - b[0]),
      thirstMaxSince: Array.from(this.thirstMaxSince).sort((a, b) => a[0] - b[0]),
      starvingAnnounced: Array.from(this.starvingAnnounced).sort((a, b) => a[0] - b[0]),
      activities: Array.from(this.activities.plans).sort((a, b) => a[0] - b[0]),
      idleAnnounced: Array.from(this.idleAnnounced).sort((a, b) => a - b),
      ...(this.sawMasterworks.size > 0 ? { sawMasterworks: Array.from(this.sawMasterworks).sort()
        .map((key) => key.split(':').map(Number) as [EntityId, EntityId]) } : {}),
      ...(this.activities.serializeRetryUntil().length > 0 ? { needRetryUntil: this.activities.serializeRetryUntil() } : {}),
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
    this.activities.retryUntil.clear();
    for (const [id, need, until] of state.needRetryUntil ?? []) {
      this.activities.setRetryUntil(id, need, until);
    }
  }
}
