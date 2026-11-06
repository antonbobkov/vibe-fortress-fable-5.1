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
import { getSkill, resolveMelee, weaponOf } from './melee';
import { advanceProjectiles, bresenhamRay, findAmmoForShooter, fireRanged, lineOfSightRanged, shotCooldownTicks } from './ranged';
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
import { clearLineTile, kitingTile } from './kiting';
import { clearDestroyedEquipment, dropWhatArmsCannotHold, reequipAllSquads, reequipSoldier, reequipSquad } from './equipment';
import { getBarracksForSquad, stepTraining } from './training';
import { canCastBolt, castSupport, drinkVial, heldSpellKind, otherBoltTarget, runeCovers, type CastHost } from '@systems/magic/cast';
import { allyOnLine, carelessThisTime, nearestClearTarget, type RayTo } from './clear-shot';
import { CASTER_HOLD_DISTANCE } from '@systems/magic/constants';
import { stepFled } from './fled';

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

/** The species' natural ranged attack (the wyrm's breath), if it has one. */
function naturalRangedOf(ctx: TickContext, id: EntityId): { range?: number } | undefined {
  const creature = ctx.world.entities.get(id, C.Creature);
  if (creature === undefined) return undefined;
  const row = ctx.registry.table<{ id: string; attacks?: { range?: number }[] }>('creatures').byIndex(creature.species);
  return row?.attacks?.find((a) => typeof a.range === 'number' && a.range > 0);
}

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
    'LimbLost',
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
      () => this.world?.calendar.tick ?? 0,
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

  /**
   * The `combat.fireAt` service (09's hunt): shoot now, or false. A launcher with ammunition holds
   * its shot while one of the shooter's own faction stands on the ray (§ Ranged resolution); the
   * caller has no other target to give it, so it waits.
   */
  fireAt(shooterId: EntityId, targetId: EntityId, options?: { skipXp?: boolean }): boolean {
    const ctx = this.shotCtx();
    if (ctx === null || this.shotHeld(ctx, shooterId, targetId)) return false;
    return fireRanged(ctx, shooterId, targetId, this.targets.cooldownUntil, options);
  }

  /** Shoot at a target this system has chosen, its line already checked. */
  private shoot(shooterId: EntityId, targetId: EntityId): boolean {
    const ctx = this.shotCtx();
    if (ctx === null) return false;
    return fireRanged(ctx, shooterId, targetId, this.targets.cooldownUntil);
  }

  private shotCtx(): TickContext | null {
    return (
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
        : null)
    );
  }

  /** What 25's casting rules read from 16. */
  private castHost(ctx: TickContext): CastHost {
    return {
      cooldownUntil: this.targets.cooldownUntil,
      isHostile: (a, b) => isCreatureHostile(ctx.world.entities, a, b, (e) => this.targets.targetOf(e)),
      lineOfSight: (from, to) => this.lineOfSight(from, to),
    };
  }

  /** 16's projectile ray from `from` toward a creature, as far as `range`; null without line of sight. */
  private rayFrom(ctx: TickContext, from: TileIndex, range: number): RayTo {
    const map = ctx.world.map;
    return (other) => {
      const p = ctx.world.entities.get(other, C.Position);
      if (p === undefined) return null;
      const tile = map.index(p.x, p.y, p.z);
      if (!this.lineOfSight(from, tile)) return null;
      return { tile, ray: bresenhamRay(map, from, tile, range) };
    };
  }

  /**
   * § Ranged resolution: the target a launcher's shot goes to this tick: the held one with no ally
   * on the ray, the nearest other hostile it can reach with a clear line, or 0 (it waits). A
   * launcher with ammunition and a channel's bolt hold; a burst or a single goes to the held target.
   */
  private clearShotTarget(ctx: TickContext, id: EntityId, w: ReturnType<typeof weaponOf>, target: EntityId, from: TileIndex): EntityId {
    const launcher = w?.weaponDef.launcher;
    if (launcher === undefined) return target;
    const channel = launcher.ammo === undefined;
    if (channel && heldSpellKind(ctx, w) !== 'bolt') return target;
    const rayTo = this.rayFrom(ctx, from, launcher.range);
    const held = rayTo(target);
    if (held !== null && !allyOnLine(ctx, id, held.tile, held.ray)) return target;
    // An ally on the line: one draw on the shooter's own stream decides whether it is careless.
    const weigh = held === null ? { drew: false, careless: false } : this.weighShot(ctx, id, w, channel);
    if (weigh.careless) return target;
    const isHostile = (a: EntityId, b: EntityId): boolean => isCreatureHostile(ctx.world.entities, a, b, (e) => this.targets.targetOf(e));
    const other = channel
      ? otherBoltTarget(ctx, id, w, target, isHostile, rayTo)
      : nearestClearTarget(ctx, id, target, launcher.range, isHostile, () => true, rayTo, true);
    if (other === 0 && weigh.drew) this.holdAim(ctx, id, w);
    return other;
  }

  /**
   * § Ranged resolution, Held shot: where a soldier on duty that is not shooting steps, or null.
   * Only while one of its own stands on its held target's ray and it has no other clear target
   * from where it stands; then the first adjacent tile that `clearLineTile` allows from which the
   * held target, or another hostile in range, has a clear line. Draws nothing.
   */
  private clearLineStep(ctx: TickContext, id: EntityId, w: ReturnType<typeof weaponOf>, target: EntityId,
    from: TileIndex, targetTile: TileIndex): TileIndex | null {
    const launcher = w?.weaponDef.launcher;
    if (launcher === undefined) return null;
    const channel = launcher.ammo === undefined;
    if (channel && heldSpellKind(ctx, w) !== 'bolt') return null;
    const here = this.rayFrom(ctx, from, launcher.range);
    const held = here(target);
    if (held === null || !allyOnLine(ctx, id, held.tile, held.ray)) return null;
    const isHostile = (a: EntityId, b: EntityId): boolean => isCreatureHostile(ctx.world.entities, a, b, (e) => this.targets.targetOf(e));
    const other = channel
      ? otherBoltTarget(ctx, id, w, target, isHostile, here)
      : nearestClearTarget(ctx, id, target, launcher.range, isHostile, () => true, here, true);
    if (other !== 0) return null;
    const map = ctx.world.map;
    const clearFrom = (tile: TileIndex): boolean => {
      const rayTo = this.rayFrom(ctx, tile, launcher.range);
      const line = rayTo(target);
      const dist = Math.max(Math.abs(map.xOf(tile) - map.xOf(targetTile)), Math.abs(map.yOf(tile) - map.yOf(targetTile))) +
        Math.abs(map.zOf(tile) - map.zOf(targetTile)) * 2;
      if (line !== null && dist <= launcher.range && !allyOnLine(ctx, id, line.tile, line.ray)) return true;
      return nearestClearTarget(ctx, id, target, launcher.range, isHostile, () => true, rayTo, true, tile) !== 0;
    };
    return clearLineTile(ctx, id, from, targetTile, (other) => this.targets.targetOf(other),
      (a, b) => this.lineOfSight(a, b), clearFrom);
  }

  /**
   * § Ranged resolution, Held shot: the one draw of a shooter with an ally on its line, on 16's
   * stream for a launcher with ammunition and on 25's for a caster, by its shooting skill.
   */
  private weighShot(ctx: TickContext, id: EntityId, w: ReturnType<typeof weaponOf>, channel: boolean): { drew: boolean; careless: boolean } {
    const skill = w === null ? 0 : getSkill(ctx.world.entities, ctx.registry, id, w.weaponDef.skill);
    return carelessThisTime(channel ? ctx.world.rngFor('25') : this.rng, skill);
  }

  /** A careful shooter that weighed a shot and holds it takes aim again one attack cooldown later. */
  private holdAim(ctx: TickContext, id: EntityId, w: ReturnType<typeof weaponOf>): void {
    this.targets.cooldownUntil.set(id, ctx.tick + shotCooldownTicks(ctx, id, w?.weaponDef.size ?? 0));
  }

  /**
   * A launcher with ammunition shooting at `target` would send its missile past one of the
   * shooter's own faction and is held (§ Ranged resolution). A shooter weighs such a shot only once
   * its attack cooldown has elapsed; a careless one fires. A natural ranged attack has no such rule.
   */
  private shotHeld(ctx: TickContext, shooterId: EntityId, target: EntityId): boolean {
    const entities = ctx.world.entities;
    const w = weaponOf(entities, ctx.registry, shooterId);
    const launcher = w?.weaponDef.launcher;
    if (launcher?.ammo === undefined || naturalRangedOf(ctx, shooterId) !== undefined) return false;
    const pos = entities.get(shooterId, C.Position);
    if (pos === undefined) return false;
    const line = this.rayFrom(ctx, ctx.world.map.index(pos.x, pos.y, pos.z), launcher.range)(target);
    if (line === null || !allyOnLine(ctx, shooterId, line.tile, line.ray)) return false;
    if ((this.targets.cooldownUntil.get(shooterId) ?? 0) > ctx.tick) return true;
    const weigh = this.weighShot(ctx, shooterId, w, false);
    if (weigh.careless) return false;
    if (weigh.drew) this.holdAim(ctx, shooterId, w);
    return true;
  }

  /**
   * 25 § Casting, for a channel whose spell is no bolt, where the creature would walk to its target:
   * a burst or a single that cannot take the held target throws at another it can; and a caster
   * with the rune for its spell stops `CASTER_HOLD_DISTANCE` from its target rather than closing to
   * club it. True when the creature cast or stood.
   */
  private castInstead(ctx: TickContext, id: EntityId, w: ReturnType<typeof weaponOf>, target: EntityId, from: TileIndex, dist: number): boolean {
    const kind = heldSpellKind(ctx, w);
    if (kind === undefined || kind === 'bolt') return false;
    if ((kind === 'burst' || kind === 'single') && (this.targets.cooldownUntil.get(id) ?? 0) <= ctx.tick) {
      const map = ctx.world.map;
      const other = otherBoltTarget(ctx, id, w, target, (a, b) => isCreatureHostile(ctx.world.entities, a, b, (e) => this.targets.targetOf(e)), (o) => {
        const p = ctx.world.entities.get(o, C.Position);
        if (p === undefined) return null;
        const tile = map.index(p.x, p.y, p.z);
        return this.lineOfSight(from, tile) ? { tile, ray: [] } : null;
      });
      if (other !== 0) {
        this.targets.engagements.set(id, ctx.tick);
        this.shoot(id, other);
        return true;
      }
    }
    if (dist > CASTER_HOLD_DISTANCE || !runeCovers(ctx, id, w)) return false;
    ctx.world.services.movement?.stopWalking(id);
    return true;
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

      // 25 § Effects: under a `flee` effect the creature keeps its target, does not attack, and runs.
      if (stepFled(ctx, id, target)) continue;

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
      const naturalRanged = naturalRangedOf(ctx, id);

      const launcher = w?.weaponDef.launcher;
      // 25 § Casting: a channel's ammunition is its holder's rune. With none, a channel is a club.
      const channel = launcher !== undefined && launcher.ammo === undefined;
      // 25 § Vials: below cost, with a hostile held, the caster drinks before anything else.
      if (channel && (this.targets.cooldownUntil.get(id) ?? 0) <= tick && drinkVial(ctx, id, w, this.targets.cooldownUntil)) continue;
      const hasAmmo = channel
        ? canCastBolt(ctx, id, w, target)
        : launcher?.ammo !== undefined && findAmmoForShooter(entities, ctx.registry, id, launcher.ammo,
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

      // 25 § Casting: a ward, mend or dread staff casts for its held target when its row's rule holds.
      if (channel && (this.targets.cooldownUntil.get(id) ?? 0) <= tick && castSupport(ctx, id, w, target, this.castHost(ctx))) {
        this.targets.engagements.set(id, tick);
        continue;
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
        // § Ranged resolution: a launcher's shot (a channel's bolt, 25 § Casting) is held while
        // one of the shooter's own stands on the ray, and goes to another target with a clear
        // line, or the shooter waits. A natural ranged attack has no such rule.
        const launcherShot = channel || (hasAmmo && naturalRanged === undefined);
        let shot = 0;
        if (cooldown <= tick) {
          shot = launcherShot ? this.clearShotTarget(ctx, id, w, target, tileA) : target;
          if (shot !== 0) {
            this.targets.engagements.set(id, tick);
            this.shoot(id, shot);
          }
        }
        // Held shot: a soldier on duty that does not shoot steps aside to a tile with a clear line.
        if (shot === 0 && launcherShot && entities.get(id, C.Soldier)?.onDuty === true) {
          const step = this.clearLineStep(ctx, id, w, target, tileA, tileT);
          if (step !== null) ctx.world.services.movement?.walkTo(id, step, 'combat', ctx);
        }
      } else {
        // A civilian who fights back (10) strikes only what is in reach; it does not chase.
        if (entities.has(id, C.Brain) && creatureA?.faction === 'fortress' && entities.get(id, C.Soldier)?.onDuty !== true) continue;
        if (channel && this.castInstead(ctx, id, w, target, tileA, dist)) continue;
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
    if (event.type === 'LimbLost') {
      const id = event['id'] as EntityId;
      if (ctx.world.entities.alive(id)) {
        dropWhatArmsCannotHold(ctx, id);
        const squadId = ctx.world.entities.get(id, C.Soldier)?.squadId ?? 0;
        const squad = squadId !== 0 ? ctx.world.entities.get(squadId, C.Squad) : undefined;
        if (squad) reequipSoldier(ctx, squad, id);
      }
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
