import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { JobBoard } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

describe('T-187 failed walk stays blocked until a reachability trigger', () => {
  it('does not repeatedly claim a labelled-reachable dig across forbidden traffic', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 't187-forbidden-walk', world: 'flat-test', embark: 'none',
      registry, map: buildFlatTestMap(registry, 8, 3) });
    for (let x = 0; x < 8; x += 1) for (const y of [0, 2]) w.carve(w.index(x, y, 32), TileKind.Wall);
    const target = w.index(7, 1, 32);
    w.carve(target, TileKind.Wall);
    const at = w.index(1, 1, 32);
    const dwarf = w.spawnDwarf({ at, skills: { mining: 10 } });
    const pick = w.spawnItem('pick', 'iron', at);
    w.items.attachToCarrier(pick, dwarf);
    w.game.world.entities.add(dwarf, C.Worker, { jobId: 0, phase: 0, carrying: 0, toolId: pick });
    const equipment = w.game.world.entities.get(dwarf, C.Equipment)!;
    w.game.world.entities.add(dwarf, C.Equipment, { ...equipment, weapon: pick });
    const barrier = w.index(4, 1, 32);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [barrier], mode: 'forbidden' }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [target] }).ok).toBe(true);
    w.step(300);
    const board = w.game.world.services.jobs as JobBoard;
    const job = [...board.jobs.values()].find((j) => j.target.ref === target)!;
    expect(job).toBeDefined();
    expect(w.pathing.reader().reachable(at, w.index(6, 1, 32), 'walker')).toBe(true);
    expect(job.blockedReason).toBe('unreachable');
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job.id)).toHaveLength(1);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    w.replaceGame(loaded);
    w.step(150);
    expect(w.events('JobClaimed').filter((e) => e['jobId'] === job.id)).toHaveLength(1);
    expect(w.game.world.applyCommand({ type: 'SetTraffic', tiles: [barrier], mode: 'normal' }).ok).toBe(true);
    w.until((v) => v.events('JobCompleted').some((e) => e['jobId'] === job.id), 1000);
    expect(w.map.kindAt(target)).toBe(TileKind.Floor);
  });
});
