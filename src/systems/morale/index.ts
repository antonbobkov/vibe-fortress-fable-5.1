/** `15` Happiness and morale: thoughts, hourly mood, hall spirit, and daily sulks. */
import authoredThoughts from '@content/thoughts.json';
import { C, type ActiveThought, type Mood } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type ThoughtSource, type TickContext, type WorldLike } from '@core/system';
import type { EntityId, MoodTier } from '@core/types';
import type { DwarvesReader } from '@systems/dwarves';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TileFlag } from '@core/map3d';
import { currentValue, moodValue, productivity, tierOf } from './mood';
import { baseValue, eventPredicate, eventTargets, personalityBase, personalityMultiplier, triggerEvent, worldPredicate, type ThoughtDef } from './thoughts';
import { NEED_PRESSURE_THOUGHTS, standingThoughts } from './standing';
import { advanceSulkCounter, doSulk, sulkKind } from './sulks';
import type { MoraleReader, ThoughtView } from './reader';
import type { MoraleStateV1 } from './state';

export * from './mood';
export * from './thoughts';
export { advanceSulkCounter, sulkKind, doSulk } from './sulks';
export { NEED_PRESSURE_THOUGHTS } from './standing';
export type { MoraleReader, ThoughtView } from './reader';

export const MORALE_ID = '15';
const AUTHORED = authoredThoughts as ThoughtDef[];
const SUBSCRIBES = Array.from(new Set<EventType>([
  'HourPassed', 'DayPassed', 'Slept', 'RoomQualityChanged',
  ...AUTHORED.map(triggerEvent).filter((e): e is EventType => e !== null),
]));
const SOURCE_IDS = new Set(['friend_died', 'pet_died', 'buried_friend', 'memorial_placed']);

export class MoraleSystem extends BaseSystem<MoraleStateV1> {
  readonly id = MORALE_ID;
  readonly order = 15;
  override readonly subscribes: readonly EventType[] = SUBSCRIBES;
  private world: WorldLike | null = null;
  private rng: RngStream | null = null;
  private definitions = new Map<string, ThoughtDef>();
  private indices = new Map<string, number>();
  private sources: readonly ThoughtSource[] = [];
  private readerRef: MoraleReader | null = null;
  private spirit = 55;
  private spiritTier: MoodTier = 2;
  private hourDue = false;
  private dayDue = false;
  private firstTick = true;
  private lastHearthTier = 0;
  readonly floorSleepers = new Set<EntityId>();
  readonly dayOffUntil = new Map<EntityId, number>();
  readonly sunlightSeen = new Set<EntityId>();
  readonly statueSeen = new Set<string>();

  override init(ctx: InitContext): void {
    this.world = ctx.world;
    this.rng = ctx.rng;
    const table = ctx.registry.table<ThoughtDef>('thoughts');
    this.definitions = new Map(table.ids().map((id) => [id, table.byId(id) as ThoughtDef]));
    this.indices = new Map(table.ids().map((id) => [id, table.index(id)]));
    this.sources = ((ctx.register as unknown as { thoughtSources?: readonly ThoughtSource[] }).thoughtSources ?? []).slice();
    const entities = ctx.world.entities;
    const defs = this.definitions;
    this.readerRef = {
      mood: (id) => entities.get(id, C.Mood)?.value ?? 55,
      tier: (id) => entities.get(id, C.Mood)?.tier ?? 2,
      productivity: (id) => productivity(entities.get(id, C.Mood)?.tier ?? 2),
      thoughts: (id) => this.views(id, ctx.world.calendar.tick),
      hallSpirit: () => this.spirit,
      hallSpiritTier: () => this.spiritTier,
      def: (id) => defs.get(id),
      dayOff: (id) => (this.dayOffUntil.get(id) ?? 0) > ctx.world.calendar.tick,
    };
    ctx.register.panel({ id: 'mood', title: 'Mood', hotkey: 'e' });
    ctx.register.inspector('creature', { id: 'mood', order: 15 });
    ctx.register.announcement('SulkHappened', { severity: 'note', stringKey: 'announce.sulk', keyField: 'kind', oneOf: { field: 'kind', values: ['day_off', 'argue', 'weep'] } });
    ctx.register.announcement('SulkHappened', { severity: 'alert', stringKey: 'announce.sulk_break', oneOf: { field: 'kind', values: ['break'] } });
    ctx.register.announcement('MoodTierChanged', { severity: 'note', stringKey: 'announce.mood_tier', oneOf: { field: 'to', values: [0] } });
    ctx.register.announcement('ThoughtGained', { severity: 'note', stringKey: 'announce.thought' });
  }

