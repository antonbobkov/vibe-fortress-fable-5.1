/**
 * Casting: `02-systems/25-runecraft.md` § Channels, § Casting, § Spells, § Effects and § Vials.
 *
 * 25 has no casting loop of its own. Casting rides in 16's creature loop: `CombatSystem.tick` asks
 * {@link drinkVial} and {@link castSupport} for a channel holder, {@link canCastBolt} where it would
 * look for ammunition, and `fireRanged` takes a bolt through {@link castBolt} where it would take an
 * arrow from the quiver, and a burst or a single through {@link castAtTarget} before it spawns
 * anything. A bolt's hit roll is one of 16's ordinary rolls, so it draws on 16's stream; the resist
 * rolls of Dread and Daze draw on stream 25.
 *
 * A channel is a launcher with no ammunition. Code tests that, never an id.
 */

import { C, type ActiveEffect, type Item, type Position, type Rune, type Spellbound } from '@core/components';
import { crowdTicks } from '@core/crowding';
import { effectValue } from '@core/effects';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { DamageType, EntityId, TileIndex } from '@core/types';
import type { SpellDef } from '@content/generate';
import { MIN_ATTACK_COOLDOWN, QUALITY_COMBAT_MULT } from '@systems/combat/constants';
import { getAttribute } from '@systems/combat/melee';
import { findAmmoForShooter } from '@systems/combat/ranged';
import { BLOOD_UNCONSCIOUS_PERCENT, PAIN_UNCONSCIOUS } from '@systems/health/constants';
import type { ItemsReader } from '@systems/items';
import {
  DRINK_TICKS,
  DREAD_MAX_TARGETS,
  FIREBLOOM_DELAY_TICKS,
  FROSTBIND_SLOW_PERCENT,
  MENTAL_IMMUNE_SIZE,
  RESIST_NO_ATTRIBUTES_PERCENT,
  VIAL_RUNE,
  VIALS_PER_DAY,
} from './constants';
import { MILLI, runeMaxMilli, skillLevel } from './rune';

/** The slice of a weapon row casting reads. */
interface ChannelRow {
  readonly id: string;
  readonly skill: string;
  readonly size: number;
  readonly launcher?: { readonly range: number; readonly power: number; readonly ammo?: string };
}

/** A held weapon, as 16's `weaponOf` returns it. */
interface Held {
  readonly item: EntityId;
  readonly weaponDef: ChannelRow;
  readonly material: number;
  readonly quality: number;
}

interface MaterialRow {
  readonly id: string;
  readonly class: string;
}

/** The spell in a channel, with the numbers its power gives it. */
export interface ChannelSpell {
  readonly spell: SpellDef;
  /** The spell's row index, for `Projectile.spell`. */
  readonly index: number;
  /** `launcher.power × runeMult(material) × QUALITY_COMBAT_MULT[quality]`. */
  readonly power: number;
  /** Tiles: the spell's own range, or the channel's. */
  readonly range: number;
  /** Milli-rune spent at the cast. */
  readonly costMilli: number;
  /** `round(base × power)`, 0 for a spell with no base. */
  readonly damage: number;
  /** `round(ticks × power)`, 0 for a spell with no ticks. */
  readonly ticks: number;
}

/** What 16 hands the casting rules: its cooldowns, its hostility rule and its line of sight. */
export interface CastHost {
  readonly cooldownUntil: Map<EntityId, number>;
  isHostile(a: EntityId, b: EntityId): boolean;
  lineOfSight(from: TileIndex, to: TileIndex): boolean;
}

/** A launcher with no ammunition is a channel. */
export function isChannelRow(row: { readonly launcher?: { readonly ammo?: string } } | undefined): boolean {
  return row?.launcher !== undefined && row.launcher.ammo === undefined;
}

/** A metal's `runeMult`; every other material, a wand's wood among them, counts 1.0. */
export function runeMult(registry: Registry, material: number): number {
  const row = registry.table<MaterialRow>('materials').byIndex(material);
  if (row === undefined || row.class !== 'metal') return 1;
  const metal = registry.table<{ id: string; runeMult?: number }>('metals').byId(row.id);
  return metal?.runeMult === undefined ? 1 : metal.runeMult / 1000;
}

