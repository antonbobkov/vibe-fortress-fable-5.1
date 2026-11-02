/**
 * Runecraft: `02-systems/25-runecraft.md`. This system holds the rune of one's own (§ Rune of one's
 * own), the sanctum and its apprentices, the `attune` job and its mishaps (§ The sanctum).
 *
 * Order 25, last, and nearly idle: its tick does nothing yet; rune and sessions move on `HourPassed`
 * and `DayPassed`. Every draw is on stream `25` (`ctx.rng` is `world.rngFor('25')`), which 20's
 * caravan extras share, so the stream is saved in the `rng` section and not in this state.
 */

import { C } from '@core/components';
import type { CommandType } from '@core/command-types';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type TickContext, type WorldLike } from '@core/system';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { DwarvesReader } from '@systems/dwarves';
import { SANCTUM_APPRENTICES } from './constants';
import { MagicProducer, type MagicHost } from './producer';
import type { MagicReader, RuneView, SpellView } from './reader';
import { dropExpiredEffects, spellOfItem } from './cast';
import {
  MILLI,
  hoursToFull,
  metalPercent,
  metalPieces,
  mishapPermille,
  runeMaxMilli,
  runeRegenMilli,
  skillLevel,
} from './rune';
import type { MagicStateV1, MishapRecord } from './state';

export type { MagicReader, RuneView, SpellView } from './reader';
export type { MagicStateV1, MishapRecord } from './state';
export * from './constants';
export { mishapPermille, rollMishap, sessionXp, runeMaxMilli, runeRegenMilli, metalPercent, MISHAP_WEIGHTS } from './rune';

/** The zone type and the building tag the sanctum is made of. */
const SANCTUM = 'sanctum';
const RUNECRAFT = 'runecraft';
/** `runecraft` level of the first runecaster announcement. */
const FIRST_RUNECASTER_LEVEL = 10;

export class MagicSystem extends BaseSystem<MagicStateV1> implements MagicHost {
  readonly id = '25';
  readonly order = 25;
  override readonly subscribes: readonly EventType[] = ['HourPassed', 'DayPassed', 'SkillLevelUp', 'CreatureDied', 'ZoneChanged'];
  override readonly ownsCommands: readonly CommandType[] = ['SetSanctumApprentices'];

