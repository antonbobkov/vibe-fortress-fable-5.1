/**
 * T-578: the defence year's squad drills without a workshop's named worker. A soldier at drill does
 * no civilian work (16) and a workshop with a named worker offers its job to nobody else (12), so a
 * smith who trained full time left the squad's kit open at the forge for the rest of the run. The
 * script takes every workshop's named worker out of the squad while the alert is down, and fills the
 * squad to SQUAD_SIZE from the newest adults outside it whom no workshop names, those no role holds first.
 */
import { describe, expect, it } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { CombatReader } from '@systems/combat';
import type { JobsReader } from '@systems/jobs';
import { keepWoodcutter, specialistCandidates, SQUAD_SIZE, type EconomyState } from '../scenarios/three_years_economy';
import { Z, type FortressState } from '../scenarios/three_years_fortress';
import { checkDefenceSquad, keepNamedWorkersAtTheirShops, keepToolLaborsOffTheSquad, type DefenceYearState } from '../scenarios/defence_year_fortress';
import { scriptRecord } from '../scenarios/script-commands';
import { TestWorld } from '../scenarios/test-world';

function ground(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let y = 10; y <= 30; y += 1) for (let x = 10; x <= 30; x += 1) {
    const t = w.index(x, y, Z);
    w.carve(t, TileKind.Floor, granite);
    w.map.setFlag(t, TileFlag.Grass, false);
  }
  return w;
}

/** Seven founders (the seventh the smith) and `immigrants` more; a forge whose worker is the smith; a squad of `members`. */
function fort(w: TestWorld, immigrants: number, members: (founders: number[]) => number[]): { state: DefenceYearState; founders: number[]; arrived: number[]; squadId: number } {
  const all = Array.from({ length: 7 + immigrants }, (_, k) => w.spawnDwarf({ at: w.index(12 + k, 12, Z) }));
  const founders = all.slice(0, 7);
  (w.game as unknown as { arrival: { dwarves: number[] } }).arrival = { dwarves: founders };
  const forge = w.build('forge', w.index(20, 20, Z), 'granite');
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: forge, dwarfId: founders[6]! }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squadId = w.readers.of<CombatReader>('16').squads()[0]!.id;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: members(founders) }).ok).toBe(true);
  const fortress = { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: { forge },
    economy: { phases: new Set<string>(['arming']), specialists: { forge: founders[6]!, smelter: founders[3]! } } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId } as unknown as FortressState;
  const state = { fortress, notes: [], barracksZoneId: 0, archeryRangeZoneId: 0 } as unknown as DefenceYearState;
  return { state, founders, arrived: all.slice(7), squadId };
}

const membersOf = (w: TestWorld, squadId: number): readonly number[] =>
  w.readers.of<CombatReader>('16').squads().find((s) => s.id === squadId)?.members ?? [];

