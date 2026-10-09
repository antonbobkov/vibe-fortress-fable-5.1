import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_YEAR } from '@core/constants';
import { TileKind } from '@core/map3d';
import { Registrations, type TickContext } from '@core/system';
import { JobsSystem } from '@systems/jobs';
import { partyThink, despawnMember } from '@systems/threats/ai';
import { ThreatsSystem } from '@systems/threats';
import { spawnHostileMember } from '@systems/threats/parties';
import { spawnCaravan, DEPOT_WAIT_DAYS, type TradeSystem } from '@systems/trade';
import { TestWorld } from '../scenarios/test-world';

function setup() {
  const w = new TestWorld({ seed: 't175-cosmetic', world: 'flat-test', embark: 'none' });
  const apply = w.game.world.applyCommand.bind(w.game.world);
  const ctx: TickContext = {
    world: w.game.world,
    registry: w.game.registry,
    readers: w.readers,
    tick: w.tick,
    rng: w.game.world.rngFor('18'),
    register: new Registrations(),
    terrain: w.game.world.services.terrain,
    jobs: w.game.world.services.jobs,
    spawn: w.game.world.services.spawn,
    emit: (event) => w.game.world.emit(event),
  };
  return { w, apply, ctx };
}
function squad() {
  const s = setup();
  expect(s.apply({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
  return { ...s, squadId: s.w.game.world.entities.with(C.Squad)[0]! };
}

describe('T-175 command validation is atomic and keeps its rejection reason', () => {
  it.each([-5, 0, 19, 201, 1000000000])('rejects population cap %i instead of clamping', (n) => {
    const { w, apply } = setup();
    const before = w.game.world.fortress.populationCap;
    expect(apply({ type: 'SetPopulationCap', n })).toEqual({ ok: false, reason: 'out_of_range' });
    expect(w.game.world.fortress.populationCap).toBe(before);
  });
  it.each([20, 200])('accepts population cap endpoint %i', (n) => {
    const { w, apply } = setup();
    expect(apply({ type: 'SetPopulationCap', n })).toEqual({ ok: true });
    expect(w.game.world.fortress.populationCap).toBe(n);
  });
  it.each(['toString', 'constructor', 'hasOwnProperty', '__proto__'])(
    'rejects inherited standing-order name %s',
    (name) => {
      const { w, apply } = setup();
      const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
      const before = { ...board.standingOrders };
      expect(apply({ type: 'SetStandingOrder', name, on: true })).toEqual({
        ok: false,
        reason: 'not_found',
      });
      expect(board.standingOrders).toEqual(before);
    },
  );
  it.each([0, 'yes', null])('rejects non-boolean standing-order on=%s', (on) => {
    const { w, apply } = setup();
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const before = { ...board.standingOrders };
    expect(apply({ type: 'SetStandingOrder', name: 'autoHarvest', on })).toEqual({
      ok: false,
      reason: 'bad_setting',
    });
    expect(board.standingOrders).toEqual(before);
  });
  it.each(['dog', 'cat'])('answers not_grazer for a tame %s', (species) => {
    const { w, apply } = setup();
    const animalId = w.spawnTame(species, w.index(20, 20, 32));
    const zoneId = w.zone('pasture', [w.index(22, 20, 32)]);
    expect(apply({ type: 'AssignPasture', animalId, zoneId })).toEqual({
      ok: false,
      reason: 'not_grazer',
    });
    expect(w.game.world.entities.get(animalId, C.Tame)?.pastureId).toBe(0);
  });
  it('adds an explicitly created leader as a squad member with its Soldier component', () => {
    const { w, apply } = setup();
    const leaderId = w.spawnDwarf({ at: w.index(20, 20, 32), ageYears: 30 });
    expect(apply({ type: 'CreateSquad', name: 'Led', leaderId })).toEqual({ ok: true });
    const squadId = w.game.world.entities.with(C.Squad)[0]!;
    expect(w.game.world.entities.get(squadId, C.Squad)?.members).toEqual([leaderId]);
    expect(w.game.world.entities.get(leaderId, C.Soldier)).toMatchObject({
      squadId,
      onDuty: false,
    });
  });
  it('requires a new squad leader to belong to that squad', () => {
    const { w, apply, squadId } = squad();
    const leaderId = w.spawnDwarf({ at: w.index(20, 20, 32), ageYears: 30 });
    expect(apply({ type: 'SetSquadLeader', squadId, leaderId })).toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(w.game.world.entities.get(squadId, C.Squad)?.leaderId).toBe(0);
    expect(apply({ type: 'SetSquadMembers', squadId, members: [leaderId] })).toEqual({ ok: true });
    expect(apply({ type: 'SetSquadLeader', squadId, leaderId })).toEqual({ ok: true });
  });
  it.each([{ weaponClass: 'nope' }, { weaponClass: 5 }, { armor: 'nope' }, { ranged: 'x' }, []])(
    'rejects invalid squad equipment %j without storing it',
    (equipment) => {
      const { w, apply, squadId } = squad();
      const before = structuredClone(w.game.world.entities.get(squadId, C.Squad)!.equipment);
      expect(apply({ type: 'SetSquadEquipment', squadId, equipment })).toEqual({
        ok: false,
        reason: 'bad_setting',
      });
      expect(w.game.world.entities.get(squadId, C.Squad)!.equipment).toEqual(before);
    },
  );
  it('accepts each authored weapon class and the three armor options', () => {
    const { w, apply, squadId } = squad();
    const weapons = w.game.registry.table<{ id: string; weaponClass: string }>('weapons');
    for (const row of weapons.rows.slice(1))
      expect(
        apply({ type: 'SetSquadEquipment', squadId, equipment: { weaponClass: row.weaponClass } }),
      ).toEqual({ ok: true });
    for (const armor of ['metal', 'leather', 'any'])
      expect(
        apply({ type: 'SetSquadEquipment', squadId, equipment: { armor, ranged: true } }),
      ).toEqual({ ok: true });
  });
  it('links another stockpile and rejects buildings and other zone types', () => {
    const { w, apply } = setup();
    const zoneId = w.zone('stockpile', [w.index(20, 20, 32)]);
    const sourceZoneId = w.zone('stockpile', [w.index(21, 20, 32)]);
    expect(apply({ type: 'LinkStockpile', zoneId, sourceZoneId, on: true })).toEqual({ ok: true });
    const workshop = w.build('carpenter', w.index(30, 30, 32), 'oak');
    expect(apply({ type: 'LinkStockpile', zoneId, sourceZoneId: workshop, on: true })).toEqual({
      ok: false,
      reason: 'not_found',
    });
    const pasture = w.zone('pasture', [w.index(23, 20, 32)]);
    expect(apply({ type: 'LinkStockpile', zoneId, sourceZoneId: pasture, on: true })).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });
  it.each([1.5, 0, 8])('rejects fluid plate level %s', (level) => {
    const { w, apply } = setup();
    const plateId = w.build('pressure_plate', w.index(20, 20, 32), 'granite');
    const before = structuredClone(w.game.world.entities.get(plateId, C.Building)!.settings);
    expect(apply({ type: 'SetPlateTrigger', plateId, trigger: { kind: 'water', level } })).toEqual({
      ok: false,
      reason: 'out_of_range',
    });
    expect(w.game.world.entities.get(plateId, C.Building)!.settings).toEqual(before);
  });
  it('bounds container requests by stockpile tile count, with no partial write', () => {
    const { w, apply } = setup();
    const zoneId = w.zone('stockpile', [w.index(20, 20, 32), w.index(21, 20, 32)]);
    expect(
      apply({ type: 'SetStockpileContainers', zoneId, wants: { barrel: 2, bag: 0, bin: 1 } }),
    ).toEqual({ ok: true });
    const before = structuredClone(
      w.game.world.entities.get(zoneId, C.Stockpile)!.containersWanted,
    );
    for (const n of [3, 1000000000, 1.5, -1]) {
      expect(
        apply({ type: 'SetStockpileContainers', zoneId, wants: { barrel: 1, bag: n } }),
      ).toEqual({ ok: false, reason: 'out_of_range' });
      expect(w.game.world.entities.get(zoneId, C.Stockpile)!.containersWanted).toEqual(before);
    }
  });
  it('the command catalog contains the plain designation-priority range', () => {
    const text = readFileSync('docs/04-implementation/command-catalog.md', 'utf8');
    expect(text).toContain('with values outside 1 to 9 rejected');
  });
});

describe('T-175 transient entities and destroyed inputs do not linger', () => {
  it('keeps an ended party for one day from its actual end, then removes it', () => {
    const { w, ctx } = setup();
    const entities = w.game.world.entities;
    const partyId = entities.create('party');
    entities.add(partyId, C.Party, {
      civ: 'gloam',
      purpose: 'raid',
      members: [],
      leaderId: 0,
      state: 'retreat',
      goalTile: 0,
      goalEntity: 0,
      arrivedTick: 0,
      stateSince: 0,
      loot: [],
      edge: 'n',
      size: 1,
    });
    const member = spawnHostileMember(
      w.game.world,
      w.game.registry,
      w.game.world.rngFor('18'),
      partyId,
      'gloam_warrior',
      'melee',
      w.index(20, 0, 32),
      0,
      false,
    );
    const party = entities.get(partyId, C.Party)!;
    despawnMember(member, partyId, party, { ...ctx, tick: 17 });
    expect(party.state).toBe('gone');
    expect(party.stateSince).toBe(17);
    const threats = w.game.world.scheduler.byId('18') as ThreatsSystem;
    threats.tick({ ...ctx, tick: 17 + TICKS_PER_DAY - 1 });
    expect(entities.alive(partyId)).toBe(true);
    threats.tick({ ...ctx, tick: 17 + TICKS_PER_DAY });
    expect(entities.alive(partyId)).toBe(false);
  });
  it('timestamps a party wiped out before retreat', () => {
    const { w, ctx } = setup();
    const entities = w.game.world.entities;
    const partyId = entities.create('party');
    entities.add(partyId, C.Party, {
      civ: 'gloam',
      purpose: 'raid',
      members: [],
      leaderId: 0,
      state: 'engage',
      goalTile: 0,
      goalEntity: 0,
      arrivedTick: 0,
      stateSince: 0,
      loot: [],
      edge: 'n',
      size: 1,
    });
    const party = entities.get(partyId, C.Party)!;
    partyThink(partyId, party, { ...ctx, tick: 101 });
    expect(party.state).toBe('gone');
    expect(party.stateSince).toBe(101);
  });
  it('departing caravan guards leave no spare dagger or arrow', () => {
    const { w, ctx } = setup();
    const entities = w.game.world.entities;
    const trade = w.game.world.scheduler.byId('20') as TradeSystem;
    const caravan = spawnCaravan(ctx, 'wildwood', 'n', 0, false, 0, [], w.game.world.rngFor('20'));
    const members = [...caravan.merchants, ...caravan.guards, ...caravan.animals];
    const gear = entities
      .with(C.Item)
      .filter((id) => members.includes(entities.get(id, C.Item)!.carriedBy));
    const types = w.game.registry.table('items');
    expect(gear.some((id) => types.idOf(entities.get(id, C.Item)!.type) === 'dagger')).toBe(true);
    expect(gear.some((id) => types.idOf(entities.get(id, C.Item)!.type) === 'arrow')).toBe(true);
    caravan.state = 'waiting';
    caravan.stateSince = -DEPOT_WAIT_DAYS * TICKS_PER_DAY;
    trade.deserialize({ ...trade.serialize(), activeCaravan: caravan }, ctx);
    trade.tick(ctx);
    expect(trade.reader().activeCaravan()).toBeNull();
    expect(gear.filter((id) => entities.alive(id))).toEqual([]);
  });
  it('delays a mature sapling while a creature stands on it', () => {
    const { w, ctx } = setup();
    const tile = w.index(37, 42, 13);
    const material = w.game.registry.table('materials').index('pine');
    w.game.world.services.terrain.setKind(tile, TileKind.Sapling, material);
    w.plants.saplings.set(tile, 0);
    const id = w.spawnCreature('blind_stalker', tile, 'hostile:deep');
    w.plants.dailyDue = true;
    w.plants.tick({ ...ctx, tick: 2 * TICKS_PER_YEAR });
    expect(w.map.kindAt(tile)).toBe(TileKind.Sapling);
    expect(w.plants.saplings.has(tile)).toBe(true);
    w.movement.teleport(id, w.index(40, 42, 13));
    w.plants.dailyDue = true;
    w.plants.tick({ ...ctx, tick: 2 * TICKS_PER_YEAR + TICKS_PER_DAY });
    expect(w.map.kindAt(tile)).toBe(TileKind.Tree);
    expect(w.plants.saplings.has(tile)).toBe(false);
  });
  it('drops an externally destroyed delivered input on the dispatch tick', () => {
    const { w, apply } = setup();
    const workshopId = w.build('carpenter', w.index(20, 20, 32), 'oak');
    w.step(1);
    const log = w.spawnItem('log', 'oak', w.index(20, 20, 32));
    expect(
      apply({ type: 'AddWorkOrder', workshopId, order: { recipe: 'make_bed', count: 1 } }),
    ).toEqual({ ok: true });
    w.step(2);
    const board = (w.game.world.scheduler.byId('11') as JobsSystem).board;
    const job = Array.from(board.jobs.values()).find(
      (job) => job.target.ref === workshopId && board.typeId(job) === 'craft',
    )!;
    expect(job).toBeDefined();
    w.game.world.services.items!.reserve(log, job.id);
    job.inputs[0]!.reserved = [log];
    job.inputs[0]!.delivered = [log];
    w.game.world.services.items!.destroy(log, 'burned');
    w.step(1);
    expect(job.inputs[0]!.delivered).toEqual([]);
    expect(job.inputs[0]!.reserved).toEqual([]);
    expect(w.events('ItemDestroyed').some((event) => event['id'] === log)).toBe(true);
  });
});
