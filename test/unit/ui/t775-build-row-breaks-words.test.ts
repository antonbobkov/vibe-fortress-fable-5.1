/**
 * T-775: a Build row too long for its line wraps between words. The count ("(no mechanism)") goes to
 * a row of its own when it does not fit after the last input; it is never cut in the middle of a word
 * (`reports/data/2026-11-25-playtest-6.md`, finding 8; `fortress-screen.md` § Build tool).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { wrapHang } from '@ui/messages';
import { BUILD_CATEGORIES, BuildTool, buildRowLines, drawBuildPanel, inputText } from '@ui/panels/build';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** A fortress with nothing in stock: every figure reads "(no …)", the longest a row can be. */
function emptyFortress(): PanelContext {
  return ctxOf(new TestWorld({ seed: 't775-build', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' }));
}

/** A row's text as the panel draws it ({@link drawBuildPanel}), laid out for `width` cells. */
function rowText(ctx: PanelContext, tool: BuildTool, index: number, width: number): string {
  const r = tool.rows(ctx)[index];
  if (r === undefined) throw new Error('no such row');
  const figure = tool.countText(ctx, r);
  return buildRowLines(r.name.charAt(0).toUpperCase() + r.name.slice(1), inputText(r, ctx.registry, ctx.strings), figure === '' ? '' : ` (${figure})`, width);
}

describe('T-775 a Build row wraps between words', () => {
  it('the Traps rows at 31 cells with no mechanism wrap as "1 mechanism+1 cage" / "(no mechanism)"', () => {
    const ctx = emptyFortress();
    const tool = new BuildTool();
    tool.category = 'trap';
    // 33 columns: the list is 31 cells wide, as in the 36-column sidebar with its scroll bar.
    const s = surface(33, 30);
    drawBuildPanel(s, { col: 0, row: 0, cols: 33, rows: 30 }, tool, ctx);
    const lines = s.lines().map((line) => line.replace(/ /g, ' ').trimEnd());
    const rowOf = (name: string, n: number): string[] => {
      const at = lines.findIndex((line) => line.trimStart().startsWith(name));
      expect(at).toBeGreaterThan(0);
      return lines.slice(at, at + n);
    };
    // The inputs follow the name where they fit; the count takes the next row, hung two cells in.
    expect(rowOf('Cage trap', 2)).toEqual([' Cage trap 1 mechanism+1 cage', '   (no mechanism)']);
    expect(rowOf('Stone-fall trap', 3)).toEqual([' Stone-fall trap', '   1 mechanism+1 stone', '   (no mechanism)']);
    expect(rowOf('Weapon trap', 3)).toEqual([' Weapon trap', '   1 mechanism+1 weapon', '   (no mechanism)']);
    expect(lines.join('\n')).not.toMatch(/mechanis$|^ *m\)|^ *sm\)|^ *ism\)/m);
  });

  it('no row of the six categories at 31 cells has a line that ends inside a word', () => {
    const ctx = emptyFortress();
    let checked = 0;
    for (const category of BUILD_CATEGORIES) {
      const tool = new BuildTool();
      tool.category = category.id;
      const n = tool.rows(ctx).length;
      expect(n).toBeGreaterThan(0);
      for (let k = 0; k < n; k += 1) {
        const text = rowText(ctx, tool, k, 31);
        const lines = wrapHang(text, 31, 2);
        for (const line of lines) expect(Array.from(line).length).toBeLessThanOrEqual(31);
        // Rejoined with a space at each break, the lines give the row back: every break was at a space.
        expect(lines.map((line) => line.replace(/^ +| +$/g, '')).join(' ')).toBe(text);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('the count keeps its words together; a row that fits keeps its one line', () => {
    expect(buildRowLines('Cage trap', '1 mechanism+1 cage', ' (no mechanism)', 31)).toBe('Cage trap 1 mechanism+1 cage (no mechanism)');
    expect(wrapHang(buildRowLines('Drawbridge', 'n blocks+1 mechanism', ' (no mechanism)', 31), 31, 2)).toEqual([
      'Drawbridge n blocks+1 mechanism', '  (no mechanism)',
    ]);
    expect(buildRowLines('Loom', '2 logs', ' (5)', 20)).toBe('Loom      2 logs (5)');
  });
});
