import { describe, it, expect } from 'vitest';
import {
  ENTITY_KINDS,
  EntityStore,
  NO_ENTITY,
  entityGeneration,
  entityIndex,
  makeEntityId,
  type EntityKind,
} from '@core/entities';
import { C, COMPONENT_TYPES, createEntityStore, MOVEMENT_CLASSES } from '@core/components';
import { RngStream } from '@core/rng';
// @ts-expect-error -- a plain .mjs script without type declarations
import { parseComponentOwners } from '../../scripts/parse-component-owners.mjs';

interface OwnerRow {
  component: string;
  owner: string;
  ownerNote: string;
  alsoWrittenBy: string[];
}

const ownerRows: OwnerRow[] = parseComponentOwners();

describe('T-M0-05 entities: id packing', () => {
  it('bits 0-23 are the index and 24-31 the generation', () => {
    const id = makeEntityId(0x00abcdef & 0xffffff, 0x7f);
    expect(entityIndex(id)).toBe(0xabcdef);
    expect(entityGeneration(id)).toBe(0x7f);
  });

  it('round-trips over the whole field range', () => {
    const rng = new RngStream(3);
    for (let k = 0; k < 2000; k += 1) {
      const index = rng.int(0, 0xffffff);
      const gen = rng.int(1, 255);
      const id = makeEntityId(index, gen);
      expect(entityIndex(id)).toBe(index);
      expect(entityGeneration(id)).toBe(gen);
      expect(id).toBeGreaterThan(0);
    }
  });

  it('NO_ENTITY is 0 and is never alive', () => {
    expect(NO_ENTITY).toBe(0);
    const store = createEntityStore();
    expect(store.alive(NO_ENTITY)).toBe(false);
  });
});

describe('T-M0-05 entities: lifetime and generations', () => {
  it('a created entity is alive and carries its kind', () => {
    const store = createEntityStore();
    const id = store.create('creature');
    expect(store.alive(id)).toBe(true);
    expect(store.kind(id)).toBe('creature');
    expect(store.count).toBe(1);
  });

  it('alive is false after destroy', () => {
    const store = createEntityStore();
    const id = store.create('item');
    store.destroy(id);
    expect(store.alive(id)).toBe(false);
    expect(store.kind(id)).toBeUndefined();
    expect(store.count).toBe(0);
  });

  it('a reused slot has a new generation and the old id stays dead', () => {
    const store = createEntityStore();
    const first = store.create('item');
    store.destroy(first);
    const second = store.create('item');
    expect(entityIndex(second)).toBe(entityIndex(first));
    expect(entityGeneration(second)).not.toBe(entityGeneration(first));
    expect(store.alive(first)).toBe(false);
    expect(store.alive(second)).toBe(true);
  });

  it('the generation wraps past 255 without ever producing id 0', () => {
    const store = createEntityStore();
    let id = store.create('item');
    for (let k = 0; k < 600; k += 1) {
      expect(id).not.toBe(0);
      expect(entityGeneration(id)).toBeGreaterThan(0);
      store.destroy(id);
      id = store.create('item');
      expect(entityIndex(id)).toBe(0);
    }
  });

  it('destroying twice is a no-op and destroying an unknown id is safe', () => {
    const store = createEntityStore();
    const id = store.create('zone');
    store.destroy(id);
    store.destroy(id);
    store.destroy(makeEntityId(9999, 4));
    expect(store.count).toBe(0);
  });

  it('destroy notifies the listener with the id and kind', () => {
    const store = createEntityStore();
    const seen: [number, EntityKind][] = [];
    store.setDestroyListener((id, kind) => seen.push([id, kind]));
    const a = store.create('building');
    const b = store.create('crop');
    store.destroy(a);
    store.destroy(b);
    expect(seen).toEqual([
      [a, 'building'],
      [b, 'crop'],
    ]);
  });

  it('destroy removes every component of the entity', () => {
    const store = createEntityStore();
    const id = store.create('creature');
    store.add(id, C.Position, { x: 1, y: 2, z: 3 });
    store.add(id, C.Needs, { hunger: 1, thirst: 2, rest: 3, social: 4, comfort: 5, purpose: 6, joy: 7 });
    store.destroy(id);
    expect(store.store(C.Position).size).toBe(0);
    expect(store.store(C.Needs).size).toBe(0);
  });

  it('every documented kind can be created and listed ascending', () => {
    const store = createEntityStore();
    for (const kind of ENTITY_KINDS) {
      const ids = [store.create(kind), store.create(kind), store.create(kind)];
      expect(store.ofKind(kind)).toEqual(ids);
      expect(ids.every((id) => store.kind(id) === kind)).toBe(true);
    }
    expect(store.count).toBe(ENTITY_KINDS.length * 3);
  });

  it('each visits a kind ascending and tolerates destruction inside the callback', () => {
    const store = createEntityStore();
    const ids = Array.from({ length: 6 }, () => store.create('item'));
    const seen: number[] = [];
    store.each('item', (id) => {
      seen.push(id);
      store.destroy(id);
    });
    expect(seen).toEqual(ids);
    expect(store.count).toBe(0);
  });
});

