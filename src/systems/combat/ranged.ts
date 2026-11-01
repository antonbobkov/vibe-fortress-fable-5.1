/**
 * Combat system: ranged combat resolution and projectile simulation.
 * `02-systems/16-combat.md` § Ranged resolution.
 * `02-systems/22-pathfinding-and-spatial.md` § Line of sight.
 */

import { C, type Body } from '@core/components';
import { crowdTicks } from '@core/crowding';
import type { EntityStore } from '@core/entities';
import { TileKind, type Map3D } from '@core/map3d';
import type { Registry } from '@core/registry';
import type { RngStream } from '@core/rng';
import type { TickContext } from '@core/system';
import type { BodySlot, DamageType, EntityId, TileIndex } from '@core/types';
import { grantXp } from '@systems/dwarves';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import {
  AMMO_BREAK_PERMILLE,
  BLUNT_THROUGH_PERCENT,
  MIN_ATTACK_COOLDOWN,
  PROJECTILE_SPEED,
} from './constants';
import {
  armorCovering,
  getAttribute,
  getDamageVsLayer,
  getSkill,
  isConscious,
  isFleeing,
  isWarTrained,
  shieldIsBuckler,
  shieldOf,
  weaponOf,
  weightedPickPart,
  type WieldedWeapon,
} from './melee';

interface MaterialRow {
  readonly id: string;
  readonly class: string;
  readonly sharpness?: number;
}

interface MetalRow {
  readonly id: string;
  readonly weaponMult: number;
  readonly armorMult: number;
  readonly bluntBonus?: number;
}

interface BodyPlanRow {
  readonly id: string;
  readonly parts: Record<BodySlot, { hit: number; hpFactor: number }>;
}

interface LauncherDef {
  readonly range: number;
  readonly power: number;
  readonly ammo: string;
  readonly metalPower?: number;
  readonly yewPower?: number;
}

export interface AmmoRow {
  readonly id: string;
  readonly name: string;
  readonly damageType: DamageType;
  readonly damage: number;
}

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

/**
 * 2D Bresenham line algorithm between (x0, y0) and (x1, y1).
 */
