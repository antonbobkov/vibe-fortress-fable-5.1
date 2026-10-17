/** T-355: a farm plot tile that a built building covers gets no planting job. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import type { BuildingsSystem } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

describe('T-355 a smelter built over a farm plot', () => {
  it('cancels the planting job of a covered tile and makes none for it', () => {
    const w = new TestWorld({ seed: 't355-plot', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const tiles: number[] = [];
    for (let dy = 0; dy < 3; dy += 1) for (let dx = 0; dx < 5; dx += 1) tiles.push(w.index(20 + dx, 20 + dy, Z));
    const zoneId = w.zone('farm_plot', tiles);
    expect(world.applyCommand({ type: 'SetPlotCrop', zoneId, season: world.calendar.season, speciesId: 'barley' }).ok).toBe(true);
    w.spawnItem('seed', 'barley', w.index(30, 30, Z), 20);
    w.step(TICKS_PER_HOUR + 1);
    const jobs = w.readers.of<JobsReader>('11');
    for (const t of tiles) expect(jobs.byKey(`plant:${t}`), `plant job at ${t}`).toBeDefined();
    // A smelter whose north-west corner (impassable) and work tile lie on the plot.
    const system = world.scheduler.byId('14') as BuildingsSystem;
    const r = world.applyCommand({ type: 'PlaceBuilding', buildingType: 'smelter', origin: w.index(22, 20, Z), orientation: 0, materialChoice: 0 });
    expect(r.ok, String((r as { reason?: string }).reason)).toBe(true);
    const smelter = system.lastPlacedBuilding;
    system.completeNow(smelter, w.game.registry.table('materials').index('granite'), 0);
    const covered = new Set(world.entities.get(smelter, C.Building)!.footprint);
    w.step(2 * TICKS_PER_HOUR);
    for (const t of tiles) {
      if (covered.has(t)) expect(jobs.byKey(`plant:${t}`), `plant job under the smelter at ${t}`).toBeUndefined();
      else expect(jobs.byKey(`plant:${t}`) !== undefined || w.plants.cropAtTile.has(t), `plot tile ${t} still farmed`).toBe(true);
    }
  });
});
