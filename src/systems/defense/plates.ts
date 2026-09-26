import { C } from '@core/components';
import { FluidType } from '@core/map3d';
import type { TickContext } from '@core/system';
import type { EntityId } from '@core/types';
import { PLATE_RESET_TICKS } from '@systems/buildings/constants';
import type { PlateRecord } from './state';

export function plateCondition(ctx: TickContext, id: EntityId): boolean {
  const b = ctx.world.entities.get(id, C.Building);
  if (b?.state !== 'built') return false;
  const trigger = b.settings['triggerOn'] as { kind?: string; minSize?: number; includeFortress?: boolean; level?: number } | undefined;
  const tile = b.origin;
  if (trigger?.kind === 'water' || trigger?.kind === 'magma') {
    return ctx.world.map.fluidTypeAt(tile) === (trigger.kind === 'water' ? FluidType.Water : FluidType.Magma) &&
      ctx.world.map.fluidLevelAt(tile) >= (trigger.level ?? 1);
  }
  for (const occupant of ctx.readers.entities.at(tile)) {
    const creature = ctx.world.entities.get(occupant, C.Creature);
    if (creature === undefined || creature.sizeClass < (trigger?.minSize ?? 0)) continue;
    if (creature.faction === 'fortress') { if (trigger?.includeFortress) return true; }
    else if (creature.faction === 'wild' || creature.faction === 'deep' || creature.faction.startsWith('hostile:')) return true;
  }
  return false;
}

export function updatePlate(ctx: TickContext, id: EntityId, record: PlateRecord): void {
  const condition = plateCondition(ctx, id);
  if (condition === record.lastState || ctx.tick - record.lastEdgeTick < PLATE_RESET_TICKS) return;
  record.lastState = condition;
  record.lastEdgeTick = ctx.tick;
  ctx.emit({ type: 'MechanismTriggered', sourceId: id, on: condition });
}
