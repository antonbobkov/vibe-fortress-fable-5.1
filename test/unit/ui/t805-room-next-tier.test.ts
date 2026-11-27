/** T-805: the room inspector says the next tier, the enclosure multiplier and one step that raises the score. */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { TileFlag, TileKind } from '@core/map3d';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { BuildingsReader } from '@systems/buildings';
import { drawZonesPanel, roomRaiseLines, ZoneTool } from '@ui/panels/zones';
import type { PanelContext } from '@ui/panels/context';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const NBSP = / /g;
const zz = FLAT_TEST_SURFACE_Z - 7;

function fixture() {
  const w = new TestWorld({ seed: 't805-rooms', world: 'flat-test', embark: 'none' });
  w.digRoom(30, 30, zz, 3, 3);
  const tiles = Array.from({ length: 9 }, (_, n) => w.index(30 + (n % 3), 30 + Math.floor(n / 3), zz));
  const room = w.zone('barracks', tiles);
  const sent: Command[] = [];
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings, shiftLetters: new Set<string>(),
    submit: (cmd) => sent.push(cmd), notice: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const tool = new ZoneTool(); tool.selected = room;
  const b = w.readers.of<BuildingsReader>('14');
  const panel = (): string => {
    const s = surface(60, 40);
    drawZonesPanel(s, { col: 0, row: 0, cols: 60, rows: 40 }, tool, ctx);
    return s.lines().map((l) => l.trimEnd()).join('\n').replace(NBSP, ' ');
  };
  return { w, room, tiles, ctx, tool, b, panel };
}

describe('T-805 the room inspector says what the next tier needs', () => {
  it('an enclosed room shows ×1.5 on its parts, the next tier and the gap, and smoothing as the step', () => {
    const f = fixture();
    const score = f.b.roomScore(f.room)!;
    // 9 rough stone floor tiles (1 each), 16 rough walls (0), size 9, enclosed: (9 + 9) × 1.5 = 27.
    expect(score).toMatchObject({ enclosed: true, tier: 1 });
    expect(score.score).toBe(27);
    expect(f.b.roomDiagnostics(f.room)).toMatchObject({ rough: 25, smoothGain: 50, plainSmoothed: 0 });
    const text = f.panel();
    expect(text).toContain('Room: Modest (score 27)');
    expect(text).toContain('tiles 9 walls 0 furn. 0 size 9 · x1.5 enclosed');
    expect(text).toContain('Decent at 60: 33 to go');
    expect(text).not.toContain('enclose it');
    expect(text).toContain('Raises it: smooth 25 tiles (+75)');
  });

  it('an open room says how far the next tier is and to enclose it, without the multiplier', () => {
    const f = fixture();
    f.w.map.setKind(f.w.index(29, 29, zz), TileKind.Floor, f.w.map.materialAt(f.w.index(29, 29, zz)));
    const score = f.b.roomScore(f.room)!;
    expect(score).toMatchObject({ enclosed: false, tier: 0, score: 18 });
    const text = f.panel();
    expect(text).toContain('tiles 9 walls 0 furn. 0 size 9\n');
    expect(text).not.toContain('x1.5 enclosed');
    expect(text).toContain('Modest at 20: 2 to go · enclose it for x1.5');
    expect(text).toContain('Not enclosed: 1 open border tile');
    expect(text).toContain('Raises it: smooth 24 tiles (+48)');
  });

  it('offers engraving before smoothing, then size, then statues and fine furniture', () => {
    const f = fixture();
    for (const t of f.tiles) f.w.map.setFlag(t, TileFlag.Smoothed, true);
    // Nine smoothed floors: a masterwork on each adds 5, × 1.5 enclosed.
    expect(f.b.roomDiagnostics(f.room)).toMatchObject({ plainSmoothed: 9, engraveMax: 45, rough: 16 });
    expect(f.panel()).toContain('Raises it: engrave 9 tiles (+up to 67)');
    for (const t of f.tiles) f.w.map.setFlag(t, TileFlag.Engraved, true);
    expect(f.panel()).toContain('Raises it: smooth 16 tiles (+48)');
    for (let x = 29; x <= 33; x += 1) for (let y = 29; y <= 33; y += 1) {
      const t = f.w.index(x, y, zz);
      if (f.w.map.kindAt(t) === TileKind.Wall) f.w.map.setFlag(t, TileFlag.Smoothed, true);
    }
    for (let x = 29; x <= 33; x += 1) for (let y = 29; y <= 33; y += 1) {
      const t = f.w.index(x, y, zz);
      if (f.w.map.kindAt(t) === TileKind.Wall) f.w.map.setFlag(t, TileFlag.Engraved, true);
    }
    expect(f.panel()).toContain('Raises it: 31 more tiles count');
  });

  it('a room that lacks its furniture shows its needs and not the way up', () => {
    const f = fixture();
    f.w.digRoom(40, 30, zz, 2, 2);
    const bedroom = f.w.zone('bedroom', [f.w.index(40, 30, zz), f.w.index(41, 30, zz)]);
    f.tool.selected = bedroom;
    const text = f.panel();
    expect(text).toContain('Needs a bed');
    expect(text).not.toContain(' to go');
    expect(text).not.toContain('Raises it');
  });

  it('a room at the size cap with every tile worked names statues and fine furniture; royal has no next tier', () => {
    const f = fixture();
    const big = Array.from({ length: 40 }, (_, n) => f.w.index(10 + (n % 8), 10 + Math.floor(n / 8), zz));
    f.w.digRoom(10, 10, zz, 8, 5);
    for (const t of big) { f.w.map.setFlag(t, TileFlag.Smoothed, true); f.w.map.setFlag(t, TileFlag.Engraved, true); }
    for (let x = 9; x <= 18; x += 1) for (let y = 9; y <= 15; y += 1) {
      const t = f.w.index(x, y, zz);
      if (f.w.map.kindAt(t) === TileKind.Wall) { f.w.map.setFlag(t, TileFlag.Smoothed, true); f.w.map.setFlag(t, TileFlag.Engraved, true); }
    }
    const hall = f.w.zone('barracks', big);
    f.tool.selected = hall;
    expect(f.panel()).toContain('Raises it: statues and fine furniture');
    // A royal room has no tier above it, so neither line shows.
    const royal = { ...f.b.roomScore(hall)!, score: 1200, tier: 5 as const };
    expect(roomRaiseLines(f.ctx, royal, f.b.roomDiagnostics(hall)!, 40)).toEqual([]);
  });
});
