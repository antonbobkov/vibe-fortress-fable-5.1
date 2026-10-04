/**
 * Barracks and archery range training sessions.
 * `02-systems/16-combat.md` § Training,
 * `04-implementation/algorithms/combat-and-health.md` § Threat scan, duties, training.
 */

import { C, ItemFlag, type Squad } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import { BODY_SLOTS, type Alert, type BodySlot, type EntityId, type TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import { WARDEN_TRAINING_BONUS_PERCENT } from '@systems/dwarves/constants';
import { grantXp } from '@systems/dwarves';
import {
  AMMO_BREAK_PERMILLE,
  SPAR_INJURY_PERMILLE,
  SPAR_TICKS,
  TRAIN_SHIFT_HOURS,
  TRAIN_SHOTS,
  TRAIN_XP,
} from './constants';
import { weaponOf } from './melee';
import { findAmmoForShooter } from './ranged';

export interface BarracksInfo {
  readonly zoneId: EntityId;
  readonly tiles: readonly TileIndex[];
  readonly tier: number;
}

/**
 * Finds the barracks zone assigned to a squad or available.
 */
export function getBarracksForSquad(
  ctx: TickContext,
  squadId: EntityId,
  barracksZoneId: EntityId,
): BarracksInfo | null {
  if (!ctx.readers.has('14')) return null;
  const buildings = ctx.readers.of<BuildingsReader>('14');

  if (barracksZoneId !== 0) {
    const z = buildings.zone(barracksZoneId);
    if (z && z.tiles.length > 0) {
      const room = buildings.room(barracksZoneId);
      return { zoneId: barracksZoneId, tiles: z.tiles, tier: room?.tier ?? 0 };
    }
  }

  // Look for zone with squadId setting
  const bZones = buildings.zonesOfType('barracks');
  for (const zId of bZones) {
    const z = buildings.zone(zId);
    if (z && (z.settings['squadId'] === squadId || z.settings['squad'] === squadId)) {
      const room = buildings.room(zId);
      return { zoneId: zId, tiles: z.tiles, tier: room?.tier ?? 0 };
    }
  }

  // Fallback to first barracks zone if exists
  if (bZones.length > 0) {
    const firstId = bZones[0] as EntityId;
    const z = buildings.zone(firstId);
    if (z && z.tiles.length > 0) {
      const room = buildings.room(firstId);
      return { zoneId: firstId, tiles: z.tiles, tier: room?.tier ?? 0 };
    }
  }

  return null;
}

/**
 * Checks if a member of a squad with station is currently on station shift.
 * Shifts swap every TRAIN_SHIFT_HOURS (6 hours).
 */
export function isOnStationShift(squad: Squad, memberId: EntityId, tick: number): boolean {
  if (squad.station === null) return false;
  const sorted = squad.members.slice().sort((a, b) => a - b);
  const memberIdx = sorted.indexOf(memberId);
  if (memberIdx < 0) return false;
  const shiftCount = Math.ceil(sorted.length / 2);
  const isFirstHalf = memberIdx < shiftCount;
  const shiftIndex = Math.floor(tick / (TRAIN_SHIFT_HOURS * 100)) % 2;
  return shiftIndex === 0 ? !isFirstHalf : isFirstHalf;
}

/**
 * Checks if a fortress has an appointed, alive Warden.
 */
export function hasWarden(entities: EntityStore): boolean {
  for (const id of entities.with(C.Title)) {
    if (entities.alive(id)) {
      const title = entities.get(id, C.Title);
      if (title?.title === 'warden') return true;
    }
  }
  return false;
}

/**
 * Step training for squads in 'train' mode.
 */
export function stepTraining(
  ctx: TickContext,
  rng: RngStream,
  sessionEnds: Map<EntityId, number>,
  alert: Alert,
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const registry = ctx.registry;

  // Training only happens in 'calm' alert (watchful and hearth force active duty)
  if (alert !== 'calm') return;

  const wardenBonus = hasWarden(entities)
    ? Math.floor((TRAIN_XP * (100 + WARDEN_TRAINING_BONUS_PERCENT)) / 100)
    : TRAIN_XP;

  for (const squadId of entities.with(C.Squad)) {
    const squad = entities.get(squadId, C.Squad);
    if (!squad || squad.mode !== 'train') continue;

    const barracks = getBarracksForSquad(ctx, squadId, squad.barracksZoneId);
    if (!barracks || barracks.tiles.length === 0) continue;

    // Cache barracksZoneId on squad if not already set
    if (squad.barracksZoneId === 0) {
      squad.barracksZoneId = barracks.zoneId;
    }

    // Find present members on barracks tiles
    const present: EntityId[] = [];
    for (const m of squad.members) {
      if (!entities.alive(m)) continue;
      const soldier = entities.get(m, C.Soldier);
      if (!soldier || !soldier.onDuty) continue;

      if (isOnStationShift(squad, m, ctx.tick)) continue;

      const pos = entities.get(m, C.Position);
      if (!pos) continue;
      const tile = map.index(pos.x, pos.y, pos.z);
      if (barracks.tiles.includes(tile)) {
        present.push(m);
      }
    }

    if (present.length === 0) continue;

    // Check for archery target building in barracks
    let archeryTargetTile = -1;
    if (ctx.readers.has('14')) {
      const buildings = ctx.readers.of<BuildingsReader>('14');
      for (const t of barracks.tiles) {
        const bId = buildings.at(t);
        if (bId !== 0 && buildings.get(bId)?.typeId === 'archery_target') {
          archeryTargetTile = t;
          break;
        }
      }
    }

    const rangedPracticing: EntityId[] = [];

    // Archery range practice for ranged members if target building exists
    if (archeryTargetTile >= 0) {
      for (const m of present) {
        const w = weaponOf(entities, registry, m);
        if (w?.weaponDef.launcher) {
          rangedPracticing.push(m);
          const nextTick = sessionEnds.get(m) ?? 0;
          if (ctx.tick >= nextTick) {
            sessionEnds.set(m, ctx.tick + SPAR_TICKS);

            const ammoType = w.weaponDef.launcher.ammo;

            // Fire up to TRAIN_SHOTS bolts/arrows
            for (let s = 0; s < TRAIN_SHOTS; s++) {
              const ammoItemId = findAmmoForShooter(entities, registry, m, ammoType);
              if (ammoItemId !== 0) {
                const ammoItem = entities.get(ammoItemId, C.Item);
                if (ammoItem) {
                  if (ammoItem.count > 1) {
                    ammoItem.count -= 1;
                    // Spawn dropped bolt at archery target
                    const breaks = rng.chance(AMMO_BREAK_PERMILLE);
                    if (!breaks) {
                      const spawned = ctx.world.services.spawn?.item(
                        ammoItem.type,
                        ammoItem.material,
                        archeryTargetTile,
                        1,
                        ammoItem.quality,
                      );
                      if (typeof spawned === 'number') {
                        const spItem = entities.get(spawned, C.Item);
                        if (spItem) {
                          spItem.flags &= ~ItemFlag.Owned;
                          spItem.ownerId = 0;
                        }
                      }
                    }
                  } else {
                    const breaks = rng.chance(AMMO_BREAK_PERMILLE);
                    if (breaks) {
                      entities.destroy(ammoItemId);
                      ctx.world.services.items?.refreshDerivedIndexes?.(ammoItemId);
                    } else {
                      ammoItem.flags &= ~ItemFlag.Owned;
                      ammoItem.ownerId = 0;
                      ammoItem.carriedBy = 0;
                      if (ctx.world.services.items) {
                        ctx.world.services.items.dropAt(ammoItemId, archeryTargetTile);
                      } else {
                        entities.add(ammoItemId, C.Position, map.unpack(archeryTargetTile));
                      }
                    }
                  }
                }
              }
            }

            const skillName = w.weaponDef.skill;
            grantXp(entities, registry, m, skillName, wardenBonus, (e) => ctx.emit(e));
            ctx.emit({ type: 'TrainingSession', squadId, members: [m] });
          }
        }
      }
    }

    // Melee sparring / solo drills for remaining present members
    const meleeMembers = present.filter((m) => !rangedPracticing.includes(m));
    meleeMembers.sort((a, b) => a - b);

    // Form consecutive pairs
    const pairs: [EntityId, EntityId][] = [];
    for (let i = 0; i + 1 < meleeMembers.length; i += 2) {
      pairs.push([meleeMembers[i] as EntityId, meleeMembers[i + 1] as EntityId]);
    }
    const solo = meleeMembers.length % 2 === 1 ? meleeMembers[meleeMembers.length - 1] : undefined;

    // Process pairs
    for (const [m1, m2] of pairs) {
      const nextTick = Math.max(sessionEnds.get(m1) ?? 0, sessionEnds.get(m2) ?? 0);
      if (ctx.tick >= nextTick) {
        sessionEnds.set(m1, ctx.tick + SPAR_TICKS);
        sessionEnds.set(m2, ctx.tick + SPAR_TICKS);

        for (const m of [m1, m2]) {
          const w = weaponOf(entities, registry, m);
          if (w) {
            grantXp(entities, registry, m, w.weaponDef.skill, wardenBonus, (e) => ctx.emit(e));
          }
          grantXp(entities, registry, m, 'dodge', wardenBonus, (e) => ctx.emit(e));

          const equip = entities.get(m, C.Equipment);
          if (equip && equip.shield !== 0) {
            grantXp(entities, registry, m, 'shield', wardenBonus, (e) => ctx.emit(e));
          }
          if (equip && Object.values(equip.armor).some((id) => id !== 0)) {
            grantXp(entities, registry, m, 'armor_use', wardenBonus, (e) => ctx.emit(e));
          }
        }

        // Sparring injury roll
        const w1 = weaponOf(entities, registry, m1);
        const w2 = weaponOf(entities, registry, m2);
        const isTrain1 = (w1?.weaponDef as { training?: boolean } | undefined)?.training === true;
        const isTrain2 = (w2?.weaponDef as { training?: boolean } | undefined)?.training === true;

        if (!isTrain1 && !isTrain2) {
          if (rng.int(0, 999) < SPAR_INJURY_PERMILLE) {
            const defender = rng.int(0, 1) === 0 ? m1 : m2;
            const attacker = defender === m1 ? m2 : m1;
            const b = entities.get(defender, C.Body);
            if (b) {
              const nonDestroyed: number[] = [];
              for (let i = 0; i < b.parts.length; i++) {
                if (!b.parts[i]?.destroyed) nonDestroyed.push(i);
              }
              if (nonDestroyed.length > 0) {
                const partIdx = nonDestroyed[rng.int(0, nonDestroyed.length - 1)] as number;
                const slotName = BODY_SLOTS[partIdx] as BodySlot;
                const weaponEntityId = weaponOf(entities, registry, attacker)?.item ?? 0;
                ctx.emit({
                  type: 'DamageDealt',
                  defenderId: defender,
                  part: slotName,
                  damageType: 'blunt',
                  amount: 2, // light bruise
                  attackerId: attacker,
                  weaponId: weaponEntityId,
                });
              }
            }
          }
        }

        ctx.emit({ type: 'TrainingSession', squadId, members: [m1, m2] });
      }
    }

    // Process solo
    if (solo !== undefined) {
      const nextTick = sessionEnds.get(solo) ?? 0;
      if (ctx.tick >= nextTick) {
        sessionEnds.set(solo, ctx.tick + SPAR_TICKS);
        const soloXp = Math.floor(wardenBonus / 2);

        const w = weaponOf(entities, registry, solo);
        if (w) {
          grantXp(entities, registry, solo, w.weaponDef.skill, soloXp, (e) => ctx.emit(e));
        }
        grantXp(entities, registry, solo, 'dodge', soloXp, (e) => ctx.emit(e));

        const equip = entities.get(solo, C.Equipment);
        if (equip && equip.shield !== 0) {
          grantXp(entities, registry, solo, 'shield', soloXp, (e) => ctx.emit(e));
        }
        if (equip && Object.values(equip.armor).some((id) => id !== 0)) {
          grantXp(entities, registry, solo, 'armor_use', soloXp, (e) => ctx.emit(e));
        }

        ctx.emit({ type: 'TrainingSession', squadId, members: [solo] });
      }
    }
  }
}
