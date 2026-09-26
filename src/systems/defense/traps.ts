import { C, ItemFlag } from '@core/components';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import { resolveMelee, weightedPickPart } from '@systems/combat';
import { CAGE_MAX_SIZE, STONE_FALL_DAMAGE, TRAP_JAM_PERMILLE, TRAP_SKILL } from './constants';
import type { TrapRecord } from './state';

interface MaterialRow { id: string; density: number }
interface SpeciesRow { id: string; plan: string }
interface PlanRow { id: string; parts: Record<string, { hit: number; hpFactor: number }> }

export function trapTargets(ctx: TickContext, creatureId: EntityId, mode: TrapRecord['mode']): boolean {
  const creature = ctx.world.entities.get(creatureId, C.Creature);
  if (creature === undefined) return false;
  if (mode === 'all') return ctx.world.entities.get(creatureId, C.Tame) === undefined;
  return creature.faction === 'wild' || creature.faction === 'deep' || creature.faction.startsWith('hostile:') ||
    ctx.world.entities.get(creatureId, C.Hostile)?.stealthed === true;
}

export function jamChance(corpses: number): number {
  return Math.min(1000, TRAP_JAM_PERMILLE * (corpses + 1));
}

function corpseCount(ctx: TickContext, tile: TileIndex): number {
  return ctx.readers.entities.at(tile).filter((id) => ctx.world.entities.has(id, C.Corpse)).length;
}

export function triggerTrap(ctx: TickContext, trapId: EntityId, creatureId: EntityId, trap: TrapRecord): void {
  if (trap.state !== 'armed' || !trapTargets(ctx, creatureId, trap.mode)) return;
  const entities = ctx.world.entities;
  const building = entities.get(trapId, C.Building);
  if (building?.state !== 'built') return;
  const tile = building.origin;
  const hostile = entities.get(creatureId, C.Hostile);
  if (hostile?.stealthed) entities.add(creatureId, C.Hostile, { ...hostile, stealthed: false, spotted: true });
  let outcome = 'hit';
  if (trap.kind === 'stone_fall') {
    const stoneId = trap.loaded.shift() ?? 0;
    const stone = entities.get(stoneId, C.Item);
    const density = stone === undefined ? 100 : (ctx.registry.table<MaterialRow>('materials').byIndex(stone.material)?.density ?? 100);
    const species = entities.get(creatureId, C.Creature);
    const speciesRow = species === undefined ? undefined : ctx.registry.table<SpeciesRow>('creatures').byIndex(species.species);
    const plan = speciesRow === undefined ? undefined : ctx.registry.table<PlanRow>('bodyPlans').byId(speciesRow.plan);
    const part = plan === undefined ? 'torso' : weightedPickPart(ctx.rng, plan as Parameters<typeof weightedPickPart>[1], entities.get(creatureId, C.Body), true);
    ctx.emit({ type: 'DamageDealt', defenderId: creatureId, part, damageType: 'blunt', amount: Math.round(STONE_FALL_DAMAGE * density / 100), attackerId: trapId, weaponId: 0 });
    if (stoneId !== 0) ctx.world.services.items?.uninstall?.(stoneId, tile);
    trap.state = 'spent';
  } else if (trap.kind === 'cage') {
    const creature = entities.get(creatureId, C.Creature);
    const cageId = trap.loaded[0] ?? 0;
    const cage = entities.get(cageId, C.Item);
    if (creature === undefined || creature.sizeClass > CAGE_MAX_SIZE || cage === undefined) return;
    trap.loaded.shift();
    const from = ctx.world.services.movement?.tileOf(creatureId) ?? tile;
    ctx.world.services.movement?.stopWalking(creatureId);
    ctx.world.services.spatial?.remove(creatureId, from);
    entities.remove(creatureId, C.Position);
    entities.add(creatureId, C.Creature, { ...creature, cagedIn: cageId });
    entities.add(cageId, C.Item, { ...cage, occupantId: creatureId, flags: cage.flags & ~ItemFlag.Installed });
    ctx.world.services.items?.uninstall?.(cageId, tile);
    trap.state = 'spent';
    outcome = 'caged';
    ctx.emit({ type: 'CreatureCaged', creatureId, cageItemId: cageId });
  } else if (trap.kind === 'spike') {
    if (!building.toggled) return;
    for (const weaponId of trap.loaded) {
      const result = resolveMelee(ctx, trapId, creatureId, new Map(), { weaponId, overrideSkill: TRAP_SKILL, overrideDamageType: 'pierce', surprised: true, skipXp: true });
      outcome = result.outcome;
    }
  } else {
    for (const weaponId of trap.loaded) {
      const result = resolveMelee(ctx, trapId, creatureId, new Map(), { weaponId, overrideSkill: TRAP_SKILL, surprised: true, skipXp: true });
      outcome = result.outcome;
    }
    if (ctx.rng.chance(jamChance(corpseCount(ctx, tile)))) trap.state = 'jammed';
  }
  ctx.emit({ type: 'TrapTriggered', trapId, creatureId, kind: trap.kind, outcome });
  if (trap.state === 'spent') ctx.emit({ type: 'TrapSpent', trapId });
  if (trap.state === 'jammed') ctx.emit({ type: 'TrapJammed', trapId });
}
