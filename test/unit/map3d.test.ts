import { describe, it, expect } from 'vitest';
import {
  Designation,
  FluidType,
  Map3D,
  TILE_FLAG_MASK,
  TileFlag,
  TileKind,
  isSolidBottomed,
} from '@core/map3d';
import { CHUNK_SIZE, LOCAL_MAP_H, LOCAL_MAP_W, LOCAL_MAP_Z } from '@core/constants';
import { RngStream } from '@core/rng';

const ALL_FLAGS: TileFlag[] = [
  TileFlag.Discovered,
  TileFlag.Constructed,
  TileFlag.Smoothed,
  TileFlag.Engraved,
  TileFlag.Mud,
  TileFlag.Snow,
  TileFlag.Grass,
  TileFlag.Ash,
  TileFlag.Burning,
  TileFlag.Outdoor,
  TileFlag.Lit,
  TileFlag.Restricted,
  TileFlag.Web,
  TileFlag.Wet,
];

describe('T-M0-04 map3d: grid sizes', () => {
  it('a default map is LOCAL_MAP_W x LOCAL_MAP_H x LOCAL_MAP_Z', () => {
    const m = new Map3D();
    expect([m.w, m.h, m.d]).toEqual([LOCAL_MAP_W, LOCAL_MAP_H, LOCAL_MAP_Z]);
    const n = LOCAL_MAP_W * LOCAL_MAP_H * LOCAL_MAP_Z;
    expect(m.tileCount).toBe(n);
    expect(n).toBe(442_368); // data-model.md § Sizes
    for (const grid of [m.kind, m.material, m.fluid, m.designation, m.flags, m.tempOverride]) {
      expect(grid.length).toBe(n);
    }
  });

  it('the grids have the documented element types', () => {
    const m = new Map3D(4, 4, 2);
    expect(m.kind).toBeInstanceOf(Uint8Array);
    expect(m.material).toBeInstanceOf(Uint16Array);
    expect(m.fluid).toBeInstanceOf(Uint8Array);
    expect(m.designation).toBeInstanceOf(Uint8Array);
    expect(m.flags).toBeInstanceOf(Uint16Array);
    expect(m.tempOverride).toBeInstanceOf(Int8Array);
    expect(m.buildingAt).toBeInstanceOf(Map);
  });

  it('rejects non-positive dimensions', () => {
    expect(() => new Map3D(0, 4, 4)).toThrow(RangeError);
    expect(() => new Map3D(4, -1, 4)).toThrow(RangeError);
  });
});

describe('T-M0-04 map3d: index math', () => {
  it('index matches the documented formula', () => {
    const m = new Map3D();
    expect(m.index(0, 0, 0)).toBe(0);
    expect(m.index(5, 0, 0)).toBe(5);
    expect(m.index(0, 1, 0)).toBe(LOCAL_MAP_W);
    expect(m.index(0, 0, 1)).toBe(LOCAL_MAP_W * LOCAL_MAP_H);
    expect(m.index(3, 7, 11)).toBe((11 * LOCAL_MAP_H + 7) * LOCAL_MAP_W + 3);
  });

  it('index round-trips for every tile of a small map', () => {
    const m = new Map3D(7, 5, 3);
    let seen = 0;
    for (let z = 0; z < m.d; z += 1) {
      for (let y = 0; y < m.h; y += 1) {
        for (let x = 0; x < m.w; x += 1) {
          const i = m.index(x, y, z);
          expect(m.xOf(i)).toBe(x);
          expect(m.yOf(i)).toBe(y);
          expect(m.zOf(i)).toBe(z);
          expect(m.unpack(i)).toEqual({ x, y, z });
          expect(m.validIndex(i)).toBe(true);
          seen += 1;
        }
      }
    }
    expect(seen).toBe(m.tileCount);
  });

  it('index round-trips at random positions on a full-size map', () => {
    const m = new Map3D();
    const rng = new RngStream(77);
    for (let k = 0; k < 2000; k += 1) {
      const x = rng.int(0, m.w - 1);
      const y = rng.int(0, m.h - 1);
      const z = rng.int(0, m.d - 1);
      const i = m.index(x, y, z);
      expect(m.unpack(i)).toEqual({ x, y, z });
    }
  });

  it('inBounds and validIndex reject what is off the map', () => {
    const m = new Map3D(4, 4, 4);
    expect(m.inBounds(0, 0, 0)).toBe(true);
    expect(m.inBounds(3, 3, 3)).toBe(true);
    expect(m.inBounds(4, 0, 0)).toBe(false);
    expect(m.inBounds(-1, 0, 0)).toBe(false);
    expect(m.inBounds(0, 0, 4)).toBe(false);
    expect(m.validIndex(-1)).toBe(false);
    expect(m.validIndex(m.tileCount)).toBe(false);
    expect(m.validIndex(1.5)).toBe(false);
  });

  it('above, below and offset clamp at the edges', () => {
    const m = new Map3D(4, 4, 3);
    const mid = m.index(1, 1, 1);
    expect(m.above(mid)).toBe(m.index(1, 1, 2));
    expect(m.below(mid)).toBe(m.index(1, 1, 0));
    expect(m.below(m.index(1, 1, 0))).toBe(-1);
    expect(m.above(m.index(1, 1, 2))).toBe(-1);
    expect(m.offset(m.index(0, 0, 0), -1, 0, 0)).toBe(-1);
    expect(m.offset(m.index(0, 0, 0), 1, 1, 1)).toBe(m.index(1, 1, 1));
  });
});

