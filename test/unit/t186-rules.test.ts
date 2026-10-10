import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C, ItemFlag, type Party, type SquadOrder } from '@core/components';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import type { JobBoard } from '@systems/jobs';
import { RETRY_TRIGGERS } from '@systems/jobs/board';
import { HAUL_PRIORITY } from '@systems/jobs/constants';
import type { ItemsReader } from '@systems/items';
import type { DefenseSystem } from '@systems/defense';
import { chooseGoal } from '@systems/threats/ai';
import { spawnHostileMember } from '@systems/threats/parties';
import { TestWorld } from '../scenarios/test-world';

function world() { return new TestWorld({ seed: 't186-rules', world: 'flat-test', embark: 'none' }); }
function context(w: TestWorld): TickContext {
  return { world: w.game.world, registry: w.game.registry, readers: w.readers, tick: w.tick,
    rng: w.game.world.rngFor('18'), register: new Registrations(), jobs: w.game.world.services.jobs,
    terrain: w.game.world.services.terrain, spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event) };
}
function hostile(w: TestWorld, purpose: Party['purpose'], at: number) {
  const e = w.game.world.entities;
  const id = e.create('party');
  e.add(id, C.Party, { civ: 'gloam', purpose, members: [], leaderId: 0, state: 'approach',
    goalTile: -1, goalEntity: 0, arrivedTick: 0, stateSince: 0, loot: [], edge: 'n', size: 1 });
  const member = spawnHostileMember(w.game.world, w.game.registry, w.game.world.rngFor('18'),
    id, 'gloam_snatcher', purpose, at, 1, false);
  return { member, party: e.get(id, C.Party)! };
}

