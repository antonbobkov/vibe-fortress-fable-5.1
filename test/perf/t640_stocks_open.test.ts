/**
 * T-640: how long the Stocks panel takes to draw on the 80-dwarf furniture fixture's 25,000 items
 * (the T-635 audit timed 285–310 ms from the key to the changed screen, against 130–160 ms for every
 * other panel). It prints the first draw of a fresh panel, a second draw in the same tick (the next
 * frame while paused), a draw with the largest category opened, one with the type of most stacks
 * opened (T-645), one with a filter, and the first draw split into the per-tick totals and the draw
 * that follows them. A probe, not a budget: it asserts only the fixture's size.
 *
 *   npx vitest run -c vitest.perf.config.ts test/perf/t640_stocks_open.test.ts
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { computeLayout } from '@render/cellbuffer';
import type { ItemsReader } from '@systems/items';
import { drawStocksPanel } from '@ui/panels/stocks';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { keymap, strings, surface } from '../unit/ui/ui-fixture';
import { ensureScriptedFurniture } from './scripted-furniture';

describe('T-640 Stocks open time on the furniture fixture', () => {
  it('prints the first, the next and an opened draw', async () => {
    const now = (): number => performance.now();
    const game = await ensureScriptedFurniture(now);
    const world = game.world;
    const items = world.entities.with(C.Item).length;
    expect(items).toBeGreaterThanOrEqual(25_000);
    const host: FortressHost = {
      readers: world.readers, registry: game.registry, ui: defaultUiState(0), submit: () => {},
      speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 50, true), precondition: () => true,
      registeredPanels: () => world.registrations.panels, announcements: () => world.registrations.announcements, now: () => 0,
    };
    const rect = { col: 0, row: 0, cols: 36, rows: 44 };
    const time = (f: FortressScreen): number => {
      const s = surface(36, 44);
      const start = performance.now();
      drawStocksPanel(s, rect, f.stocks, f.ctx);
      return performance.now() - start;
    };
    const rows: Record<string, number>[] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      const f = new FortressScreen(host, keymap, strings);
      f.openPanel('stocks');
      const first = time(f);
      const next = time(f);
      // The largest category opened: its types and their stacks are rows.
      const totals = f.stocks.totals(f.ctx).totals;
      const biggest = [...totals].filter(([id]) => !id.includes('/')).sort((a, b) => b[1].count - a[1].count)[0]?.[0] ?? '';
      f.stocks.tree.expanded.add(biggest);
      const opened = time(f);
      // T-645: the type with the most stacks opened, down its path: its stacks are rows.
      const { itemIds } = f.stocks.totals(f.ctx);
      const type = [...itemIds].sort((a, b) => b[1].length - a[1].length)[0]?.[0] ?? 0;
      const reader = f.ctx.readers.of<ItemsReader>('13');
      const parts = reader.categoryOf(type).split('/');
      for (let k = 1; k <= parts.length; k += 1) f.stocks.tree.expanded.add(parts.slice(0, k).join('/'));
      f.stocks.tree.expanded.add(`type:${type}`);
      const typeOpened = time(f);
      // A filter: every stack's name is matched.
      f.stocks.filter.value = 'o';
      const filtered = time(f);
      // T-645: the first draw split: the per-tick totals alone, then the draw that follows them.
      const g = new FortressScreen(host, keymap, strings);
      g.openPanel('stocks');
      const start = performance.now();
      g.stocks.totals(g.ctx);
      const totalsMs = performance.now() - start;
      const afterTotals = time(g);
      rows.push({ pass, first: Math.round(first), next: Math.round(next), opened: Math.round(opened), typeOpened: Math.round(typeOpened),
        stacks: itemIds.get(type)?.length ?? 0, filtered: Math.round(filtered), totals: Math.round(totalsMs), afterTotals: Math.round(afterTotals) });
    }
    console.log(`t640_stocks_open: ${JSON.stringify({ items, rows })}`);
  });
});
