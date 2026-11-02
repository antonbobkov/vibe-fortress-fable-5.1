/**
 * Runecraft: `02-systems/25-runecraft.md`. This system holds the rune of one's own (§ Rune of one's
 * own), the sanctum and its apprentices, the `attune` job and its mishaps (§ The sanctum).
 *
 * Casting rides in 16's creature loop (`cast.ts`). Order 25, last, and nearly idle: its tick only
 * blooms the Fireblooms that are due, and returns at once when none is queued; rune, vials and
 * sessions move on `HourPassed` and `DayPassed`. Every draw is on stream `25` (`ctx.rng` is
 * `world.rngFor('25')`), which 20's caravan extras share, so the stream is saved in the `rng`
 * section and not in this state.
 */

import { C, type Rune, type Summoned } from '@core/components';
import type { CommandType } from '@core/command-types';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import { BaseSystem, type InitContext, type MagicApi, type TickContext, type WorldLike } from '@core/system';
import type { EntityId } from '@core/types';
import { resolveProjectileHit, type WieldedWeapon } from '@systems/combat';
import type { BuildingsReader } from '@systems/buildings/reader';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import { SANCTUM_APPRENTICES } from './constants';
import { MagicProducer, type MagicHost } from './producer';
import type { MagicReader, RuneView, SpellView } from './reader';
import { dropExpiredEffects, spellOfItem } from './cast';
import { summonSpecies, summonsOf } from './summon';
import { enchantOfItem } from './enchant';
import { draughtRestLeft, soldierDrinks, soldiersOnDuty } from './draughts';
import {
  MILLI,
  hoursToFull,
  metalPercent,
  metalPieces,
  mishapPermille,
  runeGear,
  runeMaxMilli,
  runeRegenMilli,
  skillLevel,
} from './rune';
import type { Bloom, MagicStateV1, MishapRecord } from './state';

export type { MagicReader, RuneView, SpellView } from './reader';
export type { EnchantView, EnchantEffectView } from './enchant';
export { effectAtTier } from './enchant';
export type { MagicStateV1, MishapRecord } from './state';
export * from './constants';
export { mishapPermille, rollMishap, sessionXp, runeMaxMilli, runeRegenMilli, metalPercent, MISHAP_WEIGHTS } from './rune';

/** The zone type and the building tag the sanctum is made of. */
const SANCTUM = 'sanctum';
const RUNECRAFT = 'runecraft';
/** `runecraft` level of the first runecaster announcement. */
const FIRST_RUNECASTER_LEVEL = 10;

export class MagicSystem extends BaseSystem<MagicStateV1> implements MagicHost, MagicApi {
  readonly id = '25';
  readonly order = 25;
  override readonly subscribes: readonly EventType[] = [
    'HourPassed', 'DayPassed', 'SkillLevelUp', 'CreatureDied', 'ZoneChanged', 'RaidArrived', 'AmbushSprung', 'AttackResolved',
  ];
  override readonly ownsCommands: readonly CommandType[] = ['SetSanctumApprentices'];

