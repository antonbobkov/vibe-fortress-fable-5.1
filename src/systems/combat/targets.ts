/**
 * Combat targeting management: `02-systems/16-combat.md` § Targeting.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { EntityId, Tick } from '@core/types';

export class TargetManager {
  readonly targets: Map<EntityId, EntityId> = new Map();
  readonly unreachableTicks: Map<EntityId, number> = new Map();
  readonly cooldownUntil: Map<EntityId, Tick> = new Map();
  readonly engagements: Map<EntityId, Tick> = new Map();

  constructor(public entities: EntityStore) {}

  targetOf(id: EntityId): EntityId {
    const soldier = this.entities.get(id, C.Soldier);
    if (soldier !== undefined) return soldier.targetId;
    return this.targets.get(id) ?? 0;
  }

  setTarget(id: EntityId, targetId: EntityId): void {
    const soldier = this.entities.get(id, C.Soldier);
    if (soldier !== undefined) {
      this.entities.add(id, C.Soldier, { ...soldier, targetId });
    } else {
      if (targetId === 0) {
        this.targets.delete(id);
      } else {
        this.targets.set(id, targetId);
      }
    }
    if (targetId === 0) {
      this.unreachableTicks.delete(id);
    }
  }

  clearTarget(id: EntityId): void {
    this.setTarget(id, 0);
  }

  allWithTarget(): EntityId[] {
    const result = new Set<EntityId>();
    for (const [id, t] of this.targets) {
      if (t !== 0) result.add(id);
    }
    for (const id of this.entities.with(C.Soldier)) {
      const s = this.entities.get(id, C.Soldier);
      if (s && s.targetId !== 0) result.add(id);
    }
    return Array.from(result).sort((a, b) => a - b);
  }

  onCreatureDied(id: EntityId): void {
    this.targets.delete(id);
    this.unreachableTicks.delete(id);
    this.cooldownUntil.delete(id);
    this.engagements.delete(id);

    // Clear target for any creature that was targeting this dead creature
    for (const [attacker, target] of this.targets) {
      if (target === id) this.targets.delete(attacker);
    }
    for (const soldierId of this.entities.with(C.Soldier)) {
      const s = this.entities.get(soldierId, C.Soldier);
      if (s && s.targetId === id) {
        this.entities.add(soldierId, C.Soldier, { ...s, targetId: 0 });
      }
    }
  }
}
