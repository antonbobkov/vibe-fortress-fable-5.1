/**
 * T-742: Stocks rows of stacks under T-703's rule (a fact is never cut; a name may end in `»`). A
 * stack row too narrow for its units drops them from its name, as its count column gives them
 * (`barley`, not `barley »`, five levels down); a row of a type with quality names its tier unless it
 * is the plain one (`poor steel` beside `steel`), and the line under the tree names the stack whole.
 */
import { describe, expect, it } from 'vitest';
import type { EntityId } from '@core/types';
import type { PanelContext } from '@ui/panels/context';
import { drawStocksPanel, StocksPanel } from '@ui/panels/stocks';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 32;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd) => { w.game.world.applyCommand(cmd); }, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  return { w, ctx, panel: new StocksPanel(), type: (id: string): number => w.game.registry.table('items').index(id) };
}

/** The rows the tree shows, top to bottom. */
function rows(panel: StocksPanel, ctx: PanelContext): string[] {
  const out: string[] = [];
  panel.tree.selected = 0;
  for (let guard = 0; guard < 500; guard += 1) {
    const node = panel.selectedNode(ctx);
    if (node !== null) out.push(node);
    const before = panel.tree.selected;
    panel.move(1, ctx);
    if (panel.tree.selected === before) break;
  }
  return out;
}

function select(panel: StocksPanel, ctx: PanelContext, node: string): void {
  const at = rows(panel, ctx).indexOf(node);
  if (at < 0) throw new Error(`no row ${node}`);
  panel.tree.selected = at;
}

/** The panel at the sidebar's width, its rows without trailing blanks; the glyph set draws `×` as `x`. */
function draw(panel: StocksPanel, ctx: PanelContext): string[] {
  const s = surface(36, 50);
  drawStocksPanel(s, { col: 0, row: 0, cols: 36, rows: 50 }, panel, ctx);
  return s.lines().map((line) => line.trimEnd());
}

describe('T-742 Stocks stack rows keep their facts and name their quality', () => {
  it('a single stack five levels down drops its units from its name, never cut; the line under the tree names it with them', () => {
    const { w, ctx, panel, type } = setup('t742-deep');
    const bag = w.spawnItem('plant_food', 'barley', w.index(10, 10, Z), 1);
    // Two levels down, a stack's name holds its units.
    const seed = w.spawnItem('seed', 'barley', w.index(11, 10, Z), 1);
    for (const id of ['food', 'food/plant', 'food/plant/raw', `type:${type('plant_food')}`, 'seed', `type:${type('seed')}`]) panel.tree.expanded.add(id);
    const lines = draw(panel, ctx);
    expect(lines.find((line) => line.includes('barley') && line.indexOf('barley') > 10)).toMatch(/^ {11}barley +1 +\d+ ☼$/);
    expect(lines.find((line) => /^ {7}barley x1 /.test(line))).toMatch(/^ {7}barley x1 +1 +\d+ ☼$/);
    expect(lines.join('\n')).not.toContain('»');
    select(panel, ctx, `item:${bag}`);
    expect(panel.rotLine(ctx).text).toMatch(/^barley ×1 · /);
    select(panel, ctx, `item:${seed}`);
    expect(panel.rotLine(ctx).text).toBe('barley ×1');
  });

  it('greaves of two qualities read apart: the plain tier goes unnamed, another is named first; the line under the tree names the tier', () => {
    const { w, ctx, panel, type } = setup('t742-quality');
    const poor: EntityId[] = [0, 1].map((k) => w.spawnItem('greaves', 'steel', w.index(10 + k, 10, Z), 1, 0));
    for (let k = 0; k < 3; k += 1) w.spawnItem('greaves', 'steel', w.index(10 + k, 11, Z), 1, 1);
    const masterwork = w.spawnItem('greaves', 'steel', w.index(10, 12, Z), 1, 5);
    for (const id of ['armor', 'armor/legs', `type:${type('greaves')}`]) panel.tree.expanded.add(id);
    const lines = draw(panel, ctx);
    expect(lines.find((line) => line.includes('poor steel'))).toMatch(/^ {7}. poor steel +2 +[\d,]+ ☼$/);
    expect(lines.find((line) => /^ {7}. steel /.test(line))).toMatch(/^ {7}. steel +3 +[\d,]+ ☼$/);
    // "masterwork steel" does not fit three levels down: the line under the tree names it whole.
    expect(lines.some((line) => /^ {9}masterwo/.test(line))).toBe(true);
    const groups = rows(panel, ctx).filter((id) => id.startsWith('stacks:'));
    expect(groups).toHaveLength(2);
    const poorRow = groups.find((id) => panel.rowItems(ctx, id).includes(poor[0] as EntityId)) as string;
    select(panel, ctx, poorRow);
    expect(panel.rotLine(ctx).text).toBe('poor · 2 stacks');
    select(panel, ctx, groups.find((id) => id !== poorRow) as string);
    expect(panel.rotLine(ctx).text).toBe('3 stacks');
    select(panel, ctx, `item:${masterwork}`);
    expect(panel.rotLine(ctx).text).toBe('masterwork steel ×1');
  });

  it('a line under the tree too long for its row wraps, the tree giving up a row', () => {
    const { w, ctx, panel, type } = setup('t742-wrap');
    // Masterwork meals that rot, in several stacks: the line names the tier, the stacks and what rots.
    for (let k = 0; k < 2; k += 1) w.spawnItem('lavish_meal', 'barley', w.index(10 + k, 10, Z), 20, 5);
    for (const id of ['food', 'food/meal', 'food/meal/lavish', `type:${type('lavish_meal')}`]) panel.tree.expanded.add(id);
    const group = rows(panel, ctx).find((id) => id.startsWith('stacks:')) as string;
    select(panel, ctx, group);
    const text = panel.rotLine(ctx).text;
    expect(text).toMatch(/^masterwork · \d+ stacks · \d+ rot within 3 days$/);
    expect(Array.from(text).length).toBeGreaterThan(34);
    const lines = draw(panel, ctx);
    const at = lines.findIndex((line) => line.trim().startsWith('masterwork · '));
    expect(`${lines[at]?.trim() ?? ''} ${lines[at + 1]?.trim() ?? ''}`).toBe(text);
    expect(lines.join('\n')).not.toMatch(/stacks.*»/);
  });
});
