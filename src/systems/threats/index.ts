/**
 * Threats, Monsters & Raids system: `02-systems/18-threats-monsters-and-raids.md`.
 */

import { seasonOf } from '@core/calendar';
import { C } from '@core/components';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import {
  BaseSystem,
  type InitContext,
  type SystemId,
  type TickContext,
} from '@core/system';
import type { Edge, EntityId, TileIndex } from '@core/types';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsReader } from '@systems/items/reader';
import type { WeatherReader } from '@systems/weather/reader';
import type { LocalMapSpec } from '@systems/embark/spec';
import { isDue } from '@core/scheduler';
import {
  THREATS_CADENCE,
  THREATS_PHASE,
  WARNING_DAYS,
} from './constants';
import { arriveParty, spawnHostileMember } from './parties';
import { makeThreatsReader, type ThreatsReader } from './reader';
import {
  calculatePartySize,
  calculateRenown,
  initScheduleAtEmbark,
  type ThreatScheduleEntry,
} from './schedule';
import {
  checkPartyCasualties,
  chooseGoal,
  stepThreatMembers,
  stepThreatParties,
} from './ai';
import type {
  PendingArrivalState,
  PendingSpawnState,
  ThreatsStateV1,
} from './state';

export * from './constants';
export * from './state';
export * from './reader';
export * from './schedule';
export * from './parties';
export * from './gear';
export * from './ai';
export * from './caverns';
export * from './deep';

import { TileFlag } from '@core/map3d';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import { cavernAt } from '@systems/terrain/api';
import {
  type CavernMonsterInfo,
  dailyCavernRespawn,
  handleRestlessDeadHour,
  handleWebEntangle,
  spawnInitialCavernMonsters,
  spinSpiderWebs,
  stepCavernMonsters,
  wakeCavernMonsters,
} from './caverns';
import {
  type DeepState,
  checkHollowWave,
  handleDeepsilverMined,
  nextDeepThreshold,
  stepHollowBorn,
} from './deep';

export class ThreatsSystem extends BaseSystem<ThreatsStateV1> {
  override readonly id: SystemId = '18';
  override readonly order: number = 18;
  override readonly cadence: number = 1;
  override readonly phase: number = 0;

  override readonly ownsCommands: readonly CommandType[] = [];
  override readonly subscribes: readonly EventType[] = [
    'DayPassed',
    'HourPassed',
    'WealthChanged',
    'ImmigrantsArrived',
    'DwarfDied',
    'WeatherChanged',
    'CreatureDied',
    'CreatureUnconscious',
    'TrapTriggered',
    'DoorBroken',
    'EntitiesMoved',
    'TilesChanged',
    'CavernBreached',
    'DeepsilverMined',
  ];

  private rng!: RngStream;
  private spec: LocalMapSpec | null = null;
  private peril = 0;
  private traits: readonly string[] = [];
  private schedule = new Map<string, ThreatScheduleEntry>();
  private renownVal = 0;
  private deepsilverTiles: number[] = [];
  private pendingArrivals: PendingArrivalState[] = [];
  private pendingSpawns: PendingSpawnState[] = [];
  private readerRef: ThreatsReader | null = null;

  private entities!: EntityStore;
  private registry!: Registry;
  private monsterInfo = new Map<EntityId, CavernMonsterInfo>();
  private webs = new Map<TileIndex, EntityId>();
  private wasDaylight = true;
  private hollowBorn = new Set<EntityId>();
  private deepState: DeepState = {
    pressure: 0,
    level: 0,
    nextHollowWaveTick: 0,
    hollowWaveIndex: 0,
  };

  constructor(private readonly options: { spec?: LocalMapSpec } = {}) {
    super();
  }