export function bresenham2D(x0: number, y0: number, x1: number, y1: number): Point2D[] {
  const points: Point2D[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;

  for (;;) {
    points.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }

  return points;
}

/**
 * Chebyshev distance between two tiles on a map.
 */
export function chebyshevBetween(map: Map3D, a: TileIndex, b: TileIndex): number {
  return Math.max(
    Math.abs(map.xOf(a) - map.xOf(b)),
    Math.abs(map.yOf(a) - map.yOf(b)),
    Math.abs(map.zOf(a) - map.zOf(b)),
  );
}

/**
 * Returns true if a tile has an adjacent fortification on the same z-level.
 */
export function hasAdjacentFortification(map: Map3D, tile: TileIndex): boolean {
  for (const n of map.neighbors8(tile)) {
    if (map.kindAt(n) === TileKind.Fortification) return true;
  }
  return false;
}

/**
 * Checks whether a tile blocks a projectile entering it.
 * Blocked by: Wall, Tree, Boulder, closed doors, raised bridges, closed floodgates,
 * and Fortifications unless the fortification is adjacent to `from` or `to`.
 */
export function blocksProjectile(
  map: Map3D,
  tile: TileIndex,
  from: TileIndex,
  to: TileIndex,
  buildings?: BuildingsReader,
): boolean {
  if (!map.validIndex(tile)) return true;
  const kind = map.kindAt(tile);
  if (kind === TileKind.Wall || kind === TileKind.Tree || kind === TileKind.Boulder) return true;
  if (buildings && buildings.blocksSightAt(tile)) return true;
  if (kind === TileKind.Fortification) {
    const nearFrom = chebyshevBetween(map, tile, from) <= 1;
    const nearTo = chebyshevBetween(map, tile, to) <= 1;
    if (!nearFrom && !nearTo) return true;
  }
  return false;
}

/**
 * Line of sight for ranged combat (`16` § Ranged resolution, `22` § Line of sight).
 * Same z-level: Bresenham ray with no blocking tiles in between.
 * Cross z-level: only allowed if shooter is at target.z + 1 and shooter has an overlook
 * fortification (adjacent to a fortification overlooking the target).
 */
export function lineOfSightRanged(
  map: Map3D,
  from: TileIndex,
  to: TileIndex,
  range: number,
  buildings?: BuildingsReader,
): boolean {
  if (!map.validIndex(from) || !map.validIndex(to)) return false;
  if (from === to) return true;

  const zFrom = map.zOf(from);
  const zTo = map.zOf(to);
  const xFrom = map.xOf(from);
  const yFrom = map.yOf(from);
  const xTo = map.xOf(to);
  const yTo = map.yOf(to);

  const dx = Math.abs(xTo - xFrom);
  const dy = Math.abs(yTo - yFrom);
  const dz = Math.abs(zTo - zFrom);
  const dist = Math.max(dx, dy) + dz * 2;
  if (dist > range) return false;

  if (zFrom === zTo) {
    const line = bresenham2D(xFrom, yFrom, xTo, yTo);
    for (let i = 1; i < line.length - 1; i += 1) {
      const pt = line[i];
      if (!pt) continue;
      const tile = map.index(pt.x, pt.y, zFrom);
      if (blocksProjectile(map, tile, from, to, buildings)) return false;
    }
    return true;
  }

  // Cross-level overlook rule:
  // Shooter must be exactly 1 level above target
  if (zFrom !== zTo + 1) return false;

  const line = bresenham2D(xFrom, yFrom, xTo, yTo);
  if (line.length < 2) return false;

  // Shooter must overlook through/adjacent to a fortification on shooter's level
  const step1 = line[1];
  if (!step1) return false;
  const tile1AtZFrom = map.index(step1.x, step1.y, zFrom);
  const hasOverlookFort =
    map.kindAt(tile1AtZFrom) === TileKind.Fortification || hasAdjacentFortification(map, from);
  if (!hasOverlookFort) return false;

  // Along the target's level, intermediate tiles must not block
  for (let i = 1; i < line.length - 1; i += 1) {
    const pt = line[i];
    if (!pt) continue;
    const tileBelow = map.index(pt.x, pt.y, zTo);
    if (blocksProjectile(map, tileBelow, from, to, buildings)) return false;
  }

  return true;
}

/**
 * Builds the sequence of tiles a projectile travels along from `from` towards `to`
 * up to Chebyshev distance `maxRange`. Does not include `from`.
 */
export function bresenhamRay(
  map: Map3D,
  from: TileIndex,
  to: TileIndex,
  maxRange: number,
): TileIndex[] {
  const zFrom = map.zOf(from);
  const zTo = map.zOf(to);
  const xFrom = map.xOf(from);
  const yFrom = map.yOf(from);
  const xTo = map.xOf(to);
  const yTo = map.yOf(to);

  const tiles: TileIndex[] = [];
  let x = xFrom;
  let y = yFrom;
  const dx = Math.abs(xTo - xFrom);
  const dy = -Math.abs(yTo - yFrom);
  const sx = xTo >= xFrom ? 1 : -1;
  const sy = yTo >= yFrom ? 1 : -1;
  let err = dx + dy;

  let currentDist = 0;
  while (currentDist < maxRange) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    currentDist += 1;

    // Determine z for this tile (step down to zTo if cross-level overlook)
    const z = zFrom === zTo ? zFrom : currentDist === 1 ? zFrom : zTo;
    if (!map.inBounds(x, y, z)) break;
    const tile = map.index(x, y, z);
    tiles.push(tile);
  }

  return tiles;
}

/**
 * Returns creature size from content, default 60 (dwarf size).
 */
