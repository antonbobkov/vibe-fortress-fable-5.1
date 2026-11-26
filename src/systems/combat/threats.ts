/**
 * Combat threat scanning: `02-systems/16-combat.md` § Threat detection.
 *
 * "Each tick, for each hostile-to-fortress creature that is not stealthed (18),
 * any fortress creature within THREAT_RADIUS that the hostile can come at is sent
 * ThreatNearby { id, hostileId } (throttled to one per creature per THREAT_THROTTLE_TICKS).
 * 10 reacts for civilians; war animals (08) react by attacking."
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { ReaderSetLike, TickContext } from '@core/system';
import type { Registry } from '@core/registry';
import type { EntityId, MovementClass, Tick, TileIndex } from '@core/types';
import { THREAT_RADIUS, THREAT_THROTTLE_TICKS } from './constants';
import { weaponOf } from './melee';

/** Whether a creature attacks from range: its species' natural ranged attack (the wyrm's breath), or a launcher or channel in hand. */
export function attacksFromRange(entities: EntityStore, registry: Registry, id: EntityId): boolean {
  const creature = entities.get(id, C.Creature);
  if (creature === undefined) return false;
  const row = registry.table<{ id: string; attacks?: { range?: number }[] }>('creatures').byIndex(creature.species);
  if (row?.attacks?.some((a) => typeof a.range === 'number' && a.range > 0) === true) return true;
  return weaponOf(entities, registry, id)?.weaponDef.launcher !== undefined;
}

/**
 * § Threat detection: whether a hostile standing on `from` can come at a creature on `to`. It can when
 * its walker label (22, in its own movement class) is the label of `to` or of a tile beside `to` on
 * its level, or, for one that attacks from range, when it has a clear line of fire to `to`. A hostile
 * on a tile its class has no label for (0) is taken to come. A monster sealed in rock, behind a wall
 * or across a cavern band it cannot climb does not.
 */
export function hostileReaches(
  readers: ReaderSetLike,
  entities: EntityStore,
  registry: Registry,
  hostileId: EntityId,
  from: TileIndex,
  to: TileIndex,
): boolean {
  if (!readers.has('pathing')) return true;
  const pathing = readers.pathing;
  const cls = (entities.get(hostileId, C.Motion)?.movementClass ?? 'walker') as MovementClass;
  const label = pathing.labelOf(from, cls);
  if (label === 0) return true;
  if (pathing.labelOf(to, cls) === label) return true;
  const map = readers.map;
  const at = map.unpack(to);
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if ((dx !== 0 || dy !== 0) && map.inBounds(at.x + dx, at.y + dy, at.z) && pathing.labelOf(map.index(at.x + dx, at.y + dy, at.z), cls) === label) return true;
    }
  }
  return attacksFromRange(entities, registry, hostileId) && pathing.lineOfFire(from, to);
}

export function threatScan(
  ctx: TickContext,
  throttles: Map<EntityId, Tick>,
  targetOfFn?: (id: EntityId) => EntityId,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const spatial = ctx.readers.spatial;
  const tick = ctx.tick;

  for (const hostileId of entities.with(C.Creature)) {
    if (!entities.alive(hostileId)) continue;
    const creature = entities.get(hostileId, C.Creature);
    if (!creature) continue;

    // Check if stealthed (18)
    const hostileComp = entities.get(hostileId, C.Hostile);
    if (hostileComp?.stealthed) continue;

    // Check if hostile to fortress
    const fH = creature.faction;
    let hostileToFortress = false;
    if (fH.startsWith('hostile') || fH === 'deep') {
      hostileToFortress = true;
    } else if (fH === 'wild') {
      const wild = entities.get(hostileId, C.Wild);
      if (wild?.state === 'attack') {
        hostileToFortress = true;
      } else if (targetOfFn && targetOfFn(hostileId) !== 0) {
        const tgt = targetOfFn(hostileId);
        const tgtCreature = entities.get(tgt, C.Creature);
        if (tgtCreature?.faction === 'fortress') {
          hostileToFortress = true;
        }
      }
    }

    if (!hostileToFortress) continue;

    const posH = entities.get(hostileId, C.Position);
    if (!posH) continue;
    const tileH = map.index(posH.x, posH.y, posH.z);

    const nearby = spatial.inRadius(tileH, THREAT_RADIUS, 'creature').filter((otherId: EntityId) => {
      if (otherId === hostileId || !entities.alive(otherId)) return false;
      const c = entities.get(otherId, C.Creature);
      if (c?.faction !== 'fortress') return false;
      const p = entities.get(otherId, C.Position);
      if (!p || p.z !== posH.z) return false;
      if (Math.max(Math.abs(p.x - posH.x), Math.abs(p.y - posH.y)) > THREAT_RADIUS) return false;
      // A threat must be able to come: a way for the hostile's class, or a line of fire for a shooter.
      return hostileReaches(ctx.readers, entities, ctx.registry, hostileId, tileH, map.index(p.x, p.y, p.z));
    });

    for (const fortressId of nearby) {
      const last = throttles.get(fortressId) ?? -THREAT_THROTTLE_TICKS;
      if (tick - last >= THREAT_THROTTLE_TICKS) {
        throttles.set(fortressId, tick);
        ctx.emit({
          type: 'ThreatNearby',
          id: fortressId,
          hostileId,
        });
      }
    }
  }
}
