/**
 * Combat system: `02-systems/16-combat.md`.
 */

import { C } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import {
  BaseSystem,
  type InitContext,
  type SystemId,
  type TickContext,
} from '@core/system';
import type { Alert, EntityId } from '@core/types';
import {
  COMBAT_CADENCE,
  COMBAT_PHASE,
  FLEE_BLOOD_PERCENT,
  PERCEPTION_RADIUS,
  TARGET_LOSE_TICKS,
} from './constants';
import { isCreatureHostile } from './factions';
import { resolveMelee } from './melee';
import { makeCombatReader, type CombatReader } from './reader';
import type { CombatStateV1 } from './state';
import { TargetManager } from './targets';
import { threatScan } from './threats';

export type { CombatReader } from './reader';
export * from './constants';
export * from './factions';
export * from './melee';
export * from './state';
export * from './targets';
export * from './threats';

export class CombatSystem extends BaseSystem<CombatStateV1> {
  override readonly id: SystemId = '16';
  override readonly order: number = 16;
  override readonly cadence: number = COMBAT_CADENCE;
  override readonly phase: number = COMBAT_PHASE;

  override readonly subscribes: readonly EventType[] = [
    'CreatureDied',
    'CreatureUnconscious',
    'AlertChanged',
  ];

  private rngRef: RngStream | null = null;
  private readerRef: CombatReader | null = null;
  private alertState: Alert = 'calm';
  private targetManager: TargetManager | null = null;
  private readonly threatThrottles = new Map<EntityId, number>();