/** `power(item) = launcher.power × runeMult(item.material) × QUALITY_COMBAT_MULT[item.quality]`. */
export function channelPower(registry: Registry, row: { readonly launcher?: { readonly power: number } }, material: number, quality: number): number {
  const launcher = row.launcher;
  if (launcher === undefined) return 0;
  return (launcher.power / 1000) * runeMult(registry, material) * (QUALITY_COMBAT_MULT[quality] ?? 1);
}

/** The weapon row of an item, or undefined. */
function weaponRowOf(registry: Registry, item: Item): ChannelRow | undefined {
  const typeId = registry.table<{ id: string }>('items').byIndex(item.type)?.id;
  return typeId === undefined ? undefined : registry.table<ChannelRow>('weapons').byId(typeId);
}

/**
 * The spell set in a channel item and its numbers; undefined for an item that is no channel or
 * whose stone carries no spell.
 */
export function spellOfItem(entities: EntityStore, registry: Registry, itemId: EntityId): ChannelSpell | undefined {
  const item = entities.get(itemId, C.Item);
  if (item === undefined || item.stone === undefined) return undefined;
  const row = weaponRowOf(registry, item);
  if (row === undefined || !isChannelRow(row)) return undefined;
  return channelSpell(registry, row, item.material, item.quality, item.stone);
}

function channelSpell(registry: Registry, row: ChannelRow, material: number, quality: number, stone: number): ChannelSpell | undefined {
  const stoneId = registry.table<{ id: string }>('materials').byIndex(stone)?.id;
  if (stoneId === undefined) return undefined;
  const spells = registry.table<SpellDef>('spells');
  const spell = spells.rows.find((s) => s !== undefined && s.stone === stoneId);
  if (spell === undefined) return undefined;
  const power = channelPower(registry, row, material, quality);
  return {
    spell,
    index: spells.index(spell.id),
    power,
    range: spell.range ?? row.launcher?.range ?? 0,
    costMilli: spell.cost * MILLI,
    damage: spell.base === undefined ? 0 : Math.round(spell.base * power),
    ticks: spell.ticks === undefined ? 0 : Math.round(spell.ticks * power),
  };
}

/** The spell of a held channel, from 16's `weaponOf`. */
function heldSpell(entities: EntityStore, registry: Registry, held: Held | null | undefined): ChannelSpell | undefined {
  if (held === null || held === undefined || !isChannelRow(held.weaponDef)) return undefined;
  const item = entities.get(held.item, C.Item);
  if (item?.stone === undefined) return undefined;
  return channelSpell(registry, held.weaponDef, held.material, held.quality, item.stone);
}

/** The kind of the spell in a held channel (`bolt`, `ward`, …), or undefined. */
export function heldSpellKind(ctx: TickContext, held: Held | null | undefined): SpellDef['kind'] | undefined {
  return heldSpell(ctx.world.entities, ctx.registry, held)?.spell.kind;
}

/** The kinds of spell that fly by 16's ranged branch. */
function fliesByRangedBranch(spell: SpellDef): boolean {
  return spell.kind === 'bolt' || spell.kind === 'burst' || spell.kind === 'single';
}

/** Casting distance: Chebyshev on the level, each level between counting two. */
function castDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 2;
}

function tileOf(ctx: TickContext, id: EntityId): TileIndex {
  const p = ctx.world.entities.get(id, C.Position);
  return p === undefined ? -1 : ctx.world.map.index(p.x, p.y, p.z);
}

/** The holder's rune covers the held channel's spell now. */
export function runeCovers(ctx: TickContext, casterId: EntityId, held: Held | null | undefined): boolean {
  const rune = ctx.world.entities.get(casterId, C.Rune);
  const cs = heldSpell(ctx.world.entities, ctx.registry, held);
  return rune !== undefined && cs !== undefined && rune.current >= cs.costMilli;
}