describe('T-M0-05 entities: components', () => {
  it('add, get, has and remove', () => {
    const store = createEntityStore();
    const id = store.create('creature');
    expect(store.has(id, C.Brain)).toBe(false);
    expect(store.get(id, C.Brain)).toBeUndefined();
    store.add(id, C.Brain, {
      behavior: 'idle',
      behaviorUntil: 0,
      targetTile: -1,
      activity: '',
      lastMistTick: 0,
      lastOutdoorThoughtHour: 0,
      daysUnderground: 0,
    });
    expect(store.has(id, C.Brain)).toBe(true);
    expect(store.get(id, C.Brain)?.behavior).toBe('idle');
    store.remove(id, C.Brain);
    expect(store.has(id, C.Brain)).toBe(false);
  });

  it('adding to a dead entity throws', () => {
    const store = createEntityStore();
    const id = store.create('item');
    store.destroy(id);
    expect(() => store.add(id, C.Position, { x: 0, y: 0, z: 0 })).toThrow(RangeError);
  });

  it('Position is stored as parallel typed arrays', () => {
    expect(C.Position.storage).toBe('soa');
    const store = createEntityStore();
    const ids = Array.from({ length: 3000 }, () => store.create('creature'));
    ids.forEach((id, k) => store.add(id, C.Position, { x: k % 96, y: (k * 7) % 96, z: k % 48 }));
    ids.forEach((id, k) => {
      expect(store.get(id, C.Position)).toEqual({ x: k % 96, y: (k * 7) % 96, z: k % 48 });
    });
    expect(store.store(C.Position).size).toBe(3000);
  });

  it('Position survives the SoA array growth', () => {
    const store = createEntityStore();
    const first = store.create('creature');
    store.add(first, C.Position, { x: 11, y: 22, z: 33 });
    for (let k = 0; k < 5000; k += 1) {
      const id = store.create('creature');
      store.add(id, C.Position, { x: 1, y: 1, z: 1 });
    }
    expect(store.get(first, C.Position)).toEqual({ x: 11, y: 22, z: 33 });
  });

  it('Motion is stored as SoA and keeps the movement class', () => {
    expect(C.Motion.storage).toBe('soa');
    const store = createEntityStore();
    for (const mc of MOVEMENT_CLASSES) {
      const id = store.create('creature');
      store.add(id, C.Motion, {
        pathId: 5,
        stepIndex: 2,
        progress: 250,
        speed: 1000,
        movementClass: mc,
        repathCount: 1,
        waitUntil: 42,
      });
      expect(store.get(id, C.Motion)).toEqual({
        pathId: 5,
        stepIndex: 2,
        progress: 250,
        speed: 1000,
        movementClass: mc,
        repathCount: 1,
        waitUntil: 42,
      });
    }
  });

  it('non-hot components use map storage', () => {
    const mapBacked = COMPONENT_TYPES.filter((t) => t.storage === 'map').map((t) => t.name);
    const soa = COMPONENT_TYPES.filter((t) => t.storage === 'soa').map((t) => t.name);
    expect(soa).toEqual(['Position', 'Motion']);
    expect(mapBacked).toContain('Item');
    expect(mapBacked).toContain('Building');
  });

  it('with(a, b) iterates ascending and only over entities having both', () => {
    const store = createEntityStore();
    const rng = new RngStream(19);
    const expected: number[] = [];
    for (let k = 0; k < 400; k += 1) {
      const id = store.create('creature');
      const hasPos = rng.chance(700);
      const hasMotion = rng.chance(500);
      if (hasPos) store.add(id, C.Position, { x: 0, y: 0, z: 0 });
      if (hasMotion) {
        store.add(id, C.Motion, {
          pathId: 0,
          stepIndex: 0,
          progress: 0,
          speed: 0,
          movementClass: 'walker',
          repathCount: 0,
          waitUntil: 0,
        });
      }
      if (hasPos && hasMotion) expected.push(id);
    }
    const got = store.with(C.Position, C.Motion);
    expect(got).toEqual(expected);
    expect([...got].sort((a, b) => a - b)).toEqual(got);
    // The order does not depend on the argument order.
    expect(store.with(C.Motion, C.Position)).toEqual(expected);
  });

  it('with(a) is every entity that has a', () => {
    const store = createEntityStore();
    const ids = Array.from({ length: 10 }, () => store.create('item'));
    for (const id of ids) store.add(id, C.Item, makeItem());
    expect(store.with(C.Item)).toEqual(ids);
  });

  it('with skips destroyed entities', () => {
    const store = createEntityStore();
    const a = store.create('item');
    const b = store.create('item');
    store.add(a, C.Item, makeItem());
    store.add(b, C.Item, makeItem());
    store.destroy(a);
    expect(store.with(C.Item)).toEqual([b]);
  });

  it('with(a, b, c) intersects three components', () => {
    const store = createEntityStore();
    const all = store.create('creature');
    const some = store.create('creature');
    for (const id of [all, some]) {
      store.add(id, C.Position, { x: 0, y: 0, z: 0 });
      store.add(id, C.Needs, { hunger: 0, thirst: 0, rest: 0, social: 0, comfort: 0, purpose: 0, joy: 0 });
    }
    store.add(all, C.Attributes, { str: 1, agi: 1, tou: 1, end: 1, wil: 1, wit: 1, cha: 1 });
    expect(store.with(C.Position, C.Needs, C.Attributes)).toEqual([all]);
  });

  it('forEachWith visits the same ids as with', () => {
    const store = createEntityStore();
    const ids = Array.from({ length: 5 }, () => store.create('item'));
    for (const id of ids) store.add(id, C.Item, makeItem());
    const seen: number[] = [];
    store.forEachWith(C.Item, (id) => seen.push(id));
    expect(seen).toEqual(ids);
  });

  it('allIds is ascending by slot and only living entities', () => {
    const store = createEntityStore();
    const ids = Array.from({ length: 8 }, () => store.create('item'));
    store.destroy(ids[3]!);
    store.destroy(ids[6]!);
    expect(store.allIds()).toEqual(ids.filter((_, k) => k !== 3 && k !== 6));
  });

  it('clear empties the store', () => {
    const store = createEntityStore();
    const id = store.create('item');
    store.add(id, C.Item, makeItem());
    store.clear();
    expect(store.count).toBe(0);
    expect(store.slotCount).toBe(0);
    expect(store.allIds()).toEqual([]);
    expect(store.alive(id)).toBe(false);
  });
});

