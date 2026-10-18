/**
 * The movement helper.
 *
 * Implements `02-systems/22-pathfinding-and-spatial.md` § Movement helper and the pseudo-code of
 * `04-implementation/algorithms/pathfinding-and-connectivity.md` § Movement helper:
 * `moveAlongPath`, `teleport` and `fall`, the per-tick `EntitiesMoved` batch, and the spatial
 * index update that goes with every step.
 *
 * `repath` clears the mover's path and counts the attempt; it does not issue a new request,
 * because the goal belongs to the brain that asked for the path and the helper does not know it.
 * See docs/02-systems/22-pathfinding-and-spatial.md § Movement helper.
 */

import { C, type Motion, type Position } from './components';
import { isSolidBottomed, Map3D, TileKind } from './map3d';
import { FLUID_MAX_LEVEL, REPATH_LIMIT, REPATH_WAIT_TICKS, STEP_COST } from './path-constants';
import type { EntityStore } from './entities';
import type { MovementApi } from './system';
import type { GameEvent } from './events';
import type { MoverOptions, PathingCore, PathUrgency } from './pathfinding';
import type { SpatialIndex } from './spatial';
import type { EntityId, TileIndex } from './types';

/** What one call to {@link MovementHelper.moveAlongPath} did. */
export type MoveOutcome = 'idle' | 'moving' | 'arrived' | 'blocked' | 'fell';

/** The slice of `TickContext` the helper needs. */
export interface MovementContext {
  readonly tick: number;
  emit(event: GameEvent): void;
}

/** What one call to {@link MovementHelper.walkTo} did. */
export type WalkOutcome = 'pending' | 'moving' | 'arrived' | 'unreachable';

interface Walk {
  target: TileIndex;
  request: number;
  following: boolean;
  attempts: number;
}

/** One entry of the tick's `EntitiesMoved` batch. */
export type MoveRecord = [EntityId, TileIndex, TileIndex];

/** The movement helper's saved state (D-081). */
export interface MovementState {
  /** `[mover, target, request, following, attempts]`, in the order the walks began. */
  walks: [EntityId, TileIndex, number, boolean, number][];
  moves: MoveRecord[];
}

export class MovementHelper implements MovementApi {
  private readonly map: Map3D;
  private readonly entities: EntityStore;
  private readonly spatial: SpatialIndex;
  private readonly pathing: PathingCore;
  private readonly moves: MoveRecord[] = [];
  /**
   * The walks in progress, by mover. Saved with 22's requests (D-081).
   */
  private readonly walks = new Map<EntityId, Walk>();
  /** Movers whose last step was refused because creatures stood on the next tile for more than `REPATH_LIMIT` waits (derived, never saved). */
  private readonly crowded = new Map<EntityId, TileIndex>();

  constructor(map: Map3D, entities: EntityStore, spatial: SpatialIndex, pathing: PathingCore) {
    this.map = map;
    this.entities = entities;
    this.spatial = spatial;
    this.pathing = pathing;
  }

  /**
   * The walks in progress and the unflushed moves, for a save. `schemas/system-state.md` rebuilds
   * 22's requests on load and lets the brains re-request, but that changes what the next ticks do,
   * which `simulation-core.md` § Determinism forbids; the walks are saved with the requests they
   * follow (docs/04-implementation/save-format.md § Load procedure).
   */
  saveState(): MovementState {
    const walks: [EntityId, TileIndex, number, boolean, number][] = [];
    this.walks.forEach((w, id) => walks.push([id, w.target, w.request, w.following, w.attempts]));
    return { walks, moves: this.moves.map((m) => [m[0], m[1], m[2]] as MoveRecord) };
  }

  loadState(state: MovementState): void {
    this.walks.clear();
    for (const [id, target, request, following, attempts] of state.walks) {
      this.walks.set(id, { target, request, following, attempts });
    }
    this.moves.length = 0;
    for (const m of state.moves) this.moves.push([m[0], m[1], m[2]]);
  }

  /** The moves recorded since the last {@link flushMoves}. */
  pendingMoves(): readonly MoveRecord[] {
    return this.moves;
  }

  /** `EntitiesMoved { moves }`, emitted once per tick after every brain has run. */
  flushMoves(emit: (event: GameEvent) => void): void {
    if (this.moves.length === 0) return;
    const moves = this.moves.slice();
    this.moves.length = 0;
    emit({ type: 'EntitiesMoved', moves });
  }

  /** The tile an entity stands on, or -1. */
  tileOf(id: EntityId): TileIndex {
    return this.spatial.tileOf(id);
  }

  /** The species flag `O` ("opens doors") by species index; the host installs it from content (D-074). */
  speciesOpensDoors: (species: number) => boolean = () => false;

