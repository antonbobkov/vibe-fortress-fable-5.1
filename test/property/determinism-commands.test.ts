/**
 * `05-plan/01-testing-strategy.md` § Property tests, "determinism under commands": random valid
 * command streams over 2,000 ticks, run twice, equal hashes every 100 ticks.
 *
 * The command generator registry grows with the milestones (see `command-generators.ts`); from M1
 * the streams designate, undo, set traffic and set labors on the `flat-test` fortress with the
 * default party (`01-testing-strategy.md` § Golden tests: the default embark), so the dwarves act
 * on them (T-M1-16).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TestWorld } from '../scenarios/test-world';
import { COMMAND_GENERATORS, commandStream, prepareM4GeneratorWorld, prepareM5GeneratorWorld, prepareM6GeneratorWorld, resolveCommand, submitScheduled, type ScheduledCommand } from './command-generators';
import { currentMilestone } from '../scenarios/runner';

const TICKS = 2_000;
const CHECKPOINT = 100;
const SEED = 'determinism-under-commands';

function runWith(stream: readonly ScheduledCommand[]): string[] {
  const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
  prepareM4GeneratorWorld(w);
  if (currentMilestone() >= 5) prepareM5GeneratorWorld(w);
  if (currentMilestone() >= 6) prepareM6GeneratorWorld(w);
  const game = w.game;
  let next = 0;
  const hashes: string[] = [];
  for (let tick = 0; tick < TICKS; tick += 1) {
    while (next < stream.length && (stream[next] as ScheduledCommand).tick <= tick) {
      submitScheduled(game, (stream[next] as ScheduledCommand).command);
      next += 1;
    }
    game.step(1);
    if ((tick + 1) % CHECKPOINT === 0) hashes.push(game.hash());
  }
  return hashes;
}

describe('T-M0-11 property: determinism under commands', () => {
  it('two runs of the same command stream agree at every 100th tick', () => {
    const probe = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    prepareM4GeneratorWorld(probe);
    if (currentMilestone() >= 5) prepareM5GeneratorWorld(probe);
    if (currentMilestone() >= 6) prepareM6GeneratorWorld(probe);
    fc.assert(
      fc.property(commandStream(probe, currentMilestone(), TICKS), (stream) => {
        const first = runWith(stream);
        const second = runWith(stream);
        expect(first).toHaveLength(TICKS / CHECKPOINT);
        expect(second).toEqual(first);
        return true;
      }),
      { numRuns: COMMAND_GENERATORS.length === 0 ? 2 : 10 },
    );
  });
});

describe('T-M6-18 property: M6 command families', () => {
  it('samples accepted squad, alert, trap, lever and hospital commands', () => {
    const generators = COMMAND_GENERATORS.filter((g) => g.milestone === 6);
    expect(generators.map((g) => g.id)).toEqual([
      'CreateSquad', 'SetSquadMode', 'SetAlert', 'SetTrapMode', 'PullLever', 'SetHospitalSupplies',
    ]);
    for (const generator of generators) {
      const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
      prepareM6GeneratorWorld(w);
      for (const command of fc.sample(generator.arbitrary(w), { numRuns: 4, seed: 20260927 })) {
        const resolved = resolveCommand(w.game, command);
        expect(w.game.world.applyCommand(resolved), `${generator.id}: ${JSON.stringify(resolved)}`).toEqual({ ok: true });
      }
    }
  });
});

describe('T-M5-09 property: M5 workshop and item commands', () => {
  it('samples accepted MeltItem, EditWorkOrder, SetWorkshopWorker and SuspendWorkshop commands', () => {
    const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    prepareM4GeneratorWorld(w);
    prepareM5GeneratorWorld(w);
    const generators = COMMAND_GENERATORS.filter((g) => g.milestone === 5);
    expect(generators.map((g) => g.id)).toEqual(['MeltItem', 'EditWorkOrder', 'SetWorkshopWorker', 'SuspendWorkshop']);
    for (const generator of generators) for (const command of fc.sample(generator.arbitrary(w), { numRuns: 12, seed: 20260924 })) {
      const resolved = resolveCommand(w.game, command);
      const result = w.game.world.applyCommand(resolved);
      expect(result, `${generator.id}: ${JSON.stringify(resolved)}`).toEqual({ ok: true });
    }
  });
});

describe('T-M4-19 property: the M4 command generators', () => {
  it('samples accepted farming, order, animal, title and standing-order commands', () => {
    const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    prepareM4GeneratorWorld(w);
    const generators = COMMAND_GENERATORS.filter((g) => g.milestone === 4);
    expect(generators.map((g) => g.id)).toEqual([
      'SetPlotCrop', 'AddWorkOrder', 'AssignPasture', 'MarkSlaughter', 'AssignTitle', 'SetStandingOrder',
    ]);
    for (const generator of generators) {
      for (const command of fc.sample(generator.arbitrary(w), { numRuns: 12, seed: 20260923 })) {
        const resolved = resolveCommand(w.game, command);
        const result = w.game.world.applyCommand(resolved);
        expect(result, `${generator.id}: ${JSON.stringify(resolved)}`).toEqual({ ok: true });
      }
    }
  });
});

describe('T-M1-16 property: the M1 command generators', () => {
  it('produce Designate, UndoDesignation, SetTraffic and SetLabor commands the world accepts', () => {
    const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    const ids = COMMAND_GENERATORS.filter((g) => g.milestone <= 1).map((g) => g.id);
    expect(ids).toEqual(['Designate', 'UndoDesignation', 'SetTraffic', 'SetLabor']);
    for (const g of COMMAND_GENERATORS.filter((gen) => gen.milestone <= 1)) {
      const samples = fc.sample(g.arbitrary(w), { numRuns: 12, seed: 7 });
      for (const cmd of samples) w.submit(cmd);
      w.step(1);
      const rejected = w.events('CommandRejected').filter((e) => (e as unknown as { command: { type: string } }).command.type === g.id);
      // UndoDesignation of tiles without designations and a child's labor are the only refusals allowed.
      const reasons = rejected.map((e) => (e as unknown as { reason: string }).reason);
      expect(reasons.every((r) => r === 'has_progress' || r === 'child_labor'), `${g.id}: ${reasons.join(', ')}`).toBe(true);
    }
    expect(w.readers.of<{ designations(): unknown[] }>('03').designations().length).toBeGreaterThan(0);
  });
});

describe('T-M2-13 property: the M2 command generators', () => {
  it('produce PlaceBuilding, CreateZone, SetStockpileFilter, ForbidItem, CancelBuilding and RemoveZone commands the world accepts', () => {
    const w = new TestWorld({ seed: SEED, world: 'flat-test', embark: 'default' });
    const m2 = COMMAND_GENERATORS.filter((g) => g.milestone === 2);
    expect(m2.map((g) => g.id)).toEqual(['PlaceBuilding', 'CreateZone', 'SetStockpileFilter', 'ForbidItem', 'CancelBuilding', 'RemoveZone']);
    const accepted = new Map<string, number>();
    // One stockpile the filter commands can name, whatever zone types the samples draw.
    const pile = w.game.world.applyCommand({ type: 'CreateZone', zoneType: 'stockpile', tiles: [w.index(30, 70, FLAT_TEST_SURFACE_Z), w.index(31, 70, FLAT_TEST_SURFACE_Z)] });
    expect(pile.ok).toBe(true);
    w.step(1);
    for (const g of m2) {
      const samples = fc.sample(g.arbitrary(w), { numRuns: 12, seed: 7 });
      for (const cmd of samples) {
        const resolved = resolveCommand(w.game, cmd);
        const r = w.game.world.applyCommand(resolved);
        if (r.ok) accepted.set(g.id, (accepted.get(g.id) ?? 0) + 1);
      }
      w.step(1);
    }
    // Every generator yields commands the world takes: a valid footprint, qualifying tiles, an
    // existing stockpile, item, building or zone.
    for (const g of m2) expect(accepted.get(g.id) ?? 0, g.id).toBeGreaterThan(0);
  });
});
