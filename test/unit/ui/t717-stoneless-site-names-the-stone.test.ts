/**
 * T-717: on a site with no surface stone the game says stone is what is missing. A blocked job
 * names the input that is short, not the first undelivered one (`11` § Player-facing behavior,
 * `panels.md` § Jobs); the Build list's figure counts every input (`fortress-screen.md` § Build
 * tool); the advice for stone or blocks no workshop at hand can make says where the rock is; and
 * Stocks files soil loads under a row of their own (`panels.md` § Stocks).
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import type { BuildingsReader } from '@systems/buildings';
import { siteSummary } from '@systems/embark';
import type { TerrainReader } from '@systems/terrain';
import { jobBlockText, workshopBlockText } from '@ui/messages';
import { BuildTool, drawBuildPanel } from '@ui/panels/build';
import type { PanelContext } from '@ui/panels/context';
import { StocksPanel } from '@ui/panels/stocks';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 25;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** The soil depth the site panel gives for the test map (03 stage 3). */
function soilDepth(w: TestWorld): number {
  const spec = w.readers.of<TerrainReader>('03').spec();
  if (spec === null) throw new Error('the test map has no site');
  return siteSummary(spec, w.game.registry).soil?.depth ?? 0;
}

/** A still's build job as 14 makes it: an empty barrel, then a stone. */
function stillJob(w: TestWorld) {
  const b = w.readers.of<BuildingsReader>('14');
  return {
    type: w.game.registry.table('jobTypes').index('build'),
    blockedReason: 'missing_input',
    tool: null,
    inputs: [
      { filter: { types: b.inputTypes('barrel') }, count: 1, reserved: [], delivered: [] },
      { filter: { types: b.inputTypes('raw_stone') }, count: 1, reserved: [], delivered: [] },
    ],
  };
}

/** The build tool with a workshop picked from the Workshops list. */
function workshopTool(ctx: PanelContext, id: string): BuildTool {
  const tool = new BuildTool();
  tool.category = 'workshop';
  tool.list.selected = tool.rows(ctx).findIndex((r) => r.id === id);
  expect(tool.current(ctx)?.id).toBe(id);
  tool.arm();
  return tool;
}