describe('T-M0-04 map3d: neighbours', () => {
  it('a tile in the interior has 6, 8 and 26 neighbours', () => {
    const m = new Map3D(5, 5, 5);
    const i = m.index(2, 2, 2);
    expect(m.neighbors6(i)).toHaveLength(6);
    expect(m.neighbors8(i)).toHaveLength(8);
    expect(m.neighbors26(i)).toHaveLength(26);
    expect(m.neighbors(i)).toEqual(m.neighbors6(i));
  });

  it('neighbours are clipped at a corner', () => {
    const m = new Map3D(5, 5, 5);
    const i = m.index(0, 0, 0);
    expect(m.neighbors6(i)).toEqual([m.index(1, 0, 0), m.index(0, 1, 0), m.index(0, 0, 1)]);
    expect(m.neighbors8(i)).toEqual([m.index(1, 0, 0), m.index(0, 1, 0), m.index(1, 1, 0)]);
    expect(m.neighbors26(i)).toHaveLength(7); // 2x2x2 block minus the tile itself
  });

  it('neighbours are clipped on a face and on an edge', () => {
    const m = new Map3D(5, 5, 5);
    expect(m.neighbors6(m.index(0, 2, 2))).toHaveLength(5);
    expect(m.neighbors26(m.index(0, 2, 2))).toHaveLength(17); // 2x3x3 - 1
    expect(m.neighbors6(m.index(0, 0, 2))).toHaveLength(4);
    expect(m.neighbors26(m.index(0, 0, 2))).toHaveLength(11); // 2x2x3 - 1
    expect(m.neighbors8(m.index(4, 4, 2))).toHaveLength(3);
  });

  it('the top and bottom z-levels lose their vertical neighbour', () => {
    const m = new Map3D(5, 5, 5);
    expect(m.neighbors6(m.index(2, 2, 0))).toHaveLength(5);
    expect(m.neighbors6(m.index(2, 2, 4))).toHaveLength(5);
    expect(m.neighbors8(m.index(2, 2, 0))).toHaveLength(8);
  });

  it('no neighbour list contains the tile itself or a duplicate', () => {
    const m = new Map3D(4, 4, 4);
    for (let i = 0; i < m.tileCount; i += 1) {
      for (const list of [m.neighbors6(i), m.neighbors8(i), m.neighbors26(i)]) {
        expect(list).not.toContain(i);
        expect(new Set(list).size).toBe(list.length);
        for (const n of list) expect(m.validIndex(n)).toBe(true);
      }
    }
  });

  it('the neighbour relation is symmetric', () => {
    const m = new Map3D(4, 4, 4);
    for (let i = 0; i < m.tileCount; i += 1) {
      for (const n of m.neighbors6(i)) expect(m.neighbors6(n)).toContain(i);
      for (const n of m.neighbors26(i)) expect(m.neighbors26(n)).toContain(i);
    }
  });
});

