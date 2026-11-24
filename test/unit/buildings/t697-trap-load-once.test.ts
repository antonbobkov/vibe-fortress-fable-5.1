import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { TileIndex } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { DefenseReader } from '@systems/defense';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function bld(w: TestWorld): BuildingsReader {
  return w.readers.of<BuildingsReader>('14');
}

function defense(w: TestWorld): DefenseReader {
  return w.readers.of<DefenseReader>('19');
}

/** Every unit of the item types in the world: on the ground, carried, stored or installed. */
function units(w: TestWorld, types: readonly number[]): number {
  let n = 0;
  for (const id of w.game.world.entities.with(C.Item)) {
    const item = w.game.world.entities.get(id, C.Item);
    if (item !== undefined && types.includes(item.type)) n += item.count;
  }
  return n;
}

/** The units of the item types lying on a tile. */
function unitsAt(w: TestWorld, tile: TileIndex, types: readonly number[]): number {
  const items = w.readers.of<ItemsReader>('13');
  return items.at(tile).reduce((n, id) => {
    const item = items.get(id);
    return item !== undefined && types.includes(item.type) ? n + item.count : n;
  }, 0);
}

function takeApart(w: TestWorld, id: number): void {
  expect(w.game.world.applyCommand({ type: 'DeconstructBuilding', buildingId: id } as never)).toEqual({ ok: true });
  w.until((x) => !x.game.world.entities.alive(id), 4000);
}

describe('T-697 a trap taken apart gives back its load once', () => {
  it('a weapon trap built by a dwarf gives back one mechanism and its one weapon', () => {
    const w = new TestWorld({ seed: 't697-weapon', world: 'flat-test', embark: 'default' });
    const mechanism = bld(w).inputTypes('mechanism');
    const weapons = bld(w).inputTypes('weapon');
    w.spawnItem('mechanism', 'granite', w.index(44, 14, Z));
    w.spawnItem('dagger', 'iron', w.index(45, 14, Z));
    const before = { mechanisms: units(w, mechanism), weapons: units(w, weapons) };
    const tile = w.index(50, 16, Z);
    expect(w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'weapon_trap', origin: tile } as never)).toMatchObject({ ok: true });
    const id = bld(w).at(tile);
    w.until((x) => bld(x).get(id)?.state === 'built', 4000);
    w.step(1);
    // The mechanism is consumed and kept; the weapon is installed, not consumed.
    const settings = bld(w).get(id)?.settings ?? {};
    expect((settings['inputs'] as { type: string }[]).map((u) => u.type)).toEqual(['mechanism']);
    expect(settings['trapLoaded']).toHaveLength(1);
    expect(defense(w).trapState(id)).toBe('armed');
    expect([units(w, mechanism), units(w, weapons)]).toEqual([before.mechanisms - 1, before.weapons]);
    takeApart(w, id);
    expect([unitsAt(w, tile, mechanism), unitsAt(w, tile, weapons)]).toEqual([1, 1]);
    expect([units(w, mechanism), units(w, weapons)]).toEqual([before.mechanisms, before.weapons]);
  });

  it('a stone-fall trap that fell and was rearmed gives back one mechanism and its new stone', () => {
    const w = new TestWorld({ seed: 't697-stone-fall', world: 'flat-test', embark: 'default' });
    const mechanism = bld(w).inputTypes('mechanism');
    const stone = bld(w).inputTypes('raw_stone');
    const tile = w.index(50, 16, Z);
    const before = units(w, stone);
    const trap = w.build('stone_fall_trap', tile, 'granite');
    w.step(1);
    expect((bld(w).get(trap)?.settings['inputs'] as { type: string }[]).map((u) => u.type)).toEqual(['mechanism']);
    // Built as `TestWorld.build` does: its stone made anew and installed.
    expect(units(w, stone)).toBe(before + 1);
    const cow = w.spawnCreature('cow', w.index(51, 16, Z), 'wild');
    w.game.world.services.movement?.teleport(cow, tile);
    w.step(2);
    expect(defense(w).trapState(trap)).toBe('spent');
    w.game.world.services.movement?.teleport(cow, w.index(60, 30, Z));
    // A stone for the rearm, by the wagon: the fallen one lies on the trap's tile.
    w.spawnItem('raw_stone', 'granite', w.index(44, 14, Z));
    w.until((x) => defense(x).trapState(trap) === 'armed', 4000);
    expect(units(w, stone)).toBe(before + 2);
    takeApart(w, trap);
    // One mechanism, and the stone it held: the fallen stone and the new one, no third.
    expect(unitsAt(w, tile, mechanism)).toBe(1);
    expect(units(w, stone)).toBe(before + 2);
    expect(defense(w).trapAt(tile)).toBe(0);
  });

  it('a trap from an older save, its load kept among its inputs, still gives it back once', () => {
    const w = new TestWorld({ seed: 't697-old-save', world: 'flat-test', embark: 'default' });
    const mechanism = bld(w).inputTypes('mechanism');
    const weapons = bld(w).inputTypes('weapon');
    const tile = w.index(50, 16, Z);
    const trap = w.build('weapon_trap', tile, 'iron');
    w.step(1);
    const b = w.game.world.entities.get(trap, C.Building)!;
    const inputs = b.settings['inputs'] as { type: string; material: number }[];
    const loaded = (b.settings['trapLoaded'] as number[])[0] as number;
    const type = w.game.registry.table<{ id: string }>('items').byIndex(w.game.world.entities.get(loaded, C.Item)!.type)!.id;
    w.game.world.entities.add(trap, C.Building, { ...b, settings: { ...b.settings, inputs: [...inputs, { type, material: inputs[0]!.material }] } });
    const before = units(w, weapons);
    takeApart(w, trap);
    expect([unitsAt(w, tile, mechanism), unitsAt(w, tile, weapons)]).toEqual([1, 1]);
    expect(units(w, weapons)).toBe(before);
  });
});
