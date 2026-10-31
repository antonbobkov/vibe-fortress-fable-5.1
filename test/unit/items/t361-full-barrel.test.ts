import { describe, it, expect } from 'vitest';
import { C } from '@core/components';
import { haulKey, type ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';
import { threeYearsWorld } from '../../scenarios/three_years_fortress';

const Z = 32;

function items(w: TestWorld): ItemsReader {
  return w.readers.of<ItemsReader>('13');
}

function apply(w: TestWorld, cmd: Record<string, unknown>): { ok: boolean } {
  return w.game.world.applyCommand(cmd as never) as { ok: boolean };
}

/** A barrel of ale standing off any stockpile, as a brew leaves it at the still. */
function fullBarrel(w: TestWorld, tile: number, count = 20): { barrel: number; ale: number } {
  const barrel = w.spawnItem('barrel', 'oak', tile);
  const ale = w.spawnItem('drink', 'ale', tile, count);
  expect(w.game.world.services.items?.putIn(ale, barrel)).toBe(true);
  return { barrel, ale };
}

/** A drink stockpile that wants a barrel on every tile, and holds them, empty. */
function lockedPile(w: TestWorld, tiles: number[]): { sp: number; barrels: number[] } {
  const sp = w.zone('stockpile', tiles);
  apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
  apply(w, { type: 'SetStockpileContainers', zoneId: sp, wants: { barrel: tiles.length } });
  return { sp, barrels: tiles.map((t) => w.spawnItem('barrel', 'oak', t)) };
}

describe('T-361 drink in a barrel off any stockpile reaches a drink stockpile', () => {
  it('goes whole to a free tile of a drink stockpile', () => {
    const w = new TestWorld({ seed: 't361-free', world: 'flat-test', embark: 'default' });
    const sp = w.zone('stockpile', rect(w, 50, 20, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: sp, filter: 'drink' });
    const { barrel, ale } = fullBarrel(w, w.index(44, 14, Z));
    w.until(() => items(w).stockpileAt(items(w).tileOf(barrel)) === sp, 2500);
    expect(items(w).containerOf(ale)).toBe(barrel);
  });

  it('goes by its stack into the barrels of a stockpile that wants one on every tile', () => {
    const w = new TestWorld({ seed: 't361-wanted', world: 'flat-test', embark: 'default' });
    const { sp, barrels } = lockedPile(w, rect(w, 50, 20, Z, 2, 1));
    const { barrel, ale } = fullBarrel(w, w.index(44, 14, Z));
    w.until(() => barrels.includes(items(w).containerOf(ale)), 4000);
    expect(items(w).stockpileAt(items(w).tileOf(ale))).toBe(sp);
    // Its own barrel is left empty, free for the next brew.
    expect(w.game.world.entities.get(barrel, C.Container)?.contents).toEqual([]);
  });

  it('keeps its barrel while the stack is on its way, though a free tile appears', () => {
    const w = new TestWorld({ seed: 't361-reserved', world: 'flat-test', embark: 'default' });
    const { barrels } = lockedPile(w, rect(w, 50, 20, Z, 2, 1));
    const { barrel, ale } = fullBarrel(w, w.index(44, 14, Z));
    const jobs = (): JobsReader => w.readers.of<JobsReader>('11');
    w.until(() => jobs().byKey(haulKey(ale)) !== undefined, 2000);
    // A drink stockpile with a free tile appears while the stack has its job.
    const free = w.zone('stockpile', rect(w, 50, 24, Z, 2, 2));
    apply(w, { type: 'SetStockpileFilter', zoneId: free, filter: 'drink' });
    let barrelHauled = false;
    w.until(() => {
      if (jobs().byKey(haulKey(barrel)) !== undefined && jobs().byKey(haulKey(ale)) !== undefined) barrelHauled = true;
      return barrels.includes(items(w).containerOf(ale));
    }, 4000);
    expect(barrelHauled, 'no haul of the barrel while its stack has one').toBe(false);
  });

  it('stays in its barrel on a stockpile that accepts it', () => {
    const w = new TestWorld({ seed: 't361-stays', world: 'flat-test', embark: 'default' });
    const tiles = rect(w, 50, 20, Z, 3, 1);
    const { barrels } = lockedPile(w, tiles.slice(0, 2));
    const pile = w.zone('stockpile', tiles.slice(2));
    apply(w, { type: 'SetStockpileFilter', zoneId: pile, filter: 'drink' });
    const { barrel, ale } = fullBarrel(w, tiles[2]!, 10);
    w.step(600);
    expect(items(w).containerOf(ale)).toBe(barrel);
    expect(barrels.every((b) => (w.game.world.entities.get(b, C.Container)?.contents.length ?? 0) === 0)).toBe(true);
  });

  it('on the three-year map, thirsty dwarves drink the brew from the stockpile and not the brook', () => {
    // Level ground: the test lays its pile and barrel out by hand at one level beside the wagon.
    const w = threeYearsWorld('three-years', 0, undefined, 0);
    const ent = w.game.world.entities;
    const drink = w.game.registry.table('items').index('drink');
    for (const id of ent.with(C.Item).filter((i) => ent.get(i, C.Item)?.type === drink)) w.game.world.services.items?.destroy(id, 'consumed');
    const wagon = w.game.arrival!.wagon;
    const { barrels } = lockedPile(w, rect(w, wagon.x + 2, wagon.y + 3, Z, 2, 1));
    const { ale } = fullBarrel(w, w.index(wagon.x - 2, wagon.y + 3, Z));
    w.until(() => barrels.includes(items(w).containerOf(ale)), 3000);
    const before = w.events('DrankWater').length;
    for (const id of ent.with(C.Labors)) w.setNeed(id, 'thirst', 90);
    w.until(() => w.events('DrankAlcohol').length > 0, 1200);
    expect(w.events('DrankWater').length).toBe(before);
  });
});