  /** Attune sessions today, by dwarf. */
  readonly sessions = new Map<EntityId, number>();
  /** The last mishap of each sanctum zone. */
  readonly lastMishaps = new Map<EntityId, MishapRecord>();
  firstRunecasterDone = false;
  /** Fireblooms cast and not yet bloomed, in the order they were cast. */
  readonly pendingBlooms: Bloom[] = [];
  /** Casters whose firebloom has caught a fortress creature today: announced once a day each. */
  readonly bloomAlertsToday = new Set<EntityId>();
  /** The producer looks over every `attune` job for one that lost its reason. */
  sweepDue = true;
  /** `DayPassed`: the producer looks for Miserable dwarves to give a calming draught (§ Draughts). */
  calmDue = false;
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
    ctx.world.services.magic = this;
    ctx.register.jobProducer(new MagicProducer(this));
    ctx.register.inspector('creature', { id: 'rune', order: 13 });
    ctx.register.inspector('zone', { id: SANCTUM, order: 40 });
    ctx.register.inspector('item', { id: 'stone', order: 20 });
    // One line per kind; a scorched circle and a fire are alerts.
    for (const kind of ['singed', 'blackout', 'surge', 'wisp_loose', 'scorched_circle', 'fire']) {
      const severity = kind === 'scorched_circle' || kind === 'fire' ? 'alert' : 'note';
      ctx.register.announcement('Mishap', { severity, stringKey: `announce.mishap_${kind}`, oneOf: { field: 'kind', values: [kind] } });
    }
    ctx.register.announcement('FirstRunecaster', { severity: 'note', stringKey: 'announce.first_runecaster' });
    // 12 emits a setting; only a masterwork one is told.
    ctx.register.announcement('StoneSet', { severity: 'note', stringKey: 'announce.stone_set', oneOf: { field: 'tier', values: [5] } });
    ctx.register.announcement('RuneSpent', { severity: 'note', stringKey: 'announce.rune_spent' });
    ctx.register.announcement('SpellCast', { severity: 'alert', stringKey: 'announce.firebloom_burned', oneOf: { field: 'burned', values: [true] } });
    ctx.register.announcement('SummonTurned', { severity: 'danger', stringKey: 'announce.summon_turned' });
  }

  // ---------- the casting API 16's ranged branch writes through ----------

  addBloom(bloom: Bloom): void {
    this.pendingBlooms.push({ ...bloom });
  }

  /**
   * § Spells, Firebloom: at its tick a bloom strikes every creature in the 3×3 around its tile, on
   * its level, whatever its faction, as a missile of `raw` `ember` with no hit roll: a shield may
   * block it and armour counts. Draws on stream 25. A bloom that catches a creature of the caster's
   * faction emits `SpellCast { burned: true }`, once a day per caster.
   */
  override tick(ctx: TickContext): void {
    if (this.pendingBlooms.length === 0) return;
    const due = this.pendingBlooms.filter((b) => b.at <= ctx.tick);
    if (due.length === 0) return;
    const rest = this.pendingBlooms.filter((b) => b.at > ctx.tick);
    this.pendingBlooms.length = 0;
    this.pendingBlooms.push(...rest);
    for (const bloom of due) this.bloom(ctx, bloom);
  }

  private bloom(ctx: TickContext, bloom: Bloom): void {
    const entities = ctx.world.entities;
    const map = ctx.world.map;
    if (!map.validIndex(bloom.tile)) return;
    const cx = map.xOf(bloom.tile);
    const cy = map.yOf(bloom.tile);
    const z = map.zOf(bloom.tile);
    const struck: EntityId[] = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (!map.inBounds(cx + dx, cy + dy, z)) continue;
        for (const id of ctx.readers.spatial.at(map.index(cx + dx, cy + dy, z))) {
          if (entities.alive(id) && entities.has(id, C.Creature) && entities.has(id, C.Body)) struck.push(id);
        }
      }
    }
    struck.sort((a, b) => a - b);
    const faction = entities.get(bloom.casterId, C.Creature)?.faction ?? 'fortress';
    const firebloom = ctx.registry.table<{ id: string; kind: string }>('spells').rows.find((r) => r?.kind === 'burst')?.id ?? 'firebloom';
    const weaponDef = { skill: RUNECRAFT, size: 0 } as unknown as WieldedWeapon['weaponDef'];
    let burned = 0;
    for (const id of struck) {
      if (!entities.alive(id)) continue;
      const own = entities.get(id, C.Creature)?.faction === faction;
      // Only a hit counts as burning one of its own: a shield's block or armour that takes it all does not.
      const dealt = resolveProjectileHit(ctx, entities, ctx.registry, ctx.rng, bloom.casterId, id, bloom.raw, 'ember', weaponDef);
      if (burned === 0 && own && dealt > 0) burned = id;
    }
    if (burned !== 0 && !this.bloomAlertsToday.has(bloom.casterId)) {
      this.bloomAlertsToday.add(bloom.casterId);
      ctx.emit({ type: 'SpellCast', casterId: bloom.casterId, spellId: firebloom, targetId: burned, tile: bloom.tile, burned: true });
    }
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

  tileOf(id: EntityId): number {
    const world = this.worldRef;
    const p = world?.entities.get(id, C.Position);
    return world === null || p === undefined ? -1 : world.map.index(p.x, p.y, p.z);
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
      fadeSummons(ctx);
      this.sweepDue = true;
    } else if (event.type === 'DayPassed') {
      this.calmDue = true;
      this.sessions.clear();
      this.bloomAlertsToday.clear();
      clearVialsToday(ctx);
    } else if (event.type === 'RaidArrived' || event.type === 'AmbushSprung') {
      // § Draughts: every soldier on duty drinks its first listed `raid` draught.
      for (const id of soldiersOnDuty(ctx.world.entities)) soldierDrinks(ctx, id, 'raid');
    } else if (event.type === 'AttackResolved') {
      this.hitTaken(event, ctx);
    } else if (event.type === 'SkillLevelUp') {
      this.levelUp(event, ctx);
    } else if (event.type === 'CreatureDied') {
      this.sessions.delete(event['id'] as EntityId);
      this.sweepDue = true;
      bringFadeForward(ctx, event['id'] as EntityId);
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

  /** § Draughts: a hit on a soldier on duty whose blood is below half, who may drink a `wounded` draught. */
  private hitTaken(event: GameEvent, ctx: TickContext): void {
    if (event['outcome'] !== 'hit') return;
    const id = event['defenderId'] as EntityId;
    const entities = ctx.world.entities;
    if (entities.get(id, C.Soldier)?.onDuty !== true) return;
    const body = entities.get(id, C.Body);
    if (body === undefined || body.blood * 2 >= body.maxBlood) return;
    soldierDrinks(ctx, id, 'wounded');
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
      if (view === undefined || rune === undefined || (rune.current >= view.max && rune.outAnnounced !== true)) continue;
      const next = Math.max(rune.current, Math.min(view.max, rune.current + view.regen));
      // § Spells: regen that lifts the rune over its spell's cost ends the `RuneSpent` silence.
      const lifted = rune.outAnnounced === true && next >= (this.heldSpellCost(id) ?? 0);
      if (lifted) {
        const { outAnnounced: _out, ...rest } = rune;
        entities.add<Rune>(id, C.Rune, { ...rest, current: next });
      } else if (next !== rune.current) {
        entities.add<Rune>(id, C.Rune, { ...rune, current: next });
      }
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
    const gear = runeGear(world.entities, registry, id);
    const max = runeMaxMilli(level, gear.maxBonus);
    const regen = runeRegenMilli(level, metal, gear.regenPercent);
    return {
      current: rune.current, max, regen, metalPercent: metal, metalPieces: pieces, robePercent: gear.regenPercent,
      maxBonus: gear.maxBonus, hoursToFull: hoursToFull(rune.current, max, regen),
      vials: this.vialsCarried(id), vialsToday: rune.vialsToday ?? 0,
    };
  }

  /** Rune vials (tag `rune_fuel`) the creature carries. */
  private vialsCarried(id: EntityId): number {
    const world = this.worldRef;
    const registry = this.registryRef;
    const readers = this.readersRef;
    if (world === null || registry === null || readers === null || !readers.has('13')) return 0;
    const items = registry.table<{ id: string; tags?: readonly string[] }>('items');
    let n = 0;
    for (const itemId of readers.of<ItemsReader>('13').carriedItems(id)) {
      const item = world.entities.get(itemId, C.Item);
      if (item !== undefined && items.byIndex(item.type)?.tags?.includes('rune_fuel') === true) n += item.count;
    }
    return n;
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
      enchantOf: (itemId) => {
        const world = this.worldRef;
        const registry = this.registryRef;
        return world === null || registry === null ? undefined : enchantOfItem(world.entities, registry, itemId);
      },
      spellOf: (itemId) => this.spellOf(itemId),
      summonsOf: (id) => (this.worldRef === null ? [] : summonsOf(this.worldRef.entities, id)),
      effects: (id) => {
        const world = this.worldRef;
        const bound = world === null ? undefined : world.entities.get(id, C.Spellbound);
        const tick = world === null ? 0 : world.calendar.tick;
        return bound === undefined ? [] : bound.effects.filter((e) => e.until > tick).map((e) => ({ ...e }));
      },
      draughtRest: (id) => {
        const world = this.worldRef;
        return world === null ? 0 : draughtRestLeft(world.entities, id, world.calendar.tick);
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
      summon: cs.spell.kind === 'call'
        ? registry.table<{ id: string; name: string }>('creatures').byIndex(summonSpecies(registry, cs.spell, world.entities.get(itemId, C.Item)?.material ?? 0))?.name ?? ''
        : '',
    };
  }

  /** The milli-rune cost of the spell in the creature's held channel, or undefined. */
  private heldSpellCost(id: EntityId): number | undefined {
    const weapon = this.worldRef?.entities.get(id, C.Equipment)?.weapon ?? 0;
    const spell = weapon === 0 ? undefined : this.spellOf(weapon);
    return spell === undefined ? undefined : spell.cost * MILLI;
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
      ...(this.pendingBlooms.length === 0 ? {} : { pendingBlooms: this.pendingBlooms.map((b) => ({ ...b })) }),
      ...(this.bloomAlertsToday.size === 0 ? {} : { bloomAlertsToday: Array.from(this.bloomAlertsToday).sort((a, b) => a - b) }),
    };
  }

  deserialize(state: MagicStateV1, ctx: InitContext): void {
    if (this.rngRef === null) this.init(ctx);
    this.sessions.clear();
    for (const [id, n] of state.sessionsToday ?? []) this.sessions.set(id, n);
    this.firstRunecasterDone = state.firstRunecasterDone === true;
    this.lastMishaps.clear();
    for (const [id, r] of state.lastMishaps ?? []) this.lastMishaps.set(id, { ...r });
    this.pendingBlooms.length = 0;
    for (const b of state.pendingBlooms ?? []) this.pendingBlooms.push({ ...b });
    this.bloomAlertsToday.clear();
    for (const id of state.bloomAlertsToday ?? []) this.bloomAlertsToday.add(id);
    this.sanctumSet = null;
    this.sweepDue = true;
  }
}