/**
 * `canCastBolt`: the holder has a `Rune`, the staff's spell flies by 16's ranged branch, the rune
 * covers its cost, and the target is within the spell's range. A Firebloom also needs no creature
 * of the caster's own faction in the 3×3 around the target; a Daze, a target it can daze.
 */
export function canCastBolt(ctx: TickContext, casterId: EntityId, held: Held | null, targetId: EntityId): boolean {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  if (rune === undefined) return false;
  const cs = heldSpell(entities, ctx.registry, held);
  if (cs === undefined || !fliesByRangedBranch(cs.spell) || rune.current < cs.costMilli) return false;
  const a = entities.get(casterId, C.Position);
  const b = entities.get(targetId, C.Position);
  if (a === undefined || b === undefined || castDistance(a, b) > cs.range) return false;
  if (cs.spell.kind === 'burst') return !ownFactionInSquare(ctx, casterId, b);
  if (cs.spell.kind === 'single') return dazeable(ctx, targetId);
  return true;
}

/** A creature of the caster's faction stands in the 3×3 around `centre`, on its level. */
function ownFactionInSquare(ctx: TickContext, casterId: EntityId, centre: Position): boolean {
  const entities = ctx.world.entities;
  const faction = entities.get(casterId, C.Creature)?.faction;
  if (faction === undefined) return false;
  for (const id of squareCreatures(ctx, centre)) {
    if (entities.get(id, C.Creature)?.faction === faction) return true;
  }
  return false;
}

/** Living creatures in the 3×3 around `centre` on its level, ascending by id. */
function squareCreatures(ctx: TickContext, centre: Position): EntityId[] {
  const map = ctx.world.map;
  const out: EntityId[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = centre.x + dx;
      const y = centre.y + dy;
      if (!map.inBounds(x, y, centre.z)) continue;
      for (const id of ctx.readers.spatial.at(map.index(x, y, centre.z))) {
        if (ctx.world.entities.alive(id) && ctx.world.entities.has(id, C.Creature)) out.push(id);
      }
    }
  }
  return out.sort((a, b) => a - b);
}

/** Size at least `MENTAL_IMMUNE_SIZE`, or of the `deep` faction: Dread and Daze never take it. */
export function mentallyImmune(ctx: TickContext, id: EntityId): boolean {
  const creature = ctx.world.entities.get(id, C.Creature);
  if (creature === undefined) return true;
  if (creature.faction === 'deep') return true;
  const size = ctx.registry.table<{ id: string; size: number }>('creatures').byIndex(creature.species)?.size ?? 0;
  return size >= MENTAL_IMMUNE_SIZE;
}

/** Daze's target: a captain, or of size 100 or more; conscious (a stunned creature is not); not immune. */
function dazeable(ctx: TickContext, id: EntityId): boolean {
  const entities = ctx.world.entities;
  if (mentallyImmune(ctx, id) || entities.get(id, C.Body)?.conscious === false) return false;
  if (entities.get(id, C.Hostile)?.role === 'captain') return true;
  const creature = entities.get(id, C.Creature);
  const size = creature === undefined ? 0 : ctx.registry.table<{ id: string; size: number }>('creatures').byIndex(creature.species)?.size ?? 0;
  return size >= 100;
}

/** The resist roll of Dread and Daze, on stream 25: `Willpower / 2` percent, or the default without attributes. */
export function resists(ctx: TickContext, id: EntityId): boolean {
  const attrs = ctx.world.entities.get(id, C.Attributes);
  const percent = attrs === undefined ? RESIST_NO_ATTRIBUTES_PERCENT : Math.floor(attrs.wil / 2);
  return ctx.world.rngFor('25').int(0, 99) < percent;
}

/**
 * The cast-when rule of a bolt: a caster holds it while a creature of its own faction (for a
 * fortress caster, any fortress creature) stands on a tile the bolt would cross before it reaches
 * its target. `ray` is 16's projectile ray from the caster toward the target.
 */
