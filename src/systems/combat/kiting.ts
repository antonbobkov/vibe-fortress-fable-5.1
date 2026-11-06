/**
 * 16 Targeting: a ranged soldier steps away from a nearby melee threat when it can, and a held
 * shooter steps aside to a tile with a clear line (§ Ranged resolution, Held shot).
 */
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { RANGED_KEEP_DISTANCE, RANGED_KITE_TRIGGER_DISTANCE } from './constants';
import { isCreatureHostile } from './factions';
import { weaponOf } from './melee';

/**
 * The nearest visible, conscious melee threat on the level within `RANGED_KITE_TRIGGER_DISTANCE`
 * of `from` (distance, then id), and its tile; null when there is none.
 */
function nearestMeleeThreat(ctx: TickContext, id: EntityId, from: TileIndex,
  targetOf: (id: EntityId) => EntityId, lineOfSight: (from: TileIndex, to: TileIndex) => boolean): TileIndex | null {
  const { entities, map } = ctx.world;
  const species = ctx.registry.table<{ id: string; attacks?: readonly { range?: number }[] }>('creatures');
  let nearest = 0;
  let threatTile = -1;
  let best = Infinity;
  for (const other of ctx.readers.spatial.inRadius(from, RANGED_KITE_TRIGGER_DISTANCE, 'creature')) {
    const position = entities.get(other, C.Position);
    if (position === undefined || position.z !== map.zOf(from) || entities.get(other, C.Body)?.conscious === false ||
      entities.get(other, C.Hostile)?.stealthed === true || !isCreatureHostile(entities, id, other, targetOf)) continue;
    const creature = entities.get(other, C.Creature);
    if (weaponOf(entities, ctx.registry, other)?.weaponDef.launcher !== undefined ||
      (creature !== undefined && species.byIndex(creature.species)?.attacks?.some((attack) => (attack.range ?? 0) > 0))) continue;
    const tile = map.index(position.x, position.y, position.z);
    if (!lineOfSight(from, tile)) continue;
    const distance = Math.max(Math.abs(position.x - map.xOf(from)), Math.abs(position.y - map.yOf(from)));
    if (distance > RANGED_KITE_TRIGGER_DISTANCE) continue;
    if (distance < best || (distance === best && other < nearest)) { nearest = other; threatTile = tile; best = distance; }
  }
  return nearest === 0 ? null : threatTile;
}

/** The legal adjacent steps from `from` on its own level, by tile index: walkable, passable and reachable. */
function adjacentSteps(ctx: TickContext, from: TileIndex): TileIndex[] {
  const map = ctx.world.map;
  return ctx.readers.pathing.edges(from, 'walker').filter(([tile, cost]) =>
    map.zOf(tile) === map.zOf(from) && Number.isFinite(cost)).map(([tile]) => tile).sort((a, b) => a - b)
    .filter((tile) => ctx.readers.pathing.passable(tile, 'walker') && ctx.readers.pathing.reachable(from, tile, 'walker'));
}

export function kitingTile(ctx: TickContext, id: EntityId, from: TileIndex,
  targetOf: (id: EntityId) => EntityId, lineOfSight: (from: TileIndex, to: TileIndex) => boolean): TileIndex | null {
  const map = ctx.world.map;
  const threatTile = nearestMeleeThreat(ctx, id, from, targetOf, lineOfSight);
  if (threatTile === null) return null;
  for (const tile of adjacentSteps(ctx, from)) {
    const distance = Math.max(Math.abs(map.xOf(tile) - map.xOf(threatTile)), Math.abs(map.yOf(tile) - map.yOf(threatTile)));
    if (distance >= RANGED_KEEP_DISTANCE && lineOfSight(tile, threatTile)) return tile;
  }
  return null;
}

/**
 * § Ranged resolution, Held shot: the step of a careful soldier on duty that holds its shot with no
 * other clear target. The first legal adjacent tile by tile index, as kiting picks one, that is no
 * nearer its held target than it stands (it stays on its own side of the line), has no melee threat
 * within `RANGED_KITE_TRIGGER_DISTANCE` (so it would not kite back), and from which `clearFrom`
 * finds a shot. Null when there is none: it waits where it stands. Draws nothing.
 */
export function clearLineTile(ctx: TickContext, id: EntityId, from: TileIndex, targetTile: TileIndex,
  targetOf: (id: EntityId) => EntityId, lineOfSight: (from: TileIndex, to: TileIndex) => boolean,
  clearFrom: (tile: TileIndex) => boolean): TileIndex | null {
  const map = ctx.world.map;
  const away = (tile: TileIndex): number =>
    Math.max(Math.abs(map.xOf(tile) - map.xOf(targetTile)), Math.abs(map.yOf(tile) - map.yOf(targetTile)));
  const now = away(from);
  for (const tile of adjacentSteps(ctx, from)) {
    if (away(tile) < now || nearestMeleeThreat(ctx, id, tile, targetOf, lineOfSight) !== null) continue;
    if (clearFrom(tile)) return tile;
  }
  return null;
}
