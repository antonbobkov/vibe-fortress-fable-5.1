/**
 * Combat threat scanning: `02-systems/16-combat.md` § Threat detection.
 *
 * "Each tick, for each hostile-to-fortress creature that is not stealthed (18),
 * any fortress creature within THREAT_RADIUS is sent ThreatNearby { id, hostileId }
 * (throttled to one per creature per THREAT_THROTTLE_TICKS). 10 reacts for civilians;
 * war animals (08) react by attacking."
 */

import { C } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, Tick } from '@core/types';
import { THREAT_RADIUS, THREAT_THROTTLE_TICKS } from './constants';

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
      return Math.max(Math.abs(p.x - posH.x), Math.abs(p.y - posH.y)) <= THREAT_RADIUS;
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
