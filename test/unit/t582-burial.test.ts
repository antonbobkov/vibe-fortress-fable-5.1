import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { Designation, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { keepTheDead, setupThreeYearsFortress, threeYearsWorld, TOMB_H, TOMB_W } from '../scenarios/three_years_fortress';
import { scriptRecord } from '../scenarios/script-commands';

/**
 * T-582: the three-year script made no coffin, so every dead dwarf lay where it fell to the end of
 * the run and every adult held `unburied_dead` (15 § Grief), which kept the hall spirit under what
 * immigration asks (21). As a player does, the script now digs a tomb off a corridor of the hall
 * level once a dwarf has died, keeps a free coffin there ahead of the unburied dead, orders the
 * coffins it lacks first at the mason's, and orders a memorial slab naming a dead dwarf whose body
 * is gone (14 § Burial).
 */
describe('T-582 the three-year script buries its dead', () => {
  it('three-years-p0-1: a tomb, a coffin ahead of the dead, the coffins ordered, and a slab for a body that is gone', () => {
    const w = threeYearsWorld('three-years-p0-1', 0);
    const state = setupThreeYearsFortress(w);
    const map = w.map, z = state.hallZ;
    const ent = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    // The hall level as the script plans it, dug at once.
    for (const bp of state.bedroomPlans) for (const t of [...bp.tiles, w.index(bp.doorX, bp.doorY, z)]) map.setDesignation(t, Designation.Dig, 4);
    const dig = (tiles: readonly number[]): void => {
      for (const t of tiles) { w.carve(t, TileKind.Floor); w.discover(t); map.setDesignation(t, Designation.None, 0); }
    };
    const designated: number[] = [];
    for (let y = 0; y < map.h; y += 1) for (let x = 0; x < map.w; x += 1) {
      const t = w.index(x, y, z);
      if (map.designationAt(t) === Designation.Dig) designated.push(t);
    }
    dig(designated);
    // The mason's workshop stands, and the stone for a coffin lies in stock.
    for (const t of state.diningHallTiles) { w.carve(t, TileKind.Floor); w.discover(t); }
    const site = state.diningHallTiles.find((t) => buildings.ghost('mason', t, 0).reason === null)!;
    const mason = w.build('mason', site, 'granite');
    state.placedIds['mason'] = mason;
    w.step(1);

    // Nobody has died: nothing is dug or ordered.
    keepTheDead(w, state);
    expect(state.burial?.tombs).toEqual([]);
    const orders = (): string[] => (ent.get(mason, C.Workshop)?.orders ?? []).map((o) => `${w.game.registry.table('recipes').byIndex(o.recipe)?.id}:${o.remaining}`);
    expect(orders()).toEqual([]);

    // A founder dies.
    const victim = w.game.arrival!.dwarves[6]!;
    const hp = ent.get(victim, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: victim, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === victim), 60);
    const corpse = w.events('CorpseCreated').find((e) => e['creatureId'] === victim)!['id'] as number;

    // A tomb is dug off a corridor of the hall level, and the coffins for the body and one ahead are ordered first at the mason's.
    state.burial!.day = -1;
    keepTheDead(w, state);
    expect(state.burial?.dead).toEqual([victim]);
    expect(state.burial?.tombs.length).toBe(1);
    const tomb = state.burial!.tombs[0]!;
    expect(tomb.tiles.length).toBe(TOMB_W * TOMB_H);
    for (const t of tomb.tiles) expect(map.designationAt(t)).toBe(Designation.Dig);
    expect(orders()).toEqual(['make_coffin_stone:2']);

    // Dug: the tomb is zoned, and two coffins are placed in it, each beside an open tile the halls reach.
    dig(tomb.tiles);
    w.step(1);
    state.burial!.day = -1;
    keepTheDead(w, state);
    expect(tomb.zoneId).toBeGreaterThan(0);
    expect(buildings.zone(tomb.zoneId)?.type).toBe('tomb');
    const coffins = buildings.byType('coffin');
    expect(coffins.length).toBe(2);
    for (const id of coffins) {
      const at = buildings.get(id)!.origin;
      expect(tomb.tiles).toContain(at);
      const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => map.offset(at, dx!, dy!, 0))
        .filter((n) => n >= 0 && buildings.at(n) === 0 && map.kindAt(n) === TileKind.Floor);
      expect(beside.length, `coffin at ${map.xOf(at)},${map.yOf(at)} has an open side`).toBeGreaterThan(0);
    }
    // Called again the same day, or the next, nothing more is placed or ordered.
    keepTheDead(w, state);
    state.burial!.day = -1;
    keepTheDead(w, state);
    expect(buildings.byType('coffin').length).toBe(2);
    expect(orders()).toEqual(['make_coffin_stone:2']);

    // The body is gone (lost): a slab naming the dead dwarf is ordered, first, at the mason's.
    w.game.world.services.items?.destroy(corpse, 'rotted');
    w.step(1);
    expect(buildings.memorialEligible(victim)).toBe(true);
    state.burial!.day = -1;
    keepTheDead(w, state);
    expect(orders()[0]).toBe('make_memorial_slab:1');
    expect(ent.get(mason, C.Workshop)?.orders[0]?.memorialDwarfId).toBe(victim);
    expect(state.burial?.memorials).toEqual([victim]);
    state.burial!.day = -1;
    keepTheDead(w, state);
    expect(orders().filter((o) => o.startsWith('make_memorial_slab')).length).toBe(1);
    expect([...scriptRecord(w).rejected]).toEqual([]);
  }, 120_000);
});