  override init(ctx: InitContext): void {
    this.entities = ctx.world.entities;
    this.registry = ctx.registry;
    this.rng = ctx.rng;
    this.spec = this.options.spec ?? null;
    this.peril = this.spec?.peril ?? 0;
    this.traits = this.spec?.traits ?? [];

    this.schedule = initScheduleAtEmbark(ctx.registry, this.peril, this.traits, this.rng);

    this.deepState.pressure = ctx.world.fortress?.deepPressure ?? 0;
    this.deepState.level = ctx.world.fortress?.deepLevel ?? 0;

    this.readerRef = makeThreatsReader(
      ctx.world.entities,
      () => this.renownVal,
      () => this.schedule,
      () => this.deepState.pressure,
      () => this.deepState.level,
      (n: number) => {
        let count = 0;
        for (const [id, info] of this.monsterInfo) {
          if (this.entities.alive(id) && info.tier === n) {
            count++;
          }
        }
        return count;
      },
      () => nextDeepThreshold(this.deepState.level),
    );
    ctx.register.panel({ id: 'threats', title: 'Threats', hotkey: 't' });
    ctx.register.announcement('ThreatWarning', {
      severity: 'alert',
      stringKey: 'announce.threat_warning',
    });
    ctx.register.announcement('RaidArrived', {
      severity: 'danger',
      stringKey: 'announce.raid_arrived',
    });
    ctx.register.announcement('RaidEnded', {
      severity: 'note',
      stringKey: 'announce.raid_ended',
    });
    ctx.register.announcement('ThiefSpotted', {
      severity: 'alert',
      stringKey: 'announce.thief_spotted',
    });
    ctx.register.announcement('ThiefEscaped', {
      severity: 'alert',
      stringKey: 'announce.thief_escaped',
    });
    ctx.register.announcement('AmbushSprung', {
      severity: 'danger',
      stringKey: 'announce.ambush_sprung',
    });
    ctx.register.announcement('MonsterSpawned', {
      severity: 'note',
      stringKey: 'announce.monster_spawned',
    });
    ctx.register.announcement('DeepStirred', {
      severity: 'danger',
      stringKey: 'announce.deep_stirred',
    });
    ctx.register.announcement('RestlessRose', {
      severity: 'alert',
      stringKey: 'announce.restless_rose',
    });
    const pathing =
      ctx.readers && typeof ctx.readers.has === 'function' && ctx.readers.has('pathing')
        ? ctx.readers.pathing
        : undefined;
    spawnInitialCavernMonsters(
      ctx.world,
      ctx.registry,
      this.rng,
      this.traits,
      this.monsterInfo,
      this.webs,
      pathing,
    );
  }

  override reader(): ThreatsReader {
    if (!this.readerRef) throw new Error('18 threats: reader requested before init');
    return this.readerRef;
  }

  private updateRenown(ctx: TickContext): void {
    let wealth = ctx.world.fortress.wealthCached;
    if (ctx.readers.has('13')) {
      const items = ctx.readers.of<ItemsReader>('13');
      wealth = items.wealth();
    }

    let pop = 0;
    const entities = ctx.world.entities;
    for (const id of entities.with(C.Creature)) {
      if (entities.alive(id)) {
        const c = entities.get(id, C.Creature);
        if (c?.faction === 'fortress') {
          pop++;
        }
      }
    }

    this.renownVal = calculateRenown(wealth, pop);
  }

