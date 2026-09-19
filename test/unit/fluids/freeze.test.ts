import { describe, it, expect } from 'vitest';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import { transition } from '@systems/terrain';
import type { BuildingsReader } from '@systems/buildings';
import { regionSpec } from '@app/headless';
import { TestWorld } from '../../scenarios/test-world';
import { digPond, POND_Z } from '../../scenarios/pond';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test' });
}

describe('T-M3-05 freezing and thawing', () => {
  it('hysteresis: nothing flickers between FREEZE_C and THAW_C', () => {
    const w = world('hysteresis');
    const [t] = digPond(w, 2) as [number];
    const at = (c: number, ticks = 30): void => {
      w.forceTemperature(t, c);
      w.step(ticks);
    };
    at(0);
    expect(w.fluids.sim.isFrozen(t)).toBe(false);
    at(-1);
    expect(w.fluids.sim.isFrozen(t)).toBe(false);
    at(-2);
    expect(w.fluids.sim.isFrozen(t)).toBe(true);
    for (const c of [-1, 0, 1, 2]) {
      at(c);
      expect([c, w.fluids.sim.isFrozen(t)]).toEqual([c, true]);
    }
    at(3);
    expect(w.fluids.sim.isFrozen(t)).toBe(false);
    at(-1);
    expect(w.fluids.sim.isFrozen(t)).toBe(false);
  });

  it('only outdoor water freezes: underground water never does', () => {
    const w = world('indoor');
    const indoor = w.index(20, 20, 25);
    w.carve(indoor, TileKind.Floor);
    w.setFluid(indoor, 3);
    const [pond] = digPond(w, 3) as [number];
    w.forceTemperature(indoor, -20);
    w.forceTemperature(pond, -20);
    w.step(30);
    expect(w.fluids.sim.isFrozen(indoor)).toBe(false);
    expect(w.fluids.sim.isFrozen(pond)).toBe(true);
    expect(w.fluids.freezer.outdoor).toContain(pond);
    expect(w.fluids.freezer.outdoor).not.toContain(indoor);
  });

  it('gemsprings warm springs never freeze', () => {
    const spec = regionSpec('springs', { traits: ['gemsprings'] });
    const w = new TestWorld({ seed: 'springs', world: 'local', spec });
    const springs = (w.game.local?.warmSprings ?? []).filter((s) => w.fluids.sim.level(s) > 0);
    expect(springs.length).toBeGreaterThan(0);
    for (const s of springs) {
      w.map.setFlag(s, TileFlag.Outdoor, true);
      w.forceTemperature(s, -30);
    }
    w.fluids.freezer.tilesChanged(springs);
    w.step(30);
    for (const s of springs) expect(w.fluids.sim.isFrozen(s)).toBe(false);
  });

  it('a dwarf on a freezing pond is moved to the nearest walkable tile within 2', () => {
    const w = world('displace');
    const pond = digPond(w, 3);
    const centre = w.index(41, 41, POND_Z);
    const dwarf = w.spawnDwarf({ at: centre });
    w.step(2);
    for (const t of pond) w.forceTemperature(t, -10);
    w.step(30);
    expect(w.fluids.sim.isFrozen(centre)).toBe(true);
    const tile = w.movement.tileOf(dwarf);
    expect(tile).not.toBe(centre);
    expect(pond).not.toContain(tile);
    const p = w.map.unpack(tile);
    expect(Math.max(Math.abs(p.x - 41), Math.abs(p.y - 41), Math.abs(p.z - POND_Z))).toBeLessThanOrEqual(2);
    expect(w.pathing.graph.passable(tile, 'walker')).toBe(true);
    expect(w.events('CreatureDied')).toEqual([]);
  });

  it('digging ice drops nothing (03) and the water is gone; frozen water is not water to pathing', () => {
    const w = world('dig-ice');
    const pond = digPond(w, 5);
    const t = pond[4] as number;
    for (const p of pond) w.forceTemperature(p, -10);
    w.step(30);
    expect(w.map.kindAt(t)).toBe(TileKind.Wall);
    const terrain = w.game.terrain;
    if (terrain === null) throw new Error('no terrain');
    const facts = terrain.core.host.facts;
    const result = transition(w.map, t, Designation.Dig, facts, {
      stoneDrops: () => true,
      logs: () => 1,
      gather: () => null,
      logMaterial: () => 'oak',
    });
    expect(result.drops).toEqual([]);
    // 03's transition table: a floor of the same material (D-099 on 04's "leaves an open tile").
    expect(result.changes).toEqual([{ tile: t, kind: TileKind.Floor, material: w.map.materialAt(t) }]);
    expect(w.pathing.graph.passable(t, 'walker')).toBe(false);
    terrain.core.writeMany(result.changes);
    w.step(4);
    expect(w.map.fluid[t]).toBe(0);
    expect(w.fluids.freezer.original.has(t)).toBe(false);
    expect(w.fluids.freezer.outdoor).not.toContain(t);
    expect(w.pathing.graph.passable(t, 'walker')).toBe(true);
  });

  it('a well works with water 3 levels below and stops when it freezes', () => {
    const w = world('well');
    const x = 60;
    const y = 60;
    const site = w.index(x, y, 32);
    const water = w.index(x, y, 29);
    for (const z of [30, 31, 32]) {
      w.carve(w.index(x, y, z), TileKind.Open);
      w.map.setFlag(w.index(x, y, z), TileFlag.Outdoor, true);
    }
    w.carve(water, TileKind.Floor);
    w.map.setFlag(water, TileFlag.Outdoor, true);
    w.discover(site);
    w.setFluid(water, 5);
    w.fluids.freezer.tilesChanged([water]);
    const well = w.build('well', site, 'granite');
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(buildings.wellWorking(well)).toBe(true);
    w.forceTemperature(water, -10);
    w.step(30);
    expect(w.fluids.sim.isFrozen(water)).toBe(true);
    expect(buildings.wellWorking(well)).toBe(false);
  });
});
