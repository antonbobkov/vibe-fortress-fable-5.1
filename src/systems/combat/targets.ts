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
  /**
   * § Targeting, a fight that harms no one: for each creature holding a target, that target and the
   * last tick a blow by or on the creature did damage, or the tick it took up the target.
   */
  readonly harmless: Map<EntityId, { target: EntityId; since: Tick }> = new Map();

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

  /** Starts the count for each creature with a new target, and forgets the creatures with none. */
  refreshHarmless(tick: Tick): void {
    for (const id of this.allWithTarget()) {
      const target = this.targetOf(id);
      if (this.harmless.get(id)?.target !== target) this.harmless.set(id, { target, since: tick });
    }
    for (const id of Array.from(this.harmless.keys())) if (this.targetOf(id) === 0) this.harmless.delete(id);
  }

  /** A blow by or on the creature did damage: its fight is not harmless. */
  harmed(id: EntityId, tick: Tick): void {
    const entry = this.harmless.get(id);
    if (entry !== undefined) this.harmless.set(id, { target: entry.target, since: tick });
  }

  /** Ticks since a blow by or on the creature did damage in its fight with its current target; 0 without one. */
  harmlessFor(id: EntityId, tick: Tick): number {
    const target = this.targetOf(id);
    const entry = this.harmless.get(id);
    return target === 0 || entry === undefined || entry.target !== target ? 0 : Math.max(0, tick - entry.since);
  }

  onCreatureDied(id: EntityId): void {
    this.harmless.delete(id);
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
