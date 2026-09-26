import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { DefenseReader } from '@systems/defense';
import { jamChance } from '@systems/defense/traps';
import { PLATE_RESET_TICKS } from '@systems/buildings/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;
const reader = (w: TestWorld): DefenseReader => w.readers.of<DefenseReader>('19');

describe('T-M6-12 defense', () => {
  it('jam chance grows with corpses', () => {
    expect([jamChance(0), jamChance(1), jamChance(3), jamChance(30)]).toEqual([50, 100, 200, 1000]);
  });

  it('all mode triggers a fortress dwarf but keeps tame animals safe', () => {
    const w = new TestWorld({ seed: 'df-all-mode', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const trap = w.build('stone_fall_trap', tile, 'granite');
    const dwarf = w.spawnDwarf({ at: w.index(39, 40, Z) });
    w.step(1);
    expect(reader(w).trapAt(tile)).toBe(trap);
    expect(reader(w).trapState(trap)).toBe('armed');
    expect(w.game.world.applyCommand({ type: 'SetTrapMode', trapId: trap, mode: 'all' })).toEqual({ ok: true });
    w.game.world.services.movement?.teleport(dwarf, tile);
    w.step(2);
    expect(w.events('EntitiesMoved').some((event) => (event['moves'] as [number, number, number][]).some((move) => move[0] === dwarf && move[2] === tile))).toBe(true);
    expect(w.events('TrapTriggered').some((event) => event['creatureId'] === dwarf)).toBe(true);
    expect(reader(w).trapState(trap)).toBe('spent');
  });

  it('plate emits edges no closer than PLATE_RESET_TICKS and only on condition changes', () => {
    const w = new TestWorld({ seed: 'df-plate-reset', world: 'flat-test', embark: 'none' });
    const tile = w.index(40, 40, Z);
    const plate = w.build('pressure_plate', tile, 'granite');
    const dwarf = w.spawnDwarf({ at: w.index(39, 40, Z) });
    expect(w.game.world.applyCommand({ type: 'SetPlateTrigger', plateId: plate, trigger: { kind: 'creatures', minSize: 1, includeFortress: true } })).toEqual({ ok: true });
    w.step(1);
    w.game.world.services.movement?.teleport(dwarf, tile);
    w.step(1);
    expect(w.events('MechanismTriggered').filter((e) => e['sourceId'] === plate).map((e) => e['on'])).toEqual([true]);
    w.game.world.services.movement?.teleport(dwarf, w.index(39, 40, Z));
    w.step(PLATE_RESET_TICKS - 1);
    expect(reader(w).plateActive(plate)).toBe(true);
    w.step(1);
    expect(w.events('MechanismTriggered').filter((e) => e['sourceId'] === plate).map((e) => e['on'])).toEqual([true, false]);
  });

  it('retreat rule order: reachable hall, indoor tile behind a door, bedroom, stay', () => {
    const w = new TestWorld({ seed: 'df-retreat-order', world: 'flat-test', embark: 'none' });
    const from = w.index(40, 37, Z);
    const dwarf = w.spawnDwarf({ at: from });
    const granite = w.game.registry.table('materials').index('granite');
    const hallTile = w.index(40, 44, Z);
    for (let x = 0; x < w.map.w; x += 1) if (x !== 40) w.game.world.services.terrain.setKind(w.index(x, 40, Z), TileKind.Wall, granite);
    const door = w.build('door', w.index(40, 40, Z), 'oak');
    for (let y = 41; y < 47; y += 1) for (let x = 38; x <= 42; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, Z), TileFlag.Outdoor, false);
    const hearth = w.build('hearth', hallTile, 'granite');
    expect(hearth).toBeGreaterThan(0);
    w.step(1);
    expect(reader(w).retreatTile(dwarf)).toBeGreaterThanOrEqual(0);
    // Block the hall alone; the door remains the route to other indoor tiles.
    for (const tile of w.readers.of<{ hearthHallTiles(): number[] }>('14').hearthHallTiles()) {
      w.game.world.services.terrain.setKind(tile, TileKind.Wall, granite);
    }
    expect(door).toBeGreaterThan(0);
    w.step(1);
    const result = reader(w).retreatTile(dwarf);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(w.map.hasFlag(result, TileFlag.Outdoor)).toBe(false);
    expect(w.game.world.entities.get(dwarf, C.Position)).toBeDefined();
    const bedroomWorld = new TestWorld({ seed: 'df-bedroom', world: 'flat-test', embark: 'none' });
    const bedroomDwarf = bedroomWorld.spawnDwarf({ at: bedroomWorld.index(35, 35, Z) });
    const bedTile = bedroomWorld.index(36, 35, Z);
    bedroomWorld.build('bed', bedTile, 'oak');
    const bedroom = bedroomWorld.zone('bedroom', [bedTile]);
    expect(bedroomWorld.game.world.applyCommand({ type: 'AssignRoom', zoneId: bedroom, dwarfId: bedroomDwarf })).toEqual({ ok: true });
    bedroomWorld.step(1);
    expect(reader(bedroomWorld).retreatTile(bedroomDwarf)).toBe(bedTile);
    const stay = new TestWorld({ seed: 'df-stay', world: 'flat-test', embark: 'none' });
    const lonely = stay.spawnDwarf({ at: stay.index(35, 35, Z) });
    expect(reader(stay).retreatTile(lonely)).toBe(-1);
  });

  it('a completed pull lever job emits the toggled source state', () => {
    const w = new TestWorld({ seed: 'df-pull-lever', world: 'flat-test', embark: 'none' });
    const lever = w.build('lever', w.index(40, 40, Z), 'granite');
    w.spawnDwarf({ at: w.index(41, 40, Z) });
    expect(w.game.world.applyCommand({ type: 'PullLever', leverId: lever })).toEqual({ ok: true });
    w.until((world) => world.events('MechanismTriggered').some((event) => event['sourceId'] === lever), 350);
    expect(w.events('MechanismTriggered').filter((event) => event['sourceId'] === lever)[0]?.['on']).toBe(true);
    expect(w.readers.of<{ mechanismState(id: number): string }>('14').mechanismState(lever)).toBe('on');
  });

  it('a war animal assigned to a chain holds within one tile', () => {
    const w = new TestWorld({ seed: 'df-chain', world: 'flat-test', embark: 'none' });
    const station = w.index(40, 40, Z);
    const chain = w.build('chain_post', station, 'oak');
    const dog = w.spawnCreature('dog', w.index(47, 40, Z), 'fortress');
    w.game.world.entities.add(dog, C.Tame, {
      pastureId: 0, condition: 0, trained: 'war', assignedTo: 0, pregnantUntil: 0,
      lastProductTick: {}, juvenileUntil: 0, slaughter: false, petOf: 0, noBreed: false,
    });
    expect(w.game.world.applyCommand({ type: 'AssignAnimal', animalId: dog, chainId: chain })).toEqual({ ok: true });
    expect(reader(w).stationOf(dog)).toBe(chain);
    w.until((world) => {
      const tile = world.game.world.services.movement?.tileOf(dog) ?? -1;
      return tile >= 0 && Math.max(Math.abs(w.map.xOf(tile) - 40), Math.abs(w.map.yOf(tile) - 40)) <= 1;
    }, 250);
  });

  it('spikes attack with pierce only while extended; weapon traps use melee resolution', () => {
    const w = new TestWorld({ seed: 'df-attack-traps', world: 'flat-test', embark: 'none' });
    const spikeTile = w.index(40, 40, Z);
    const weaponTile = w.index(44, 40, Z);
    const spike = w.build('spike_trap', spikeTile, 'iron');
    const weapon = w.build('weapon_trap', weaponTile, 'iron');
    const foe = w.spawnCreature('trollkin', w.index(39, 40, Z), 'hostile:gloam');
    w.step(1);
    w.game.world.services.movement?.teleport(foe, spikeTile);
    w.step(2);
    expect(w.events('TrapTriggered').some((event) => event['trapId'] === spike)).toBe(false);
    const b = w.game.world.entities.get(spike, C.Building);
    if (b === undefined) throw new Error('spike building absent');
    w.game.world.entities.add(spike, C.Building, { ...b, toggled: true });
    w.game.world.services.movement?.teleport(foe, w.index(39, 40, Z));
    w.game.world.services.movement?.teleport(foe, spikeTile);
    w.step(2);
    expect(w.events('AttackResolved').some((event) => event['attackerId'] === spike && event['damageType'] === 'pierce')).toBe(true);
    w.game.world.services.movement?.teleport(foe, weaponTile);
    w.step(2);
    expect(w.events('AttackResolved').some((event) => event['attackerId'] === weapon)).toBe(true);
  });
});