  moverOf(id: EntityId): MoverOptions {
    const creature = this.entities.get<{ faction: string; sizeClass: number; species: number }>(id, C.Creature);
    if (creature === undefined) return {};
    return {
      faction: creature.faction,
      size: creature.sizeClass,
      opensDoors: this.speciesOpensDoors(creature.species),
      tame: this.entities.has(id, C.Tame),
    };
  }

  /** Write a `Position`, update the spatial bucket and record the move for this tick's batch. */
  private place(id: EntityId, from: TileIndex, to: TileIndex): void {
    const p = this.map.unpack(to);
    this.entities.add<Position>(id, C.Position, p);
    this.spatial.move(id, from, to);
    this.moves.push([id, from, to]);
  }

  /** `movement.teleport(id, to)`: spawning, caging, a bridge push. No path is involved. */
  teleport(id: EntityId, to: TileIndex): boolean {
    if (!this.entities.alive(id) || !this.map.validIndex(to)) return false;
    const from = this.tileOf(id);
    if (from === to) return true;
    if (from < 0) {
      this.entities.add<Position>(id, C.Position, this.map.unpack(to));
      this.spatial.insert(id, to);
      this.moves.push([id, -1, to]);
      return true;
    }
    this.place(id, from, to);
    return true;
  }

  /**
   * Point a mover at a finished path request (`Motion.pathId` is the request id, D-049), from its
   * first step. A mover without `Motion` gets one with the default walker class.
   */
  follow(id: EntityId, pathId: number): void {
    const m = this.entities.get<Motion>(id, C.Motion) ?? {
      pathId: 0,
      stepIndex: 0,
      progress: 0,
      speed: 0,
      movementClass: 'walker' as const,
      repathCount: 0,
      waitUntil: 0,
    };
    this.entities.add<Motion>(id, C.Motion, { ...m, pathId, stepIndex: 0, progress: 0 });
  }

  /**
   * `walkTo(w, t, urgency)` of `algorithms/jobs-and-hauling.md` § Job steps, shared by every
   * brain: request a path to `target` (served in the core pathing pass, so it is ready the next
   * tick), follow it with {@link moveAlongPath}, and re-request when the route is blocked, up to
   * `REPATH_LIMIT` times (D-022). Returns `arrived` once the mover stands on `target`.
   */
  walkTo(id: EntityId, target: TileIndex, urgency: PathUrgency, ctx: MovementContext): WalkOutcome {
    const at = this.tileOf(id);
    if (at < 0) {
      this.crowded.delete(id);
      return 'unreachable';
    }
    if (at === target) {
      this.stopWalking(id);
      return 'arrived';
    }
    let walk = this.walks.get(id);
    if (walk === undefined || walk.target !== target) {
      this.stopWalking(id);
      this.crowded.delete(id);
      walk = { target, request: this.request(id, at, target, urgency), following: false, attempts: 0 };
      this.walks.set(id, walk);
      return 'pending';
    }
    if (!walk.following) {
      const result = this.pathing.pathfinder.pathResult(walk.request);
      if (result.state === 'pending') return 'pending';
      if (result.state === 'failed') {
        this.stopWalking(id);
        this.crowded.delete(id);
        return 'unreachable';
      }
      this.follow(id, walk.request);
      walk.following = true;
    }
    const r = this.moveAlongPath(id, ctx);
    if (r === 'moving') return 'moving';
    if (this.tileOf(id) === target) {
      this.stopWalking(id);
      return 'arrived';
    }
    // Blocked, fell, or the path ran out short of the target: ask again, a bounded number of times.
    walk.attempts += 1;
    if (walk.attempts > REPATH_LIMIT) {
      this.stopWalking(id);
      return 'unreachable';
    }
    this.pathing.pathfinder.release(walk.request);
    walk.request = this.request(id, this.tileOf(id), target, urgency);
    walk.following = false;
    return 'pending';
  }

  /** Forget a mover's walk and its path request. */
  stopWalking(id: EntityId): void {
    const walk = this.walks.get(id);
    if (walk === undefined) return;
    this.pathing.pathfinder.release(walk.request);
    this.walks.delete(id);
    this.clearPath(id);
  }

  walkBlockedTile(id: EntityId): TileIndex {
    return this.crowded.get(id) ?? -1;
  }

  /** The target of a mover's current walk, or -1. */
  walkTarget(id: EntityId): TileIndex {
    return this.walks.get(id)?.target ?? -1;
  }

  private request(id: EntityId, from: TileIndex, to: TileIndex, urgency: PathUrgency): number {
    const m = this.entities.get<Motion>(id, C.Motion);
    return this.pathing.pathfinder.requestPath(id, from, to, m?.movementClass ?? 'walker', urgency, {}, this.moverOf(id));
  }

