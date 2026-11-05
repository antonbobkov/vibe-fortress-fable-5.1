/**
 * Summons: `02-systems/25-runecraft.md` § Summons.
 *
 * A summon is a war-trained tame animal assigned to its caster. 08's tame brain drives it and 16
 * fights it; 25 adds no brain. It fades on the first `HourPassed` at or after `Summoned.fadesAt`,
 * through 17's death with cause `faded`; its caster's death brings that tick forward. A species
 * that `turns` may come through turned instead: faction `deep`, no `Tame`, and 18 makes it a
 * Hollow-born on `SummonTurned`. Only a turning species draws, on stream 25.
 */

import { C, type Summoned, type Tame } from '@core/components';
import { MAX_CREATURES } from '@core/constants';
import type { EntityStore } from '@core/entities';
import type { Registry } from '@core/registry';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { SpellDef } from '@content/generate';
import { MAX_SUMMONS_PER_CASTER, SHADE_TURN_PERMILLE, SUMMON_TICKS } from './constants';

interface SpeciesRow {
  readonly id: string;
  readonly movementClass: string;
  readonly flags: { readonly summoned?: boolean; readonly turns?: boolean };
}

/** Where a summon may stand beside a tile: north, east, south, west, then the diagonals clockwise from north-east. */
const BESIDE: readonly (readonly [number, number])[] = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];

/** A summoned species: its row has `flags.summoned`. */
export function isSummonedSpecies(registry: Registry, species: number): boolean {
  return registry.table<SpeciesRow>('creatures').byIndex(species)?.flags.summoned === true;
}

/** The living summons a caster has called, ascending. */
export function summonsOf(entities: EntityStore, casterId: EntityId): EntityId[] {
  if (casterId === 0) return [];
  const out: EntityId[] = [];
  for (const id of entities.with(C.Summoned)) {
    if (entities.alive(id) && entities.get(id, C.Summoned)?.summonerId === casterId) out.push(id);
  }
  return out.sort((a, b) => a - b);
}

/** The species a Call brings: the `summon` of the staff's metal, else the spell row's own. 0 for none. */
export function summonSpecies(registry: Registry, spell: SpellDef, material: number): number {
  const creatures = registry.table<SpeciesRow>('creatures');
  const row = registry.table<{ id: string; class: string }>('materials').byIndex(material);
  const metal = row?.class === 'metal' ? registry.table<{ id: string; summon?: string }>('metals').byId(row.id) : undefined;
  const id = metal?.summon ?? spell.summon;
  return id === undefined ? 0 : Math.max(0, creatures.index(id));
}

/**
 * The first tile beside `at`, on its level, that a creature of the species can stand on and that no
 * living creature holds; -1 when there is none.
 */
export function freeTileBeside(ctx: TickContext, at: TileIndex, species: number): TileIndex {
  const map = ctx.world.map;
  const cls = ctx.registry.table<SpeciesRow>('creatures').byIndex(species)?.movementClass ?? 'walker';
  for (const [dx, dy] of BESIDE) {
    const tile = map.offset(at, dx, dy, 0);
    if (tile < 0 || !ctx.readers.pathing.passable(tile, cls as Parameters<typeof ctx.readers.pathing.passable>[1])) continue;
    if (ctx.readers.spatial.at(tile).some((id) => ctx.world.entities.alive(id) && ctx.world.entities.has(id, C.Creature))) continue;
    return tile;
  }
  return -1;
}

/** What a Call will bring, and where. */
export interface CallPlan {
  readonly species: number;
  readonly tile: TileIndex;
}

/**
 * § Spells, Call: cast when the caster has fewer than `MAX_SUMMONS_PER_CASTER` summons alive and the
 * creature count is under `MAX_CREATURES`, and a tile beside it is free. Null when it is not cast.
 */
export function planCall(ctx: TickContext, casterId: EntityId, spell: SpellDef, material: number): CallPlan | null {
  const entities = ctx.world.entities;
  if (summonsOf(entities, casterId).length >= MAX_SUMMONS_PER_CASTER) return null;
  if (entities.with(C.Creature).length >= MAX_CREATURES) return null;
  const species = summonSpecies(ctx.registry, spell, material);
  const pos = entities.get(casterId, C.Position);
  if (species <= 0 || pos === undefined) return null;
  const tile = freeTileBeside(ctx, ctx.world.map.index(pos.x, pos.y, pos.z), species);
  return tile < 0 ? null : { species, tile };
}

/**
 * The call is answered: the summon stands beside its caster, of the fortress, war-trained and
 * assigned to it (`SummonCalled`). A species that `turns` comes through turned with
 * `SHADE_TURN_PERMILLE`: faction `deep`, no `Tame`, no summoner (`SummonTurned`). Either fades a
 * day later.
 */
export function answerCall(ctx: TickContext, casterId: EntityId, plan: CallPlan): EntityId {
  const entities = ctx.world.entities;
  const row = ctx.registry.table<SpeciesRow>('creatures').byIndex(plan.species);
  const turned = row?.flags.turns === true && ctx.world.rngFor('25').int(0, 999) < SHADE_TURN_PERMILLE;
  const id = ctx.world.services.spawn.creature(plan.species, plan.tile, turned ? 'deep' : 'fortress');
  entities.add<Summoned>(id, C.Summoned, { summonerId: turned ? 0 : casterId, fadesAt: ctx.tick + SUMMON_TICKS });
  if (turned) {
    ctx.emit({ type: 'SummonTurned', id });
    return id;
  }
  entities.add<Tame>(id, C.Tame, {
    pastureId: 0, condition: 0, trained: 'war', assignedTo: casterId, pregnantUntil: 0, lastProductTick: {},
    juvenileUntil: 0, slaughter: false, petOf: 0, noBreed: true,
  });
  ctx.emit({ type: 'SummonCalled', id, casterId });
  if (plan.species === wispSpecies(ctx.registry)) ctx.emit({ type: 'WispAppeared', id, tile: plan.tile });
  return id;
}

/**
 * The wisp: the `call` spell row's own summon, which a wand or an unlisted metal brings and a
 * sanctum lets loose. 0 when content has none. A wisp appearing emits `WispAppeared` (15's `saw_wisp`).
 */
export function wispSpecies(registry: Registry): number {
  const spell = registry.table<SpellDef>('spells').rows.find((s) => s?.kind === 'call');
  return spell?.summon === undefined ? 0 : Math.max(0, registry.table('creatures').index(spell.summon));
}

/**
 * § The sanctum, `wisp_loose`: the `call` spell's own summon appears beside the circle, wild, with
 * no summoner, and fades in a day. 08's wild brain wanders it. Nothing when no tile is free or the
 * creature count is at `MAX_CREATURES`. Returns the wisp, or 0.
 */
export function looseWisp(ctx: TickContext, circleTile: TileIndex): EntityId {
  const entities = ctx.world.entities;
  const spell = ctx.registry.table<SpellDef>('spells').rows.find((s) => s?.kind === 'call');
  if (spell?.summon === undefined || circleTile < 0 || entities.with(C.Creature).length >= MAX_CREATURES) return 0;
  const species = Math.max(0, ctx.registry.table('creatures').index(spell.summon));
  const tile = species === 0 ? -1 : freeTileBeside(ctx, circleTile, species);
  if (tile < 0) return 0;
  const id = ctx.world.services.spawn.creature(species, tile, 'wild');
  entities.add<Summoned>(id, C.Summoned, { summonerId: 0, fadesAt: ctx.tick + SUMMON_TICKS });
  ctx.emit({ type: 'WispAppeared', id, tile });
  return id;
}
