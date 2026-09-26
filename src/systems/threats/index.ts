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
import type { Edge, EntityId } from '@core/types';
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
  ];

  private rng!: RngStream;
  private spec: LocalMapSpec | null = null;
  private peril = 0;
  private traits: readonly string[] = [];
  private schedule = new Map<string, ThreatScheduleEntry>();
  private renownVal = 0;
  private deepPressureVal = 0;
  private deepLevelVal = 0;
  private deepsilverTiles: number[] = [];
  private pendingArrivals: PendingArrivalState[] = [];
  private pendingSpawns: PendingSpawnState[] = [];
  private readerRef: ThreatsReader | null = null;

  constructor(private readonly options: { spec?: LocalMapSpec } = {}) {
    super();
  }

  override init(ctx: InitContext): void {
    this.rng = ctx.rng;
    this.spec = this.options.spec ?? null;
    this.peril = this.spec?.peril ?? 0;
    this.traits = this.spec?.traits ?? [];

    this.schedule = initScheduleAtEmbark(ctx.registry, this.peril, this.traits, this.rng);

    this.readerRef = makeThreatsReader(
      ctx.world.entities,
      () => this.renownVal,
      () => this.schedule,
      () => this.deepPressureVal,
      () => this.deepLevelVal,
    );
    ctx.register.panel({ id: 'threats', title: 'Threats', hotkey: 'm' });
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
    } else if (event.type === 'HourPassed') {
      this.processArrivalsAndSpawns(ctx);
    } else if (event.type === 'WealthChanged' || event.type === 'ImmigrantsArrived' || event.type === 'DwarfDied') {
      this.updateRenown(ctx);
    } else if (event.type === 'CreatureDied' || event.type === 'CreatureUnconscious') {
      const cId = event['id'] as EntityId;
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
      if (partyId !== 0) {
        const P = ctx.world.entities.get(partyId, C.Party);
        if (P) {
          checkPartyCasualties(partyId, P, ctx);
        }
      }
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
    if (isDue(ctx.tick, THREATS_CADENCE, THREATS_PHASE)) {
      stepThreatParties(ctx);
    }
  }

  serialize(): ThreatsStateV1 {
    const schedEntries: [string, { nextTick: number; earliestTick: number; pendingSpawnTick: number }][] = [];
    for (const [k, e] of this.schedule) {
      schedEntries.push([k, { nextTick: e.nextTick, earliestTick: e.earliestTick, pendingSpawnTick: e.pendingSpawnTick }]);
    }

    return {
      stateVersion: 1,
      schedule: schedEntries,
      renown: this.renownVal,
      deepsilverTiles: [...this.deepsilverTiles],
      cavernSpawnCounts: [],
      webs: [],
      namedCaptains: [],
      pendingArrivals: [...this.pendingArrivals],
      pendingSpawns: [...this.pendingSpawns],
      rng: this.rng.state(),
    };
  }

  deserialize(state: ThreatsStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.renownVal = state.renown;
    this.deepsilverTiles = [...state.deepsilverTiles];
    this.pendingArrivals = state.pendingArrivals ? [...state.pendingArrivals] : [];
    this.pendingSpawns = state.pendingSpawns ? [...state.pendingSpawns] : [];

    for (const [k, s] of state.schedule) {
      const entry = this.schedule.get(k);
      if (entry) {
        entry.nextTick = s.nextTick;
        entry.earliestTick = s.earliestTick;
        entry.pendingSpawnTick = s.pendingSpawnTick;
      }
    }

    this.rng.setState(state.rng);
  }
}