describe('T-578 the forge\'s worker does not drill', () => {
  it('the smith leaves the squad, which keeps its other soldiers, and a second look sends nothing', () => {
    const w = ground('t578-smith');
    // The fixture's militia: the woodcutter, the mason, the smith and the two miners.
    const { state, founders, squadId } = fort(w, 1, (f) => [f[2]!, f[3]!, f[6]!, f[0]!, f[1]!]);
    const after = keepNamedWorkersAtTheirShops(w, state, membersOf(w, squadId));
    expect([...membersOf(w, squadId)].sort()).toEqual([founders[0]!, founders[1]!, founders[2]!, founders[3]!].sort());
    expect(after).toEqual(membersOf(w, squadId));
    const sent = scriptRecord(w).accepted.get('SetSquadMembers') ?? 0;
    keepNamedWorkersAtTheirShops(w, state, membersOf(w, squadId));
    expect(scriptRecord(w).accepted.get('SetSquadMembers') ?? 0).toBe(sent);
  });

  it('a squad left under SQUAD_SIZE takes the newest free immigrant, never the smith', () => {
    const w = ground('t578-smith-refill');
    const { state, founders, arrived, squadId } = fort(w, 2, (f) => [f[6]!, f[0]!]);
    keepNamedWorkersAtTheirShops(w, state, membersOf(w, squadId));
    const members = membersOf(w, squadId);
    expect(members.length).toBe(SQUAD_SIZE);
    expect(members).not.toContain(founders[6]);
    expect(members).toEqual([founders[0]!, arrived[1]!, arrived[0]!]);
  });

  it('the craftdwarf\'s named worker leaves it too, and the recruit is no workshop\'s worker', () => {
    const w = ground('t578-crafter');
    const { state, founders, arrived, squadId } = fort(w, 2, (f) => [f[3]!, f[6]!, f[0]!, f[1]!]);
    const shop = w.build('craftdwarf', w.index(24, 24, Z), 'granite');
    w.step(1);
    // The mason is the craftdwarf's worker; the newest immigrant is the fuel worker at another shop.
    expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: shop, dwarfId: founders[3]! }).ok).toBe(true);
    const mason = w.build('mason', w.index(14, 24, Z), 'granite');
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'SetWorkshopWorker', workshopId: mason, dwarfId: arrived[1]! }).ok).toBe(true);
    keepNamedWorkersAtTheirShops(w, state, membersOf(w, squadId));
    expect(membersOf(w, squadId)).toEqual([founders[0]!, founders[1]!, arrived[0]!]);
  });

  it('a dwarf outside the squad is given mechanics when none there has it, never one the economy dedicates', () => {
    const w = ground('t578-mechanic');
    const { state, founders, arrived, squadId } = fort(w, 3, (f) => [f[0]!, f[1]!, f[2]!]);
    const members = membersOf(w, squadId);
    const all = [...founders, ...arrived];
    for (const id of all) w.setLabor(id, 'mechanics', members.includes(id));
    // The newest immigrant is the brewer, and the mason the craftdwarf.
    state.fortress.economy.brewer = arrived[2]!;
    (state.fortress.economy.specialists as Record<string, number>)['craftdwarf'] = founders[3]!;
    w.step(1);
    keepToolLaborsOffTheSquad(w, state, members);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.workersWithLabor('mechanics').filter((id) => !members.includes(id))).toEqual([arrived[0]!]);
    expect(members.every((id) => jobs.laborEnabled(id, 'mechanics')), 'the soldiers keep it').toBe(true);
    const sent = scriptRecord(w).accepted.get('SetLabor') ?? 0;
    keepToolLaborsOffTheSquad(w, state, members);
    expect(scriptRecord(w).accepted.get('SetLabor') ?? 0).toBe(sent);
  });

  it('T-581: a dwarf outside the squad is given carpentry when only soldiers have it', () => {
    const w = ground('t581-carpenter');
    const { state, founders, arrived, squadId } = fort(w, 2, (f) => [f[2]!, f[0]!, f[1]!]);
    const members = membersOf(w, squadId);
    for (const id of [...founders, ...arrived]) w.setLabor(id, 'carpentry', members.includes(id));
    // The newest immigrant is the brewer.
    state.fortress.economy.brewer = arrived[1]!;
    w.step(1);
    keepToolLaborsOffTheSquad(w, state, members);
    const jobs = w.readers.of<JobsReader>('11');
    expect(jobs.workersWithLabor('carpentry').filter((id) => !members.includes(id))).toEqual([arrived[0]!]);
    expect(members.every((id) => jobs.laborEnabled(id, 'carpentry')), 'the soldiers keep it').toBe(true);
  });

  it('not in a fight: under an alert the squad goes active with the smith in it', () => {
    const w = ground('t578-smith-alert');
    const { state, founders, squadId } = fort(w, 0, (f) => [f[2]!, f[6]!, f[0]!]);
    w.game.world.fortress.alert = 'hearth';
    checkDefenceSquad(w, state);
    expect(membersOf(w, squadId)).toContain(founders[6]);
    w.game.world.fortress.alert = 'calm';
    checkDefenceSquad(w, state);
    expect(membersOf(w, squadId)).not.toContain(founders[6]);
  });
});

describe("T-733 a soldier at drill is nobody's specialist", () => {
  it("the squad's members are the soldiers the economy passes over, so the woodcutter is a civilian", () => {
    const w = ground('t733-woodcutter');
    // The founding woodcutter and a miner drill with an immigrant; ten adults, enough for the specialists.
    const { state, founders, arrived, squadId } = fort(w, 3, (f) => [f[2]!, f[0]!]);
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [founders[2]!, founders[0]!, arrived[0]!] }).ok).toBe(true);
    checkDefenceSquad(w, state);
    expect([...(state.fortress.strong?.trained ?? [])].sort()).toEqual([...membersOf(w, squadId)].sort());
    expect(specialistCandidates(w, state.fortress)).not.toContain(arrived[0]);
    // The founder at drill keeps no axe: his trade goes to a dwarf outside the squad.
    keepWoodcutter(w, state.fortress);
    const woodcutter = state.fortress.economy.specialists['woodcutter'];
    expect(woodcutter).toBeDefined();
    expect(membersOf(w, squadId)).not.toContain(woodcutter);
  });

  it('a soldier who leaves the squad is a candidate again', () => {
    const w = ground('t733-leaves');
    const { state, founders, arrived, squadId } = fort(w, 3, (f) => [f[2]!, f[0]!]);
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [founders[2]!, founders[0]!, arrived[0]!] }).ok).toBe(true);
    checkDefenceSquad(w, state);
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: [founders[2]!, founders[0]!, arrived[1]!] }).ok).toBe(true);
    checkDefenceSquad(w, state);
    const candidates = specialistCandidates(w, state.fortress);
    expect(candidates).toContain(arrived[0]);
    expect(candidates).not.toContain(arrived[1]);
  });

  it("a named worker's replacement comes in by the refill's rules, a specialist leaving its role", () => {
    const w = ground('t733-named-refill');
    const { state, founders, arrived, squadId } = fort(w, 2, (f) => [f[6]!, f[0]!]);
    // Every adult outside the squad holds a role but the newest immigrant, the woodcutter, whom no workshop names.
    const specialists = state.fortress.economy.specialists as Record<string, number>;
    specialists['fuel'] = founders[1]!;
    specialists['charcoal'] = founders[2]!;
    specialists['woodcutter'] = arrived[1]!;
    state.fortress.economy.brewer = arrived[0]!;
    keepNamedWorkersAtTheirShops(w, state, membersOf(w, squadId));
    expect(membersOf(w, squadId)).toEqual([founders[0]!, arrived[1]!]);
    expect(specialists['woodcutter'], 'the woodcutter left the role for the squad').toBeUndefined();
    expect(Object.values(specialists)).not.toContain(founders[0]);
  });
});