describe('T-M0-04 map3d: flags', () => {
  it('set and clear one flag at a time', () => {
    const m = new Map3D(4, 4, 4);
    const i = m.index(1, 2, 3);
    expect(m.flagsAt(i)).toBe(0);
    m.setFlag(i, TileFlag.Discovered, true);
    expect(m.hasFlag(i, TileFlag.Discovered)).toBe(true);
    expect(m.hasFlag(i, TileFlag.Mud)).toBe(false);
    m.setFlag(i, TileFlag.Discovered, false);
    expect(m.hasFlag(i, TileFlag.Discovered)).toBe(false);
    expect(m.flagsAt(i)).toBe(0);
  });

  it('every documented flag has a distinct bit inside the 14-bit mask', () => {
    const bits = new Set(ALL_FLAGS);
    expect(bits.size).toBe(14);
    let all = 0;
    for (const f of ALL_FLAGS) {
      expect(f & TILE_FLAG_MASK).toBe(f);
      all |= f;
    }
    expect(all).toBe(TILE_FLAG_MASK);
  });

  it('setting every flag then clearing them returns to zero', () => {
    const m = new Map3D(2, 2, 2);
    const i = 0;
    for (const f of ALL_FLAGS) m.setFlag(i, f, true);
    expect(m.flagsAt(i)).toBe(TILE_FLAG_MASK);
    for (const f of ALL_FLAGS) m.setFlag(i, f, false);
    expect(m.flagsAt(i)).toBe(0);
  });

  it('flags are per tile', () => {
    const m = new Map3D(4, 4, 4);
    m.setFlag(m.index(0, 0, 0), TileFlag.Grass, true);
    expect(m.hasFlag(m.index(1, 0, 0), TileFlag.Grass)).toBe(false);
    expect(m.hasFlag(m.index(0, 1, 0), TileFlag.Grass)).toBe(false);
    expect(m.hasFlag(m.index(0, 0, 1), TileFlag.Grass)).toBe(false);
  });

  it('property: random setFlag sequences leave every other bit untouched', () => {
    const m = new Map3D(8, 8, 2);
    const rng = new RngStream(31415);
    const expected = new Uint16Array(m.tileCount);
    for (let step = 0; step < 20_000; step += 1) {
      const i = rng.int(0, m.tileCount - 1);
      const flag = rng.pick(ALL_FLAGS);
      const value = rng.chance(500);
      m.setFlag(i, flag, value);
      const e = expected[i] as number;
      expected[i] = value ? e | flag : e & ~flag & 0xffff;
      expect(m.flagsAt(i)).toBe(expected[i]);
    }
    for (let i = 0; i < m.tileCount; i += 1) expect(m.flagsAt(i)).toBe(expected[i]);
  });
});

