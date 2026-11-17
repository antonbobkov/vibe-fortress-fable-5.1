/**
 * T-586: an ice designation survives the afternoon thaw (`03-terrain-and-mining.md` § Ice harvesting).
 * In a temperate winter the brook freezes at night and thaws by day; a thaw cleared every
 * `harvest_ice` designation on it, silently. Now the designation stays while the tile is outdoor
 * water, shown as blocked with no job, and its job comes back when the water freezes again.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import type { JobsReader } from '@systems/jobs';
import type { TerrainReader } from '@systems/terrain';
import { digPond } from '../scenarios/pond';
import { TestWorld } from '../scenarios/test-world';

const registry = contentRegistry();
const materials = registry.table('materials');
const Z = 32;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function iceBlocks(w: TestWorld): number {
  const block = registry.table('items').index('stone_block');
  const ice = materials.index('ice');
  return w.game.world.entities.with(C.Item).map((id) => w.game.world.entities.get(id, C.Item))
    .filter((i) => i?.type === block && i.material === ice).length;
}

/** A dwarf holding a pick (the way T-559 arms its miner). */
function miner(w: TestWorld, at: TileIndex): EntityId {
  const dwarf = w.spawnDwarf({ at, skills: { mining: 5 } });
  const pick = w.spawnItem('pick', 'iron', at);
  w.items.attachToCarrier(pick, dwarf);
  w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
  const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
  w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
  return dwarf;
}

function setTemperature(w: TestWorld, tiles: readonly TileIndex[], celsius: number): void {
  for (const t of tiles) w.forceTemperature(t, celsius);
  w.step(30);
}

describe('T-586 an ice designation survives a thaw', () => {
  it('a thaw keeps the designation, blocked with no job; the next freeze makes its job, and a miner cuts it', () => {
    const w = world('t586-thaw');
    const pond = digPond(w, 3);
    setTemperature(w, pond, -10);
    const corner = pond[0] as TileIndex;
    expect(w.fluids.sim.isFrozen(corner)).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [corner], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
    w.step(1);
    const jobs = w.readers.of<JobsReader>('11');
    const terrain = w.readers.of<TerrainReader>('03');
    const key = `harvest_ice:${corner}`;
    expect(jobs.byKey(key)).toBeDefined();

    // The afternoon thaw: the water is open, the designation stays and waits, its job is gone.
    setTemperature(w, pond, 10);
    expect(w.fluids.sim.isFrozen(corner)).toBe(false);
    expect(w.map.designationAt(corner)).toBe(Designation.HarvestIce);
    expect(terrain.designationWork(corner)).toBe('blocked');
    expect(jobs.byKey(key)).toBeUndefined();
    // A thawed tile still takes no new designation.
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [pond[1] as TileIndex], kind: 'harvest_ice', priority: 5 }))
      .toMatchObject({ ok: false, reason: 'precondition_failed' });

    // Night: the water freezes again and the job is back; a miner cuts the block.
    setTemperature(w, pond, -10);
    expect(w.fluids.sim.isFrozen(corner)).toBe(true);
    expect(jobs.byKey(key)).toBeDefined();
    miner(w, w.index(36, 41, Z));
    w.until((v) => iceBlocks(v) > 0, 2000);
    expect(iceBlocks(w)).toBe(1);
    expect(w.map.designationAt(corner)).toBe(Designation.None);
  });

  it('a waiting designation goes when its tile stops being water', () => {
    const w = world('t586-gone');
    const pond = digPond(w, 3);
    setTemperature(w, pond, -10);
    const corner = pond[0] as TileIndex;
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [corner], kind: 'harvest_ice', priority: 5 }).ok).toBe(true);
    setTemperature(w, pond, 10);
    expect(w.map.designationAt(corner)).toBe(Designation.HarvestIce);
    // Filled in (a wall of granite where the water stood): no longer outdoor water.
    w.game.world.services.terrain.setKind(corner, TileKind.Wall, materials.index('granite'));
    expect(w.map.designationAt(corner)).toBe(Designation.None);
  });
});
