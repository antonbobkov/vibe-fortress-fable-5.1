import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import type { JobsSystem } from '@systems/jobs';
import { TestWorld } from '../scenarios/test-world';

describe('T-172 jobs lose destroyed entity targets immediately', () => {
  it('a bleeding hospital patient dies and leaves no medical target jobs or reservations', () => {
    const w = new TestWorld({ seed: 't172-patient', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, 32);
    w.zone('hospital', [at, w.index(13, 12, 32)]);
    w.build('bed', at, 'oak');
    w.build('chest', w.index(13, 12, 32), 'oak');
    const patient = w.spawnDwarf({ at, ageYears: 30 });
    w.spawnDwarf({ at: w.index(15, 12, 32), ageYears: 30 });
    w.spawnItem('cloth', 'wool_cloth', w.index(16, 12, 32), 10);
    const arm = w.game.world.entities.get(patient, C.Body)!.parts[2]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'left_arm', damageType: 'edge', amount: Math.floor(arm.maxHp / 3) });
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const jobs = () => [...board.jobs.values()].filter((job) => job.producer === 'health' && job.target.ref === patient);
    w.until(() => jobs().length > 0, 20);
    const ids = jobs().map((job) => job.id);
    const torso = w.game.world.entities.get(patient, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: patient, attackerId: 0, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until(() => !w.game.world.entities.alive(patient), 10);
    expect(jobs()).toEqual([]);
    for (const id of w.game.world.entities.with(C.Item)) expect(ids).not.toContain(w.game.world.entities.get(id, C.Item)?.reservedBy);
    w.step(1);
    for (const id of ids) expect(w.events('JobCancelled').some((e) => e['jobId'] === id && e['reason'] === 'target_gone')).toBe(true);
  });
  it('deconstructing a workshop cancels its craft job in that tick but completes the deconstruction itself', () => {
    const w = new TestWorld({ seed: 't172-workshop', world: 'flat-test', embark: 'none' });
    const shop = w.build('craftdwarf', w.index(12, 12, 32));
    const worker = w.spawnDwarf({ at: w.index(16, 16, 32), ageYears: 30 });
    const stone = w.spawnItem('raw_stone', 'granite', w.index(18, 16, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: shop,
      order: { recipeId: 'craft_stone', remaining: 1, mode: 'once' } })).toEqual({ ok: true });
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const craftAt = () => [...board.jobs.values()].find((job) => job.target.ref === shop && job.producer === 'workshops');
    w.until(() => craftAt()?.inputs[0]?.delivered.includes(stone) === true, 3000);
    const craft = craftAt()!;
    board.interrupt(worker, true);
    w.setLabor(worker, 'crafts', false);
    expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: shop })).toEqual({ ok: true });
    w.until(() => !w.game.world.entities.alive(shop), 3000);
    expect(board.jobs.has(craft.id)).toBe(false);
    expect(w.game.world.entities.get(stone, C.Item)?.reservedBy).toBe(0);
    w.step(1);
    expect(w.events('JobCancelled').some((e) => e['jobId'] === craft.id && e['reason'] === 'target_gone')).toBe(true);
    expect(w.events('JobCompleted').some((e) => e['jobType'] === 'deconstruct' && e['target'] === shop)).toBe(true);
  });

  it.each(['entity', 'building', 'zone'] as const)('cancels a claimed %s target and drops its reserved input and worker immediately', (kind) => {
    const w = new TestWorld({ seed: `t172-${kind}`, world: 'flat-test', embark: 'none' });
    const worker = w.spawnDwarf({ at: w.index(12, 12, 32), ageYears: 30 });
    const cloth = w.spawnItem('cloth', 'wool_cloth', w.index(12, 12, 32));
    w.step(1);
    const e = w.game.world.entities;
    const target = e.create(kind === 'entity' ? 'creature' : kind);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const id = board.create(`t172:${kind}`, { type: 'diagnose', target: { kind, ref: target }, workTile: w.index(12, 12, 32),
      inputs: [{ filter: { itemId: cloth }, count: 1 }] });
    expect(board.claim(worker, board.jobs.get(id)!)).toBe(true);
    w.game.world.services.items!.attachToCarrier(cloth, worker);
    board.setWorker(worker, { carrying: cloth });
    const observed: number[] = [];
    e.setDestroyListener((gone) => { expect(e.alive(gone)).toBe(false); observed.push(gone); });
    e.destroy(target);
    expect(board.jobs.has(id)).toBe(false);
    expect(e.get(worker, C.Worker)).toMatchObject({ jobId: 0, carrying: 0 });
    expect(e.get(cloth, C.Item)).toMatchObject({ reservedBy: 0, carriedBy: 0 });
    expect(e.get(cloth, C.Position)).toEqual(e.get(worker, C.Position));
    expect(observed).toEqual([target]);
    w.step(1);
    expect(w.events('JobCancelled').filter((ev) => ev['jobId'] === id)).toEqual([
      expect.objectContaining({ reason: 'target_gone' }),
    ]);
  });
  it('rebuilds target cancellation on load and preserves unrelated, tile and pair jobs', () => {
    const w = new TestWorld({ seed: 't172-load', world: 'flat-test', embark: 'none' });
    w.step(1);
    const e = w.game.world.entities;
    const target = e.create('creature');
    const other = e.create('creature');
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const ids = [
      board.create('t172:gone', { type: 'diagnose', target: { kind: 'entity', ref: target }, workTile: w.index(12, 12, 32) }),
      board.create('t172:other', { type: 'diagnose', target: { kind: 'entity', ref: other }, workTile: w.index(12, 12, 32) }),
      board.create('t172:tile', { type: 'diagnose', target: { kind: 'tile', ref: target }, workTile: w.index(12, 12, 32) }),
      board.create('t172:pair', { type: 'diagnose', target: { kind: 'pair', ref: target, ref2: other }, workTile: w.index(12, 12, 32) }),
    ];
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    const loadedBoard = (loaded.world.scheduler.byId('11') as JobsSystem).board;
    loaded.world.entities.destroy(target);
    expect(loadedBoard.jobs.has(ids[0]!)).toBe(false);
    expect(ids.slice(1).every((id) => loadedBoard.jobs.has(id))).toBe(true);
    expect(board.jobs.has(ids[0]!)).toBe(true);
  });

  it('an active hunt transitions to its death tile and waits for its own corpse across a load', () => {
    const w = new TestWorld({ seed: 't172-hunt-load', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, 32);
    const hunter = w.spawnDwarf({ at, ageYears: 30 });
    const bow = w.spawnItem('crossbow', 'oak', at);
    const bolts = w.spawnItem('bolt', 'iron', at, 20);
    w.step(1);
    const e = w.game.world.entities;
    const deer = w.game.world.services.spawn.creature(w.game.registry.table('creatures').index('deer'), w.index(13, 12, 32), 'wild');
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    board.items.equip(hunter, bow);
    board.items.equip(hunter, bolts);
    e.add(hunter, C.Equipment, { ...e.get(hunter, C.Equipment)!, weapon: bow, quiver: bolts });
    const id = board.create(`hunt:${deer}`, { type: 'hunt', target: { kind: 'entity', ref: deer }, workTile: 'ranged',
      data: { animal: deer, anchorTile: w.index(13, 12, 32) } });
    expect(board.claim(hunter, board.jobs.get(id)!)).toBe(true);
    const torso = e.get(deer, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: deer, attackerId: hunter, part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until(() => !e.alive(deer), 10);
    expect(board.jobs.get(id)?.target).toMatchObject({ kind: 'tile' });
    expect(board.jobs.get(id)?.data['animal']).toBe(deer);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.game.hash());
    const loadedBoard = (loaded.world.scheduler.byId('11') as JobsSystem).board;
    const carried = new Set<number>();
    for (let i = 0; i < 1000 && loadedBoard.jobs.has(id); i += 1) {
      loaded.step(1);
      const carrying = loaded.world.entities.get(hunter, C.Worker)?.carrying ?? 0;
      if (carrying !== 0) carried.add(carrying);
    }
    expect(loadedBoard.jobs.has(id)).toBe(false);
    expect(carried.size).toBe(1);
    expect(loaded.world.entities.get([...carried][0]!, C.Corpse)?.species).toBe(w.game.registry.table('creatures').index('deer'));
    expect(loaded.world.entities.get(hunter, C.Worker)).toMatchObject({ jobId: 0, carrying: 0 });
  });
});
