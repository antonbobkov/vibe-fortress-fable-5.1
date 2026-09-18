import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import { RngStream } from '@core/rng';
import type { TileIndex } from '@core/types';
import {
  CHANNEL_BASE_TICKS,
  CHOP_BASE_TICKS,
  DIG_BASE_TICKS,
  ENGRAVE_BASE_TICKS,
  GATHER_BASE_TICKS,
  SKILL_TIME_BONUS_PERCENT,
  SMOOTH_BASE_TICKS,
} from '@systems/terrain/constants';
import { jobKey, rollQuality, workCentiTicksFor, workTileOf, type TerrainReader } from '@systems/terrain';
import { effortPerTick, effortRequired, type JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { onlyMiner } from '../../scenarios/m1-helpers';

/** Ticks of work for a job of `centi` hundredths of a tick at a skill level. */
function ticks(centi: number, skill: number): number {
  const need = effortRequired(centi);
  const per = effortPerTick(SKILL_TIME_BONUS_PERCENT, skill, 100);
  return Math.ceil(need / per);
}

describe('T-M1-10 terrain jobs: work time', () => {
  it('balance.md § Time and pace: a granite tile is 90 ticks for a novice and 50 at Proficient (level 10)', () => {
    expect(ticks(workCentiTicksFor(Designation.Dig, 150), 0)).toBe(90);
    expect(ticks(workCentiTicksFor(Designation.Dig, 150), 10)).toBe(50);
    // "A 3×3 room in granite takes a novice miner 9 × 90 = 810 ticks; a Proficient miner 9 × 50 = 450."
    expect(9 * ticks(workCentiTicksFor(Designation.Dig, 150), 0)).toBe(810);
    expect(9 * ticks(workCentiTicksFor(Designation.Dig, 150), 10)).toBe(450);
    // "level 20 works at 100/(100+160) ≈ 38% of base time".
    expect(ticks(workCentiTicksFor(Designation.Dig, 100), 20)).toBe(Math.ceil((60 * 100) / 260));
  });

  it('every terrain job type takes the base ticks of jobs.md § Terrain', () => {
    const h = 150;
    expect(workCentiTicksFor(Designation.Dig, h)).toBe(DIG_BASE_TICKS * h);
    expect(workCentiTicksFor(Designation.Ramp, h)).toBe(DIG_BASE_TICKS * h);
    expect(workCentiTicksFor(Designation.Channel, h)).toBe(CHANNEL_BASE_TICKS * h);
    for (const d of [Designation.StairsUp, Designation.StairsDown, Designation.StairsUpDown]) {
      expect(workCentiTicksFor(d, h)).toBe(DIG_BASE_TICKS * 1.2 * h);
    }
    expect(workCentiTicksFor(Designation.Smooth, h)).toBe(SMOOTH_BASE_TICKS * 100);
    expect(workCentiTicksFor(Designation.Engrave, h)).toBe(ENGRAVE_BASE_TICKS * 100);
    expect(workCentiTicksFor(Designation.Remove, h)).toBe((DIG_BASE_TICKS / 2) * 100);
    expect(workCentiTicksFor(Designation.Chop, h)).toBe(CHOP_BASE_TICKS * 100);
    expect(workCentiTicksFor(Designation.Gather, h)).toBe(GATHER_BASE_TICKS * 100);
  });

  it('the worker stands on the tile for channel, down stairs and floor smoothing, beside it otherwise', () => {
    expect(workTileOf(Designation.Channel, TileKind.Floor)).toBe('at');
    expect(workTileOf(Designation.StairsDown, TileKind.Floor)).toBe('at');
    expect(workTileOf(Designation.Smooth, TileKind.Floor)).toBe('at');
    expect(workTileOf(Designation.Smooth, TileKind.Wall)).toBe('adjacent');
    expect(workTileOf(Designation.Dig, TileKind.Wall)).toBe('adjacent');
    expect(workTileOf(Designation.StairsUpDown, TileKind.Wall)).toBe('adjacent');
    expect(jobKey(Designation.Dig, 12)).toBe('dig:12');
    expect(jobKey(Designation.StairsUp, 12)).toBe('carve_stairs:12');
  });

  it('D-058: engraving quality is 12\'s roll from the engraver\'s skill', () => {
    const rng = new RngStream(7);
    const counts = [0, 0, 0, 0, 0, 0];
    for (let k = 0; k < 2000; k += 1) {
      const q = rollQuality(0, rng);
      counts[q] = (counts[q] ?? 0) + 1;
    }
    expect(counts[5]).toBe(0);
    expect(counts[4]).toBe(0);
    for (let k = 0; k < 200; k += 1) expect(rollQuality(20, rng)).toBeGreaterThanOrEqual(4);
  });
});

function world(seed: string): { w: TestWorld; reader: TerrainReader; wall(x: number, y: number, material: string): TileIndex } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'default' });
  onlyMiner(w);
  const reader = w.readers.of<TerrainReader>('03');
  const wall = (x: number, y: number, material: string): TileIndex => {
    const i = w.index(x, y, 32);
    w.game.world.services.terrain.setKind(i, TileKind.Wall, w.game.registry.table('materials').index(material));
    return i;
  };
  return { w, reader, wall };
}