export function getCreatureSize(entities: EntityStore, registry: Registry, id: EntityId): number {
  const creature = entities.get(id, C.Creature);
  if (!creature) return 60;
  const spTable = registry.table<{ id: string; size: number }>('creatures');
  const sp = spTable.byIndex(creature.species);
  return sp?.size ?? 60;
}

/**
 * Multiplier for ammunition material.
 */
export function getAmmoMaterialMult(registry: Registry, materialIndex: number): number {
  const matRow = registry.table<MaterialRow>('materials').byIndex(materialIndex);
  if (matRow === undefined) return 1.0;
  if (matRow.class === 'metal') {
    const metalRow = registry.table<MetalRow>('metals').byId(matRow.id);
    if (metalRow !== undefined) return metalRow.weaponMult / 1000;
  } else if (matRow.class === 'wood') {
    return 0.4;
  } else if (matRow.class === 'bone') {
    return 0.5;
  } else if (matRow.sharpness !== undefined) {
    return matRow.sharpness / 1000;
  }
  return 1.0;
}

/**
 * Returns the launcher power multiplier from content.
 */
export function getLauncherPower(registry: Registry, weapon: WieldedWeapon): number {
  const launcher = weapon.weaponDef.launcher as LauncherDef | undefined;
  if (!launcher) return 1.0;
  const matRow = registry.table<MaterialRow>('materials').byIndex(weapon.material);
  if (matRow?.class === 'metal' && launcher.metalPower !== undefined) {
    return launcher.metalPower / 1000;
  }
  if (matRow?.id === 'yew' && launcher.yewPower !== undefined) {
    return launcher.yewPower / 1000;
  }
  return launcher.power / 1000;
}

/**
 * Calculates ranged hit chance (percentage 3..95) according to `16` § Ranged resolution.
 * hit = 40 + skill(shooter, launcherSkill) * 3 - distance * 2 + (size(target) - 60) / 4 - skill(target, 'dodge') * 2 + (target unconscious ? 40 : 0)
 */
export function calculateRangedHit(
  entities: EntityStore,
  registry: Registry,
  shooterId: EntityId,
  targetId: EntityId,
  weaponSkill: string,
  distance: number,
): number {
  const launcherSkill = getSkill(entities, registry, shooterId, weaponSkill);
  const dodgeSkill = getSkill(entities, registry, targetId, 'dodge');
  const targetSize = getCreatureSize(entities, registry, targetId);
  const targetUnconscious = !isConscious(entities, targetId);

  const hit =
    40 +
    launcherSkill * 3 -
    distance * 2 +
    Math.floor((targetSize - 60) / 4) -
    dodgeSkill * 2 +
    (targetUnconscious ? 40 : 0);

  return Math.max(3, Math.min(95, hit));
}

/**
 * Finds matching ammo item on shooter (in quiver or carried).
 */
export function findAmmoForShooter(
  entities: EntityStore,
  registry: Registry,
  shooterId: EntityId,
  wantedAmmoId: string,
  carriedItems?: readonly EntityId[],
): EntityId {
  const equip = entities.get(shooterId, C.Equipment);
  const itemsTable = registry.table<{ id: string }>('items');

  if (equip && equip.quiver !== 0 && entities.alive(equip.quiver)) {
    const qItem = entities.get(equip.quiver, C.Item);
    if (qItem) {
      const qRow = itemsTable.byIndex(qItem.type);
      if (qRow?.id === wantedAmmoId && qItem.count > 0) {
        return equip.quiver;
      }
    }
  }

  // Check carried items
  for (const id of carriedItems ?? entities.with(C.Item)) {
    const item = entities.get(id, C.Item);
    if (item && item.carriedBy === shooterId && item.count > 0) {
      const row = itemsTable.byIndex(item.type);
      if (row?.id === wantedAmmoId) {
        return id;
      }
    }
  }

  return 0;
}