describe('T-M0-04 map3d: designation packing', () => {
  const kinds: Designation[] = [
    Designation.None,
    Designation.Dig,
    Designation.Channel,
    Designation.StairsUp,
    Designation.StairsDown,
    Designation.StairsUpDown,
    Designation.Ramp,
    Designation.Smooth,
    Designation.Engrave,
    Designation.Remove,
    Designation.Chop,
    Designation.Gather,
    Designation.Harvest,
  ];

  it('every designation and priority round-trips through one byte', () => {
    const m = new Map3D(4, 4, 4);
    const i = 5;
    for (const k of kinds) {
      for (let p = 1; p <= 9; p += 1) {
        m.setDesignation(i, k, p);
        expect(m.designationAt(i)).toBe(k);
        expect(m.designationPriorityAt(i)).toBe(k === Designation.None ? 0 : p);
        expect(m.designation[i]).toBeLessThanOrEqual(255);
      }
    }
  });

  it('the low nibble is the designation and the high nibble is the priority', () => {
    const m = new Map3D(4, 4, 4);
    m.setDesignation(0, Designation.Harvest, 9);
    expect(m.designation[0]).toBe((9 << 4) | 12);
    m.setDesignation(0, Designation.Dig, 5);
    expect(m.designation[0]).toBe((5 << 4) | 1);
  });

  it('clearing to None zeroes the whole byte', () => {
    const m = new Map3D(4, 4, 4);
    m.setDesignation(0, Designation.Dig, 7);
    m.setDesignation(0, Designation.None, 7);
    expect(m.designation[0]).toBe(0);
    expect(m.designationPriorityAt(0)).toBe(0);
  });

  it('a priority outside 1-9 is rejected', () => {
    const m = new Map3D(4, 4, 4);
    expect(() => m.setDesignation(0, Designation.Dig, 0)).toThrow(RangeError);
    expect(() => m.setDesignation(0, Designation.Dig, 10)).toThrow(RangeError);
    expect(() => m.setDesignation(0, Designation.Dig, 2.5)).toThrow(RangeError);
  });

  it('the designation values match the documented table', () => {
    expect(kinds.map((k) => k as number)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe('T-M0-04 map3d: tile kinds', () => {
  it('the kind values match the documented table', () => {
    expect([
      TileKind.Open,
      TileKind.Wall,
      TileKind.Floor,
      TileKind.Ramp,
      TileKind.StairsUp,
      TileKind.StairsDown,
      TileKind.StairsUpDown,
      TileKind.Fortification,
      TileKind.Tree,
      TileKind.Sapling,
      TileKind.Shrub,
      TileKind.Boulder,
    ]).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('solid-bottomed is exactly floor, ramp, stairs, sapling and shrub', () => {
    const solid = [
      TileKind.Floor,
      TileKind.Ramp,
      TileKind.StairsUp,
      TileKind.StairsDown,
      TileKind.StairsUpDown,
      TileKind.Sapling,
      TileKind.Shrub,
    ];
    for (let k = 0; k <= 11; k += 1) {
      expect(isSolidBottomed(k as TileKind)).toBe(solid.includes(k as TileKind));
    }
  });

  it('setKind writes both grids and dirties the chunk', () => {
    const m = new Map3D(32, 32, 2);
    m.clearRenderDirty();
    const i = m.index(20, 20, 1);
    const c = m.chunkOf(i);
    expect(m.chunk(c)?.dirtyRender).toBe(false);
    m.setKind(i, TileKind.Wall, 42);
    expect(m.kindAt(i)).toBe(TileKind.Wall);
    expect(m.materialAt(i)).toBe(42);
    expect(m.chunk(c)?.dirtyRender).toBe(true);
    expect(m.chunk(c)?.dirtyPath).toBe(true);
  });
});

describe('T-M0-04 map3d: columnSurfaceZ', () => {
  it('is -1 for an all-open column', () => {
    const m = new Map3D(4, 4, 8);
    expect(m.columnSurfaceZ(1, 1)).toBe(-1);
  });

  it('is the highest non-open tile', () => {
    const m = new Map3D(4, 4, 8);
    for (let z = 0; z <= 3; z += 1) m.setKind(m.index(1, 1, z), TileKind.Wall, 1);
    expect(m.columnSurfaceZ(1, 1)).toBe(3);
    m.setKind(m.index(1, 1, 5), TileKind.Floor, 1);
    expect(m.columnSurfaceZ(1, 1)).toBe(5);
    m.setKind(m.index(1, 1, 5), TileKind.Open, 0);
    expect(m.columnSurfaceZ(1, 1)).toBe(3);
  });

  it('a tree, a shrub and a boulder all count as ground', () => {
    const m = new Map3D(4, 4, 8);
    m.setKind(m.index(0, 0, 2), TileKind.Tree, 1);
    m.setKind(m.index(1, 0, 3), TileKind.Shrub, 1);
    m.setKind(m.index(2, 0, 4), TileKind.Boulder, 1);
    expect(m.columnSurfaceZ(0, 0)).toBe(2);
    expect(m.columnSurfaceZ(1, 0)).toBe(3);
    expect(m.columnSurfaceZ(2, 0)).toBe(4);
  });

  it('is -1 off the map', () => {
    const m = new Map3D(4, 4, 4);
    expect(m.columnSurfaceZ(-1, 0)).toBe(-1);
    expect(m.columnSurfaceZ(0, 4)).toBe(-1);
  });
});

describe('T-M0-04 map3d: chunks', () => {
  it('chunk index matches the documented formula on a standard map', () => {
    const m = new Map3D();
    const chunksPerRow = LOCAL_MAP_W / CHUNK_SIZE;
    expect(m.chunksPerRow).toBe(chunksPerRow);
    expect(m.chunksPerCol).toBe(chunksPerRow);
    expect(m.chunkCount).toBe(chunksPerRow * chunksPerRow * LOCAL_MAP_Z);
    expect(m.chunkCount).toBe(1728); // data-model.md § Sizes
    for (const [x, y, z] of [
      [0, 0, 0],
      [15, 15, 0],
      [16, 0, 0],
      [0, 16, 0],
      [95, 95, 47],
      [33, 70, 12],
    ] as [number, number, number][]) {
      const cx = Math.floor(x / CHUNK_SIZE);
      const cy = Math.floor(y / CHUNK_SIZE);
      expect(m.chunkOf(m.index(x, y, z))).toBe((z * chunksPerRow + cy) * chunksPerRow + cx);
    }
  });

  it('every tile maps into an existing chunk', () => {
    const m = new Map3D(32, 48, 3);
    expect(m.chunksPerRow).toBe(2);
    expect(m.chunksPerCol).toBe(3);
    expect(m.chunkCount).toBe(18);
    const seen = new Set<number>();
    for (let i = 0; i < m.tileCount; i += 1) {
      const c = m.chunkOf(i);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(m.chunkCount);
      seen.add(c);
    }
    expect(seen.size).toBe(m.chunkCount);
  });

  it('a partial chunk still exists on an undersized map', () => {
    const m = new Map3D(8, 8, 2);
    expect(m.chunksPerRow).toBe(1);
    expect(m.chunkCount).toBe(2);
    expect(m.chunkOf(m.index(7, 7, 1))).toBe(1);
  });

  it('chunk records start dirty with an empty bucket', () => {
    const m = new Map3D(16, 16, 1);
    const rec = m.chunk(0);
    expect(rec).toEqual({ dirtyRender: true, dirtyPath: true, activeFluidCount: 0, entities: [] });
  });

  it('entity buckets stay sorted and de-duplicated', () => {
    const m = new Map3D(16, 16, 1);
    const rng = new RngStream(5);
    const inserted: number[] = [];
    for (let k = 0; k < 200; k += 1) {
      const id = rng.int(1, 300);
      m.addEntityToChunk(0, id);
      if (!inserted.includes(id)) inserted.push(id);
    }
    const bucket = m.chunk(0)?.entities ?? [];
    expect(bucket).toEqual([...inserted].sort((a, b) => a - b));
    for (const id of inserted) expect(m.removeEntityFromChunk(0, id)).toBe(true);
    expect(m.chunk(0)?.entities).toEqual([]);
    expect(m.removeEntityFromChunk(0, 1)).toBe(false);
  });
});

describe('T-M0-04 map3d: fluid byte and buildings', () => {
  it('the fluid byte packs level, type and the three bits', () => {
    const m = new Map3D(4, 4, 4);
    m.fluid[0] = Map3D.packFluid(5, FluidType.Magma, true, true, false);
    expect(m.fluidLevelAt(0)).toBe(5);
    expect(m.fluidTypeAt(0)).toBe(FluidType.Magma);
    expect(m.fluidSettledAt(0)).toBe(true);
    expect(m.fluidSourceAt(0)).toBe(true);
    expect(m.fluidFrozenAt(0)).toBe(false);
    m.fluid[1] = Map3D.packFluid(7, FluidType.Water, false, false, true);
    expect(m.fluidLevelAt(1)).toBe(7);
    expect(m.fluidTypeAt(1)).toBe(FluidType.Water);
    expect(m.fluidFrozenAt(1)).toBe(true);
    expect(Map3D.packFluid(99)).toBe(7);
    expect(Map3D.packFluid(-1)).toBe(0);
  });

  it('buildingAt entries come back sorted by tile', () => {
    const m = new Map3D(8, 8, 2);
    m.setBuildingAt(m.index(3, 3, 1), 11);
    m.setBuildingAt(m.index(1, 0, 0), 22);
    m.setBuildingAt(m.index(0, 0, 0), 33);
    expect(m.buildingEntries()).toEqual([
      [m.index(0, 0, 0), 33],
      [m.index(1, 0, 0), 22],
      [m.index(3, 3, 1), 11],
    ]);
    expect(m.buildingAtTile(m.index(3, 3, 1))).toBe(11);
    m.setBuildingAt(m.index(3, 3, 1), 0);
    expect(m.buildingAtTile(m.index(3, 3, 1))).toBe(0);
  });

  it('clear resets every grid and chunk', () => {
    const m = new Map3D(16, 16, 2);
    m.setKind(0, TileKind.Wall, 7);
    m.setFlag(0, TileFlag.Mud, true);
    m.setDesignation(0, Designation.Dig, 3);
    m.setBuildingAt(1, 9);
    m.addEntityToChunk(0, 4);
    m.clearRenderDirty();
    m.clear();
    expect(m.kindAt(0)).toBe(TileKind.Open);
    expect(m.flagsAt(0)).toBe(0);
    expect(m.designation[0]).toBe(0);
    expect(m.buildingAt.size).toBe(0);
    expect(m.chunk(0)?.entities).toEqual([]);
    expect(m.chunk(0)?.dirtyRender).toBe(true);
  });
});
