import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { ItemsSystem } from '@systems/items';
import { cmd, pathWorld, playUntil, surfaceZ, wagon, zoneRect } from './player-path';

/**
 * T-676: the Balanced embark, a Food stockpile and an Everything stockpile placed beside the wagon
 * at once, neither wanting containers. The wagon's meals, turnips and meat (whose type wants a
 * barrel) lie loose on a stockpile that takes them, and the wagon is empty within the first days.
 */
describe('T-676 dwarves haul the wagon\'s goods to stockpiles', () => {
  it('a Balanced embark with a Food and an Everything stockpile empties the wagon into them within three days', () => {
    const w = pathWorld('t676');
    const { x: cx, y: cy } = wagon(w);
    const z = surfaceZ(w, cx, cy);
    const items = w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
    const core = items.core;
    const wagonId = (w.readers.of('14') as unknown as { wagon(): number }).wagon();
    const contents = (): readonly number[] => core.container(wagonId)?.contents ?? [];
    const category = (id: number): string => core.host.facts.row(core.get(id)?.type ?? 0).category;
    const food = contents().filter((id) => category(id).startsWith('food/'));
    expect(food.length).toBeGreaterThan(0);

    const foodPile = zoneRect(w, 'stockpile', cx - 7, cy + 3, z, 5, 4);
    cmd(w, { type: 'SetStockpileFilter', zoneId: foodPile, filter: 'food' });
    const goodsPile = zoneRect(w, 'stockpile', cx - 1, cy + 3, z, 9, 7);
    cmd(w, { type: 'SetStockpileFilter', zoneId: goodsPile, filter: 'everything' });
    expect(items.stockpiles.tilesOf(goodsPile).length).toBeGreaterThan(contents().length);

    const emptied = playUntil(w, () => contents().length === 0, 3 * TICKS_PER_DAY);
    const left = contents().map((id) => core.host.facts.row(core.get(id)?.type ?? 0).id);
    expect(left, `still in the wagon on tick ${w.tick}`).toEqual([]);
    expect(emptied).toBe(true);
    // The food the wagon brought lies on a stockpile now (none eaten so soon is missing from the count).
    const stored = food.filter((id) => core.get(id) !== undefined && items.stockpiles.isStored(id));
    const gone = food.filter((id) => core.get(id) === undefined || core.get(id)?.carriedBy !== 0);
    expect(stored.length + gone.length).toBe(food.length);
    expect(stored.length).toBeGreaterThan(0);
  }, 120_000);
});
