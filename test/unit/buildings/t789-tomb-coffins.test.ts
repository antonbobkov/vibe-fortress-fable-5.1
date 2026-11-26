import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { TOMB_COFFINS_READY } from '@systems/buildings/constants';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

/** A 3 × 4 tomb walled in on every side but one door gap at (40, 43). */
function walledTomb(w: TestWorld): { tiles: number[]; door: number } {
  const tiles: number[] = [];
  for (let y = 39; y <= 44; y += 1) for (let x = 39; x <= 43; x += 1) {
    const i = w.index(x, y, Z);
    const inside = x >= 40 && x <= 42 && y >= 40 && y <= 43;
    if (inside) tiles.push(i);
    else if (!(x === 41 && y === 44)) w.carve(i, TileKind.Wall);
  }
  return { tiles, door: w.index(41, 44, Z) };
}

function kill(w: TestWorld, id: number): void {
  const hp = w.game.world.entities.get(id, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
}

describe('T-789 a tomb keeps its own coffins ready', () => {
  it('orders coffins at the mason, places them in the tomb, and buries a death with no player action', () => {
    const w = new TestWorld({ seed: 't789-tomb', world: 'flat-test', embark: 'none' });
    const buildings = w.readers.of<BuildingsReader>('14');
    const mason = w.build('mason', w.index(50, 40, Z), 'granite');
    for (let k = 0; k < 3; k += 1) w.spawnDwarf({ at: w.index(46 + k, 46, Z), skills: { masonry: 5 } });
    const victim = w.spawnDwarf({ at: w.index(46, 48, Z) });
    for (let k = 0; k < 6; k += 1) w.spawnItem('raw_stone', 'granite', w.index(52 + k, 44, Z));
    const tomb = w.zone('tomb', [w.index(40, 40, Z), w.index(41, 40, Z), w.index(40, 41, Z), w.index(41, 41, Z)]);
    expect(buildings.tombCoffins(tomb)).toEqual({ ready: 0, wanted: TOMB_COFFINS_READY });
    expect(buildings.tombShortfalls()).toEqual([{ zoneId: tomb, short: TOMB_COFFINS_READY }]);
    // The first day: the mason gets one standing coffin order, marked for the tomb.
    w.until(() => (w.game.world.entities.get(mason, C.Workshop)?.orders.length ?? 0) > 0, TICKS_PER_DAY + 20);
    const orders = w.game.world.entities.get(mason, C.Workshop)!.orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ forZoneId: tomb, remaining: TOMB_COFFINS_READY, mode: 'once' });
    // The coffins are made, placed in the tomb and built.
    w.until(() => buildings.tombCoffins(tomb).ready === TOMB_COFFINS_READY &&
      buildings.byType('coffin').every((id) => buildings.get(id)?.state === 'built'), 4 * TICKS_PER_DAY);
    expect(buildings.byType('coffin')).toHaveLength(TOMB_COFFINS_READY);
    expect(buildings.tombShortfalls()).toEqual([]);
    expect(w.game.world.entities.get(mason, C.Workshop)!.orders).toHaveLength(0);
    // A death: the body goes into a ready coffin, and the tomb asks for another.
    kill(w, victim);
    w.until(() => w.events('Buried').some((e) => e['dwarfId'] === victim), 2 * TICKS_PER_DAY);
    expect(w.events('Buried').find((e) => e['dwarfId'] === victim)!['tombTier']).not.toBe('none');
    w.until(() => buildings.byType('coffin').length === TOMB_COFFINS_READY + 1, 3 * TICKS_PER_DAY);
    expect(buildings.byType('coffin')).toHaveLength(TOMB_COFFINS_READY + 1);
  });

  it('never seals a tomb: a full setting stops at the last coffin that leaves every tile joined to the door', () => {
    const w = new TestWorld({ seed: 't789-seal', world: 'flat-test', embark: 'none' });
    const buildings = w.readers.of<BuildingsReader>('14');
    const { tiles, door } = walledTomb(w);
    for (let k = 0; k < 2; k += 1) w.spawnDwarf({ at: w.index(46 + k, 46, Z) });
    for (let k = 0; k < tiles.length; k += 1) w.spawnItem('coffin', 'granite', w.index(46 + k, 50, Z));
    w.step(1);
    const tomb = w.zone('tomb', tiles);
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: tomb, key: 'coffins ready', value: tiles.length + 1 }).ok).toBe(false);
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: tomb, key: 'coffins ready', value: tiles.length })).toEqual({ ok: true });
    w.step(4 * TICKS_PER_DAY);
    const coffins = buildings.byType('coffin');
    expect(coffins.length).toBeGreaterThan(0);
    expect(coffins.length).toBeLessThan(tiles.length);
    w.step(20);
    // Every tile of the tomb without a coffin is reached from the door, and every coffin from one of them.
    const open = tiles.filter((t) => buildings.at(t) === 0);
    for (const t of open) expect(w.reachable(door, t)).toBe(true);
    const sides = (t: number): number[] => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => w.map.offset(t, dx!, dy!, 0));
    for (const id of coffins) expect(sides(buildings.get(id)!.origin).some((s) => s === door || open.includes(s))).toBe(true);
    // The door tile's neighbour inside the tomb is the last left open.
    expect(open).toContain(w.index(41, 43, Z));
  });

  it('a setting of 0 keeps no coffins and asks for none', () => {
    const w = new TestWorld({ seed: 't789-zero', world: 'flat-test', embark: 'none' });
    const buildings = w.readers.of<BuildingsReader>('14');
    const mason = w.build('mason', w.index(50, 40, Z), 'granite');
    w.spawnDwarf({ at: w.index(46, 46, Z), skills: { masonry: 5 } });
    w.spawnItem('coffin', 'granite', w.index(46, 50, Z));
    const tomb = w.zone('tomb', [w.index(40, 40, Z), w.index(41, 40, Z)]);
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: tomb, key: 'coffins ready', value: 0 })).toEqual({ ok: true });
    w.step(2 * TICKS_PER_DAY);
    expect(buildings.byType('coffin')).toHaveLength(0);
    expect(w.game.world.entities.get(mason, C.Workshop)!.orders).toHaveLength(0);
    expect(buildings.tombCoffins(tomb)).toEqual({ ready: 0, wanted: 0 });
  });
});