  get targets(): TargetManager {
    if (this.targetManager === null) throw new Error('16 combat: targets before init');
    return this.targetManager;
  }

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('16 combat: used before init');
    return this.rngRef;
  }

  override init(ctx: InitContext): void {
    ctx.world.services.combat = this;
    this.rngRef = ctx.rng;
    this.targetManager = new TargetManager(ctx.world.entities);

    const pathingReader = ctx.readers.has('pathing')
      ? ctx.readers.pathing
      : undefined;

    this.readerRef = makeCombatReader(
      ctx.world.entities,
      ctx.registry,
      this.targetManager,
      () => this.alertState,
      pathingReader ? (from, to) => pathingReader.lineOfSight(from, to) : undefined,
    );

    // Registrations
    ctx.register.inspector('creature', { id: 'combat', order: 11 });
    ctx.register.announcement('AlertChanged', {
      severity: 'note',
      stringKey: 'announce.alert_changed',
    });
    ctx.register.announcement('KillRecorded', {
      severity: 'note',
      stringKey: 'announce.kill_recorded',
    });
    ctx.register.announcement('AttackResolved', {
      severity: 'alert',
      stringKey: 'announce.attack_resolved',
    });
  }

  override reader(): CombatReader {
    if (this.readerRef === null) throw new Error('16 combat: reader before init');
    return this.readerRef;
  }

  setTarget(id: EntityId, targetId: EntityId): void {
    this.targets.setTarget(id, targetId);
  }

  targetOf(id: EntityId): EntityId {
    return this.targets.targetOf(id);
  }

  clearTarget(id: EntityId): void {
    this.setTarget(id, 0);
  }

  alert(): Alert {
    return this.alertState;
  }

  override tick(ctx: TickContext): void {
    const entities = ctx.world.entities;
    const map = ctx.world.map;
    const tick = ctx.tick;

    for (const id of this.targets.allWithTarget()) {
      if (!entities.alive(id)) {
        this.targets.clearTarget(id);
        continue;
      }

      const target = this.targets.targetOf(id);
      if (target === 0 || !entities.alive(target) || !isCreatureHostile(entities, id, target, (e) => this.targets.targetOf(e))) {
        this.targets.clearTarget(id);
        continue;
      }

      const bodyA = entities.get(id, C.Body);
      if (bodyA !== undefined && !bodyA.conscious) continue;

      if (bodyA !== undefined && bodyA.maxBlood > 0) {
        const soldier = entities.get(id, C.Soldier);
        const creature = entities.get(id, C.Creature);
        if (creature && (!soldier || !soldier.onDuty) && creature.faction !== 'deep') {
          const spTable = ctx.registry.table<{ id: string; temper: string; fleeBloodPercent: number | null }>('creatures');
          const sp = spTable.byIndex(creature.species);
          const fleeThresh = sp?.fleeBloodPercent ?? (sp?.temper === 'aggressive' ? null : FLEE_BLOOD_PERCENT);
          if (fleeThresh !== null && (bodyA.blood / bodyA.maxBlood) * 100 < fleeThresh) {
            this.targets.clearTarget(id);
            ctx.emit({ type: 'CreatureFled', id, from: target });
            const wild = entities.get(id, C.Wild);
            if (wild !== undefined) {
              entities.add(id, C.Wild, {
                ...wild,
                state: 'flee',
                stateUntil: ctx.tick + 200,
              });
            }
            continue;
          }
        }
      }

      const posA = entities.get(id, C.Position);
      const posT = entities.get(target, C.Position);
      if (posA === undefined || posT === undefined) continue;

      const zA = posA.z;
      const zT = posT.z;
      const xA = posA.x;
      const xT = posT.x;
      const yA = posA.y;
      const yT = posT.y;

      const dx = Math.abs(xA - xT);
      const dy = Math.abs(yA - yT);
      const dz = Math.abs(zA - zT);
      const isAdjacent = dz === 0 && Math.max(dx, dy) <= 1;

      if (isAdjacent) {
        const cooldown = this.targets.cooldownUntil.get(id) ?? 0;
        if (cooldown <= tick) {
          this.targets.engagements.set(id, tick);
          resolveMelee(ctx, id, target, this.targets.cooldownUntil);
        }
      } else {
        // Perception check
        if (Math.max(dx, dy) > PERCEPTION_RADIUS || dz > 2) {
          this.targets.clearTarget(id);
          continue;
        }

        // Approach toward target
        const tileT = map.index(xT, yT, zT);
        const outcome = ctx.world.services.movement?.walkTo(id, tileT, 'combat', ctx);
        if (outcome === 'unreachable') {
          const unreach = (this.targets.unreachableTicks.get(id) ?? 0) + 1;
          this.targets.unreachableTicks.set(id, unreach);
          if (unreach >= TARGET_LOSE_TICKS) {
            this.targets.clearTarget(id);
          }
        } else {
          this.targets.unreachableTicks.set(id, 0);
        }
      }
    }

    threatScan(ctx, this.threatThrottles, (e: EntityId) => this.targets.targetOf(e));
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      const killer = (event['killer'] ?? event['killerId'] ?? 0) as EntityId;
      this.threatThrottles.delete(id);
      this.targets.onCreatureDied(id);
      if (killer !== 0 && ctx.world.entities.alive(killer)) {
        ctx.emit({ type: 'KillRecorded', killerId: killer, victimId: id });
      }
      return;
    }

    if (event.type === 'AlertChanged') {
      this.alertState = (event['to'] as Alert) ?? 'calm';
      return;
    }
  }

  override applyCommand(cmd: Command, ctx: TickContext): CommandResult {
    if (cmd.type === 'SetAlert') {
      const rawLevel = cmd['level'];
      if (rawLevel !== 'calm' && rawLevel !== 'watchful' && rawLevel !== 'hearth') {
        return reject('out_of_range');
      }
      const from = this.alertState;
      const to = rawLevel as Alert;
      this.alertState = to;
      ctx.emit({ type: 'AlertChanged', from, to });
      return OK;
    }

    if (cmd.type === 'CreateSquad' || cmd.type === 'DisbandSquad' || cmd.type === 'SetSquadMembers' ||
        cmd.type === 'SetSquadLeader' || cmd.type === 'SetSquadMode' || cmd.type === 'SetSquadEquipment' ||
        cmd.type === 'SetSquadStation' || cmd.type === 'SetSquadPatrol' || cmd.type === 'SquadOrder' ||
        cmd.type === 'RenameSquad') {
      // Squad full implementation is in T-M6-05
      return OK;
    }

    return reject('not_found');
  }

  override serialize(): CombatStateV1 {
    return {
      version: 1,
      alert: this.alertState,
      targets: this.targetManager ? Array.from(this.targetManager.targets.entries()) : [],
      cooldownUntil: this.targetManager ? Array.from(this.targetManager.cooldownUntil.entries()) : [],
      engagements: this.targetManager ? Array.from(this.targetManager.engagements.entries()) : [],
    };
  }

  override deserialize(state: CombatStateV1): void {
    if (state.version !== 1) return;
    this.alertState = state.alert ?? 'calm';
    if (this.targetManager !== null) {
      this.targetManager.targets.clear();
      for (const [k, v] of state.targets ?? []) this.targetManager.targets.set(k, v);
      this.targetManager.cooldownUntil.clear();
      for (const [k, v] of state.cooldownUntil ?? []) this.targetManager.cooldownUntil.set(k, v);
      this.targetManager.engagements.clear();
      for (const [k, v] of state.engagements ?? []) this.targetManager.engagements.set(k, v);
    }
  }
}
