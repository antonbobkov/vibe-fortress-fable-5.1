import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { C, createEntityStore, type Position } from '@core/components';
import { NO_ENTITY } from '@core/entities';
import { Map3D } from '@core/map3d';
import { SpatialIndex, chebyshev } from '@core/spatial';
import type { EntityId, TileIndex } from '@core/types';

const W = 40;
const H = 40;
const D = 5;

function world(): { map: Map3D; entities: ReturnType<typeof createEntityStore>; spatial: SpatialIndex } {
  const map = new Map3D(W, H, D);
  const entities = createEntityStore();
  return { map, entities, spatial: new SpatialIndex(map, entities) };
}

function spawn(
  map: Map3D,
  entities: ReturnType<typeof createEntityStore>,
  spatial: SpatialIndex,
  tile: TileIndex,
  kind: 'creature' | 'item' = 'creature',
): EntityId {
  const id = entities.create(kind);
  entities.add<Position>(id, C.Position, map.unpack(tile));
  spatial.insert(id, tile);
  return id;
}

describe('T-M0-09 spatial: buckets and queries', () => {
  it('`at` lists exactly the entities on one tile, ascending', () => {
    const { map, entities, spatial } = world();
    const tile = map.index(5, 5, 2);
    const a = spawn(map, entities, spatial, tile);
    const b = spawn(map, entities, spatial, tile);
    spawn(map, entities, spatial, map.index(6, 5, 2));
    expect(spatial.at(tile)).toEqual([a, b].sort((x, y) => x - y));
    expect(spatial.at(map.index(7, 7, 2))).toEqual([]);
  });

  it('`move` keeps the buckets in step with the positions', () => {
    const { map, entities, spatial } = world();
    const from = map.index(1, 1, 0);
    const to = map.index(30, 30, 0);
    const id = spawn(map, entities, spatial, from);
    entities.add<Position>(id, C.Position, map.unpack(to));
    spatial.move(id, from, to);
    expect(spatial.at(from)).toEqual([]);
    expect(spatial.at(to)).toEqual([id]);
    expect(map.chunk(map.chunkOf(from))?.entities).toEqual([]);
    expect(map.chunk(map.chunkOf(to))?.entities).toEqual([id]);
  });

  it('`rebuild` reconstructs every bucket from the entity store', () => {
    const { map, entities, spatial } = world();
    const ids = [map.index(2, 2, 0), map.index(20, 20, 1), map.index(39, 39, 4)].map((t) =>
      spawn(map, entities, spatial, t),
    );
    for (let c = 0; c < map.chunkCount; c += 1) {
      const rec = map.chunk(c);
      if (rec !== undefined) rec.entities.length = 0;
    }
    spatial.rebuild();
    for (const id of ids) expect(spatial.at(spatial.tileOf(id))).toContain(id);
  });

  it('`nearest` picks the closest match and ignores the rest', () => {
    const { map, entities, spatial } = world();
    const origin = map.index(20, 20, 2);
    const near = spawn(map, entities, spatial, map.index(22, 20, 2));
    const far = spawn(map, entities, spatial, map.index(30, 20, 2));
    const item = spawn(map, entities, spatial, map.index(21, 20, 2), 'item');
    const creatures = (id: EntityId): boolean => entities.kind(id) === 'creature';
    expect(spatial.nearest(origin, creatures, 20)).toBe(near);
    expect(spatial.nearest(origin, (id) => id === far, 20)).toBe(far);
    expect(spatial.nearest(origin, (id) => id === item, 20)).toBe(item);
    expect(spatial.nearest(origin, creatures, 1)).toBe(NO_ENTITY);
  });

  it('the reader filters by entity kind', () => {
    const { map, entities, spatial } = world();
    const origin = map.index(10, 10, 1);
    const creature = spawn(map, entities, spatial, map.index(11, 10, 1));
    const item = spawn(map, entities, spatial, map.index(12, 10, 1), 'item');
    const reader = spatial.reader();
    expect(reader.inRadius(origin, 5, 'creature')).toEqual([creature]);
    expect(reader.inRadius(origin, 5, 'item')).toEqual([item]);
    expect(reader.inRadius(origin, 5)).toEqual([creature, item].sort((a, b) => a - b));
  });
});

describe('T-M0-09 spatial: inRadius and inBox against brute force', () => {
  it('agrees with a scan over every entity', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.integer({ min: 0, max: W - 1 }),
            y: fc.integer({ min: 0, max: H - 1 }),
            z: fc.integer({ min: 0, max: D - 1 }),
          }),
          { minLength: 1, maxLength: 60 },
        ),
        fc.record({
          x: fc.integer({ min: 0, max: W - 1 }),
          y: fc.integer({ min: 0, max: H - 1 }),
          z: fc.integer({ min: 0, max: D - 1 }),
        }),
        fc.integer({ min: 0, max: 12 }),
        (places, centre, r) => {
          const { map, entities, spatial } = world();
          const ids: EntityId[] = [];
          for (const p of places) ids.push(spawn(map, entities, spatial, map.index(p.x, p.y, p.z)));
          const origin = map.index(centre.x, centre.y, centre.z);
          const brute = ids
            .filter((id) => chebyshev(map, origin, spatial.tileOf(id)) <= r)
            .sort((a, b) => a - b);
          expect([...spatial.inRadius(origin, r)]).toEqual(brute);

          const corner = map.index(
            Math.min(W - 1, centre.x + r),
            Math.min(H - 1, centre.y + r),
            Math.min(D - 1, centre.z + r),
          );
          const box = ids
            .filter((id) => {
              const t = spatial.tileOf(id);
              return (
                map.xOf(t) >= Math.min(centre.x, map.xOf(corner)) &&
                map.xOf(t) <= Math.max(centre.x, map.xOf(corner)) &&
                map.yOf(t) >= Math.min(centre.y, map.yOf(corner)) &&
                map.yOf(t) <= Math.max(centre.y, map.yOf(corner)) &&
                map.zOf(t) >= Math.min(centre.z, map.zOf(corner)) &&
                map.zOf(t) <= Math.max(centre.z, map.zOf(corner))
              );
            })
            .sort((a, b) => a - b);
          expect([...spatial.inBox(origin, corner)]).toEqual(box);
          return true;
        },
      ),
      { numRuns: 40 },
    );
  });
});