describe('T-M1-10 terrain jobs: completion', () => {
  it('D-051: a vein is found once; every ore tile is a MineralMined and always drops ore', () => {
    const { w, reader, wall } = world('veins');
    const a = wall(48, 12, 'hematite');
    const b = wall(49, 12, 'hematite');
    const c = wall(52, 14, 'hematite');
    w.game.world.applyCommand({ type: 'Designate', tiles: [a, b, c], kind: 'dig' });
    w.until((x) => [a, b, c].every((t) => x.map.kindAt(t) === TileKind.Floor), 2000);
    w.step(1);
    expect(w.events('MineralMined')).toHaveLength(3);
    expect(w.events('VeinFound').map((e) => e['tile']).sort((p, q) => (p as number) - (q as number))).toHaveLength(2);
    expect(reader.intendedDrops().filter((d) => d.type === 'ore')).toHaveLength(3);
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'dig')).toHaveLength(3);
  });

  it('a dig grants the miner xp (10 on JobCompleted) and the tiles around the dug one are discovered', () => {
    const { w, wall } = world('xp');
    const t = wall(47, 12, 'granite');
    w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'dig' });
    w.until((x) => x.map.kindAt(t) === TileKind.Floor, 1000);
    const miner = w.game.arrival?.dwarves[0] as number;
    const mining = w.game.registry.table('skills').index('mining');
    const xp = w.game.world.entities.get(miner, C.Skills)?.xp[mining] as number;
    expect(xp).toBeGreaterThan(0);
    expect(w.map.hasFlag(w.index(47, 12, 31), TileFlag.Discovered)).toBe(true);
  });

  it('chop fells a tree to floor with logs and TreeFelled; the player cancelling a job clears its designation', () => {
    const { w, reader } = world('chop');
    const plants = w.game.registry.table('plants');
    const tree = w.index(46, 14, 32);
    w.game.world.services.terrain.setKind(tree, TileKind.Tree, plants.index('oak'));
    w.game.world.applyCommand({ type: 'Designate', tiles: [tree], kind: 'chop' });
    w.until((x) => x.map.kindAt(tree) === TileKind.Floor, 1000);
    w.step(1);
    expect(w.events('TreeFelled')[0]).toMatchObject({ tile: tree, species: 'oak' });
    const logs = reader.intendedDrops().filter((d) => d.type === 'log');
    expect(logs).toHaveLength(1);
    expect(logs[0]?.count).toBeGreaterThanOrEqual(1);
    expect(logs[0]?.count).toBeLessThanOrEqual(4);

    const far = w.index(80, 60, 31);
    w.game.world.applyCommand({ type: 'Designate', tiles: [far], kind: 'dig' });
    w.step(2);
    const job = w.readers.of<JobsReader>('11').byKey(jobKey(Designation.Dig, far));
    expect(job).toBeDefined();
    expect(w.game.world.applyCommand({ type: 'CancelJob', jobId: job?.id })).toEqual({ ok: true });
    expect(reader.designationAt(far)).toBeNull();
    w.step(2);
    expect(w.readers.of<JobsReader>('11').byKey(jobKey(Designation.Dig, far))).toBeUndefined();
  });

  it('undoing a designation cancels its job with target_invalid', () => {
    const { w } = world('undo');
    const far = w.index(80, 60, 31);
    w.game.world.applyCommand({ type: 'Designate', tiles: [far], kind: 'dig' });
    w.step(2);
    expect(w.game.world.applyCommand({ type: 'UndoDesignation', tiles: [far] })).toEqual({ ok: true });
    w.step(2);
    expect(w.events('JobCancelled').map((e) => e['reason'])).toEqual(['target_invalid']);
  });

  it('smoothing and engraving a floor: the flags, the engraving record with its engraver', () => {
    const { w, reader } = world('engrave');
    const t = w.index(40, 15, 29);
    // A granite floor reached by a finished shaft.
    const terrain = w.game.world.services.terrain;
    terrain.setKind(w.index(40, 14, 32), TileKind.StairsDown, 1);
    terrain.setKind(w.index(40, 14, 31), TileKind.StairsUpDown, 1);
    terrain.setKind(w.index(40, 14, 30), TileKind.StairsUpDown, 1);
    terrain.setKind(w.index(40, 14, 29), TileKind.StairsUp, w.map.materialAt(t));
    terrain.setKind(t, TileKind.Floor, w.map.materialAt(t));
    w.game.world.applyCommand({ type: 'SetLabor', dwarfId: w.game.arrival?.dwarves[0], labor: 'masonry', on: true });
    w.discover(t);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'smooth' })).toEqual({ ok: true });
    w.until((x) => x.map.hasFlag(t, TileFlag.Smoothed), 2000);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'engrave' })).toEqual({ ok: true });
    w.until((x) => x.map.hasFlag(t, TileFlag.Engraved), 3000);
    const e = reader.engravingAt(t);
    expect(e).not.toBeNull();
    expect(e?.engraverId).toBeGreaterThan(0);
    expect(e?.quality).toBeGreaterThanOrEqual(0);
  });
});
