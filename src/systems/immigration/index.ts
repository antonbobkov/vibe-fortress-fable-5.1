/** 21 Immigration: seasonal evaluation and staggered arrivals. */
import { C } from '@core/components';
import { SEASON_NAMES, seasonOf, yearOf } from '@core/calendar';
import type { Command, CommandResult } from '@core/commands';
import { OK, reject } from '@core/commands';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EventType } from '@core/event-types';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import type { World } from '@core/world';
import type { LocalMapSpec } from '@systems/embark/spec';
import { arrivalTame } from '@systems/embark';
import { ADULT_AGE_YEARS } from '@systems/dwarves/constants';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { equipStartingClothes } from '@systems/dwarves/clothing';
import type { DwarvesReader } from '@systems/dwarves/reader';
import type { MoraleReader } from '@systems/morale/reader';
import type { ItemsReader } from '@systems/items/reader';
import type { ThreatsReader } from '@systems/threats/reader';
import { findEdgeTiles } from '@systems/threats/parties';
import { AMMO_FETCH } from '@systems/foraging/constants';
import { ARRIVAL_INTERVAL_TICKS, IMMIGRATION_PERMILLE, IMMIGRATION_SPIRIT_MIN, POPULATION_CAP_MAX, POPULATION_CAP_MIN, REP_PERMILLE_PER_POINT, TOOL_STOCK_MIN, WEALTH_PER_WAVE } from './constants';
import type { ImmigrationReader } from './reader';
import type { ImmigrationStateV1, PendingWave, PlannedImmigrant } from './state';
import { coverage, guaranteedSize, planWave, waveSize } from './waves';

export * from './constants';
export * from './waves';
export type { ImmigrationReader } from './reader';
export type { ImmigrationStateV1 } from './state';

export class ImmigrationSystem extends BaseSystem<ImmigrationStateV1> {
  readonly id = '21';
  readonly order = 21;
  override readonly ownsCommands = ['SetPopulationCap'] as const;
  override readonly subscribes: readonly EventType[] = ['SeasonChanged', 'DayPassed', 'RaidArrived', 'RaidEnded'];
  private rng!: RngStream;
  private wavesSoFarState = 0;
  private guaranteedDone: [boolean, boolean] = [false, false];
  private lastWaveState: { tick: number; count: number } | null = null;
  private deferredUntilTick = 0;
  private deferredSeason = -1;
  private deferredYear = 0;
  private lastSkip: string | null = null;
  private pending: PendingWave | null = null;
  private raidOngoing = false;
  private readerRef!: ImmigrationReader;

  constructor(private readonly spec: LocalMapSpec | null = null) { super(); }

  override init(ctx: InitContext): void {
    this.rng = ctx.rng;
    this.readerRef = {
      cap: () => ctx.world.fortress.populationCap,
      wavesSoFar: () => this.wavesSoFarState,
      lastWave: () => this.lastWaveState && { ...this.lastWaveState },
      eligibility: () => this.eligibility(ctx, seasonOf(ctx.world.calendar.tick), yearOf(ctx.world.calendar.tick)),
      nextEvaluation: () => SEASON_NAMES[(seasonOf(ctx.world.calendar.tick) + 1) % SEASON_NAMES.length] ?? 'spring',
      lastSkipReason: () => this.lastSkip,
    };
    ctx.register.announcement('ImmigrantsArrived', { severity: 'alert', stringKey: 'announce.immigrants_arrived' });
    ctx.register.announcement('ImmigrationSkipped', { severity: 'note', stringKey: 'announce.immigration_skipped' });
  }

  override reader(): ImmigrationReader { return this.readerRef; }

  private raidActive(ctx: InitContext): boolean {
    const threats = ctx.readers.of<ThreatsReader>('18');
    return threats.activeParties().some((id) => {
      const p = threats.party(id);
      return p?.purpose === 'raid' || p?.purpose === 'siege';
    });
  }

  private eligibility(ctx: InitContext, season: number, year: number): { eligible: boolean; reasons: string[] } {
    const population = ctx.readers.of<DwarvesReader>('10').population();
    if (population === 0) return { eligible: false, reasons: ['no_population'] };
    if (this.raidActive(ctx)) return { eligible: false, reasons: ['raid'] };
    const cap = ctx.world.fortress.populationCap;
    if (cap <= population) return { eligible: false, reasons: ['cap'] };
    const guaranteed = year === 1 && ((season === 1 && !this.guaranteedDone[0]) || (season === 2 && !this.guaranteedDone[1]));
    if (guaranteed) return { eligible: true, reasons: [] };
    const reasons: string[] = [];
    if (ctx.readers.of<MoraleReader>('15').hallSpirit() < IMMIGRATION_SPIRIT_MIN) reasons.push('spirit');
    if (ctx.readers.of<ItemsReader>('13').wealth() < WEALTH_PER_WAVE * this.wavesSoFarState) reasons.push('wealth');
    if (season === 3 && (this.spec?.temper ?? 0) >= 2) reasons.push('winter');
    return { eligible: reasons.length === 0, reasons };
  }

