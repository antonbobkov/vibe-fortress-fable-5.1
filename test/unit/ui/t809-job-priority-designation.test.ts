/**
 * T-809: a designation job's priority set in Jobs (`SetJobPriority`) is its tile's designation
 * priority too (03 § Digging as a job), so the producer's rescan after the next designation keeps
 * it, and Look reads the same priority on the tile.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TileKind } from '@core/map3d';
import type { JobsReader } from '@systems/jobs';
import { drawTileList } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

describe('T-809 a designation job\'s priority set in Jobs stays', () => {
  it('a dig job set to 2 keeps 2 after another box is designated, and Look shows it on its tile', () => {
    const w = new TestWorld({ seed: 't809', world: 'flat-test', embark: 'none' });
    for (let x = 30; x <= 36; x += 1) w.game.world.services.terrain.setKind(w.index(x, 30, z), TileKind.Wall, 1);
    // One miner, so one job of the box is taken and the others stay open.
    const dwarf = w.spawnDwarf({ at: w.index(30, 32, z) });
    w.spawnItem('pick', 'copper', w.index(30, 32, z));
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'mining', on: true });
    const box = [30, 31, 32].map((x) => w.index(x, 30, z));
    w.game.world.applyCommand({ type: 'Designate', tiles: box, kind: 'dig', priority: 8 });
    w.step(2);
    const jobs = w.readers.of<JobsReader>('11');
    const open = jobs.list().filter((j) => box.includes(j.target.ref) && j.state === 'open');
    expect(open.length).toBeGreaterThanOrEqual(2);
    const [job, other] = open as [typeof open[number], typeof open[number]];
    const tile = job.target.ref;
    expect(job.priority).toBe(8);
    expect(w.game.world.applyCommand({ type: 'SetJobPriority', jobId: job.id, priority: 2 }).ok).toBe(true);
    expect(w.readers.map.designationPriorityAt(tile)).toBe(2);
    // Another box elsewhere: the producer rescans every designation job.
    w.game.world.applyCommand({ type: 'Designate', tiles: [w.index(35, 30, z), w.index(36, 30, z)], kind: 'dig', priority: 5 });
    w.step(2);
    expect(jobs.list().find((j) => j.target.ref === tile)?.priority).toBe(2);
    // Another tile of the first box keeps its own.
    expect(jobs.list().find((j) => j.target.ref === other.target.ref)?.priority).toBe(8);
    const s = surface(44, 14);
    drawTileList(s, { col: 0, row: 0, cols: 44, rows: 14 }, w.readers, w.game.registry, strings, tile);
    expect(s.lines().join('\n')).toContain('Designated: Dig, priority 2 (urgent)');
  });
});
