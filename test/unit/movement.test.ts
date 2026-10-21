import { describe, it, expect } from 'vitest';
import { C, createEntityStore, type Creature, type Motion, type Position } from '@core/components';
import type { GameEvent } from '@core/events';
import { Map3D, TileKind } from '@core/map3d';
import { MovementHelper, type MovementContext } from '@core/movement';
import { REPATH_LIMIT, REPATH_WAIT_TICKS, STEP_COST } from '@core/path-constants';
import { PathingCore, type TerrainHooks } from '@core/pathfinding';
import { SpatialIndex } from '@core/spatial';
import type { EntityId, TileIndex } from '@core/types';
import { fillRect, put, solidMap } from './path-fixtures';

interface Harness {
  map: Map3D;
  entities: ReturnType<typeof createEntityStore>;
  spatial: SpatialIndex;
  pathing: PathingCore;
  movement: MovementHelper;
  events: GameEvent[];
  ctx: MovementContext;
  setTick(t: number): void;
}

function harness(map: Map3D, hooks: Partial<TerrainHooks> = {}): Harness {
  const entities = createEntityStore();
  const spatial = new SpatialIndex(map, entities);
  const pathing = new PathingCore(map, hooks);
  const movement = new MovementHelper(map, entities, spatial, pathing);
  const events: GameEvent[] = [];
  let tick = 0;
  const ctx: MovementContext = {
    get tick(): number {
      return tick;
    },
    emit: (event) => events.push(event),
  };
  return {
    map,
    entities,
    spatial,
    pathing,
    movement,
    events,
    ctx,
    setTick: (t: number) => {
      tick = t;
    },
  };
}

function spawnWalker(h: Harness, tile: TileIndex, speed = STEP_COST, faction = 'fortress'): EntityId {
  const id = h.entities.create('creature');
  h.entities.add<Position>(id, C.Position, h.map.unpack(tile));
  h.entities.add<Creature>(id, C.Creature, {
    species: 1,
    name: 'test',
    sex: 0,
    ageTicks: 0,
    faction,
    sizeClass: 60,
    bodyPlan: 1,
  });
  h.entities.add<Motion>(id, C.Motion, {
    pathId: 0,
    stepIndex: 0,
    progress: 0,
    speed,
    movementClass: 'walker',
    repathCount: 0,
    waitUntil: 0,
  });
  h.spatial.insert(id, tile);
  return id;
}

/** Give a mover a ready path to `to` and return its id. */
function givePath(h: Harness, id: EntityId, to: TileIndex): number {
  const from = h.movement.tileOf(id);
  const pathId = h.pathing.pathfinder.requestPath(id, from, to, 'walker', 'job');
  h.pathing.pathfinder.tick();
  expect(h.pathing.pathfinder.pathResult(pathId).state).toBe('ready');
  const m = h.entities.get<Motion>(id, C.Motion) as Motion;
  h.entities.add<Motion>(id, C.Motion, { ...m, pathId, stepIndex: 0, progress: 0 });
  return pathId;
}

function corridor(): Map3D {
  const map = solidMap(12, 5, 2);
  fillRect(map, 1, 2, 10, 2, 0, TileKind.Floor);
  return map;
}

