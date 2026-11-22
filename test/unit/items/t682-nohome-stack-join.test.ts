/**
 * T-682: an item judged to have no home because a stockpile's last empty tile was reserved is looked at
 * again when the haul that held the tile leaves a loose stack it can join (13 § Stockpiles): the second
 * bolt gets its haul job within a few items ticks of the first bolt's delivery, not on the next stockpile
 * change.
 */

import { describe, expect, it } from 'vitest';
import type { ItemsReader, ItemsSystem } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function sys(w: TestWorld): ItemsSystem {
  return w.game.world.scheduler.byId('13') as unknown as ItemsSystem;
}

describe('T-682 an item judged full is looked at again when a stack it could join arrives', () => {
  it('the second bolt, judged full while the one tile was reserved, gets a haul job once the first bolt lies there', () => {
    const w = new TestWorld({ seed: 't682', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.readers.of<ItemsReader>('13');
    const h = sys(w).hauling;
    const tile = w.index(10, 10, Z);
    const sp = w.zone('stockpile', [tile]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: 'weapons_and_armor' } as never).ok).toBe(true);
    const first = w.spawnItem('bolt', 'oak', w.index(16, 12, Z), 5);
    const second = w.spawnItem('bolt', 'oak', w.index(24, 14, Z), 5);
    w.spawnDwarf({ at: w.index(14, 12, Z) });
    w.step(2);
    // The first bolt holds the one empty tile; the second finds no room and has no home.
    expect(w.game.world.services.jobs.exists(`haul:${first}`)).toBe(true);
    expect(h.noHome).toContain(second);
    expect(items.haulState(second)).toBe('full');
    w.until(() => items.tileOf(first) === tile && items.get(first)?.carriedBy === 0 && !w.game.world.services.jobs.exists(`haul:${first}`), 2000);
    // Within a few items ticks (a cadence of 10) of the delivery the second bolt is on its way to join the stack.
    const waited = w.until(() => w.game.world.services.jobs.exists(`haul:${second}`), 30);
    expect(waited).toBeLessThan(30);
    expect(h.noHome).not.toContain(second);
    w.until(() => items.get(second) === undefined, 2000);
    expect(items.get(first)?.count).toBe(10);
  });
});