describe('T-717 a blocked job names the input that is short', () => {
  it('a still with barrels in stock and no stone waits for the stone, and says to dig down to rock', () => {
    const w = world('t717-still');
    const ctx = ctxOf(w);
    w.spawnItem('barrel', 'oak', w.index(30, 30, Z), 1);
    w.spawnItem('barrel', 'oak', w.index(31, 30, Z), 1);
    const text = jobBlockText(ctx, stillJob(w));
    expect(text.short).toBe('waiting: 1 stone');
    const depth = soilDepth(w);
    expect(depth).toBeGreaterThan(0);
    expect(text.long).toBe(`waiting: 1 stone — dig down to rock: the soil here is ${depth} levels deep`);
  });

  it('with a barrel and a stone in stock and neither delivered, the barrel waits to be brought', () => {
    const w = world('t717-brought');
    const ctx = ctxOf(w);
    w.spawnItem('barrel', 'oak', w.index(30, 30, Z), 1);
    w.spawnItem('raw_stone', 'granite', w.index(31, 30, Z), 1);
    const text = jobBlockText(ctx, stillJob(w));
    expect(text.short).toBe('waiting: 1 barrel to be brought');
    expect(text.long).toBe(text.short);
  });

  it('with neither in stock, the first short input is named, with the workshops that make it', () => {
    const w = world('t717-neither');
    const text = jobBlockText(ctxOf(w), stillJob(w));
    expect(text.short).toBe('waiting: 1 barrel');
    expect(text.long).toMatch(/^waiting: 1 barrel — order at a carpenter's workshop/);
  });
});

describe('T-717 the Build list counts every input', () => {
  it('the still reads "(no stone)" with barrels in stock; with both, how many the stock allows', () => {
    const w = world('t717-list');
    const ctx = ctxOf(w);
    w.spawnItem('barrel', 'oak', w.index(30, 30, Z), 6);
    const row = (): string => {
      const tool = new BuildTool();
      tool.category = 'workshop';
      const s = surface(36, 60);
      drawBuildPanel(s, { col: 0, row: 0, cols: 36, rows: 60 }, tool, ctx);
      const lines = s.lines().map((line) => line.trimEnd());
      const at = lines.findIndex((line) => line.trimStart().startsWith('Still'));
      // A row whose inputs do not fit wraps them under the name, indented two cells.
      const next = lines[at + 1] ?? '';
      return /^ {3}\S/.test(next) ? `${(lines[at] ?? '').trim()} ${next.trim()}` : (lines[at] ?? '').trim();
    };
    expect(row()).toMatch(/^Still +1 barrel\+1 stone \(no stone\)$/);
    // Six barrels and two stones: two stills, the stone the scarcer.
    w.spawnItem('raw_stone', 'granite', w.index(31, 30, Z), 2);
    w.step(1);
    expect(row()).toMatch(/^Still +1 barrel\+1 stone \(2\)$/);
  });
});

describe('T-717 where stone comes from', () => {
  it('placing a mason\'s workshop on a site with no stone says to dig down to rock, not to build a workshop that needs stone', () => {
    const w = world('t717-mason');
    const ctx = ctxOf(w);
    const tool = workshopTool(ctx, 'mason');
    tool.placed(ctx, 1);
    const offer = tool.offer(ctx);
    expect(offer).not.toBeNull();
    const text = tool.offerText(ctx, offer!, 'o');
    expect(text.stock).toBe('0 stone or block in stock: 1 will wait');
    expect(text.action).toBe(`dig down to rock: the soil here is ${soilDepth(w)} levels deep`);
    expect(text.action).not.toContain('workshop');
  });

  it('a workshop order waiting for stone or blocks says the same, never a workshop that needs blocks itself', () => {
    const w = world('t717-order');
    const ctx = ctxOf(w);
    const dig = `dig down to rock: the soil here is ${soilDepth(w)} levels deep`;
    expect(workshopBlockText(ctx, 'waiting for raw_stone')).toBe(`Waiting for stone (0 available) — ${dig}`);
    expect(workshopBlockText(ctx, 'waiting for stone_block')).toBe(`Waiting for block (0 available) — ${dig}`);
    // With stone in stock a mason's workshop can be built: blocks are ordered there.
    w.spawnItem('raw_stone', 'granite', w.index(30, 30, Z), 4);
    expect(workshopBlockText(ctx, 'waiting for stone_block')).toBe("Waiting for block (0 available) — order at a mason's workshop");
  });

  it('placing a still with barrels in stock counts the stone, the input the stock lacks', () => {
    const w = world('t717-still-place');
    const ctx = ctxOf(w);
    w.spawnItem('barrel', 'oak', w.index(30, 30, Z), 6);
    const tool = workshopTool(ctx, 'still');
    tool.placed(ctx, 1);
    const text = tool.offerText(ctx, tool.offer(ctx)!, 'o');
    expect(text).toEqual({ stock: '0 stones in stock: 1 will wait', action: `dig down to rock: the soil here is ${soilDepth(w)} levels deep` });
  });
});

describe('T-717 Stocks files soil loads under soil', () => {
  it('the stone row counts only stone; the soil loads are a top-level soil row after it', () => {
    const w = world('t717-stocks');
    const ctx = ctxOf(w);
    w.spawnItem('soil_load', 'silt', w.index(30, 30, Z), 1);
    w.spawnItem('soil_load', 'peat', w.index(31, 30, Z), 1);
    w.spawnItem('soil_load', 'clay', w.index(32, 30, Z), 1);
    w.spawnItem('raw_stone', 'granite', w.index(33, 30, Z), 2);
    w.step(1);
    const stocks = new StocksPanel();
    const roots = stocks.visibleForest(ctx).map((n) => n.id);
    expect(roots).toContain('soil');
    expect(roots.indexOf('soil')).toBe(roots.indexOf('stone') + 1);
    const { totals } = stocks.totals(ctx);
    expect(totals.get('stone')?.count).toBe(2);
    expect(totals.get('soil')?.count).toBe(3);
    expect(totals.get('stone/soil')).toBeUndefined();
    // The soil row holds the load type itself.
    const soil = stocks.visibleForest(ctx).find((n) => n.id === 'soil');
    expect(soil?.children.map((c) => c.name)).toEqual(['load']);
  });
});
