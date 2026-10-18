/**
 * Combat system: `02-systems/16-combat.md`.
 */

import { C } from '@core/components';
import { OK, reject, type Command, type CommandResult } from '@core/commands';
import type { CommandType } from '@core/command-types';
import type { EventType } from '@core/event-types';
import type { GameEvent } from '@core/events';
import type { RngStream } from '@core/rng';
import {
  BaseSystem,
  type InitContext,
  type SystemId,
  type TickContext,
  type WorldLike,
} from '@core/system';
import type { Alert, EntityId, TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import {
  COMBAT_CADENCE,
  COMBAT_PHASE,
  FLEE_BLOOD_PERCENT,
  PERCEPTION_RADIUS,
  REEQUIP_CHECK_DAYS,
  TARGET_LOSE_TICKS,
} from './constants';
import { isCreatureHostile, isFactionHostile } from './factions';
import { resolveMelee, weaponOf } from './melee';
import { advanceProjectiles, findAmmoForShooter, fireRanged, lineOfSightRanged } from './ranged';
import { makeCombatReader, type CombatReader } from './reader';
import {
  createSquad,
  disbandSquad,
  dropOrdersOf,
  renameSquad,
  setSquadEquipment,
  setSquadLeader,
  setSquadMembers,
  setSquadMode,
  setSquadPatrol,
  setSquadStation,
  squadOrder,
  stepSquads,
  updateSquadDuty,
} from './squads';
import type { CombatStateV1 } from './state';
import type { JobsReader } from '@systems/jobs/reader';
import { TargetManager } from './targets';
import { threatScan } from './threats';
import { kitingTile } from './kiting';
import { clearDestroyedEquipment, reequipAllSquads, reequipSquad } from './equipment';
import { getBarracksForSquad, stepTraining } from './training';

export type { CombatReader, SquadWithId } from './reader';
export * from './constants';
export * from './equipment';
export * from './factions';
export * from './melee';
export * from './ranged';
export * from './squads';
export * from './state';
export * from './targets';
export * from './threats';
export * from './training';

export class CombatSystem extends BaseSystem<CombatStateV1> {
  override readonly id: SystemId = '16';
  override readonly order: number = 16;
  override readonly cadence: number = COMBAT_CADENCE;
  override readonly phase: number = COMBAT_PHASE;

  override readonly ownsCommands: readonly CommandType[] = [
    'CreateSquad',
    'DisbandSquad',
    'SetSquadMembers',
    'SetSquadLeader',
    'SetSquadMode',
    'SetSquadEquipment',
    'SetSquadStation',
    'SetSquadPatrol',
    'SquadOrder',
    'RenameSquad',
    'SetAlert',
  ];

  override readonly subscribes: readonly EventType[] = [
    'CreatureDied',
    'CreatureUnconscious',
    'AlertChanged',
    'DayPassed',
    'ItemCreated',
    'ItemDestroyed',
    'ZoneChanged',
  ];

  private releaseDestroyObserver: (() => void) | null = null;
  private world: WorldLike | null = null;
  private initCtx: InitContext | null = null;
  private currentCtx: TickContext | null = null;
  private rngRef: RngStream | null = null;
  private readerRef: CombatReader | null = null;
  private alertState: Alert = 'calm';
  private targetManager: TargetManager | null = null;
  private readonly threatThrottles = new Map<EntityId, number>();
  private readonly patrolIndices = new Map<EntityId, number>();
  private readonly sessionEnds = new Map<EntityId, number>();
  private daysCount = 0;
  /** Event dispatch sees all items created by the previous tick before any ItemCreated handler. */
  private lastItemReequipTick = -1;

  get targets(): TargetManager {
    if (this.targetManager === null) throw new Error('16 combat: targets before init');
    return this.targetManager;
  }

  get rng(): RngStream {
    if (this.rngRef === null) throw new Error('16 combat: used before init');
    return this.rngRef;
  }

  override init(ctx: InitContext): void {
    this.releaseDestroyObserver?.();
    this.releaseDestroyObserver = ctx.world.entities.onBeforeDestroy((id, kind) => {
      if (kind === 'item' && ctx.world.entities.has(id, C.Item)) {
        clearDestroyedEquipment(ctx.world.entities, id);
      }
      if (kind === 'creature') dropOrdersOf(ctx.world.entities, id);
    });
    this.world = ctx.world;
    this.initCtx = ctx;
    ctx.world.services.combat = this;
    this.rngRef = ctx.rng;
    this.targetManager = new TargetManager(ctx.world.entities);

    this.readerRef = makeCombatReader(
      ctx.world.entities,
      ctx.registry,
      this.targetManager,
      () => this.alertState,
      (from, to) => this.lineOfSight(from, to),
    );

    // Registrations
    ctx.register.panel({ id: 'military', title: 'Military', hotkey: 'm' });
    ctx.register.inspector('creature', { id: 'combat', order: 11 });
    ctx.register.announcement('AlertChanged', {
      severity: 'note',
      stringKey: 'announce.alert_changed',
    });
    ctx.register.announcement('KillRecorded', {
      severity: 'note',
      stringKey: 'announce.kill_recorded',
      category: 'combat',
      oneOf: { field: 'hunted', values: [false] },
    });
    ctx.register.announcement('AttackResolved', {
      severity: 'alert',
      stringKey: 'announce.attack_resolved',
      keyField: 'outcome',
      category: 'combat',
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

  lineOfSight(from: TileIndex, to: TileIndex): boolean {
    if (this.world === null) return false;
    const bReader = this.initCtx?.readers.has('14')
      ? this.initCtx.readers.of<BuildingsReader>('14')
      : undefined;
    return lineOfSightRanged(this.world.map, from, to, 14, bReader);
  }

  fireAt(shooterId: EntityId, targetId: EntityId, options?: { skipXp?: boolean }): boolean {
    const ctx =
      this.currentCtx ??
      (this.initCtx
        ? ({
            world: this.world,
            registry: this.initCtx.registry,
            rng: this.rng,
            tick: this.world?.calendar.tick ?? 0,
            emit: () => {},
            readers: this.initCtx.readers,
            register: this.initCtx.register,
          } as unknown as TickContext)
        : null);
    if (ctx === null) return false;
    return fireRanged(ctx, shooterId, targetId, this.targets.cooldownUntil, options);
  }

  override tick(ctx: TickContext): void {
    this.currentCtx = ctx;
    const entities = ctx.world.entities;
    const map = ctx.world.map;
    const tick = ctx.tick;

    // Advance active projectiles
    advanceProjectiles(ctx, this.rng);

    // Step squads: updates duty, order execution, perception scans, and positioning
    stepSquads(
      ctx,
      this.alertState,
      this.targets,
      (from, to) => this.lineOfSight(from, to),
      this.patrolIndices,
    );

    // Step barracks & archery range training
    stepTraining(ctx, this.rng, this.sessionEnds, this.alertState);

    for (const id of this.targets.allWithTarget()) {
      if (entities.get(id, C.Creature)?.cagedIn) { this.targets.clearTarget(id); continue; }
      if (!entities.alive(id)) {
        this.targets.clearTarget(id);
        continue;
      }

      const target = this.targets.targetOf(id);
      if (entities.get(target, C.Creature)?.cagedIn) { this.targets.clearTarget(id); continue; }
      if (
        target === 0 ||
        !entities.alive(target) ||
        !isCreatureHostile(entities, id, target, (e) => this.targets.targetOf(e))
      ) {
        this.targets.clearTarget(id);
        continue;
      }

      const bodyA = entities.get(id, C.Body);
      if (bodyA !== undefined && !bodyA.conscious) continue;

      if (bodyA !== undefined && bodyA.maxBlood > 0) {
        const soldier = entities.get(id, C.Soldier);
        const creature = entities.get(id, C.Creature);
        if (creature && (!soldier || !soldier.onDuty) && creature.faction !== 'deep') {
          const spTable = ctx.registry.table<{
            id: string;
            temper: string;
            fleeBloodPercent: number | null;
          }>('creatures');
          const sp = spTable.byIndex(creature.species);
          const fleeThresh =
            sp?.fleeBloodPercent ?? (sp?.temper === 'aggressive' ? null : FLEE_BLOOD_PERCENT);
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
      // 08 owns a wild attack's species perception and saved loss-of-sight grace.
      if (entities.get(id, C.Wild)?.state !== 'attack' && (Math.max(dx, dy) > PERCEPTION_RADIUS || dz > 2)) {
        this.targets.clearTarget(id);
        continue;
      }
      const isAdjacent = dz === 0 && Math.max(dx, dy) <= 1;

      const w = weaponOf(entities, ctx.registry, id);
      const creatureA = entities.get(id, C.Creature);
      const spTable = ctx.registry.table<{ id: string; attacks?: { name: string; type: string; damage: number; size: number; range?: number }[] }>('creatures');
      const spRow = creatureA ? spTable.byIndex(creatureA.species) : undefined;
      const naturalRanged = spRow?.attacks?.find((a) => typeof a.range === 'number' && a.range > 0);

      const launcher = w?.weaponDef.launcher;
      const hasAmmo = launcher !== undefined && findAmmoForShooter(entities, ctx.registry, id, launcher.ammo,
        ctx.readers.has('13') ? ctx.readers.of<ItemsReader>('13').carriedItems(id) : undefined) !== 0;
      const isRanged = hasAmmo || naturalRanged !== undefined;
      const maxRangedDist = w?.weaponDef.launcher?.range ?? naturalRanged?.range ?? 12;
      const tileA = map.index(xA, yA, zA);
      const tileT = map.index(xT, yT, zT);
      const dist = Math.max(dx, dy) + dz * 2;

      if (launcher !== undefined && hasAmmo && entities.get(id, C.Soldier)?.onDuty === true) {
        const kite = kitingTile(ctx, id, tileA, (other) => this.targets.targetOf(other), (from, to) => this.lineOfSight(from, to));
        if (kite !== null) {
          ctx.world.services.movement?.walkTo(id, kite, 'combat', ctx);
          continue;
        }
      }

      if (isAdjacent) {
        this.targets.unreachableSince.delete(id);
        const cooldown = this.targets.cooldownUntil.get(id) ?? 0;
        if (cooldown <= tick) {
          this.targets.engagements.set(id, tick);
          resolveMelee(ctx, id, target, this.targets.cooldownUntil);
        }
      } else if (
        isRanged &&
        dist <= maxRangedDist &&
        this.lineOfSight(tileA, tileT)
      ) {
        this.targets.unreachableSince.delete(id);
        const cooldown = this.targets.cooldownUntil.get(id) ?? 0;
        if (cooldown <= tick) {
          this.targets.engagements.set(id, tick);
          this.fireAt(id, target);
        }
      } else {
        // A civilian who fights back (10) strikes only what is in reach; it does not chase.
        if (entities.has(id, C.Brain) && creatureA?.faction === 'fortress' && entities.get(id, C.Soldier)?.onDuty !== true) continue;
        // Approach toward target
        const soldier = entities.get(id, C.Soldier);
        if (soldier?.stance !== 'hold') {
          const tame = entities.get(id, C.Tame);
          let isChained = false;
          let chainTile = -1;
          if (tame?.assignedTo && ctx.readers.has('14')) {
            const buildings = ctx.readers.of<BuildingsReader>('14');
            if (buildings.byTag('chain').includes(tame.assignedTo)) {
              isChained = true;
              chainTile = buildings.get(tame.assignedTo)?.origin ?? -1;
            }
          }

          if (isChained && chainTile >= 0) {
            // Drop target if hostile moves beyond 8 tiles (WAR_ANIMAL_RADIUS) or different z
            if (Math.max(Math.abs(xT - map.xOf(chainTile)), Math.abs(yT - map.yOf(chainTile))) > 8 || zT !== map.zOf(chainTile)) {
              this.targets.clearTarget(id);
              continue;
            }

            let bestTile = chainTile;
            let bestDist = Math.max(Math.abs(map.xOf(chainTile) - xT), Math.abs(map.yOf(chainTile) - yT));
            for (const n of map.neighbors8(chainTile)) {
              if (!ctx.readers.pathing.passable(n, 'walker')) continue;
              const d = Math.max(Math.abs(map.xOf(n) - xT), Math.abs(map.yOf(n) - yT));
              if (d < bestDist) {
                bestDist = d;
                bestTile = n;
              }
            }
            if (tileA !== bestTile) {
              ctx.world.services.movement?.walkTo(id, bestTile, 'combat', ctx);
            } else {
              ctx.world.services.movement?.stopWalking(id);
            }
            continue;
          }

          const outcome = ctx.world.services.movement?.walkTo(id, tileT, 'combat', ctx);
          if (outcome === 'unreachable') {
            if (!this.targets.unreachableSince.has(id)) this.targets.unreachableSince.set(id, tick);
          } else if (outcome === 'arrived' || (outcome === 'moving' && ctx.world.services.movement?.tileOf(id) !== tileA)) {
            this.targets.unreachableSince.delete(id);
          }
          // A pending retry does not prove recovery. Count elapsed ticks from the failure,
          // resetting only on an actual step or an attack opportunity.
          const since = this.targets.unreachableSince.get(id);
          if (since !== undefined && tick - since + 1 >= TARGET_LOSE_TICKS) {
            this.targets.clearTarget(id);
            ctx.world.services.movement?.stopWalking(id);
          }
        }
      }
    }

    threatScan(ctx, this.threatThrottles, (e: EntityId) => this.targets.targetOf(e));
  }

  override handle(event: GameEvent, ctx: TickContext): void {
    if (event.type === 'ItemDestroyed') {
      clearDestroyedEquipment(ctx.world.entities, event['id'] as EntityId);
      return;
    }
    if (event.type === 'ZoneChanged' && event['zoneType'] === 'barracks' && event['change'] === 'settings') {
      const entities = ctx.world.entities;
      for (const squadId of entities.with(C.Squad)) {
        const squad = entities.get(squadId, C.Squad);
        if (squad === undefined) continue;
        const zoneId = getBarracksForSquad(ctx, squadId, 0)?.zoneId ?? 0;
        if (squad.barracksZoneId !== zoneId) entities.add(squadId, C.Squad, { ...squad, barracksZoneId: zoneId });
      }
      return;
    }
    if (event.type === 'CreatureDied') {
      const id = event['id'] as EntityId;
      const killer = (event['killer'] ?? event['killerId'] ?? 0) as EntityId;
      this.threatThrottles.delete(id);
      this.targets.onCreatureDied(id);
      if (killer !== 0 && ctx.world.entities.alive(killer)) {
        const killerCreature = ctx.world.entities.get(killer, C.Creature);
        // The victim is already gone: its faction and, for a wild animal, its state come from the death event.
        const victimFaction = typeof event['faction'] === 'string' ? event['faction'] : '';
        const hostile = killerCreature !== undefined &&
          (isFactionHostile(killerCreature.faction, victimFaction) || (victimFaction === 'wild' && event['wildState'] === 'attack'));
        // The victim is already gone, so the names come from the death event. The kill of a hunt job's quarry is the
        // hunt's, and `HuntKill` announces it. A killer that is not a creature, a trap, is named by its building.
        const victimSpecies = typeof event['species'] === 'number' ? event['species'] : 0;
        const hunted = ctx.readers.has('11') && ctx.readers.of<JobsReader>('11').isHuntQuarry(id);
        const trap = killerCreature === undefined ? ctx.world.entities.get(killer, C.Building) : undefined;
        const killerName = killerCreature?.name ?? (trap === undefined ? '' : ctx.registry.table<{ id: string; name: string }>('buildings').byIndex(trap.type)?.name ?? '');
        ctx.emit({
          type: 'KillRecorded', killerId: killer, victimId: id, hostile, hunted,
          killerName, killerSpecies: killerCreature?.species ?? 0,
          victimName: typeof event['name'] === 'string' ? event['name'] : '', victimSpecies,
        });
      }
      return;
    }

    if (event.type === 'AlertChanged') {
      this.alertState = (event['to'] as Alert) ?? 'calm';
      ctx.world.fortress.alert = this.alertState;
      updateSquadDuty(ctx.world.entities, this.alertState);
      return;
    }

    if (event.type === 'DayPassed') {
      this.daysCount += 1;
      if (this.daysCount % REEQUIP_CHECK_DAYS === 0) {
        reequipAllSquads(ctx);
      }
      return;
    }

    if (event.type === 'ItemCreated') {
      if (this.lastItemReequipTick !== ctx.tick) {
        this.lastItemReequipTick = ctx.tick;
        reequipAllSquads(ctx);
      }
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
      ctx.world.fortress.alert = to;
      updateSquadDuty(ctx.world.entities, to);
      ctx.emit({ type: 'AlertChanged', from, to });
      return OK;
    }

    if (cmd.type === 'CreateSquad') {
      return createSquad(ctx.world.entities, cmd, this.alertState, ctx.tick);
    }
    if (cmd.type === 'DisbandSquad') {
      return disbandSquad(ctx.world.entities, cmd);
    }
    if (cmd.type === 'SetSquadMembers') {
      const res = setSquadMembers(ctx.world.entities, cmd, this.alertState, ctx.tick);
      if (res.ok) {
        reequipSquad(ctx, cmd['squadId'] as EntityId);
      }
      return res;
    }
    if (cmd.type === 'SetSquadLeader') {
      return setSquadLeader(ctx.world.entities, cmd);
    }
    if (cmd.type === 'SetSquadMode') {
      return setSquadMode(ctx.world.entities, cmd, this.alertState);
    }
    if (cmd.type === 'SetSquadEquipment') {
      const res = setSquadEquipment(ctx.world.entities, cmd, ctx.registry);
      if (res.ok) {
        reequipSquad(ctx, cmd['squadId'] as EntityId);
      }
      return res;
    }
    if (cmd.type === 'SetSquadStation') {
      return setSquadStation(ctx.world.map, ctx.readers.pathing, ctx.world.entities, cmd);
    }
    if (cmd.type === 'SetSquadPatrol') {
      return setSquadPatrol(ctx.world.map, ctx.readers.pathing, ctx.world.entities, cmd);
    }
    if (cmd.type === 'SquadOrder') {
      return squadOrder(
        ctx.world.map,
        ctx.readers.pathing,
        ctx.world.entities,
        this.targets,
        cmd,
        (e) => ctx.emit(e),
      );
    }
    if (cmd.type === 'RenameSquad') {
      return renameSquad(ctx.world.entities, cmd);
    }

    return reject('not_found');
  }

  override serialize(): CombatStateV1 {
    return {
      version: 1,
      ...(this.threatThrottles.size > 0 ? { threatThrottles: Array.from(this.threatThrottles).sort((a, b) => a[0] - b[0]) } : {}),
      alert: this.alertState,
      targets: this.targetManager ? Array.from(this.targetManager.targets.entries()) : [],
      cooldownUntil: this.targetManager ? Array.from(this.targetManager.cooldownUntil.entries()) : [],
      engagements: this.targetManager ? Array.from(this.targetManager.engagements.entries()) : [],
      ...(this.targetManager?.unreachableSince.size ? { unreachableSince: Array.from(this.targetManager.unreachableSince) } : {}),
    };
  }

  override deserialize(state: CombatStateV1): void {
    if (state.version !== 1) return;
    this.threatThrottles.clear();
    for (const [id, tick] of state.threatThrottles ?? []) this.threatThrottles.set(id, tick);
    this.alertState = state.alert ?? 'calm';
    if (this.world) this.world.fortress.alert = this.alertState;
    if (this.targetManager !== null) {
      this.targetManager.targets.clear();
      for (const [k, v] of state.targets ?? []) this.targetManager.targets.set(k, v);
      this.targetManager.cooldownUntil.clear();
      for (const [k, v] of state.cooldownUntil ?? []) this.targetManager.cooldownUntil.set(k, v);
      this.targetManager.engagements.clear();
      for (const [k, v] of state.engagements ?? []) this.targetManager.engagements.set(k, v);
      this.targetManager.unreachableSince.clear();
      for (const [k, v] of state.unreachableSince ?? []) this.targetManager.unreachableSince.set(k, v);
    }
  }
}