  private views(id: EntityId, tick: number): ThoughtView[] {
    const thoughts = this.world?.entities.get(id, C.Mood)?.thoughts ?? [];
    const table = this.definitions;
    const indexes = this.indices;
    const byIndex = new Map(Array.from(indexes, ([key, index]) => [index, key]));
    return thoughts.flatMap((thought) => {
      const name = byIndex.get(thought.thought);
      const def = name === undefined ? undefined : table.get(name);
      if (def === undefined) return [];
      const value = currentValue(thought, def, tick);
      if (value === 0) return [];
      const remainingHours = def.hours === null ? null : Math.max(0, def.hours - (tick - thought.startTick) / TICKS_PER_HOUR);
      return [{ id: def.id, text: def.text, value, remainingHours }];
    }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.id.localeCompare(b.id));
  }

  override reader(): MoraleReader {
    if (this.readerRef === null) throw new Error('15 morale: reader before init');
    return this.readerRef;
  }

  private ensure(id: EntityId): Mood {
    const entities = (this.world as WorldLike).entities;
    const mood = entities.get(id, C.Mood);
    if (mood !== undefined) return mood;
    const fresh: Mood = { value: 55, tier: 2, thoughts: [], sulkCounterDays: 0 };
    entities.add(id, C.Mood, fresh);
    return fresh;
  }