describe('T-M0-09 movement: moveAlongPath steps', () => {
  it('a mover with no path is idle', () => {
    const h = harness(corridor());
    const id = spawnWalker(h, h.map.index(1, 2, 0));
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('idle');
  });

  it('walks the whole path one tile per tick at one tile per tick of speed', () => {
    const h = harness(corridor());
    const from = h.map.index(1, 2, 0);
    const to = h.map.index(6, 2, 0);
    const id = spawnWalker(h, from);
    givePath(h, id, to);
    const outcomes: string[] = [];
    for (let t = 0; t < 10; t += 1) {
      h.setTick(t);
      const outcome = h.movement.moveAlongPath(id, h.ctx);
      outcomes.push(outcome);
      if (outcome === 'arrived') break;
    }
    expect(outcomes[outcomes.length - 1]).toBe('arrived');
    expect(h.movement.tileOf(id)).toBe(to);
    // Five steps of one tile each, then the arrival on the fifth call.
    expect(outcomes.length).toBe(5);
    expect(h.movement.pendingMoves().length).toBe(5);
  });

  it('a slow mover takes several ticks per tile and its progress accumulates', () => {
    const h = harness(corridor());
    const from = h.map.index(1, 2, 0);
    const id = spawnWalker(h, from, STEP_COST / 4);
    givePath(h, id, h.map.index(3, 2, 0));
    for (let t = 0; t < 3; t += 1) {
      h.setTick(t);
      expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
      expect(h.movement.tileOf(id)).toBe(from);
    }
    h.setTick(3);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(h.map.index(2, 2, 0));
  });

  it('a doubled tile cost halves the progress gained', () => {
    const h = harness(corridor());
    const from = h.map.index(1, 2, 0);
    const next = h.map.index(2, 2, 0);
    h.map.fluid[next] = Map3D.packFluid(2);
    const id = spawnWalker(h, from);
    givePath(h, id, h.map.index(4, 2, 0));
    h.setTick(0);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(from);
    expect((h.entities.get<Motion>(id, C.Motion) as Motion).progress).toBe(STEP_COST / 2);
  });

  it('emits one batched EntitiesMoved per tick and then forgets the moves', () => {
    const h = harness(corridor());
    const id = spawnWalker(h, h.map.index(1, 2, 0));
    givePath(h, id, h.map.index(4, 2, 0));
    h.setTick(0);
    h.movement.moveAlongPath(id, h.ctx);
    const emitted: GameEvent[] = [];
    h.movement.flushMoves((e) => emitted.push(e));
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.type).toBe('EntitiesMoved');
    expect(emitted[0]?.['moves']).toHaveLength(1);
    emitted.length = 0;
    h.movement.flushMoves((e) => emitted.push(e));
    expect(emitted).toHaveLength(0);
  });
});

describe('T-M0-09 movement: blocking', () => {
  it('a tile that stops being passable clears the path and reports blocked', () => {
    const h = harness(corridor());
    const id = spawnWalker(h, h.map.index(1, 2, 0));
    givePath(h, id, h.map.index(6, 2, 0));
    h.map.setKind(h.map.index(2, 2, 0), TileKind.Wall, 1);
    h.setTick(0);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('blocked');
    const m = h.entities.get<Motion>(id, C.Motion) as Motion;
    expect(m.pathId).toBe(0);
    expect(m.repathCount).toBe(1);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('idle');
  });

  it('T-412 a standing hostile on an open tile does not stop a walker', () => {
    const map = corridor();
    const h = harness(map);
    const id = spawnWalker(h, map.index(1, 2, 0));
    spawnWalker(h, map.index(2, 2, 0), STEP_COST, 'hostile:gloam');
    givePath(h, id, map.index(4, 2, 0));
    h.setTick(0);
    expect(h.movement.blockedByCreature(map.index(2, 2, 0), id)).toBe(false);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(map.index(2, 2, 0));
  });

  it('T-412 a standing hostile on a door tile stops the walker', () => {
    const map = corridor();
    const door = map.index(2, 2, 0);
    const h = harness(map, { doorAt: (t) => t === door });
    const id = spawnWalker(h, map.index(1, 2, 0));
    spawnWalker(h, door, STEP_COST, 'hostile:gloam');
    givePath(h, id, map.index(4, 2, 0));
    h.setTick(0);
    expect(h.movement.blockedByCreature(door, id)).toBe(true);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(map.index(1, 2, 0));
  });

  it('T-412 a creature standing on a door tile makes a fast mover wait, then gives up', () => {
    const map = corridor();
    const door = map.index(2, 2, 0);
    const h = harness(map, { doorAt: (t) => t === door });
    const id = spawnWalker(h, map.index(1, 2, 0), STEP_COST * 100);
    spawnWalker(h, door, STEP_COST, 'hostile:gloam');
    givePath(h, id, map.index(6, 2, 0));
    let tick = 0;
    for (let attempt = 1; attempt <= REPATH_LIMIT; attempt += 1) {
      h.setTick(tick);
      expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
      const m = h.entities.get<Motion>(id, C.Motion) as Motion;
      expect(m.repathCount).toBe(attempt);
      expect(m.waitUntil).toBe(tick + REPATH_WAIT_TICKS);
      tick = m.waitUntil;
    }
    h.setTick(tick);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('blocked');
    expect((h.entities.get<Motion>(id, C.Motion) as Motion).pathId).toBe(0);
  });

  it('two friendly creatures share a tile', () => {
    const map = corridor();
    const h = harness(map);
    const id = spawnWalker(h, map.index(1, 2, 0));
    spawnWalker(h, map.index(2, 2, 0));
    givePath(h, id, map.index(4, 2, 0));
    h.setTick(0);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(map.index(2, 2, 0));
  });

  it('any creature blocks the tile a door stands on', () => {
    const map = corridor();
    const door = map.index(2, 2, 0);
    const h = harness(map, { doorAt: (t) => t === door });
    const id = spawnWalker(h, map.index(1, 2, 0));
    spawnWalker(h, door);
    givePath(h, id, map.index(4, 2, 0));
    h.setTick(0);
    expect(h.movement.moveAlongPath(id, h.ctx)).toBe('moving');
    expect(h.movement.tileOf(id)).toBe(map.index(1, 2, 0));
  });
});