  private processArrivalsAndSpawns(ctx: TickContext): void {
    // 1. Process pending party arrivals
    const readyArrivals: PendingArrivalState[] = [];
    const remainingArrivals: PendingArrivalState[] = [];
    for (const a of this.pendingArrivals) {
      if (a.arrivalTick <= ctx.tick) {
        readyArrivals.push(a);
      } else {
        remainingArrivals.push(a);
      }
    }
    this.pendingArrivals = remainingArrivals;

    for (const a of readyArrivals) {
      const { partyId, pendingSpawns } = arriveParty(
        ctx.world,
        ctx.registry,
        this.rng,
        a.kind,
        a.civ,
        a.size,
        a.edge,
        ctx.tick,
        this.renownVal,
        this.peril,
        this.traits.includes('twilight_pass'),
      );
      this.pendingSpawns.push(...pendingSpawns);
      const entry = this.schedule.get(a.kind);
      if (entry) {
        entry.pendingSpawnTick = 0;
      }
      const pComp = ctx.world.entities.get(partyId, C.Party);
      if (pComp) {
        chooseGoal(pComp, ctx);
      }
    }

    // 2. Process pending creature spawns
    const readySpawns: PendingSpawnState[] = [];
    const remainingSpawns: PendingSpawnState[] = [];
    for (const s of this.pendingSpawns) {
      if (s.tick <= ctx.tick) {
        readySpawns.push(s);
      } else {
        remainingSpawns.push(s);
      }
    }
    this.pendingSpawns = remainingSpawns;

    for (const s of readySpawns) {
      spawnHostileMember(
        ctx.world,
        ctx.registry,
        this.rng,
        s.partyId,
        s.species,
        s.role,
        s.tile,
        s.gearTier,
        s.isCaptain,
      );
    }
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'DayPassed') {
      this.updateRenown(ctx);

      for (const [kind, entry] of this.schedule) {
        if (entry.earliestTick < 0) continue;
        if (entry.pendingSpawnTick > 0) continue;
        if (ctx.tick < entry.nextTick) continue;

        // Check lead time with fog
        let visMod = 100;
        if (ctx.readers.has('06')) {
          const weather = ctx.readers.of<WeatherReader>('06');
          visMod = weather.visibilityModifier();
        }
        const warningDays = entry.warningDays > 0 ? entry.warningDays : WARNING_DAYS;
        const leadTicks = entry.warningDays > 0
          ? Math.floor((warningDays * TICKS_PER_DAY * visMod) / 100)
          : 0;

        // Raids never come in winter at peril <= 2 (passes are closed)
        if (kind === 'raid' && this.peril <= 2) {
          const arrivalSeason = seasonOf(ctx.tick + leadTicks);
          if (arrivalSeason === 3) continue;
        }

        const civ = kind === 'bandits' ? 'hillfolk' : 'gloam';
        const edge = (this.spec?.civEdges?.[civ as 'gloam' | 'hillfolk'] ?? 'n') as Edge;
        const size = calculatePartySize(entry.base, entry.perRenown, entry.max, this.renownVal);

        if (entry.warningDays > 0) {
          const sizeBand = size < 6 ? 'a few' : size <= 15 ? 'a band' : 'a horde';
          const edgeDescMap: Record<Edge, string> = {
            n: 'the northern edge',
            e: 'the eastern edge',
            s: 'the southern edge',
            w: 'the western edge',
          };
          const edgeDesc = edgeDescMap[edge] ?? edge;

          ctx.emit({
            type: 'ThreatWarning',
            kind,
            civ,
            sizeBand,
            edge: edgeDesc,
          });

          entry.pendingSpawnTick = ctx.tick + leadTicks + 1;
          this.pendingArrivals.push({
            kind,
            civ,
            size,
            arrivalTick: entry.pendingSpawnTick,
            edge,
            warningEmitted: true,
          });

          // Roll next interval
          const intervalDays = this.rng.int(entry.intervalMin, entry.intervalMax);
          entry.nextTick = ctx.tick + intervalDays * TICKS_PER_DAY;
        } else {
          // Immediate arrival
          this.pendingArrivals.push({
            kind,
            civ,
            size,
            arrivalTick: ctx.tick,
            edge,
            warningEmitted: false,
          });

          // Roll next interval
          const intervalDays = this.rng.int(entry.intervalMin, entry.intervalMax);
          entry.nextTick = ctx.tick + intervalDays * TICKS_PER_DAY;
        }
      }

      this.processArrivalsAndSpawns(ctx);
      dailyCavernRespawn(ctx, this.rng, this.traits, this.monsterInfo, this.webs);
      spinSpiderWebs(ctx, this.monsterInfo, this.webs);
    } else if (event.type === 'HourPassed') {
      this.processArrivalsAndSpawns(ctx);
      const weather = ctx.readers.has('06') ? ctx.readers.of<WeatherReader>('06') : undefined;
      const isDaylight = weather ? weather.isDaylight() : (ctx.readers.calendar.hour >= 6 && ctx.readers.calendar.hour < 18);
      handleRestlessDeadHour(ctx, this.rng, this.renownVal, this.traits, this.wasDaylight, isDaylight);
      this.wasDaylight = isDaylight;
    } else if (event.type === 'CavernBreached') {
      const tier = event['cavern'] as number;
      wakeCavernMonsters(ctx.world, tier, this.monsterInfo);
    } else if (event.type === 'EntitiesMoved') {
      const moves = event['moves'] as [EntityId, TileIndex, TileIndex][];
      handleWebEntangle(ctx, moves);
    } else if (event.type === 'WealthChanged' || event.type === 'ImmigrantsArrived' || event.type === 'DwarfDied') {
      this.updateRenown(ctx);
    } else if (event.type === 'CreatureDied' || event.type === 'CreatureUnconscious') {
      const cId = event['id'] as EntityId;
      if (event.type === 'CreatureDied') {
        this.monsterInfo.delete(cId);
        this.hollowBorn.delete(cId);
      }
      let partyId = 0;
      const H = ctx.world.entities.get(cId, C.Hostile);
      if (H && H.partyId !== 0) {
        partyId = H.partyId;
      } else {
        for (const pId of ctx.world.entities.with(C.Party)) {
          const P = ctx.world.entities.get(pId, C.Party);
          if (P && P.members.includes(cId)) {
            partyId = pId;
            break;
          }
        }
      }
      if (event.type === 'CreatureDied' && ctx.world.entities.alive(cId) &&
          ctx.world.entities.has(cId, C.Creature) &&
          !ctx.world.entities.has(cId, C.Attributes) &&
          !ctx.world.entities.has(cId, C.Tame) &&
          !ctx.world.entities.has(cId, C.Wild)) {
        ctx.world.entities.destroy(cId);
      }
      if (partyId !== 0) {
        const P = ctx.world.entities.get(partyId, C.Party);
        if (P) {
          checkPartyCasualties(partyId, P, ctx);
        }
      }
    } else if (event.type === 'DeepsilverMined') {
      const tile = event['tile'] as TileIndex;
      handleDeepsilverMined(tile, ctx, this.deepsilverTiles, this.deepState, this.hollowBorn);
    } else if (event.type === 'TrapTriggered') {
      const cId = event['creatureId'] as EntityId;
      if (typeof cId === 'number') {
        const H = ctx.world.entities.get(cId, C.Hostile);
        if (H && H.stealthed) {
          H.stealthed = false;
          H.spotted = true;
          const P = H.partyId !== 0 ? ctx.world.entities.get(H.partyId, C.Party) : undefined;
          if (P?.purpose === 'thief') {
            ctx.emit({ type: 'ThiefSpotted', id: cId });
            P.state = 'retreat';
            P.stateSince = ctx.tick;
            P.outcome = 'withdrew';
          } else if (P?.purpose === 'ambush') {
            ctx.emit({ type: 'AmbushSprung', partyId: H.partyId });
            if (P) {
              P.state = 'engage';
              P.stateSince = ctx.tick;
            }
          }
        }
      }
    } else if (event.type === 'DoorBroken') {
      const doorId = event['id'] as EntityId;
      for (const m of ctx.world.entities.with(C.Hostile)) {
        const H = ctx.world.entities.get(m, C.Hostile);
        if (H && H.breakingDoorId === doorId) {
          H.breakingDoorId = 0;
          H.breakingSince = 0;
        }
      }
    } else if (event.type === 'TilesChanged') {
      for (const pId of ctx.world.entities.with(C.Party)) {
        const P = ctx.world.entities.get(pId, C.Party);
        if (P && (P.state === 'approach' || P.state === 'loiter')) {
          chooseGoal(P, ctx);
        }
      }
    }
  }

  override tick(ctx: TickContext): void {
    this.processArrivalsAndSpawns(ctx);
    stepThreatMembers(ctx);
    stepCavernMonsters(ctx, this.rng, this.monsterInfo);
    stepHollowBorn(ctx, this.hollowBorn);
    checkHollowWave(ctx, this.deepsilverTiles, this.deepState, this.hollowBorn);
    if (isDue(ctx.tick, THREATS_CADENCE, THREATS_PHASE)) {
      stepThreatParties(ctx);
    }
  }

  serialize(): ThreatsStateV1 {
    const schedEntries: [string, { nextTick: number; earliestTick: number; pendingSpawnTick: number }][] = [];
    for (const [k, e] of this.schedule) {
      schedEntries.push([k, { nextTick: e.nextTick, earliestTick: e.earliestTick, pendingSpawnTick: e.pendingSpawnTick }]);
    }

    const cavernSpawnCounts: [number, number][] = [];
    const speciesTable = this.registry?.table<{ id: string }>('creatures');
    if (speciesTable) {
      const speciesCounts = new Map<number, number>();
      for (const [id, info] of this.monsterInfo) {
        if (this.entities.alive(id)) {
          const idx = speciesTable.index(info.species);
          if (idx >= 0) {
            speciesCounts.set(idx, (speciesCounts.get(idx) ?? 0) + 1);
          }
        }
      }
      for (const [sp, c] of speciesCounts) {
        cavernSpawnCounts.push([sp, c]);
      }
    }

    return {
      stateVersion: 1,
      schedule: schedEntries,
      renown: this.renownVal,
      deepsilverTiles: [...this.deepsilverTiles],
      cavernSpawnCounts,
      webs: Array.from(this.webs.entries()),
      namedCaptains: [],
      pendingArrivals: [...this.pendingArrivals],
      pendingSpawns: [...this.pendingSpawns],
      ...(this.deepState.nextHollowWaveTick > 0 ? { nextHollowWaveTick: this.deepState.nextHollowWaveTick } : {}),
      ...(this.deepState.hollowWaveIndex > 0 ? { hollowWaveIndex: this.deepState.hollowWaveIndex } : {}),
      rng: this.rng.state(),
    };
  }

  deserialize(state: ThreatsStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.renownVal = state.renown;
    this.deepsilverTiles = [...state.deepsilverTiles];
    this.pendingArrivals = state.pendingArrivals ? [...state.pendingArrivals] : [];
    this.pendingSpawns = state.pendingSpawns ? [...state.pendingSpawns] : [];

    this.deepState.nextHollowWaveTick = state.nextHollowWaveTick ?? 0;
    this.deepState.hollowWaveIndex = state.hollowWaveIndex ?? 0;
    this.deepState.pressure = ctx.world.fortress?.deepPressure ?? 0;
    this.deepState.level = ctx.world.fortress?.deepLevel ?? 0;

    for (const [k, s] of state.schedule) {
      const entry = this.schedule.get(k);
      if (entry) {
        entry.nextTick = s.nextTick;
        entry.earliestTick = s.earliestTick;
        entry.pendingSpawnTick = s.pendingSpawnTick;
      }
    }

    this.webs = new Map(state.webs ?? []);
    for (const [tile] of this.webs) {
      ctx.world.map.setFlag(tile, TileFlag.Web, true);
    }
    this.monsterInfo.clear();
    this.hollowBorn.clear();
    const spTable = ctx.registry.table<{ id: string }>('creatures');
    for (const id of ctx.world.entities.with(C.Hostile)) {
      const H = ctx.world.entities.get(id, C.Hostile);
      if (H && H.role === 'cavern_monster') {
        const pos = ctx.world.entities.get(id, C.Position);
        const c = ctx.world.entities.get(id, C.Creature);
        if (pos && c) {
          const tier = cavernAt(pos.z);
          const spRow = spTable.byIndex(c.species);
          this.monsterInfo.set(id, {
            tier: tier > 0 ? tier : 1,
            species: spRow?.id ?? '',
            lairTile: ctx.world.map.index(pos.x, pos.y, pos.z),
            noTargetTicks: 0,
          });
        }
      } else if (H && H.role === 'hollow' && ctx.world.entities.alive(id)) {
        this.hollowBorn.add(id);
      }
    }

    this.rng.setState(state.rng);
  }
}