export function allyOnLine(ctx: TickContext, casterId: EntityId, targetTile: TileIndex, ray: readonly TileIndex[]): boolean {
  const entities = ctx.world.entities;
  const faction = entities.get(casterId, C.Creature)?.faction;
  if (faction === undefined) return false;
  for (const tile of ray) {
    if (tile === targetTile) return false;
    for (const id of ctx.readers.spatial.at(tile)) {
      if (id === casterId) continue;
      if (entities.get(id, C.Creature)?.faction === faction) return true;
    }
  }
  return false;
}

/**
 * A held cast's other target: the nearest creature hostile to the caster (distance, then id) that
 * the spell can reach (`canCastBolt`), in line of sight, and for a bolt with no ally on its line.
 * 0 when there is none.
 */
export function otherBoltTarget(
  ctx: TickContext,
  casterId: EntityId,
  held: Held | null,
  heldTarget: EntityId,
  isHostile: (a: EntityId, b: EntityId) => boolean,
  rayTo: (target: EntityId) => { tile: TileIndex; ray: readonly TileIndex[] } | null,
): EntityId {
  const entities = ctx.world.entities;
  const pos = entities.get(casterId, C.Position);
  const cs = heldSpell(entities, ctx.registry, held);
  if (pos === undefined || cs === undefined) return 0;
  const from = ctx.world.map.index(pos.x, pos.y, pos.z);
  let best = 0;
  let bestDist = Infinity;
  for (const id of ctx.readers.spatial.inRadius(from, cs.range, 'creature')) {
    if (id === casterId || id === heldTarget || !entities.alive(id) || !isHostile(casterId, id)) continue;
    const p = entities.get(id, C.Position);
    if (p === undefined) continue;
    const dist = castDistance(p, pos);
    if (dist > bestDist || (dist === bestDist && id > best)) continue;
    if (!canCastBolt(ctx, casterId, held, id)) continue;
    const line = rayTo(id);
    if (line === null || (cs.spell.kind === 'bolt' && allyOnLine(ctx, casterId, line.tile, line.ray))) continue;
    best = id;
    bestDist = dist;
  }
  return best;
}

/** 16's cooldown for a cast: `size × 3 + 10 − Agility / 10`, at least `MIN_ATTACK_COOLDOWN`, slowed by a crowd. */
function setCastCooldown(ctx: TickContext, casterId: EntityId, size: number, cooldownUntil: Map<EntityId, number>): void {
  const agility = getAttribute(ctx.world.entities, casterId, 'agi');
  const movement = ctx.world.services.movement;
  const crowd = movement === null ? 100 : movement.crowdPercentAt(movement.tileOf(casterId));
  cooldownUntil.set(casterId, ctx.tick + crowdTicks(Math.max(MIN_ATTACK_COOLDOWN, Math.floor(size * 3 + 10 - agility / 10)), crowd));
}

/**
 * Spend a cast's rune, at the cast. A caster that falls below the cost emits `RuneSpent` once,
 * until regen lifts it over the cost again (`Rune.outAnnounced`).
 */
function spendRune(ctx: TickContext, casterId: EntityId, rune: Rune, cs: ChannelSpell): void {
  const current = rune.current - cs.costMilli;
  const out = current < cs.costMilli && rune.outAnnounced !== true;
  ctx.world.entities.add<Rune>(casterId, C.Rune, { ...rune, current, ...(out ? { outAnnounced: true } : {}) });
  if (out) ctx.emit({ type: 'RuneSpent', id: casterId });
}

function emitCast(ctx: TickContext, casterId: EntityId, cs: ChannelSpell, targetId: EntityId, tile: TileIndex): void {
  ctx.emit({ type: 'SpellCast', casterId, spellId: cs.spell.id, targetId, tile, burned: false });
}

/** What 16's ranged branch fires for a bolt. */
export interface Bolt {
  readonly rawDamage: number;
  readonly damageType: DamageType;
  /** `Projectile.spell`. */
  readonly spell: number;
  /** The channel's power in thousandths, for the effect a hit leaves (`Projectile.spellPower`). */
  readonly powerMilli: number;
}

/**
 * The third branch of `fireRanged`: spend the rune and return the bolt, or null when the holder
 * cannot cast it (then nothing is fired). The rune is spent at the cast.
 */