describe('T-M0-05 components: ownership metadata matches components.md', () => {
  it('the document lists the components the registry declares, in the same order', () => {
    expect(COMPONENT_TYPES.map((t) => t.name)).toEqual(ownerRows.map((r) => r.component));
  });

  it('component ids are dense and match the array position', () => {
    COMPONENT_TYPES.forEach((t, i) => expect(t.id).toBe(i));
  });

  for (const row of ownerRows) {
    it(`${row.component} is owned by ${row.owner}`, () => {
      const type = COMPONENT_TYPES.find((t) => t.name === row.component);
      expect(type).toBeDefined();
      expect(type?.owner).toBe(row.owner);
      expect(type?.ownerNote).toBe(row.ownerNote);
      expect([...(type?.alsoWrittenBy ?? [])]).toEqual(row.alsoWrittenBy);
    });
  }

  it('the C map exposes every component type', () => {
    expect(Object.keys(C).sort()).toEqual(COMPONENT_TYPES.map((t) => t.name).sort());
  });
});

describe('T-M0-05 entities: store construction', () => {
  it('a store built from an explicit type list works the same', () => {
    const store = new EntityStore(COMPONENT_TYPES);
    const id = store.create('room');
    expect(store.alive(id)).toBe(true);
    expect(store.componentTypes()).toBe(COMPONENT_TYPES);
  });
});

function makeItem(): import('@core/components').Item {
  return {
    type: 0,
    material: 0,
    quality: 0,
    wear: 0,
    count: 1,
    containerId: 0,
    ownerId: 0,
    flags: 0,
    crafterId: 0,
    rotStart: 0,
    rotStage: 0,
    reservedBy: 0,
    carriedBy: 0,
  };
}