  /** Attune sessions today, by dwarf. */
  readonly sessions = new Map<EntityId, number>();
  /** The last mishap of each sanctum zone. */
  readonly lastMishaps = new Map<EntityId, MishapRecord>();
  firstRunecasterDone = false;
  /** The producer looks over every `attune` job for one that lost its reason. */
  sweepDue = true;
  /** Sanctum zones, from `ZoneChanged`; null until first read from 14 (a new game or a load). */
  private sanctumSet: Set<EntityId> | null = null;
  private worldRef: WorldLike | null = null;
  private readersRef: InitContext['readers'] | null = null;
  private rngRef: RngStream | null = null;
  private registryRef: InitContext['registry'] | null = null;

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('25 magic: used before init');
    return this.rngRef;
  }

  override init(ctx: InitContext): void {
    this.worldRef = ctx.world;
    this.readersRef = ctx.readers;
    this.registryRef = ctx.registry;
    this.rngRef = ctx.rng;
    ctx.register.jobProducer(new MagicProducer(this));
    ctx.register.inspector('creature', { id: 'rune', order: 13 });
    ctx.register.inspector('zone', { id: SANCTUM, order: 40 });
    ctx.register.inspector('item', { id: 'stone', order: 20 });
    // One line per kind; a scorched circle and a fire are alerts.
    for (const kind of ['singed', 'blackout', 'surge', 'scorched_circle', 'fire']) {
      const severity = kind === 'scorched_circle' || kind === 'fire' ? 'alert' : 'note';
      ctx.register.announcement('Mishap', { severity, stringKey: `announce.mishap_${kind}`, oneOf: { field: 'kind', values: [kind] } });
    }
    ctx.register.announcement('FirstRunecaster', { severity: 'note', stringKey: 'announce.first_runecaster' });
  }

  // ---------- the host the producer reads ----------

  private buildings(): BuildingsReader | null {
    const readers = this.readersRef;
    return readers !== null && readers.has('14') ? readers.of<BuildingsReader>('14') : null;
  }

  sanctumZones(): EntityId[] {
    if (this.sanctumSet === null) {
      const b = this.buildings();
      if (b === null) return [];
      this.sanctumSet = new Set(b.zonesOfType(SANCTUM));
    }
    return Array.from(this.sanctumSet).sort((a, b) => a - b);
  }

  /** A dwarf of the fortress who may sit in a sanctum: alive, a dwarf, an adult. */
  private eligible(id: EntityId): boolean {
    const world = this.worldRef;
    const readers = this.readersRef;
    if (world === null || readers === null || typeof id !== 'number' || !world.entities.alive(id)) return false;
    if (!world.entities.has(id, C.Brain) || !world.entities.has(id, C.Labors)) return false;
    if (world.entities.get(id, C.Creature)?.faction !== 'fortress') return false;
    return true;
  }

  private isChild(id: EntityId): boolean {
    const readers = this.readersRef;
    return readers !== null && readers.has('10') && readers.of<DwarvesReader>('10').isChild(id);
  }

  apprenticesOf(zoneId: EntityId): EntityId[] {
    const raw = this.buildings()?.zone(zoneId)?.settings['apprentices'];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[]).filter((id): id is EntityId => typeof id === 'number' && this.eligible(id) && !this.isChild(id))
      .sort((a, b) => a - b);
  }

  sessionsOf(id: EntityId): number {
    return this.sessions.get(id) ?? 0;
  }

  countSession(id: EntityId): void {
    this.sessions.set(id, this.sessionsOf(id) + 1);
  }

  noteMishap(zoneId: EntityId, record: MishapRecord): void {
    this.lastMishaps.set(zoneId, record);
    if (record.kind === 'scorched_circle') this.sweepDue = true;
  }

  // ---------- commands ----------

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type !== 'SetSanctumApprentices') return reject('not_found');
    const zoneId = cmd['zoneId'];
    const b = this.buildings();
    if (b === null || typeof zoneId !== 'number' || b.zone(zoneId)?.type !== SANCTUM) return reject('not_found');
    const raw = cmd['dwarfIds'];
    if (!Array.isArray(raw)) return reject('not_found');
    const ids = raw as unknown[];
    for (const id of ids) if (typeof id !== 'number' || !this.eligible(id)) return reject('not_found');
    for (const id of ids) if (this.isChild(id as EntityId)) return reject('not_adult');
    if (new Set(ids).size !== ids.length || ids.length > SANCTUM_APPRENTICES) return reject('member_limit');
    const dwarfIds = (ids as EntityId[]).slice().sort((a, c) => a - c);
    // 14's zone component holds the setting, as 17's `SetHospitalSupplies` keeps its own.
    const zone = ctx.world.entities.get(zoneId, C.Zone);
    if (zone === undefined) return reject('not_found');
    ctx.world.entities.add(zoneId, C.Zone, { ...zone, settings: { ...zone.settings, apprentices: dwarfIds } });
    for (const id of dwarfIds) ctx.jobs.setLabor?.(id, 'attunement', true);
    this.sweepDue = true;
    return OK;
  }

  // ---------- events ----------

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'HourPassed') {
      this.regenerate(ctx);
      dropExpiredEffects(ctx.world.entities, ctx.tick);
      this.sweepDue = true;
    } else if (event.type === 'DayPassed') {
      this.sessions.clear();
    } else if (event.type === 'SkillLevelUp') {
      this.levelUp(event, ctx);
    } else if (event.type === 'CreatureDied') {
      this.sessions.delete(event['id'] as EntityId);
      this.sweepDue = true;
    } else if (event.type === 'ZoneChanged' && event['zoneType'] === SANCTUM) {
      const zoneId = event['zoneId'] as EntityId;
      if (event['change'] === 'removed') {
        this.sanctumSet?.delete(zoneId);
        this.lastMishaps.delete(zoneId);
      } else {
        this.sanctumSet?.add(zoneId);
      }
      this.sweepDue = true;
    }
  }

  /** `SkillLevelUp` of `runecraft`: a first level gives the `Rune`; level 10 may be the first runecaster. */
  private levelUp(event: GameEvent, ctx: TickContext): void {
    if (event['skill'] !== RUNECRAFT) return;
    const id = event['id'] as EntityId;
    const level = event['level'] as number;
    const entities = ctx.world.entities;
    if (!entities.alive(id)) return;
    if (level >= 1 && !entities.has(id, C.Rune)) entities.add(id, C.Rune, { current: 0 });
    if (level >= FIRST_RUNECASTER_LEVEL && !this.firstRunecasterDone) {
      this.firstRunecasterDone = true;
      ctx.emit({ type: 'FirstRunecaster', id });
    }
  }

  /** `HourPassed`: every `Rune` on a creature without `Hostile` gains its regen, capped at its max. */
  private regenerate(ctx: TickContext): void {
    const entities = ctx.world.entities;
    for (const id of entities.with(C.Rune)) {
      if (!entities.alive(id) || entities.has(id, C.Hostile)) continue;
      const view = this.runeOf(id);
      const rune = entities.get(id, C.Rune);
      if (view === undefined || rune === undefined || rune.current >= view.max) continue;
      const next = Math.min(view.max, rune.current + view.regen);
      if (next !== rune.current) entities.add(id, C.Rune, { ...rune, current: next });
    }
  }

  private runeOf(id: EntityId): RuneView | undefined {
    const world = this.worldRef;
    const registry = this.registryRef;
    if (world === null || registry === null) return undefined;
    const rune = world.entities.get(id, C.Rune);
    if (rune === undefined) return undefined;
    const level = skillLevel(world.entities, registry, id, RUNECRAFT);
    const pieces = metalPieces(world.entities, registry, id);
    const metal = metalPercent(pieces.length);
    const max = runeMaxMilli(level);
    const regen = runeRegenMilli(level, metal);
    return { current: rune.current, max, regen, metalPercent: metal, metalPieces: pieces, hoursToFull: hoursToFull(rune.current, max, regen) };
  }

  override reader(): MagicReader {
    return {
      rune: (id) => this.runeOf(id),
      sanctums: () => this.sanctumZones(),
      apprentices: (zoneId) => this.apprenticesOf(zoneId),
      sessionsToday: (id) => this.sessionsOf(id),
      mishapPermille: (zoneId, id) => {
        const world = this.worldRef;
        const registry = this.registryRef;
        const level = world === null || registry === null ? 0 : skillLevel(world.entities, registry, id, RUNECRAFT);
        return mishapPermille(level, this.buildings()?.room(zoneId)?.tier ?? 0);
      },
      lastMishap: (zoneId) => {
        const record = this.lastMishaps.get(zoneId);
        return record === undefined ? undefined : { ...record };
      },
      canCast: (id) => this.canCast(id),
      spellOf: (itemId) => this.spellOf(itemId),
      effects: (id) => {
        const world = this.worldRef;
        const bound = world === null ? undefined : world.entities.get(id, C.Spellbound);
        const tick = world === null ? 0 : world.calendar.tick;
        return bound === undefined ? [] : bound.effects.filter((e) => e.until > tick).map((e) => ({ ...e }));
      },
    };
  }

  private spellOf(itemId: EntityId): SpellView | undefined {
    const world = this.worldRef;
    const registry = this.registryRef;
    if (world === null || registry === null) return undefined;
    const cs = spellOfItem(world.entities, registry, itemId);
    if (cs === undefined) return undefined;
    return {
      id: cs.spell.id,
      name: cs.spell.name,
      kind: cs.spell.kind,
      cost: cs.spell.cost,
      range: cs.range,
      damage: cs.damage,
      type: cs.spell.type ?? '',
      ticks: cs.ticks,
      power: cs.power,
      suffix: cs.spell.suffix,
    };
  }

  /** The creature's held weapon is a channel whose spell its rune covers now. */
  private canCast(id: EntityId): boolean {
    const world = this.worldRef;
    if (world === null) return false;
    const rune = world.entities.get(id, C.Rune);
    const weapon = world.entities.get(id, C.Equipment)?.weapon ?? 0;
    if (rune === undefined || weapon === 0) return false;
    const spell = this.spellOf(weapon);
    return spell !== undefined && rune.current >= spell.cost * MILLI;
  }

  serialize(): MagicStateV1 {
    const sessions = Array.from(this.sessions).filter(([, n]) => n > 0).sort(([a], [b]) => a - b);
    const mishaps = Array.from(this.lastMishaps).sort(([a], [b]) => a - b).map(([id, r]): [EntityId, MishapRecord] => [id, { ...r }]);
    return {
      stateVersion: 1,
      ...(sessions.length === 0 ? {} : { sessionsToday: sessions }),
      ...(this.firstRunecasterDone ? { firstRunecasterDone: true } : {}),
      ...(mishaps.length === 0 ? {} : { lastMishaps: mishaps }),
    };
  }

  deserialize(state: MagicStateV1, ctx: InitContext): void {
    if (this.rngRef === null) this.init(ctx);
    this.sessions.clear();
    for (const [id, n] of state.sessionsToday ?? []) this.sessions.set(id, n);
    this.firstRunecasterDone = state.firstRunecasterDone === true;
    this.lastMishaps.clear();
    for (const [id, r] of state.lastMishaps ?? []) this.lastMishaps.set(id, { ...r });
    this.sanctumSet = null;
    this.sweepDue = true;
  }
}