describe('T-M0-09 movement: falling and teleporting', () => {
  it('a floor channelled out under a walking mover blocks it, and the fall drops it to the floor below', () => {
    const map = solidMap(8, 5, 5);
    fillRect(map, 1, 2, 6, 2, 4, TileKind.Floor);
    // A shaft under (4, 2): open on z 3 and 2, with a floor at z = 1.
    put(map, 4, 2, 3, TileKind.Open);
    put(map, 4, 2, 2, TileKind.Open);
    put(map, 4, 2, 1, TileKind.Floor);
    const h = harness(map);
    const id = spawnWalker(h, map.index(1, 2, 4));
    givePath(h, id, map.index(6, 2, 4));
    // Channel the tile away after the path was planned: an `open` tile is never a legal step, so
    // the mover is blocked at its edge rather than walking into the shaft.
    map.setKind(map.index(4, 2, 4), TileKind.Open, 1);
    let outcome = 'moving';
    for (let t = 0; t < 8 && outcome === 'moving'; t += 1) {
      h.setTick(t);
      outcome = h.movement.moveAlongPath(id, h.ctx);
    }
    expect(outcome).toBe('blocked');
    expect(h.movement.tileOf(id)).toBe(map.index(3, 2, 4));

    // Standing in the shaft is what makes a creature fall; 03 calls `fall` when it channels.
    h.movement.teleport(id, map.index(4, 2, 4));
    expect(h.movement.fall(id, h.ctx)).toBe('fell');
    expect(h.movement.tileOf(id)).toBe(map.index(4, 2, 1));
    const fell = h.events.find((e) => e.type === 'Fell');
    expect(fell).toBeDefined();
    expect(fell?.['levels']).toBe(3);
    expect(fell?.['landedOn']).toBe(map.index(4, 2, 1));
    expect((h.entities.get<Motion>(id, C.Motion) as Motion).pathId).toBe(0);
  });

  it('a fall stops at the surface of a full fluid', () => {
    const map = solidMap(6, 5, 5);
    put(map, 2, 2, 4, TileKind.Open);
    put(map, 2, 2, 3, TileKind.Open);
    put(map, 2, 2, 2, TileKind.Open);
    map.fluid[map.index(2, 2, 2)] = Map3D.packFluid(7);
    put(map, 2, 2, 1, TileKind.Floor);
    const h = harness(map);
    const id = spawnWalker(h, map.index(2, 2, 4));
    h.setTick(0);
    expect(h.movement.fall(id, h.ctx)).toBe('fell');
    expect(h.movement.tileOf(id)).toBe(map.index(2, 2, 2));
  });

  it('teleport moves the entity and its bucket without a path', () => {
    const map = corridor();
    const h = harness(map);
    const from = map.index(1, 2, 0);
    const to = map.index(10, 2, 0);
    const id = spawnWalker(h, from);
    expect(h.movement.teleport(id, to)).toBe(true);
    expect(h.movement.tileOf(id)).toBe(to);
    expect(h.spatial.at(from)).toEqual([]);
    expect(h.spatial.at(to)).toEqual([id]);
    expect(h.movement.pendingMoves()).toEqual([[id, from, to]]);
    expect(h.movement.teleport(id, -1)).toBe(false);
  });
});