  /** `pathing.setSpeed(id, speed)`: the owning brain writes `Motion.speed` (`components.md`). */
  setSpeed(id: EntityId, speed: number): void {
    const m = this.entities.get<Motion>(id, C.Motion);
    if (m === undefined || m.speed === speed) return;
    this.entities.add<Motion>(id, C.Motion, { ...m, speed });
  }

  /** Clear a mover's path without touching its position. */
  clearPath(id: EntityId): void {
    const m = this.entities.get<Motion>(id, C.Motion);
    if (m === undefined) return;
    this.entities.add<Motion>(id, C.Motion, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
  }

  /**
   * `moveAlongPath(id, ctx)`. One call advances the mover by `speed / cost` of a tile and takes
   * every whole step that accumulates.
   */
  moveAlongPath(id: EntityId, ctx: MovementContext): MoveOutcome {
    const motion = this.entities.get<Motion>(id, C.Motion);
    if (motion === undefined) return 'idle';
    const m: Motion = { ...motion };
    if (m.pathId === 0) return 'idle';
    if (this.crowded.size > 0) this.crowded.delete(id);
    const path = this.pathing.pathfinder.path(m.pathId);
    if (path === null) {
      this.write(id, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
      return 'idle';
    }
    if (m.stepIndex >= path.length) {
      this.write(id, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
      return 'arrived';
    }
    if (m.waitUntil > ctx.tick) return 'moving';

    const mover = this.moverOf(id);
    let next = path[m.stepIndex] as TileIndex;
    // `progress += speed * 1000 / cost(next)`; costs are in the same 1000-per-step scale.
    m.progress += Math.trunc((m.speed * STEP_COST) / this.pathing.graph.cost(next, m.movementClass, mover));

    while (m.progress >= STEP_COST) {
      if (!this.pathing.graph.passable(next, m.movementClass, mover)) {
        m.repathCount += 1;
        return this.blocked(id, m);
      }
      if (this.blockedByCreature(next, id)) {
        m.repathCount += 1;
        m.waitUntil = ctx.tick + REPATH_WAIT_TICKS;
        if (m.repathCount > REPATH_LIMIT) {
          this.crowded.set(id, next);
          return this.blocked(id, m);
        }
        this.write(id, m);
        return 'moving';
      }
      const prev = this.tileOf(id);
      this.place(id, prev, next);
      if (this.map.kindAt(next) === TileKind.Open) {
        this.write(id, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
        return this.fall(id, ctx);
      }
      m.progress -= STEP_COST;
      m.stepIndex += 1;
      m.repathCount = 0;
      if (m.stepIndex >= path.length) {
        this.write(id, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
        return 'arrived';
      }
      next = path[m.stepIndex] as TileIndex;
    }
    this.write(id, m);
    return 'moving';
  }

  private write(id: EntityId, m: Motion): void {
    this.entities.add<Motion>(id, C.Motion, m);
  }

  private blocked(id: EntityId, m: Motion): MoveOutcome {
    this.write(id, { ...m, pathId: 0, stepIndex: 0, progress: 0 });
    return 'blocked';
  }

  /**
   * `blockedByCreature(next, id)`: a creature hostile to the mover, or any creature at all when a
   * door stands on the tile. Two dwarves otherwise share a tile.
   */
  blockedByCreature(next: TileIndex, id: EntityId): boolean {
    const occupants = this.spatial.at(next);
    if (occupants.length === 0) return false;
    const door = this.pathing.graph.hooks.doorAt(next);
    for (let k = 0; k < occupants.length; k += 1) {
      const other = occupants[k] as EntityId;
      if (other === id) continue;
      if (this.entities.kind(other) !== 'creature') continue;
      if (door) return true;
      if (this.pathing.graph.hooks.hostile(id, other)) return true;
    }
    return false;
  }

  /**
   * `fall(id)`: drop to the first solid-bottomed tile below (or the surface of a full fluid),
   * emit `Fell`, and clear the path.
   */
  fall(id: EntityId, ctx: MovementContext): MoveOutcome {
    const start = this.tileOf(id);
    if (start < 0) return 'idle';
    const z0 = this.map.zOf(start);
    let cur = start;
    for (;;) {
      const below = this.map.below(cur);
      if (below < 0) break;
      const kind = this.map.kindAt(below);
      if (isSolidBottomed(kind)) {
        cur = below;
        break;
      }
      if (kind !== TileKind.Open) break;
      cur = below;
      if (this.map.fluidLevelAt(cur) === FLUID_MAX_LEVEL) break;
    }
    if (cur !== start) this.place(id, start, cur);
    this.clearPath(id);
    ctx.emit({ type: 'Fell', id, levels: z0 - this.map.zOf(cur), landedOn: cur });
    return 'fell';
  }
}