/**
 * Drop or destroy an ammunition item after a projectile finishes or hits an obstacle.
 */
export function dropOrBreakAmmo(
  ctx: TickContext,
  rng: RngStream,
  itemId: EntityId,
  tile: TileIndex,
): void {
  const breaks = rng.chance(AMMO_BREAK_PERMILLE);
  const items = ctx.world.services.items;
  if (items === null) return;
  if (breaks) items.destroy(itemId, 'projectile_break');
  else {
    items.setOwner(itemId, 0);
    items.dropAt(itemId, tile);
  }
}

/**
 * Resolves a projectile hit against a defender (target or bystander).
 */
export function resolveProjectileHit(
  ctx: TickContext,
  entities: EntityStore,
  registry: Registry,
  rng: RngStream,
  shooterId: EntityId,
  defenderId: EntityId,
  rawDamage: number,
  damageType: DamageType,
  weaponDef: WieldedWeapon['weaponDef'],
  options?: { skipXp?: boolean | undefined },
): void {
  // Shield block check
  const shieldId = shieldOf(entities, defenderId);
  const defConscious = isConscious(entities, defenderId);
  const defFleeing = isFleeing(entities, defenderId);

  if (shieldId !== 0 && defConscious && !defFleeing) {
    const isBuckler = shieldIsBuckler(registry, entities, shieldId);
    let blockChance = Math.min(40, 10 + getSkill(entities, registry, defenderId, 'shield') * 2);
    if (isBuckler) blockChance = Math.floor(blockChance * 0.7);
    if (rng.int(0, 99) < blockChance) {
      ctx.emit({
        type: 'AttackResolved',
        attackerId: shooterId,
        defenderId,
        targetId: defenderId,
        part: null,
        damageType,
        amount: 0,
        outcome: 'blocked',
      });
      if (!options?.skipXp) {
        grantXp(entities, registry, defenderId, 'shield', 2, (e) => ctx.emit(e));
      }
      return;
    }
  }

  // Pick body part
  const plansTable = registry.table<BodyPlanRow>('bodyPlans');
  const creatureD = entities.get(defenderId, C.Creature);
  const speciesTable = registry.table<{ id: string; plan: string; naturalArmor?: number }>('creatures');
  const spD = creatureD ? speciesTable.byIndex(creatureD.species) : undefined;
  const plan = spD ? plansTable.byId(spD.plan) : undefined;
  const bodyD = entities.get(defenderId, C.Body) as Body | undefined;
  let part: BodySlot = 'torso';
  if (plan !== undefined) {
    part = weightedPickPart(rng, plan, bodyD, !defConscious);
  }

  // Armor reduction
  const armorPieces = armorCovering(entities, registry, defenderId, part);
  let red = 0;
  for (const piece of armorPieces) {
    const layerMult = getDamageVsLayer(damageType, piece.layer);
    red += piece.armor * piece.armorMult * (piece.coverage / 100) * piece.qualityArmorMult * layerMult;
  }
  const creature = entities.get(defenderId, C.Creature);
  if (creature) {
    const naturalArmor = (spD?.naturalArmor ?? 0) + (isWarTrained(entities, defenderId) ? 1 : 0);
    red += naturalArmor * getDamageVsLayer(damageType, 'plate');
  }

  let damage = Math.max(0, rawDamage - red);
  if (damageType === 'blunt' && red > 0) {
    damage = Math.max(damage, (rawDamage * BLUNT_THROUGH_PERCENT) / 100);
  }

  // Toughness reduction
  const touD = getAttribute(entities, defenderId, 'tou');
  const touReduction = Math.min(10, touD / 10);
  damage = Math.round((damage * (100 - touReduction)) / 100);

  ctx.emit({
    type: 'DamageDealt',
    defenderId,
    part,
    damageType,
    amount: damage,
    attackerId: shooterId,
    weaponId: 0,
  });

  ctx.emit({
    type: 'AttackResolved',
    attackerId: shooterId,
    defenderId,
    targetId: defenderId,
    part,
    damageType,
    amount: damage,
    outcome: 'hit',
  });

  if (!options?.skipXp) {
    grantXp(entities, registry, shooterId, weaponDef.skill, 3, (e) => ctx.emit(e));
    if (red > 0) {
      grantXp(entities, registry, defenderId, 'armor_use', 1, (e) => ctx.emit(e));
    }
  }
}

