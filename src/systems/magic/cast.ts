/**
 * Casting: `02-systems/25-runecraft.md` § Channels, § Casting, § Spells and § Effects.
 *
 * 25 has no casting loop of its own. Casting rides in 16's creature loop: `CombatSystem.tick` asks
 * {@link canCastBolt} where it would look for ammunition, and `fireRanged` takes a bolt through
 * {@link castBolt} where it would take an arrow from the quiver. Everything after that is 16's
 * shared path: the hit roll, cooldown, crowding, projectile, bystanders and xp. A bolt's hit roll
 * is one of 16's ordinary rolls, so it draws on 16's stream; nothing here draws at all.
 *
 * A channel is a launcher with no ammunition. Code tests that, never an id.
 */

import { C, type ActiveEffect, type Item, type Spellbound } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { DamageType, EntityId } from '@core/types';
import type { SpellDef } from '@content/generate';
import { QUALITY_COMBAT_MULT } from '@systems/combat/constants';
import { FROSTBIND_SLOW_PERCENT } from './constants';
import { MILLI } from './rune';

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

/** The kinds of spell that fly by 16's ranged branch. */
function fliesByRangedBranch(spell: SpellDef): boolean {
  return spell.kind === 'bolt' || spell.kind === 'burst' || spell.kind === 'single';
}

/**
 * `canCastBolt`: the holder has a `Rune`, the staff's spell flies by 16's ranged branch, the rune
 * covers its cost, and the target is within the spell's range.
 */
export function canCastBolt(ctx: TickContext, casterId: EntityId, held: Held | null, targetId: EntityId): boolean {
  const entities = ctx.world.entities;
  const rune = entities.get(casterId, C.Rune);
  if (rune === undefined) return false;
  const cs = heldSpell(entities, ctx.registry, held);
  if (cs === undefined || !fliesByRangedBranch(cs.spell) || rune.current < cs.costMilli) return false;
  const a = entities.get(casterId, C.Position);
  const b = entities.get(targetId, C.Position);
  if (a === undefined || b === undefined) return false;
  const distance = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) + Math.abs(a.z - b.z) * 2;
  return distance <= cs.range;
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
  entities.add(casterId, C.Rune, { ...rune, current: rune.current - cs.costMilli });
  const pos = entities.get(targetId, C.Position);
  ctx.emit({
    type: 'SpellCast',
    casterId,
    spellId: cs.spell.id,
    targetId,
    tile: pos === undefined ? -1 : ctx.world.map.index(pos.x, pos.y, pos.z),
  });
  return {
    rawDamage: cs.damage,
    damageType: (cs.spell.type ?? 'ember') as DamageType,
    spell: cs.index,
    powerMilli: Math.round(cs.power * 1000),
  };
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