export function castBolt(ctx: TickContext, casterId: EntityId, held: Held | null, targetId: EntityId): Bolt | null {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  const cs = heldSpell(entities, ctx.registry, held);
  if (rune === undefined || cs === undefined || cs.spell.kind !== 'bolt' || rune.current < cs.costMilli) return null;
  spendRune(ctx, casterId, rune, cs);
  emitCast(ctx, casterId, cs, targetId, tileOf(ctx, targetId));
  return {
    rawDamage: cs.damage,
    damageType: (cs.spell.type ?? 'ember') as DamageType,
    spell: cs.index,
    powerMilli: Math.round(cs.power * 1000),
  };
}

/**
 * `fireRanged` passes a `burst` or a `single` here before it spawns anything. Firebloom queues its
 * bloom on the target's tile with 25 (`services.magic`); Daze stuns the target unless it resists.
 * Neither rolls to hit. Returns false when the spell is no burst or single, or cannot be cast now;
 * true when it was cast (the rune spent and the cooldown set by 16's rule).
 */
export function castAtTarget(ctx: TickContext, casterId: EntityId, held: Held | null, targetId: EntityId, cooldownUntil: Map<EntityId, number>): boolean {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  const cs = heldSpell(entities, ctx.registry, held);
  if (rune === undefined || cs === undefined || held === null) return false;
  if (cs.spell.kind !== 'burst' && cs.spell.kind !== 'single') return false;
  if (!canCastBolt(ctx, casterId, held, targetId)) return false;
  const magic = ctx.world.services.magic;
  if (cs.spell.kind === 'burst' && magic === null) return false;
  const tile = tileOf(ctx, targetId);
  spendRune(ctx, casterId, rune, cs);
  emitCast(ctx, casterId, cs, targetId, tile);
  setCastCooldown(ctx, casterId, held.weaponDef.size, cooldownUntil);
  if (cs.spell.kind === 'burst') {
    magic?.addBloom({ tile, at: ctx.tick + FIREBLOOM_DELAY_TICKS, casterId, raw: cs.damage });
  } else if (!resists(ctx, targetId)) {
    ctx.emit({ type: 'CreatureStunned', id: targetId, until: ctx.tick + cs.ticks });
  }
  return true;
}

/**
 * `castSupport` (§ Spells): a ward, mend or dread staff, for a held target and with the cooldown
 * elapsed, casts when its row's condition holds. It spends the rune, emits `SpellCast` and sets the
 * cooldown by 16's rule. False when the spell is no support spell or its condition does not hold.
 */
export function castSupport(ctx: TickContext, casterId: EntityId, held: Held | null, targetId: EntityId, host: CastHost): boolean {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  const cs = heldSpell(entities, ctx.registry, held);
  const pos = entities.get(casterId, C.Position);
  if (rune === undefined || cs === undefined || pos === undefined || held === null || rune.current < cs.costMilli) return false;
  const kind = cs.spell.kind;
  let castAt = 0;
  let after: (() => void) | null = null;
  if (kind === 'ward') {
    if (effectValue(entities, casterId, 'ward', ctx.tick) > 0) return false;
    const warded = wardTargets(ctx, casterId, pos, cs.range);
    castAt = casterId;
    after = () => {
      for (const id of warded) {
        addEffect(entities, id, { kind: 'ward', value: cs.damage, until: ctx.tick + cs.ticks, sourceId: casterId });
        ctx.emit({ type: 'Warded', id });
      }
    };
  } else if (kind === 'mend') {
    const patient = mendTarget(ctx, casterId, pos, cs.range, host);
    if (patient === 0) return false;
    castAt = patient;
    after = () => ctx.emit({ type: 'Mended', id: patient, casterId });
  } else if (kind === 'dread') {
    if (ctx.tick < (rune.nextDreadTick ?? 0)) return false;
    const foes = dreadTargets(ctx, casterId, pos, cs.range, host);
    if (foes.length < 2) return false;
    castAt = targetId;
    after = () => {
      const now = entities.get(casterId, C.Rune);
      if (now !== undefined) entities.add<Rune>(casterId, C.Rune, { ...now, nextDreadTick: ctx.tick + cs.ticks });
      for (const id of foes.slice(0, DREAD_MAX_TARGETS)) {
        if (resists(ctx, id)) continue;
        addEffect(entities, id, { kind: 'flee', value: 1, until: ctx.tick + cs.ticks, sourceId: casterId });
      }
    };
  } else {
    return false;
  }
  spendRune(ctx, casterId, rune, cs);
  emitCast(ctx, casterId, cs, castAt, tileOf(ctx, castAt));
  setCastCooldown(ctx, casterId, held.weaponDef.size, host.cooldownUntil);
  after();
  return true;
}

