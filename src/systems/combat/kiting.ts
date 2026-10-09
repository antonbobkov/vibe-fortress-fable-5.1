/** 16 Targeting: a ranged soldier steps away from a nearby melee threat when it can. */
import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { RANGED_KEEP_DISTANCE, RANGED_KITE_TRIGGER_DISTANCE } from './constants';
import { isCreatureHostile } from './factions';
import { weaponOf } from './melee';

export function kitingTile(ctx: TickContext, id: EntityId, from: TileIndex,
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
  if (nearest === 0) return null;
  const steps = ctx.readers.pathing.edges(from, 'walker').filter(([tile, cost]) =>
    map.zOf(tile) === map.zOf(from) && Number.isFinite(cost)).map(([tile]) => tile).sort((a, b) => a - b);
  for (const tile of steps) {
    const distance = Math.max(Math.abs(map.xOf(tile) - map.xOf(threatTile)), Math.abs(map.yOf(tile) - map.yOf(threatTile)));
    if (distance >= RANGED_KEEP_DISTANCE && ctx.readers.pathing.passable(tile, 'walker') &&
      ctx.readers.pathing.reachable(from, tile, 'walker') && lineOfSight(tile, threatTile)) return tile;
  }
  return null;
}
