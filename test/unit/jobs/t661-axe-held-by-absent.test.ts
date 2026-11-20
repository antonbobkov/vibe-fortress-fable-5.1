/**
 * T-661: the only axe stays with a dwarf who cannot chop. 11 § Assignment: a pick, axe or launcher held
 * by a worker that is down, a patient or a soldier on duty with another weapon comes back to the fortress
 * once that has lasted `JOB_HOLD_TICKS`; until then the Jobs panel says who holds it and where.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { CombatReader } from '@systems/combat/reader';
import { createWound } from '@systems/health';
import type { ItemsReader } from '@systems/items';
import type { JobsReader, JobsSystem } from '@systems/jobs';
import { JOB_HOLD_TICKS } from '@systems/jobs/constants';
import { jobWait } from '@ui/job-wait';
import type { PanelContext } from '@ui/panels/context';
import { roundTrip } from '@app/game-save';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from '../ui/ui-fixture';

function only(w: TestWorld, dwarf: EntityId, on: string[]): void {
  for (const name of w.game.world.registry.table('labors').ids()) w.setLabor(dwarf, name, on.includes(name));
}

function ctxOf(w: TestWorld): PanelContext {
  return {
    readers: w.readers, registry: w.game.registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
}

/** Urist holds the fortress's only axe and lies in a hospital bed with a broken leg; Bob, a woodcutter too, has none. */
function setup() {
  const w = new TestWorld({ seed: 't661-axe-held', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const bedTile = w.index(30, 10, Z);
  w.build('bed', bedTile, 'oak');
  w.zone('hospital', [bedTile]);
  const urist = w.spawnDwarf({ at: w.index(12, 10, Z), name: 'Urist' });
  const bob = w.spawnDwarf({ at: w.index(12, 14, Z), name: 'Bob' });
  only(w, urist, ['woodcutting']);
  only(w, bob, ['woodcutting']);
  const axe = w.spawnItem('axe', 'iron', w.index(12, 10, Z));
  world.services.items!.attachToCarrier(axe, urist);
  world.entities.add(urist, C.Worker, { ...world.entities.get(urist, C.Worker)!, toolId: axe });
  w.spawnItem('easy_meal', 'dimcap', w.index(20, 20, Z), 60);
  w.spawnItem('drink', 'ale', w.index(21, 20, Z), 60);
  // An unsplinted fracture, which bleeds not at all, admits him; nobody has the medicine labor to set it.
  const body = world.entities.get(urist, C.Body)!;
  const leg = 4; // BodySlot order: left_leg
  const fracture = createWound('fracture', 'light', 10, w.tick);
  fracture.healRemaining = 100_000;
  body.parts[leg]!.wounds.push(fracture);
  world.emit({ type: 'DamageDealt', defenderId: urist, part: 'left_leg', damageType: 'blunt', amount: 1, attackerId: 0 });
  w.until(() => world.entities.has(urist, C.Patient), 50);
  expect(world.entities.has(urist, C.Patient)).toBe(true);
  const tree = w.index(16, 20, Z);
  w.map.setKind(tree, TileKind.Tree, w.game.registry.table('materials').index('pine'));
  w.step(2);
  expect(world.applyCommand({ type: 'Designate', kind: 'chop', tiles: [tree], priority: 5 })).toEqual({ ok: true });
  return { w, world, urist, bob, axe, bedTile };
}

describe('T-661 a tool held by a dwarf who cannot use it comes back to the fortress', () => {
  it('the only axe-holder lies in a hospital bed, and an open chop is taken by another woodcutter', () => {
    const { w, world, urist, bob, axe, bedTile } = setup();
    const admitted = w.tick;
    const items = w.readers.of<ItemsReader>('13');
    const jobs = w.readers.of<JobsReader>('11');
    w.until(() => { const p = world.entities.get(urist, C.Position)!; return w.index(p.x, p.y, p.z) === bedTile; }, 400);

    // While Urist keeps the axe, Bob leaves the chop to him (11 § Assignment), and the panel says why.
    const chop = jobs.list('open').find((j) => jobs.typeOf(j.id) === 'chop');
    expect(chop).toBeDefined();
    expect(jobWait(ctxOf(w), chop!)).toEqual({ reason: 'tool_held',
      text: 'Nobody takes it yet: the only axe is with Urist, in the hospital. Make another, or wait for it to come back.' });
    expect(items.get(axe)?.carriedBy).toBe(urist);

    w.until(() => w.events('JobCompleted').some((e) => e['jobType'] === 'chop'), 2 * TICKS_PER_DAY);
    const done = w.events('JobCompleted').find((e) => e['jobType'] === 'chop');
    expect(done?.['workerId']).toBe(bob);
    const dropped = w.events('ToolDropped').filter((e) => e['itemId'] === axe);
    expect(dropped).toHaveLength(1);
    expect(world.entities.has(urist, C.Patient)).toBe(true);
    expect(world.entities.get(urist, C.Worker)?.toolId).toBe(0);
    expect(world.entities.get(bob, C.Worker)?.toolId).toBe(axe);
    expect(items.get(axe)?.carriedBy).toBe(bob);
    // Not before the hold: the count began at the first jobs tick that saw him a patient.
    const board = (world.scheduler.byId('11') as JobsSystem).board;
    expect(board.toolAway.size).toBe(0);
    expect(w.tick - admitted).toBeGreaterThanOrEqual(JOB_HOLD_TICKS);
  }, 120_000);

  it('the count of the hold is saved', () => {
    const { w, urist, axe } = setup();
    w.step(50);
    const board = (): JobsSystem['board'] => (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const since = board().toolAway.get(urist);
    expect(since).toBeDefined();
    w.replaceGame(roundTrip(w.game).game);
    expect(board().toolAway.get(urist)).toBe(since);
    w.until(() => w.events('ToolDropped').some((e) => e['itemId'] === axe), JOB_HOLD_TICKS);
    expect(w.game.world.entities.get(urist, C.Worker)?.toolId).toBe(0);
    // Put down on the tick the hold ends, as the game that was not saved would have.
    expect(w.tick - (since as number)).toBeGreaterThanOrEqual(JOB_HOLD_TICKS);
    expect(w.tick - (since as number)).toBeLessThanOrEqual(JOB_HOLD_TICKS + 1);
  }, 120_000);

  it('a dwarf back at work holds the tool again: the count ends, and nothing is put down', () => {
    const { w, world, urist, axe } = setup();
    w.step(50);
    const board = (world.scheduler.byId('11') as JobsSystem).board;
    expect(board.toolAway.has(urist)).toBe(true);
    // Discharged early: the fracture is set.
    for (const part of world.entities.get(urist, C.Body)!.parts) for (const wound of part.wounds) wound.splinted = true;
    w.until(() => !world.entities.has(urist, C.Patient), 50);
    w.step(2);
    expect(board.toolAway.has(urist)).toBe(false);
    w.step(JOB_HOLD_TICKS);
    expect(w.events('ToolDropped').filter((e) => e['itemId'] === axe)).toHaveLength(0);
  }, 120_000);

  it('a soldier on duty puts down the pick it holds beside its spear, and keeps the one it fights with', () => {
    const w = new TestWorld({ seed: 't661-soldiers', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const world = w.game.world;
    const entities = world.entities;
    const a = w.spawnDwarf({ at: w.index(30, 30, Z) });
    const b = w.spawnDwarf({ at: w.index(32, 30, Z) });
    const picks: EntityId[] = [];
    for (const d of [a, b]) {
      only(w, d, ['mining']);
      const pick = w.spawnItem('pick', 'iron', w.index(30, 30, Z));
      world.services.items!.attachToCarrier(pick, d);
      entities.add(d, C.Worker, { ...entities.get(d, C.Worker)!, toolId: pick });
      picks.push(pick);
    }
    w.spawnItem('spear', 'iron', w.index(20, 20, Z));
    w.spawnItem('easy_meal', 'dimcap', w.index(20, 24, Z), 60);
    w.spawnItem('drink', 'ale', w.index(21, 24, Z), 60);
    world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' });
    const combat = w.readers.of<CombatReader>('16');
    const squadId = combat.squads()[0]!.id;
    world.applyCommand({ type: 'SetSquadMembers', squadId, members: [a, b] });
    expect(world.applyCommand({ type: 'SetSquadMode', squadId, mode: 'train' }).ok).toBe(true);
    w.step(5);
    const armed = [a, b].find((d) => (entities.get(d, C.Equipment)?.weapon ?? 0) !== 0) as EntityId;
    const bare = armed === a ? b : a;
    expect(entities.get(bare, C.Equipment)?.weapon ?? 0).toBe(0);
    expect(combat.onDuty(armed) && combat.onDuty(bare)).toBe(true);
    w.step(JOB_HOLD_TICKS + 5);
    expect(entities.get(armed, C.Worker)?.toolId).toBe(0);
    expect(w.events('ToolDropped').map((e) => e['itemId'])).toEqual([picks[armed === a ? 0 : 1]]);
    expect(entities.get(bare, C.Worker)?.toolId).toBe(picks[bare === a ? 0 : 1]);
  }, 120_000);
});
