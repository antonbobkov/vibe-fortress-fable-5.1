/**
 * T-426: the three-year script places a gate wall again when a fire burns it, and the T-156
 * witness waits `GATE_WALL_REBUILD_TICKS` for it.
 */
import { describe, expect, it } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { GATE_WALL_REBUILD_TICKS, gateWallTiles, keepGateWalls, Z } from '../scenarios/three_years_fortress';
import type { EconomyState } from '../scenarios/three_years_economy';
import { TestWorld } from '../scenarios/test-world';

describe('T-426 a burnt gate wall is placed again', () => {
  it('builds the six walls, loses one to fire, and has it standing again within the deadline', () => {
    const w = new TestWorld({ seed: 't426-gate', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const state = { cx: 20, cy: 20, economy: { phases: new Set<string>() } as unknown as EconomyState, gateWallLostTick: 0 };
    // Bare stone ground, so the fire stays on the wall it is set to.
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 14; y <= 34; y += 1) for (let x = 14; x <= 34; x += 1) {
      const t = w.index(x, y, Z);
      w.carve(t, TileKind.Floor, granite);
      w.map.setFlag(t, TileFlag.Grass, false);
    }
    for (let k = 0; k < 3; k += 1) w.spawnDwarf({ at: w.index(18 + k, 30, Z) });
    w.spawnItem('log', 'oak', w.index(22, 30, Z), 30);
    const buildings = w.readers.of<BuildingsReader>('14');
    const walls = gateWallTiles(w, state);
    const standing = (): boolean => walls.every((t) => buildings.get(buildings.at(t))?.typeId === 'wall' && buildings.get(buildings.at(t))?.state === 'built');
    const play = (ticks: number, until: () => boolean): void => {
      for (let n = 0; n < ticks && !until(); n += 50) { keepGateWalls(w, state); w.step(50); }
      keepGateWalls(w, state);
    };
    play(12_000, standing);
    expect(standing()).toBe(true);
    expect(state.economy.phases.has('gate walls')).toBe(true);
    expect(state.gateWallLostTick).toBe(0);

    const target = walls[0]!;
    const burnt = buildings.at(target);
    w.materials.fire.pendingIgnite.add(target);
    play(2_000, () => buildings.get(burnt) === undefined || buildings.at(target) !== burnt);
    expect(buildings.at(target)).not.toBe(burnt);
    const lost = state.gateWallLostTick;
    expect(lost).toBeGreaterThan(0);

    play(GATE_WALL_REBUILD_TICKS, standing);
    expect(standing()).toBe(true);
    expect(state.gateWallLostTick).toBe(0);
    expect(w.tick - lost).toBeLessThan(GATE_WALL_REBUILD_TICKS);
  });
});
