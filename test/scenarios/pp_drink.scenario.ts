/**
 * Player path: drink (T-330; `docs/process/player-paths.md`).
 *
 * From the Balanced embark on a compact generated forest region, by commands only: the wagon's
 * own drink is forbidden (kept for later, as a player may), so that a dwarf who drinks alcohol
 * drinks the fortress's brew; a stockpile that wants two barrels; a stair down to the first rock and a small room dug
 * there for stone; a carpenter's workshop that makes barrels; a still; and an order to brew. The
 * still brews the wagon's dimcaps.
 *
 * Asserted, as a player sees it, within a season: the still brewed drink into a barrel, and a
 * dwarf drank it. Wild animals stay on.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { Scenario } from './runner';
import { built, cmd, day, expectNoInvariantFindings, pathWorld, placeNear, playUntil, rect, stairToRock, surfaceZ, trace, wagon, zoneRect } from './player-path';

const scenario: Scenario = {
  id: 'pp_drink',
  milestone: 8,
  seed: 'pp-drink',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-drink');
    const { x: cx, y: cy } = wagon(w);
    const ent = w.game.world.entities;
    const itemTypes = w.game.registry.table('items');
    const drinkType = itemTypes.index('drink');

    const wagonDrink = ent.with(C.Item).filter((id) => ent.get(id, C.Item)!.type === drinkType);
    const units = (): number => wagonDrink.reduce((n, id) => n + (ent.alive(id) ? ent.get(id, C.Item)?.count ?? 0 : 0), 0);
    const wagonUnits = units();
    for (const itemId of wagonDrink) cmd(w, { type: 'ForbidItem', itemId, on: true });

    // Room for the wagon's goods and the logs, with slots left for the brew: on a full pile it stays at the still.
    const stockpile = zoneRect(w, 'stockpile', cx - 4, cy + 3, surfaceZ(w, cx, cy), 10, 6);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    // Drink keeps in a barrel on a stockpile (13 § Stockpiles), where 10's drink search looks first.
    cmd(w, { type: 'SetStockpileContainers', zoneId: stockpile, wants: { barrel: 2 } });
    const { sx, sy, rockZ } = stairToRock(w, cx + 4, cy + 8);
    cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: rect(w, sx + 1, sy - 1, rockZ, 3, 3) });
    const avoid = new Set<number>();
    const carpenter = placeNear(w, 'carpenter', cx - 6, cy + 12, avoid);
    const still = placeNear(w, 'still', cx + 2, cy + 14, avoid);
    // Timber for the barrels: the trees nearest the wagon.
    const trees: number[] = [];
    for (let y = 1; y < w.map.h - 1; y += 1) for (let x = 1; x < w.map.w - 1; x += 1) {
      const t = w.index(x, y, surfaceZ(w, x, y));
      if (w.map.kindAt(t) === TileKind.Tree) trees.push(t);
    }
    const near = (t: number): number => Math.abs(w.map.xOf(t) - cx) + Math.abs(w.map.yOf(t) - cy);
    trees.sort((a, b) => near(a) - near(b) || a - b);
    if (trees.length > 0) cmd(w, { type: 'Designate', kind: 'chop', priority: 4, tiles: trees.slice(0, 6) });

    const ordered = new Set<string>();
    const brewed = (): EntityId[] => w.events('ItemCrafted').filter((e) => e['recipeId'] === 'brew').map((e) => Number(e['itemId']));
    const plantDrink = (): Set<string> => new Set(brewed().map((id) => w.events('ItemCreated').find((e) => Number(e['id']) === id)?.['material'] as string));
    const drunk = (): number => w.events('DrankAlcohol').filter((e) => {
      const material = w.game.registry.table<{ id: string }>('materials').byIndex(Number(e['material']))?.id ?? String(e['material']);
      return plantDrink().has(material);
    }).length;
    const barrelType = itemTypes.index('barrel');
    const barrelled = new Set<EntityId>();
    const finished = playUntil(w, () => drunk() > 0, DAYS_PER_SEASON * TICKS_PER_DAY, () => {
      for (const id of brewed()) {
        const containerId = ent.alive(id) ? ent.get(id, C.Item)?.containerId ?? 0 : 0;
        if (containerId !== 0 && ent.get(containerId, C.Item)?.type === barrelType) barrelled.add(id);
      }
      if (!ordered.has('carpenter') && built(w, carpenter)) {
        ordered.add('carpenter');
        cmd(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_barrel', mode: 'once', remaining: 2 } });
      }
      if (!ordered.has('still') && built(w, still)) {
        ordered.add('still');
        cmd(w, { type: 'AddWorkOrder', workshopId: still, order: { recipeId: 'brew', mode: 'once', remaining: 2 } });
      }
    }, 100);

    const summary = `${trace(w, 'pp_drink')}; carpenter ${built(w, carpenter)}, still ${built(w, still)}; brewed ${brewed().length} ` +
      `(${[...plantDrink()].join(',')}), in a barrel ${barrelled.size}; drunk ${drunk()}; water drunk ${w.events('DrankWater').length}`;
    console.log(summary);
    expect(brewed().length, `the still brewed; ${summary}`).toBeGreaterThan(0);
    expect(units(), `the wagon's forbidden drink was left alone; ${summary}`).toBe(wagonUnits);
    expect(barrelled.size, `the brew stood in a barrel; ${summary}`).toBeGreaterThan(0);
    expect(finished, `a dwarf drank the brew by day ${DAYS_PER_SEASON}; ${summary}`).toBe(true);
    // T-350: since dwarves can drink at the brook, they walk to its bank
    // whenever no stocked barrel is in reach, and the whole timeline moved: a boar now kills a dwarf
    // on day 15, hit while fleeing at (37, 26), away from the bank. Which dwarf a boar meets turns
    // on that timeline (testing-strategy.md § What may be a gate), so the deaths are in the summary
    // and the chain's own outcome is asserted: nobody dies of thirst or hunger.
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    expect(w.events('CreatureDied').filter((e) => e['species'] === dwarf && e['cause'] === 'starvation').length, `no dwarf died of thirst or hunger; ${summary}`).toBe(0);
    expectNoInvariantFindings(w, `pp_drink day ${day(w)}`);
  },
};

export default scenario;
