/**
 * T-488: in `three-years-p2-7` (master 37da07a4) the sulks of a miserable year 3 broke the dining
 * hall's table and all four of its chairs, and the 68-dwarf fortress ended without a dining hall:
 * the script now places a broken hall hearth, table or chair again, as a player replaces it.
 * In `three-years-p2-4` at shift 50 raids killed both founder miners and every immigrant
 * left with the mining labor by day 164; two survivors stood beside 400 dig jobs nobody could take,
 * and the hearth hall and dining hall, half dug, were never finished. The three-year script now
 * gives the mining labor to a survivor when the last miner dies, as a player does. And the halls
 * and bedrooms witness holds a fortress that ends at least as large as its embark party; a few
 * survivors of a fortress the raids cut down are not asked to finish or keep its rooms.
 */
import { describe, expect, it } from 'vitest';
import { TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { JobsReader } from '@systems/jobs';
import { keepAMiner, type EconomyState } from '../scenarios/three_years_economy';
import { fortressWitnesses, keepHallFurniture, ROOMS_WITNESS_POPULATION, Z, type FortressState } from '../scenarios/three_years_fortress';
import { scriptRecord } from '../scenarios/script-commands';
import { TestWorld } from '../scenarios/test-world';

function ground(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const granite = w.game.registry.table('materials').index('granite');
  for (let y = 14; y <= 26; y += 1) for (let x = 14; x <= 26; x += 1) {
    const t = w.index(x, y, Z);
    w.carve(t, TileKind.Floor, granite);
    w.map.setFlag(t, TileFlag.Grass, false);
  }
  return w;
}

function fortress(specialists: Record<string, number> = {}): FortressState {
  return { cx: 20, cy: 20, z: Z, hallZ: Z - 5, placedIds: {}, economy: { phases: new Set<string>(), specialists } as unknown as EconomyState,
    gateDoorId: 0, gateDoorId2: 0, gateWallLostTick: 0, squadId: 0 } as unknown as FortressState;
}

describe('T-488 the three-year script keeps a miner', () => {
  it('gives mining to a survivor when nobody holds it, and the designated rock is dug', () => {
    const w = ground('t488-miner');
    const granite = w.game.registry.table('materials').index('granite');
    const rock = w.index(20, 20, Z);
    w.carve(rock, TileKind.Wall, granite);
    const benched = w.spawnDwarf({ at: w.index(17, 17, Z), skills: { mining: 9 } });
    const skilled = w.spawnDwarf({ at: w.index(18, 17, Z), skills: { mining: 3 } });
    const other = w.spawnDwarf({ at: w.index(19, 17, Z) });
    for (const id of [benched, skilled, other]) w.setLabor(id, 'mining', false);
    w.spawnItem('pick', 'iron', w.index(18, 18, Z), 1);
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: [rock] }).ok).toBe(true);
    w.step(1200);
    expect(w.map.kindAt(rock), 'no miner, no dig').toBe(TileKind.Wall);

    // The bench keeps its specialist; the best miner among the others takes the labor.
    const state = fortress({ fuel: benched });
    keepAMiner(w, state);
    const jobs = w.readers.of<JobsReader>('11');
    expect([benched, skilled, other].filter((id) => jobs.laborEnabled(id, 'mining'))).toEqual([skilled]);
    // With a miner standing, nothing more is sent.
    const sent = scriptRecord(w).accepted.get('SetLabor') ?? 0;
    keepAMiner(w, state);
    expect(scriptRecord(w).accepted.get('SetLabor') ?? 0).toBe(sent);
    w.until(() => w.map.kindAt(rock) === TileKind.Floor, 4800);
    expect(w.map.kindAt(rock), 'the new miner digs the rock').toBe(TileKind.Floor);
  });

  it('asks a fortress for its halls and bedrooms only when it ends at least as large as its embark party', () => {
    const w = ground('t488-witness');
    const state = fortress();
    const rooms = (): string[] => fortressWitnesses(w, state, 0).filter((m) => m.includes('hall') || m.includes('bedrooms'));
    for (let k = 1; k < ROOMS_WITNESS_POPULATION; k += 1) w.spawnDwarf({ at: w.index(14 + k, 15, Z) });
    expect(rooms(), 'a fortress cut below its embark size').toEqual([]);
    expect(fortressWitnesses(w, state, 0), 'the gate and the squad are still asked for').toContain('the squad');
    w.spawnDwarf({ at: w.index(22, 15, Z) });
    expect(rooms()).toEqual(['a hearth hall', 'a dining hall', 'seven bedrooms (0)']);
  });

  it('places a broken hall chair again, and its builder brings one from stock', () => {
    const w = ground('t488-chair');
    const buildings = w.readers.of<BuildingsReader>('14');
    const seat = w.index(20, 20, Z);
    const hearthAt = w.index(22, 22, Z);
    const state = fortress();
    state.hallFurniture = [{ type: 'chair', origin: seat, priority: 4 }, { type: 'hearth', origin: hearthAt, priority: 3 }];
    const chair = w.build('chair', seat);
    state.hearthBuildingId = w.build('hearth', hearthAt);
    keepHallFurniture(w, state);
    expect(scriptRecord(w).accepted.get('PlaceBuilding') ?? 0, 'nothing is gone, nothing is placed').toBe(0);

    w.spawnDwarf({ at: w.index(17, 17, Z) });
    w.spawnItem('chair', 'granite', w.index(18, 18, Z), 1);
    w.game.world.emit({ type: 'SulkHappened', id: 0, kind: 'break', buildingId: chair });
    w.until(() => buildings.get(chair) === undefined, 100);
    expect(buildings.at(seat), 'the sulk broke the chair').toBe(0);
    keepHallFurniture(w, state);
    const again = buildings.at(seat);
    expect(buildings.get(again)?.typeId).toBe('chair');
    expect(buildings.get(state.hearthBuildingId)?.state, 'the standing hearth is left alone').toBe('built');
    w.until(() => buildings.get(again)?.state === 'built', 4800);
    expect(buildings.get(again)?.state).toBe('built');
  });
});