/** Ward: every creature of the caster's faction within `range` on its level, the caster too, ascending by id. */
function wardTargets(ctx: TickContext, casterId: EntityId, pos: Position, range: number): EntityId[] {
  const entities = ctx.world.entities;
  const faction = entities.get(casterId, C.Creature)?.faction;
  const out: EntityId[] = [];
  for (const id of ctx.readers.spatial.inRadius(ctx.world.map.index(pos.x, pos.y, pos.z), range, 'creature')) {
    const p = entities.get(id, C.Position);
    if (!entities.alive(id) || p === undefined || p.z !== pos.z) continue;
    if (id === casterId || entities.get(id, C.Creature)?.faction === faction) out.push(id);
  }
  return out;
}

/** A body Mend would help: a bleeding wound with no bandage, or unconscious from wounds with a light wound to close. */
function needsMending(entities: EntityStore, id: EntityId): boolean {
  const body = entities.get(id, C.Body);
  if (body === undefined) return false;
  let light = false;
  for (const part of body.parts) {
    for (const w of part.wounds) {
      if (w.bleed > 0 && !w.bandaged) return true;
      if (w.severity === 'light') light = true;
    }
  }
  const fromWounds = body.pain >= PAIN_UNCONSCIOUS || body.blood < Math.floor((body.maxBlood * BLOOD_UNCONSCIOUS_PERCENT) / 100);
  return light && !body.conscious && fromWounds;
}

/** Mend's patient: the nearest creature of the caster's faction within `range` in line of sight that needs it, then lowest id; 0 for none. */
function mendTarget(ctx: TickContext, casterId: EntityId, pos: Position, range: number, host: CastHost): EntityId {
  const entities = ctx.world.entities;
  const faction = entities.get(casterId, C.Creature)?.faction;
  const from = ctx.world.map.index(pos.x, pos.y, pos.z);
  let best = 0;
  let bestDist = Infinity;
  for (const id of ctx.readers.spatial.inRadius(from, range, 'creature')) {
    const p = entities.get(id, C.Position);
    if (!entities.alive(id) || p === undefined || entities.get(id, C.Creature)?.faction !== faction) continue;
    const dist = castDistance(p, pos);
    if (dist > range || dist >= bestDist) continue;
    if (!needsMending(entities, id)) continue;
    if (id !== casterId && !host.lineOfSight(from, ctx.world.map.index(p.x, p.y, p.z))) continue;
    best = id;
    bestDist = dist;
  }
  return best;
}

/**
 * Dread's targets: the creatures hostile to the caster within `range` in line of sight that it can
 * send running (conscious, not already fleeing from a dread, not immune), nearest first, then id.
 */
function dreadTargets(ctx: TickContext, casterId: EntityId, pos: Position, range: number, host: CastHost): EntityId[] {
  const entities = ctx.world.entities;
  const from = ctx.world.map.index(pos.x, pos.y, pos.z);
  const found: { id: EntityId; dist: number }[] = [];
  for (const id of ctx.readers.spatial.inRadius(from, range, 'creature')) {
    const p = entities.get(id, C.Position);
    if (id === casterId || !entities.alive(id) || p === undefined || !host.isHostile(casterId, id)) continue;
    const dist = castDistance(p, pos);
    if (dist > range || entities.get(id, C.Body)?.conscious === false) continue;
    if (mentallyImmune(ctx, id) || effectValue(entities, id, 'flee', ctx.tick) > 0) continue;
    if (!host.lineOfSight(from, ctx.world.map.index(p.x, p.y, p.z))) continue;
    found.push({ id, dist });
  }
  return found.sort((a, b) => a.dist - b.dist || a.id - b.id).map((f) => f.id);
}