  private give(id: EntityId, def: ThoughtDef, ctx: TickContext, event?: GameEvent): void {
    const entities = ctx.world.entities;
    if (!entities.alive(id) || !entities.has(id, C.Brain)) return;
    const mood = this.ensure(id);
    const traits = entities.get(id, C.Personality)?.traits ?? [];
    const value = baseValue(def, event) * personalityMultiplier(ctx.registry, traits, def, baseValue(def, event));
    if (value === 0) return;
    const index = this.indices.get(def.id);
    if (index === undefined) return;
    const thoughts = mood.thoughts.filter((thought) => thought.thought !== index || currentValue(thought, def, ctx.tick) !== 0);
    const owned = thoughts.filter((thought) => thought.thought === index);
    if (owned.length >= def.cap) {
      const oldest = owned[0] as ActiveThought;
      thoughts.splice(thoughts.indexOf(oldest), 1);
    }
    thoughts.push({ thought: index, startTick: ctx.tick, baseValue: value });
    entities.add(id, C.Mood, { ...mood, thoughts });
    if (def.announce) ctx.emit({ type: 'ThoughtGained', id, thoughtId: def.id, value });
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'HourPassed') this.hourDue = true;
    if (event.type === 'DayPassed') this.dayDue = true;
    if (event.type === 'Buried' && !ctx.readers.of<ItemsReader>('13').unburiedDead(ctx.tick)) this.hourDue = true;
    if (event.type === 'Slept') {
      const id = event['id'];
      if (typeof id === 'number') {
        if (event['onFloor'] === true) this.floorSleepers.add(id);
        else this.floorSleepers.delete(id);
      }
    }
    if (event.type === 'EntitiesMoved') this.movementThoughts(event, ctx);
    let resolved = event;
    if (event.type === 'RoomQualityChanged') {
      const zone = ctx.readers.of<BuildingsReader>('14').zone(Number(event['zoneId']));
      if (zone?.type === 'hearth_hall') {
        resolved = { ...event, roomType: 'hearth_hall', oldTier: this.lastHearthTier };
        this.lastHearthTier = Number(event['tier']);
      }
    }
    const sourceMatches = new Map<string, EntityId[]>();
    for (const source of this.sources) if (source.on.includes(event.type)) for (const raw of source.trigger(event, ctx)) {
      const match = raw as { thoughtId?: string; id?: number };
      if (typeof match.thoughtId !== 'string' || typeof match.id !== 'number') continue;
      const list = sourceMatches.get(match.thoughtId) ?? [];
      list.push(match.id);
      sourceMatches.set(match.thoughtId, list);
    }
    for (const def of Array.from(this.definitions.values())) {
      if (def.id === 'saw_sunlight' || def.id === 'admired_statue') continue;
      if (!eventPredicate(def, resolved, ctx.registry)) continue;
      const targets = SOURCE_IDS.has(def.id) ? (sourceMatches.get(def.id) ?? []) : eventTargets(def, resolved, ctx);
      for (const id of targets) if (worldPredicate(def, resolved, ctx, id)) this.give(id, def, ctx, resolved);
    }
  }

  private movementThoughts(event: GameEvent, ctx: TickContext): void {
    const moves = event['moves'] as readonly (readonly [EntityId, number, number])[] | undefined;
    if (moves === undefined) return;
    const map = ctx.world.map;
    const buildings = ctx.readers.of<BuildingsReader>('14');
    const items = ctx.readers.of<ItemsReader>('13');
    const season = Math.floor(ctx.tick / (DAYS_PER_SEASON * TICKS_PER_DAY));
    const statues = buildings.byType('statue').map((id) => ({ id, view: buildings.get(id) }))
      .filter(({ view }) => view?.state === 'built' && (items.get(view.itemId)?.quality ?? 0) >= 2);
    for (const [id, , to] of moves) {
      if (!ctx.world.entities.has(id, C.Brain) || !map.validIndex(to)) continue;
      const brain = ctx.world.entities.get(id, C.Brain);
      if ((brain?.daysUnderground ?? 0) >= 7 && map.hasFlag(to, TileFlag.Outdoor) && !this.sunlightSeen.has(id)) {
        const def = this.definitions.get('saw_sunlight');
        if (def !== undefined) this.give(id, def, ctx);
        this.sunlightSeen.add(id);
      }
      for (const { id: statue, view: b } of statues) {
        if (b === undefined) continue;
        if (map.zOf(to) !== map.zOf(b.origin) || Math.max(Math.abs(map.xOf(to) - map.xOf(b.origin)), Math.abs(map.yOf(to) - map.yOf(b.origin))) > 1) continue;
        const key = `${id}:${statue}:${season}`;
        if (this.statueSeen.has(key)) continue;
        const def = this.definitions.get('admired_statue');
        if (def !== undefined) this.give(id, def, ctx);
        this.statueSeen.add(key);
      }
    }
  }

  override tick(ctx: TickContext): void {
    const dwarves = ctx.readers.of<DwarvesReader>('10');
    for (const id of dwarves.list()) this.ensure(id);
    if (this.firstTick || this.hourDue) {
      this.firstTick = false;
      this.hourDue = false;
      this.recompute(ctx, dwarves);
    }
    if (this.dayDue) {
      this.dayDue = false;
      for (const id of dwarves.list()) {
        const mood = this.ensure(id);
        const count = advanceSulkCounter(mood.sulkCounterDays, mood.tier === 0);
        if (!count.sulk) { ctx.world.entities.add(id, C.Mood, { ...mood, sulkCounterDays: count.days }); continue; }
        const traits = ctx.world.entities.get(id, C.Personality)?.traits ?? [];
        const kind = sulkKind(ctx.registry, traits);
        const details = doSulk(kind, id, ctx, this.dayOffUntil);
        ctx.world.entities.add(id, C.Mood, { ...mood, sulkCounterDays: 0 });
        ctx.emit({ type: 'SulkHappened', id, kind, ...details });
      }
    }
  }

  private recompute(ctx: TickContext, dwarves: DwarvesReader): void {
    const entities = ctx.world.entities;
    const thoughts = ctx.registry.table<ThoughtDef>('thoughts');
    const hearth = ctx.readers.of<BuildingsReader>('14').hearthHallTier();
    for (const id of dwarves.list()) {
      if ((entities.get(id, C.Brain)?.daysUnderground ?? 0) === 0) this.sunlightSeen.delete(id);
      const before = this.ensure(id);
      const next: ActiveThought[] = before.thoughts.filter((t) => {
        const def = thoughts.byIndex(t.thought);
        return def !== undefined && def.decay !== 'standing' && currentValue(t, def, ctx.tick) !== 0;
      });
      const traits = entities.get(id, C.Personality)?.traits ?? [];
      for (const stand of standingThoughts(id, ctx, this.floorSleepers, this.definitions)) {
        const def = this.definitions.get(stand.id) as ThoughtDef;
        const scaled = stand.value * personalityMultiplier(ctx.registry, traits, def, stand.value);
        next.push({ thought: this.indices.get(stand.id) as number, startTick: ctx.tick, baseValue: scaled });
      }
      const values = next.map((thought) => {
        const def = thoughts.byIndex(thought.thought) as ThoughtDef;
        return { value: currentValue(thought, def, ctx.tick), need: NEED_PRESSURE_THOUGHTS.has(def.id) };
      });
      const value = moodValue(values, hearth, personalityBase(ctx.registry, traits));
      const tier = tierOf(value);
      entities.add(id, C.Mood, { ...before, value, tier, thoughts: next });
      if (tier !== before.tier) ctx.emit({ type: 'MoodTierChanged', id, from: before.tier, to: tier });
    }
    const adults = dwarves.adults();
    const value = adults.length === 0 ? 55 : adults.reduce((sum, id) => sum + (entities.get(id, C.Mood)?.value ?? 55), 0) / adults.length;
    const tier = tierOf(value);
    this.spirit = value;
    if (tier !== this.spiritTier) ctx.emit({ type: 'HallSpiritChanged', value, tier });
    this.spiritTier = tier;
  }

  serialize(): MoraleStateV1 {
    if (this.rng === null) throw new Error('15 morale: serialize before init');
    return { stateVersion: 1, hallSpirit: this.spirit, hallSpiritTier: this.spiritTier, rng: this.rng.state(),
      floorSleepers: Array.from(this.floorSleepers).sort((a, b) => a - b), dailyStandingDue: this.dayDue,
      hourlyDue: this.firstTick || this.hourDue, lastHearthTier: this.lastHearthTier,
      dayOffUntil: Array.from(this.dayOffUntil).sort((a, b) => a[0] - b[0]),
      sunlightSeen: Array.from(this.sunlightSeen).sort((a, b) => a - b),
      statueSeen: Array.from(this.statueSeen).sort().map((key) => key.split(':').map(Number) as [EntityId, EntityId, number]) };
  }

  deserialize(state: MoraleStateV1, ctx: InitContext): void {
    if (this.world === null) this.init(ctx);
    this.spirit = state.hallSpirit;
    this.spiritTier = state.hallSpiritTier;
    this.rng?.setState(state.rng);
    this.floorSleepers.clear();
    for (const id of state.floorSleepers ?? []) this.floorSleepers.add(id);
    this.dayDue = state.dailyStandingDue === true;
    this.hourDue = state.hourlyDue === true;
    this.lastHearthTier = state.lastHearthTier ?? 0;
    this.dayOffUntil.clear();
    for (const [id, tick] of state.dayOffUntil ?? []) this.dayOffUntil.set(id, tick);
    this.sunlightSeen.clear();
    for (const id of state.sunlightSeen ?? []) this.sunlightSeen.add(id);
    this.statueSeen.clear();
    for (const [id, statue, season] of state.statueSeen ?? []) this.statueSeen.add(`${id}:${statue}:${season}`);
    this.firstTick = false;
  }
}