  private evaluate(ctx: TickContext, season: number, year: number): void {
    if (ctx.readers.of<DwarvesReader>('10').population() === 0) return;
    if (this.raidActive(ctx)) {
      this.raidOngoing = true;
      this.deferredUntilTick = ctx.tick + TICKS_PER_DAY;
      this.deferredSeason = season;
      this.deferredYear = year;
      return;
    }
    this.deferredUntilTick = 0;
    this.raidOngoing = false;
    const eligible = this.eligibility(ctx, season, year);
    if (!eligible.eligible) {
      this.skip(ctx, eligible.reasons[0] ?? 'cap');
      return;
    }
    const population = ctx.readers.of<DwarvesReader>('10').population();
    const remaining = ctx.world.fortress.populationCap - population;
    const guaranteedIndex = year === 1 && season === 1 && !this.guaranteedDone[0] ? 0
      : year === 1 && season === 2 && !this.guaranteedDone[1] ? 1 : -1;
    let size: number;
    if (guaranteedIndex >= 0) {
      size = guaranteedSize(this.rng, remaining);
      if (guaranteedIndex === 0) this.guaranteedDone[0] = true;
      else this.guaranteedDone[1] = true;
    } else {
      const rep = ctx.world.fortress.reputation.mountainhome ?? 0;
      if (!this.rng.chance(IMMIGRATION_PERMILLE + rep * REP_PERMILLE_PER_POINT)) { this.skip(ctx, 'luck'); return; }
      const morale = ctx.readers.of<MoraleReader>('15');
      size = waveSize(ctx.readers.of<ItemsReader>('13').wealth(), morale.hallSpiritTier(), rep, remaining, season === 3);
    }
    if (size <= 0) { this.skip(ctx, 'cap'); return; }
    this.startWave(ctx, size, guaranteedIndex >= 0);
  }

  private skip(ctx: TickContext, reason: string): void {
    this.lastSkip = reason;
    ctx.emit({ type: 'ImmigrationSkipped', reason });
  }

  private startWave(ctx: TickContext, size: number, guaranteed: boolean): void {
    const dwarves = ctx.readers.of<DwarvesReader>('10');
    const adultSkills = dwarves.adults().map((id) => Object.fromEntries(
      ctx.registry.table('skills').ids().map((skill) => [skill, dwarves.skill(id, skill)]),
    ));
    const covered = coverage(ctx.registry, adultSkills);
    const taken = new Set(dwarves.list().map((id) => ctx.world.entities.get(id, C.Creature)?.name ?? ''));
    const planned = planWave(ctx.registry, this.rng, size, covered, taken);
    const edge = this.spec?.civEdges.mountainhome ?? 'n';
    const tiles = findEdgeTiles(ctx.world.map, edge, planned.length);
    for (let i = 0; i < planned.length; i += 1) (planned[i] as PlannedImmigrant).tile = tiles[i] as number;
    this.pending = { planned, ids: [], nextIndex: 0, nextSpawnTick: ctx.tick, guaranteed };
    this.wavesSoFarState += 1;
    this.lastSkip = null;
    this.spawnNext(ctx);
  }

  private materialFor(ctx: TickContext, itemType: string): number {
    const types = ctx.registry.table<{ id: string; materials: string[] | string }>('items');
    const materials = ctx.registry.table<{ id: string; class: string }>('materials');
    const allowed = types.byId(itemType)?.materials;
    const choices = Array.isArray(allowed) ? allowed : typeof allowed === 'string' ? [allowed] : [];
    const material = materials.ids().find((id) => choices.includes(id) || choices.includes(materials.byId(id)?.class ?? ''));
    return material ? materials.index(material) : 0;
  }

  private equipTool(ctx: TickContext, id: EntityId, member: PlannedImmigrant): void {
    const tool = member.profession === 'miner' ? 'pick' : member.profession === 'woodcutter_carpenter' ? 'axe'
      : member.profession === 'hunter' ? 'crossbow' : '';
    if (!tool || ctx.readers.of<ItemsReader>('13').count(tool) >= TOOL_STOCK_MIN) return;
    const material = this.materialFor(ctx, tool);
    if (!material) return;
    const itemId = ctx.spawn.item(ctx.registry.table('items').index(tool), material, member.tile);
    ctx.world.services.items?.attachToCarrier(itemId, id);
    const equipment = ctx.world.entities.get(id, C.Equipment);
    if (equipment) ctx.world.entities.add(id, C.Equipment, { ...equipment, weapon: itemId });
    if (tool === 'crossbow') {
      const boltMaterial = this.materialFor(ctx, 'bolt');
      if (boltMaterial) {
        const bolts = ctx.spawn.item(ctx.registry.table('items').index('bolt'), boltMaterial, member.tile, AMMO_FETCH);
        ctx.world.services.items?.attachToCarrier(bolts, id);
        const current = ctx.world.entities.get(id, C.Equipment);
        if (current) ctx.world.entities.add(id, C.Equipment, { ...current, quiver: bolts });
      }
    }
  }