/** The item type of a rune vial, by its `rune_fuel` tag; undefined when content has none. */
function vialItemId(registry: Registry): string | undefined {
  return registry.table<{ id: string; tags?: readonly string[] }>('items').rows.find((row) => row?.tags?.includes('rune_fuel') === true)?.id;
}

/**
 * § Vials: a channel holder below its spell's cost, holding a hostile target, with a vial carried
 * and fewer than `VIALS_PER_DAY` drunk today, drinks one: `VIAL_RUNE` back, capped at its maximum,
 * `VialDrunk`, and its next attack waits `DRINK_TICKS`. True when it drank.
 */
export function drinkVial(ctx: TickContext, casterId: EntityId, held: Held | null, cooldownUntil: Map<EntityId, number>): boolean {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  const cs = heldSpell(entities, ctx.registry, held);
  if (rune === undefined || cs === undefined || rune.current >= cs.costMilli || (rune.vialsToday ?? 0) >= VIALS_PER_DAY) return false;
  const vialType = vialItemId(ctx.registry);
  if (vialType === undefined) return false;
  const carried = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13').carriedItems(casterId) : undefined;
  const vial = findAmmoForShooter(entities, ctx.registry, casterId, vialType, carried);
  const items = ctx.world.services.items;
  if (vial === 0 || items === null) return false;
  items.consume(vial, 1);
  const max = runeMaxMilli(skillLevel(entities, ctx.registry, casterId, 'runecraft'));
  entities.add<Rune>(casterId, C.Rune, { ...rune, current: Math.max(rune.current, Math.min(max, rune.current + VIAL_RUNE * MILLI)), vialsToday: (rune.vialsToday ?? 0) + 1 });
  ctx.emit({ type: 'VialDrunk', id: casterId });
  cooldownUntil.set(casterId, ctx.tick + DRINK_TICKS);
  return true;
}

/**
 * A bolt's hit that did damage: Frostbind slows the creature it struck by
 * `FROSTBIND_SLOW_PERCENT` for `round(ticks × power)` ticks.
 */
export function applySpellOnHit(
  ctx: TickContext,
  spellIndex: number,
  powerMilli: number,
  shooterId: EntityId,
  defenderId: EntityId,
  damage: number,
): void {
  if (damage <= 0 || !ctx.world.entities.alive(defenderId)) return;
  const spell = ctx.registry.table<SpellDef>('spells').byIndex(spellIndex);
  if (spell === undefined || spell.kind !== 'bolt' || spell.type !== 'frost' || spell.ticks === undefined) return;
  const ticks = Math.round((spell.ticks * powerMilli) / 1000);
  addEffect(ctx.world.entities, defenderId, { kind: 'slow', value: FROSTBIND_SLOW_PERCENT, until: ctx.tick + ticks, sourceId: shooterId });
}

/** `addEffect`: one more timed entry on the creature's `Spellbound`. */
export function addEffect(entities: EntityStore, id: EntityId, effect: ActiveEffect): void {
  const bound = entities.get(id, C.Spellbound);
  const effects = bound === undefined ? [] : bound.effects.slice();
  effects.push({ ...effect });
  entities.add<Spellbound>(id, C.Spellbound, { ...(bound ?? {}), effects });
}

/** `HourPassed`: drop expired entries, and the component with them. */
export function dropExpiredEffects(entities: EntityStore, tick: number): void {
  for (const id of entities.with(C.Spellbound)) {
    const bound = entities.get(id, C.Spellbound);
    if (bound === undefined) continue;
    const live = bound.effects.filter((e) => e.until > tick);
    if (live.length === bound.effects.length) continue;
    if (live.length === 0) entities.remove(id, C.Spellbound);
    else entities.add<Spellbound>(id, C.Spellbound, { ...bound, effects: live });
  }
}
