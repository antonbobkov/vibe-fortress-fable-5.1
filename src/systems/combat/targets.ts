/**
 * Combat targeting management: `02-systems/16-combat.md` § Targeting.
 */

import { C } from '@core/components';
import type { EntityStore } from '@core/entities';
import type { EntityId, Tick } from '@core/types';

export class TargetManager {
  readonly targets: Map<EntityId, EntityId> = new Map();
  readonly unreachableSince: Map<EntityId, Tick> = new Map();
  readonly cooldownUntil: Map<EntityId, Tick> = new Map();
  readonly engagements: Map<EntityId, Tick> = new Map();

  constructor(public entities: EntityStore) {}

  targetOf(id: EntityId): EntityId {
    const soldier = this.entities.get(id, C.Soldier);
    if (soldier !== undefined) return soldier.targetId;
    return this.targets.get(id) ?? 0;
  }

  setTarget(id: EntityId, targetId: EntityId): void {
    if (this.targetOf(id) !== targetId || targetId === 0) this.unreachableSince.delete(id);
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
    this.unreachableSince.delete(id);
    this.cooldownUntil.delete(id);
    this.engagements.delete(id);

    // Clear target for any creature that was targeting this dead creature
    for (const [attacker, target] of this.targets) {
      if (target === id) this.clearTarget(attacker);
    }
    for (const soldierId of this.entities.with(C.Soldier)) {
      const s = this.entities.get(soldierId, C.Soldier);
      if (s && s.targetId === id) {
        this.clearTarget(soldierId);
      }
    }
  }
}