  private spawnNext(ctx: TickContext): void {
    const wave = this.pending;
    if (!wave) return;
    const member = wave.planned[wave.nextIndex];
    if (!member) return;
    const record = member.record;
    const id = ctx.spawn.creature(ctx.registry.table('creatures').index('dwarf'), member.tile, 'fortress', {
      name: record.name, sex: record.sex, ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: record.ageYears < ADULT_AGE_YEARS,
      dwarf: dwarfComponents(record, ctx.registry, ctx.world.rngFor('10'), 'none'),
    });
    equipStartingClothes(ctx.world as World, id, member.tile);
    this.equipTool(ctx, id, member);
    wave.ids.push(id);
    if (member.spouseIndex >= 0 && member.spouseIndex < wave.ids.length) {
      const spouse = wave.ids[member.spouseIndex] as EntityId;
      for (const [a, b] of [[id, spouse], [spouse, id]] as const) {
        const relationships = ctx.world.entities.get(a, C.Relationships);
        if (relationships) ctx.world.entities.add(a, C.Relationships, { ...relationships, spouse: b, friends: [...relationships.friends, b] });
      }
    }
    if (member.pet) {
      const pet = ctx.spawn.creature(ctx.registry.table('creatures').index(member.pet), member.tile, 'fortress');
      ctx.world.entities.add(pet, C.Tame, { ...arrivalTame('none'), petOf: id });
      const relationships = ctx.world.entities.get(id, C.Relationships);
      if (relationships) ctx.world.entities.add(id, C.Relationships, { ...relationships, pets: [...relationships.pets, pet] });
    }
    wave.nextIndex += 1;
    if (wave.nextIndex < wave.planned.length) {
      wave.nextSpawnTick = ctx.tick + ARRIVAL_INTERVAL_TICKS;
      return;
    }
    this.lastWaveState = { tick: ctx.tick, count: wave.ids.length };
    ctx.emit({ type: 'ImmigrantsArrived', ids: wave.ids.slice(), count: wave.ids.length,
      children: wave.planned.filter((entry) => entry.record.ageYears < ADULT_AGE_YEARS).length, guaranteed: wave.guaranteed });
    this.pending = null;
  }

  override tick(ctx: TickContext): void {
    if (this.pending === null || this.raidOngoing || ctx.tick < this.pending.nextSpawnTick) return;
    this.spawnNext(ctx);
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'RaidArrived') this.raidOngoing = true;
    else if (event.type === 'RaidEnded') this.raidOngoing = this.raidActive(ctx);
    else if (event.type === 'SeasonChanged') this.evaluate(ctx, event['season'] as number, event['year'] as number);
    else if (event.type === 'DayPassed' && this.deferredUntilTick > 0 && ctx.tick >= this.deferredUntilTick) this.evaluate(ctx, this.deferredSeason, this.deferredYear);
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type !== 'SetPopulationCap') return reject('not_found');
    const n = cmd['n'];
    if (!Number.isInteger(n)) return reject('bad_setting');
    ctx.world.fortress.populationCap = Math.max(POPULATION_CAP_MIN, Math.min(POPULATION_CAP_MAX, n as number));
    return OK;
  }

  serialize(): ImmigrationStateV1 {
    return { stateVersion: 1, wavesSoFar: this.wavesSoFarState, guaranteedDone: [...this.guaranteedDone],
      lastWave: this.lastWaveState && { ...this.lastWaveState }, deferredUntilTick: this.deferredUntilTick,
      deferredSeason: this.deferredSeason, deferredYear: this.deferredYear, lastSkipReason: this.lastSkip,
      pending: this.pending && structuredClone(this.pending), raidOngoing: this.raidOngoing, rng: this.rng.state() };
  }

  deserialize(state: ImmigrationStateV1, ctx: InitContext): void {
    if (!this.readerRef) this.init(ctx);
    this.wavesSoFarState = state.wavesSoFar;
    this.guaranteedDone = [...state.guaranteedDone];
    this.lastWaveState = state.lastWave && { ...state.lastWave };
    this.deferredUntilTick = state.deferredUntilTick;
    this.deferredSeason = state.deferredSeason;
    this.deferredYear = state.deferredYear;
    this.lastSkip = state.lastSkipReason;
    this.pending = state.pending && structuredClone(state.pending);
    this.raidOngoing = state.raidOngoing ?? false;
    this.rng.setState(state.rng);
  }
}
