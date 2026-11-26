/**
 * T-774: Stocks listed "weapon 10" and "ammo 21" with no `►` and could not open them (playtest
 * 2026-11-25, finding 7): melee weapons were filed under their class and ammunition under its kind,
 * nodes 13's category tree does not have. They now file under `weapon/melee` and `ammo` (13 §
 * Category tree), so Stocks opens them as every other category, and a stockpile set to
 * `weapon/melee` alone takes swords and spears and no crossbow.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import type { ItemsReader } from '@systems/items';
import type { PanelContext } from '@ui/panels/context';
import { drawStocksPanel, StocksPanel } from '@ui/panels/stocks';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 32;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  const items = {
    sword: w.spawnItem('short_sword', 'copper', w.index(10, 10, Z)),
    spear: w.spawnItem('spear', 'copper', w.index(11, 10, Z)),
    crossbow: w.spawnItem('crossbow', 'oak', w.index(12, 10, Z)),
    arrows: w.spawnItem('arrow', 'oak', w.index(13, 10, Z), 20),
  };
  return { w, ctx, panel: new StocksPanel(), items };
}

function draw(panel: StocksPanel, ctx: PanelContext, cols = 36): string[] {
  const s = surface(cols, 50);
  drawStocksPanel(s, { col: 0, row: 0, cols, rows: 50 }, panel, ctx);
  return s.lines().map((line) => line.trimEnd());
}

/** The drawn row whose name, after its indent and arrow, is `name`. */
function row(lines: readonly string[], name: string): string | undefined {
  return lines.find((line) => new RegExp(`^ *(?:[►▼] )?${name} {2,}[0-9]`).test(line));
}

describe('T-774 Stocks opens weapons and ammunition', () => {
  it('weapon opens to melee (short sword, spear) and ranged (crossbow); ammo opens to arrow', () => {
    const { w, ctx, panel } = setup('t774-stocks');
    w.step(1);
    const closed = draw(panel, ctx);
    expect(row(closed, 'weapon')).toMatch(/^ *► weapon /);
    expect(row(closed, 'ammo')).toMatch(/^ *► ammo /);
    for (const node of ['weapon', 'weapon/melee', 'weapon/ranged', 'ammo']) panel.tree.expanded.add(node);
    const open = draw(panel, ctx);
    expect(row(open, 'melee')).toMatch(/^ +▼ melee +2 /);
    expect(row(open, 'ranged')).toMatch(/^ +▼ ranged +1 /);
    for (const name of ['short sword', 'spear', 'crossbow', 'arrow']) expect(row(open, name), name).toBeDefined();
    // Each type sits under its node: the short sword and the spear between melee and ranged, the arrow after ammo.
    const at = (name: string): number => open.indexOf(row(open, name) as string);
    expect(at('melee')).toBeLessThan(at('short sword'));
    expect(at('melee')).toBeLessThan(at('spear'));
    expect(Math.max(at('short sword'), at('spear'))).toBeLessThan(at('ranged'));
    expect(at('ranged')).toBeLessThan(at('crossbow'));
    expect(at('ammo')).toBeLessThan(at('arrow'));
  });

  it('a stockpile set to weapon/melee alone takes the sword and the spear and not the crossbow or the arrows', () => {
    const { w, items } = setup('t774-filter');
    const tiles = [0, 1, 2, 3].map((k) => w.index(20 + k, 20, Z));
    const sp = w.zone('stockpile', tiles);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['weapon/melee'] } })).toEqual({ ok: true });
    const reader = w.readers.of<ItemsReader>('13');
    expect(reader.stockpileAccepts(sp, items.sword)).toBe(true);
    expect(reader.stockpileAccepts(sp, items.spear)).toBe(true);
    expect(reader.stockpileAccepts(sp, items.crossbow)).toBe(false);
    expect(reader.stockpileAccepts(sp, items.arrows)).toBe(false);
    // And one set to ammo takes the arrows alone.
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: sp, filter: { categories: ['ammo'] } })).toEqual({ ok: true });
    expect(reader.stockpileAccepts(sp, items.arrows)).toBe(true);
    expect(reader.stockpileAccepts(sp, items.sword)).toBe(false);
  });

  it('every weapon row files under weapon/melee or weapon/ranged, and every ammunition under ammo', () => {
    const { w } = setup('t774-rows');
    const items = w.game.registry.table<{ id: string; category: string }>('items');
    const weapons = w.game.registry.table<{ id: string; launcher?: unknown }>('weapons').rows.filter((row) => row !== undefined);
    for (const row of weapons) {
      if (row.id === 'pick' || row.id === 'axe') continue; // items.md's tools, restated as weapons
      expect(items.byId(row.id)?.category, row.id).toBe(row.launcher === undefined ? 'weapon/melee' : 'weapon/ranged');
    }
    for (const row of w.game.registry.table<{ id: string }>('ammo').rows.filter((r) => r !== undefined)) expect(items.byId(row.id)?.category, row.id).toBe('ammo');
  });
});