/** § Summons, fading: on `HourPassed`, every summon whose `fadesAt` has come dies through 17 (`SummonFaded`), ascending. */
function fadeSummons(ctx: TickContext): void {
  const entities = ctx.world.entities;
  if (entities.store(C.Summoned).size === 0) return;
  const due = entities.with(C.Summoned).filter((id) => entities.alive(id) && (entities.get(id, C.Summoned)?.fadesAt ?? 0) <= ctx.tick);
  for (const id of due.sort((a, b) => a - b)) ctx.emit({ type: 'SummonFaded', id });
}

/** A summoner's death: its summons fade on the next `HourPassed`. */
function bringFadeForward(ctx: TickContext, dead: EntityId): void {
  const entities = ctx.world.entities;
  for (const id of summonsOf(entities, dead)) {
    const summoned = entities.get(id, C.Summoned);
    if (summoned !== undefined && summoned.fadesAt > ctx.tick) entities.add<Summoned>(id, C.Summoned, { ...summoned, fadesAt: ctx.tick });
  }
}

/** `DayPassed` (§ Vials): every caster may drink again. */
function clearVialsToday(ctx: TickContext): void {
  const entities = ctx.world.entities;
  for (const id of entities.with(C.Rune)) {
    const rune = entities.get(id, C.Rune);
    if (rune?.vialsToday === undefined) continue;
    const { vialsToday: _drunk, ...rest } = rune;
    entities.add<Rune>(id, C.Rune, rest);
  }
}