/**
 * Fires a ranged weapon at a target (`16` § Ranged resolution).
 */
export function fireRanged(
  ctx: TickContext,
  shooterId: EntityId,
  targetId: EntityId,
  cooldownUntilMap: Map<EntityId, number>,
  options?: { skipXp?: boolean | undefined; instantAdvance?: boolean | undefined },
): boolean {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const registry = ctx.registry;
  const rng = ctx.rng;

  const w = weaponOf(entities, registry, shooterId);
  const creatureS = entities.get(shooterId, C.Creature);
  const spTable = registry.table<{ id: string; attacks?: { name: string; type: string; damage: number; size: number; range?: number }[] }>('creatures');
  const spRow = creatureS ? spTable.byIndex(creatureS.species) : undefined;
  const naturalRanged = spRow?.attacks?.find((a) => typeof a.range === 'number' && a.range > 0);

  if (!naturalRanged && (w === null || w.weaponDef.launcher === undefined)) return false;

  const launcher = w?.weaponDef.launcher;
  const range = launcher?.range ?? naturalRanged?.range ?? 0;

  const posS = entities.get(shooterId, C.Position);
  const posT = entities.get(targetId, C.Position);
  if (posS === undefined || posT === undefined) return false;

  const fromTile = map.index(posS.x, posS.y, posS.z);
  const toTile = map.index(posT.x, posT.y, posT.z);

  const dx = Math.abs(posT.x - posS.x);
  const dy = Math.abs(posT.y - posS.y);
  const dz = Math.abs(posT.z - posS.z);
  const distance = Math.max(dx, dy) + dz * 2;

  if (distance > range) return false;

  const buildingsReader = ctx.readers.has('14')
    ? ctx.readers.of<BuildingsReader>('14')
    : undefined;

  if (!lineOfSightRanged(map, fromTile, toTile, range, buildingsReader)) {
    return false;
  }

  let projectileItemId = 0;
  let rawDamage = 0;
  let ammoDamageType: DamageType = 'pierce';
  let weaponSkill = 'unarmed';
  let weaponSize = 6;

  if (naturalRanged) {
    projectileItemId = 0;
    rawDamage = naturalRanged.damage;
    ammoDamageType = (naturalRanged.type as DamageType) ?? 'burn';
    weaponSkill = 'unarmed';
    weaponSize = naturalRanged.size;
  } else if (launcher && w) {
    // Find ammo
    const carriedItems = ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13').carriedItems(shooterId) : undefined;
    const ammoId = findAmmoForShooter(entities, registry, shooterId, launcher.ammo, carriedItems);
    if (ammoId === 0) return false;

    // Split or take 1 ammo unit
    projectileItemId = ammoId;
    const ammoItem = entities.get(ammoId, C.Item);
    const items = ctx.world.services.items;
    if (items === null || ammoItem === undefined) return false;
    if (ammoItem.count > 1) projectileItemId = items.split(ammoId, 1);
    else {
      const equip = entities.get(shooterId, C.Equipment);
      if (equip?.quiver === ammoId) equip.quiver = 0;
    }
    const ammoTable = registry.table<AmmoRow>('ammo');
    const ammoRow = ammoTable.byId(launcher.ammo);
    const ammoBaseDamage = ammoRow?.damage ?? 16;
    ammoDamageType = ammoRow?.damageType ?? 'pierce';
    const launcherPower = getLauncherPower(registry, w);
    const ammoMatMult = ammoItem ? getAmmoMaterialMult(registry, ammoItem.material) : 1.0;
    rawDamage = Math.round(ammoBaseDamage * launcherPower * ammoMatMult);
    weaponSkill = w.weaponDef.skill;
    weaponSize = w.weaponDef.size;
  }

  // Compute hit chance and roll
  const hit = calculateRangedHit(entities, registry, shooterId, targetId, weaponSkill, distance);
  const roll = rng.int(0, 99);
  const hitSucceeded = roll < hit;

  // Trajectory ray
  const line = bresenhamRay(map, fromTile, toTile, range);

  // Set cooldown
  const agiS = getAttribute(entities, shooterId, 'agi');
  // 22 § Crowding: a crowd on the shooter's tile slows its shots.
  const movement = ctx.world.services.movement;
  const crowd = movement === null ? 100 : movement.crowdPercentAt(movement.tileOf(shooterId));
  const cooldownTicks = crowdTicks(Math.max(
    MIN_ATTACK_COOLDOWN,
    Math.floor(weaponSize * 3 + 10 - agiS / 10),
  ), crowd);
  cooldownUntilMap.set(shooterId, ctx.tick + cooldownTicks);

  // Spawn projectile entity
  const projId = entities.create('projectile');
  entities.add(projId, C.Projectile, {
    itemId: projectileItemId,
    from: fromTile,
    to: toTile,
    progress: 0,
    shooterId,
    targetId,
    hitRoll: hitSucceeded ? 1 : 0,
    damage: rawDamage,
    damageType: ammoDamageType,
    line,
    skipXp: options?.skipXp,
  });
  if (projectileItemId !== 0) ctx.world.services.items?.attachToCarrier(projectileItemId, projId);
  entities.add(projId, C.Position, {
    x: posS.x,
    y: posS.y,
    z: posS.z,
  });

  ctx.emit({
    type: 'ProjectileFired',
    shooterId,
    targetId,
    itemId: projectileItemId,
  });

  if (options?.instantAdvance) {
    while (entities.has(projId, C.Projectile)) {
      advanceSingleProjectile(ctx, projId, rng, options);
    }
  }

  return true;
}