describe('T-186 the remaining rules have matching code', () => {
  it('does not advertise workshop suspension as a retryable job block', () => {
    expect(RETRY_TRIGGERS).not.toHaveProperty('workshop_suspended');
  });

  it('SetLabor already retries a failed walk without waiting for the timer', () => {
    const w = world();
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const board = w.game.world.services.jobs as JobBoard;
    const id = board.create('t186-unreachable', { type: 'clean_trap', target: { kind: 'tile', ref: w.index(11, 10, 32) }, workTile: 'at' });
    const job = board.jobs.get(id)!;
    board.block(job, 'unreachable');
    job.failedWalk = true;
    expect(job.retryTick).toBeGreaterThan(w.tick);
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'cleaning', on: true }).ok).toBe(true);
    expect(job.failedWalk).toBeUndefined();
    expect(job.retryTick).toBeLessThanOrEqual(w.tick);
  });

  it('dump hauling uses HAUL_PRIORITY', () => {
    const w = world();
    w.zone('dump', [w.index(20, 20, 32)]);
    const item = w.spawnItem('log', 'oak', w.index(10, 10, 32));
    expect(w.game.world.applyCommand({ type: 'DumpItem', itemId: item, on: true }).ok).toBe(true);
    w.step(11);
    expect((w.game.world.services.jobs as JobBoard).byKey(`dump:${item}`)?.priority).toBe(HAUL_PRIORITY);
  });

  it('corpse stripping uses HAUL_PRIORITY', () => {
    const w = world();
    const corpse = w.spawnItem('corpse', 'granite', w.index(10, 10, 32));
    const helm = w.spawnItem('helm', 'iron', w.index(10, 10, 32));
    w.items.attachToCarrier(helm, corpse);
    w.game.world.entities.add(corpse, C.Corpse, { species: 1, diedTick: 0, wornItems: [helm], dwarfName: null });
    w.step(11);
    expect((w.game.world.services.jobs as JobBoard).byKey(`strip:${corpse}`)?.priority).toBe(HAUL_PRIORITY);
  });

  it('releases a dead assigned workshop worker and lets another carpenter finish the order', () => {
    const w = world();
    const at = w.index(12, 12, 32);
    const workshop = w.build('carpenter', at);
    const worker = w.spawnDwarf({ at: w.index(16, 12, 32), skills: { carpentry: 10 } });
    w.spawnItem('log', 'oak', w.index(16, 12, 32), 2);
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: workshop, dwarfId: worker }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: workshop,
      order: { recipeId: 'make_bed', mode: 'once', remaining: 1 } }).ok).toBe(true);
    w.step(1);
    const oldJob = w.game.world.entities.get(workshop, C.Workshop)!.currentJobId;
    expect(oldJob).not.toBe(0);
    const torso = w.game.world.entities.get(worker, C.Body)!.parts[1]!;
    w.game.world.emit({ type: 'DamageDealt', defenderId: worker, attackerId: 0,
      part: 'torso', damageType: 'blunt', amount: torso.maxHp * 2 });
    w.until((v) => v.events('CreatureDied').some((ev) => ev['id'] === worker), 10);
    w.step(1); // Deliver the cancellation queued while handling CreatureDied.
    expect(w.game.world.entities.get(workshop, C.Workshop)?.assignedWorker).toBe(0);
    expect(w.events('JobCancelled')).toContainEqual(expect.objectContaining({ jobId: oldJob, reason: 'worker_changed' }));
    w.spawnDwarf({ at: w.index(16, 12, 32), skills: { carpentry: 10 } });
    w.until((v) => v.events('ItemCrafted').some((ev) => ev['recipeId'] === 'make_bed'), 1200);
    expect(w.events('ItemCrafted').some((ev) => ev['recipeId'] === 'make_bed')).toBe(true);
  });

  it('carried unowned tools are unavailable in cached and filtered counts, including after a save', () => {
    const w = world();
    const at = w.index(10, 10, 32);
    const dwarf = w.spawnDwarf({ at });
    const pick = w.spawnItem('pick', 'iron', at);
    const type = w.game.registry.table('items').index('pick');
    const material = w.game.registry.table('materials').index('iron');
    const items = () => w.readers.of<ItemsReader>('13');
    expect(items().available(type)).toBe(1);
    w.items.attachToCarrier(pick, dwarf);
    expect(items().get(pick)?.ownerId).toBe(0);
    expect(items().count(type)).toBe(1);
    expect(items().available(type)).toBe(0);
    expect(items().countAvailable({ type, materialId: material })).toBe(0);
    w.replaceGame(roundTrip(w.game).game);
    expect(items().available(type)).toBe(0);
    expect(items().countAvailable({ type, materialId: material })).toBe(0);
    w.items.dropAt(pick, at);
    expect(items().available(type)).toBe(1);
    expect(items().countAvailable({ type, materialId: material })).toBe(1);
  });

  it.each(['station', 'patrol', 'follow'] as const)('a new %s replaces the standing order while preserving queued kills', (kind) => {
    const w = world();
    const e = w.game.world.entities;
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const target1 = w.spawnCreature('wolf', w.index(30, 30, 32), 'wild');
    const target2 = w.spawnCreature('wolf', w.index(35, 35, 32), 'wild');
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' }).ok).toBe(true);
    const squad = e.with(C.Squad)[0]!;
    const send = (order: SquadOrder) => expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad, order }).ok).toBe(true);
    send({ kind: 'kill', targetId: target1 });
    send({ kind: 'kill', targetId: target2 });
    send({ kind: 'station', tile: w.index(15, 15, 32) });
    const replacement: SquadOrder = kind === 'station' ? { kind, tile: w.index(20, 20, 32) }
      : kind === 'patrol' ? { kind, tiles: [w.index(20, 20, 32), w.index(21, 20, 32)] }
      : { kind, dwarfId: dwarf };
    send(replacement);
    w.step(1);
    expect(e.get(squad, C.Squad)?.orders).toEqual([{ kind: 'kill', targetId: target1 }, { kind: 'kill', targetId: target2 }, replacement]);
  });

  it('a later kill does not override the first queued kill target', () => {
    const w = world();
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const a = w.spawnCreature('wolf', w.index(30, 30, 32), 'wild');
    const b = w.spawnCreature('wolf', w.index(35, 35, 32), 'wild');
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' }).ok).toBe(true);
    const squad = w.game.world.entities.with(C.Squad)[0]!;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad, members: [dwarf] }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad, mode: 'active' }).ok).toBe(true);
    for (const targetId of [a, b]) expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad, order: { kind: 'kill', targetId } }).ok).toBe(true);
    expect(w.game.world.entities.get(dwarf, C.Soldier)?.targetId).toBe(a);
  });

  it('a kill is runnable ahead of a standing order, which resumes after the target dies', () => {
    const w = world();
    const target = w.spawnCreature('wolf', w.index(35, 35, 32), 'wild');
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' }).ok).toBe(true);
    const squad = w.game.world.entities.with(C.Squad)[0]!;
    const station = { kind: 'station' as const, tile: w.index(20, 20, 32) };
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad, order: station }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad, order: { kind: 'kill', targetId: target } }).ok).toBe(true);
    expect(w.game.world.entities.get(squad, C.Squad)?.orders).toEqual([{ kind: 'kill', targetId: target }, station]);
    w.game.world.entities.destroy(target);
    w.step(1);
    expect(w.game.world.entities.get(squad, C.Squad)?.orders).toEqual([station]);
  });

  it('an ambush chooses the nearest outdoor dwarf rather than a closer grazing cow', () => {
    const w = world();
    w.spawnTame('cow', w.index(11, 10, 32));
    const dwarf = w.spawnDwarf({ at: w.index(20, 10, 32) });
    const { party } = hostile(w, 'ambush', w.index(10, 10, 32));
    chooseGoal(party, context(w));
    expect(party.goalEntity).toBe(dwarf);
    expect(party.goalTile).toBe(w.index(20, 10, 32));
  });

  it('a chained war dog cannot spot through a wall but spots when sight is clear', () => {
    const w = world();
    const chain = w.build('chain_post', w.index(20, 20, 32), 'oak');
    const dog = w.spawnTame('dog', w.index(20, 20, 32), { trained: 'war' });
    expect(w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, chainId: chain }).ok).toBe(true);
    const { member } = hostile(w, 'thief', w.index(25, 20, 32));
    const wall = w.index(23, 20, 32);
    w.carve(wall, TileKind.Wall);
    w.step(1);
    expect(w.game.world.entities.get(member, C.Hostile)?.stealthed).toBe(true);
    expect(w.events('ThiefSpotted')).toHaveLength(0);
    w.carve(wall, TileKind.Floor);
    (w.game.world.scheduler.byId('19') as DefenseSystem).tick(context(w));
    w.step(1);
    expect(w.game.world.entities.get(member, C.Hostile)?.spotted).toBe(true);
    expect(w.events('ThiefSpotted')).toContainEqual(expect.objectContaining({ id: member, animalId: dog }));
  });

  it('clean_trap unjams without marking a dwarf corpse for dumping', () => {
    const w = world();
    const at = w.index(20, 20, 32);
    const trap = w.build('weapon_trap', at, 'iron');
    w.spawnDwarf({ at: w.index(19, 20, 32) });
    const corpse = w.spawnItem('corpse', 'granite', at);
    w.game.world.entities.add(corpse, C.Corpse, { species: w.game.registry.table('creatures').index('dwarf'),
      diedTick: 0, wornItems: [], dwarfName: 'Fallen guard' });
    w.step(1);
    const defense = w.game.world.scheduler.byId('19') as DefenseSystem;
    defense.traps.get(trap)!.state = 'jammed';
    w.until((v) => v.events('JobCompleted').some((ev) => ev['jobType'] === 'clean_trap'), 500);
    expect(w.events('JobCompleted').some((ev) => ev['jobType'] === 'clean_trap')).toBe(true);
    expect(defense.traps.get(trap)?.state).toBe('armed');
    expect(w.readers.of<ItemsReader>('13').get(corpse)!.flags & ItemFlag.Dump).toBe(0);
    expect(w.readers.of<ItemsReader>('13').tileOf(corpse)).toBe(at);
  });
});
