/**
 * A creature under a `flee` effect (`25-runecraft.md` § Effects; 16 § Fleeing and morale in
 * combat), read in 16's creature loop after the conscious check. While the effect lasts the creature
 * keeps its target, does not attack, and walks to a tile `FLEE_EFFECT_TILES` away from the effect's
 * source, clamped to the map; with no path there, to the nearest tile of its party's arrival edge.
 * Nothing leaves the map, so a party's losses and retreat do not move, and when the effect ends the
 * creature still holds its target and comes back.
 *
 * Dread (25) adds the effect today; an enchanted weapon's `flee` will add it on a hit through the
 * same `addEffect`, and this reader serves both.
 */

import { C, type Position } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { getNearestEdgeTile } from '@systems/threats/ai';
import { FLEE_EFFECT_TILES } from './constants';

/** The source of the creature's latest unexpired `flee` effect, or undefined when it is under none. */
export function fleeSource(ctx: TickContext, id: EntityId): EntityId | undefined {
  const bound = ctx.world.entities.get(id, C.Spellbound);
  if (bound === undefined) return undefined;
  let source: EntityId | undefined;
  let until = -1;
  for (const effect of bound.effects) {
    if (effect.kind === 'flee' && effect.until > ctx.tick && effect.until >= until) {
      until = effect.until;
      source = effect.sourceId;
    }
  }
  return source;
}

/** The tile `FLEE_EFFECT_TILES` from `from` through `pos`, clamped to the map, stepping back toward `pos` to one a walker can stand on. -1 for none. */
function fleeGoal(ctx: TickContext, pos: Position, from: Position): TileIndex {
  const map = ctx.world.map;
  const dx = pos.x - from.x;
  let dy = pos.y - from.y;
  if (dx === 0 && dy === 0) dy = 1;
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  for (let k = FLEE_EFFECT_TILES; k > m; k -= 1) {
    const x = Math.min(map.w - 1, Math.max(0, from.x + Math.round((dx * k) / m)));
    const y = Math.min(map.h - 1, Math.max(0, from.y + Math.round((dy * k) / m)));
    const tile = map.index(x, y, pos.z);
    if (ctx.readers.pathing.passable(tile, 'walker')) return tile;
  }
  return -1;
}

/**
 * One tick of flight under a `flee` effect. True when the creature is under one, so the combat loop
 * goes on to the next creature without attacking.
 */
export function stepFled(ctx: TickContext, id: EntityId, targetId: EntityId): boolean {
  const source = fleeSource(ctx, id);
  if (source === undefined) return false;
  const entities = ctx.world.entities;
  const movement = ctx.world.services.movement;
  const pos = entities.get(id, C.Position);
  const from = entities.get(source, C.Position) ?? entities.get(targetId, C.Position);
  if (movement === null || pos === undefined || from === undefined) return true;
  if (Math.max(Math.abs(pos.x - from.x), Math.abs(pos.y - from.y)) >= FLEE_EFFECT_TILES) {
    movement.stopWalking(id);
    return true;
  }
  const goal = fleeGoal(ctx, pos, from);
  const outcome = goal < 0 ? 'unreachable' : movement.walkTo(id, goal, 'flee', ctx);
  if (outcome !== 'unreachable') return true;
  const party = entities.get(entities.get(id, C.Hostile)?.partyId ?? 0, C.Party);
  if (party === undefined) {
    movement.stopWalking(id);
    return true;
  }
  movement.walkTo(id, getNearestEdgeTile(ctx.world.map.index(pos.x, pos.y, pos.z), party.edge, ctx), 'flee', ctx);
  return true;
}