/**
 * Advances all active projectiles for one tick by up to PROJECTILE_SPEED (3) tiles.
 */
export function advanceProjectiles(
  ctx: TickContext,
  rng: RngStream,
  options?: { skipXp?: boolean | undefined },
): void {
  const entities = ctx.world.entities;
  const active = entities.with(C.Projectile);
  for (const projId of active) {
    advanceSingleProjectile(ctx, projId, rng, options);
  }
}

/**
 * Advances a single projectile by up to PROJECTILE_SPEED tiles.
 */
function advanceSingleProjectile(
  ctx: TickContext,
  projId: EntityId,
  rng: RngStream,
  options?: { skipXp?: boolean | undefined },
): void {
  const entities = ctx.world.entities;
  const map = ctx.world.map;
  const registry = ctx.registry;
  const proj = entities.get(projId, C.Projectile);
  if (proj === undefined) return;

  const buildingsReader = ctx.readers.has('14')
    ? ctx.readers.of<BuildingsReader>('14')
    : undefined;

  let progress = Math.floor(proj.progress);
  let prevTile = progress === 0 ? proj.from : (proj.line[progress - 1] ?? proj.from);

  for (let s = 0; s < PROJECTILE_SPEED; s += 1) {
    if (progress >= proj.line.length) {
      // Reached max range: drop or break
      if (proj.itemId !== 0) dropOrBreakAmmo(ctx, rng, proj.itemId, prevTile);
      entities.destroy(projId);
      return;
    }

    const nextTile = proj.line[progress];
    if (nextTile === undefined) break;
    progress += 1;
    proj.progress = progress;

    // Update projectile position
    entities.add(projId, C.Position, map.unpack(nextTile));

    // Check if nextTile blocks projectile
    if (blocksProjectile(map, nextTile, proj.from, proj.to, buildingsReader)) {
      if (proj.itemId !== 0) dropOrBreakAmmo(ctx, rng, proj.itemId, prevTile);
      entities.destroy(projId);
      return;
    }

    // Check creatures on nextTile
    const creaturesOnTile: EntityId[] = [];
    for (const c of entities.with(C.Position, C.Creature)) {
      if (entities.alive(c)) {
        const p = entities.get(c, C.Position);
        if (p && map.index(p.x, p.y, p.z) === nextTile) {
          creaturesOnTile.push(c);
        }
      }
    }

    // Is target on this tile?
    if (creaturesOnTile.includes(proj.targetId) || nextTile === proj.to) {
      if (proj.hitRoll === 1) {
        // Hit target!
        const w = weaponOf(entities, registry, proj.shooterId);
        const wDef = w?.weaponDef ?? ({ skill: 'unarmed', size: 6 } as unknown as WieldedWeapon['weaponDef']);
        resolveProjectileHit(
          ctx,
          entities,
          registry,
          rng,
          proj.shooterId,
          proj.targetId,
          proj.damage,
          proj.damageType,
          wDef,
          proj.skipXp ? { skipXp: true } : undefined,
        );
        if (proj.itemId !== 0) dropOrBreakAmmo(ctx, rng, proj.itemId, nextTile);
        entities.destroy(projId);
        return;
      } else {
        // Missed target: emit miss, grant dodge/weapon XP, continue to max range!
        const w = weaponOf(entities, registry, proj.shooterId);
        const wSkill = w?.weaponDef.skill ?? 'crossbow';
        ctx.emit({
          type: 'AttackResolved',
          attackerId: proj.shooterId,
          defenderId: proj.targetId,
          targetId: proj.targetId,
          part: null,
          damageType: proj.damageType,
          amount: 0,
          outcome: 'miss',
        });
        if (!options?.skipXp) {
          grantXp(entities, registry, proj.targetId, 'dodge', 2, (e) => ctx.emit(e));
          grantXp(entities, registry, proj.shooterId, wSkill, 1, (e) => ctx.emit(e));
        }
        // Projectile continues along ray!
        prevTile = nextTile;
        continue;
      }
    }

    // Check bystanders (creature other than target and shooter)
    const bystander = creaturesOnTile.find(
      (c) => c !== proj.targetId && c !== proj.shooterId,
    );
    if (bystander !== undefined) {
      // Half hit chance against bystander
      const w = weaponOf(entities, registry, proj.shooterId);
      const wDef = w?.weaponDef ?? ({ skill: 'unarmed', size: 6 } as unknown as WieldedWeapon['weaponDef']);
      const hit = calculateRangedHit(
        entities,
        registry,
        proj.shooterId,
        bystander,
        wDef.skill,
        chebyshevBetween(map, proj.from, nextTile),
      );
      const bystanderHitChance = Math.floor(hit / 2);
      if (rng.int(0, 99) < bystanderHitChance) {
        // Hit bystander!
        resolveProjectileHit(
          ctx,
          entities,
          registry,
          rng,
          proj.shooterId,
          bystander,
          proj.damage,
          proj.damageType,
          wDef,
          proj.skipXp ? { skipXp: true } : undefined,
        );
        if (proj.itemId !== 0) dropOrBreakAmmo(ctx, rng, proj.itemId, nextTile);
        entities.destroy(projId);
        return;
      }
      // Missed bystander: continue
    }

    prevTile = nextTile;
  }

  // If steps loop finished and reached end of line
  if (progress >= proj.line.length) {
    if (proj.itemId !== 0) dropOrBreakAmmo(ctx, rng, proj.itemId, prevTile);
    entities.destroy(projId);
  }
}
