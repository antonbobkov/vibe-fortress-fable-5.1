/**
 * T-798: the sanctum says what it lacks. With no glowcap the panel says so, and where glowcap comes
 * from, in place of "Requirements met"; with glowcap that no plot grows, how many sessions it lasts.
 * The apprentice picker shows each dwarf's profession and Wits, the wittiest first. The glowcap hint
 * comes with a sanctum and no seeds, and a hint of its own comes with the first glowcap patch seen.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { PanelContext } from '@ui/panels/context';
import { drawZonesPanel, sanctumLines, ZoneTool } from '@ui/panels/zones';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';
import { strings, surface } from './ui-fixture';

const Z = 25;
const X = 30;
const Y = 30;
const NO_GLOWCAP = 'No glowcap: apprentices wait. Glowcap grows in the dark under a glowstone lamp, from seeds the Mountainhome sells in spring or a glowcap patch in the caverns.';

function sanctum(seed: string, glowcap: number) {
  const w = new TestWorld({ seed, embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(X, Y, Z, 6, 5);
  for (let y = Y - 1; y <= Y + 5; y += 1) for (let x = X - 1; x <= X + 6; x += 1) w.discover(w.index(x, y, Z));
  const zone = w.zone('sanctum', rect(w, X, Y, Z, 3, 3));
  w.build('rune_circle', w.index(X + 1, Y + 1, Z), 'granite');
  const dwarves: EntityId[] = [40, 75, 60].map((wit, k) => {
    const id = w.spawnDwarf({ at: w.index(X + k, Y + 4, Z), name: ['Kolbein Frosthelm', 'Asa Deepdelver', 'Orm Ashbrow'][k] as string, skills: k === 0 ? { masonry: 5 } : {} });
    const attrs = w.game.world.entities.get(id, C.Attributes)!;
    w.game.world.entities.add(id, C.Attributes, { ...attrs, wit });
    return id;
  });
  if (glowcap > 0) w.spawnItem('glowcap', 'glowcap', w.index(X + 5, Y, Z), glowcap);
  w.step(1);
  const ctx: PanelContext = {
    readers: w.readers, registry: w.game.registry, strings, shiftLetters: new Set<string>(),
    submit: (cmd) => { w.game.world.applyCommand(cmd); }, notice: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
  };
  const tool = new ZoneTool();
  tool.selected = zone;
  return { w, zone, dwarves, ctx, tool };
}

function panelText(f: ReturnType<typeof sanctum>, cols = 36): string {
  const s = surface(cols, 50);
  drawZonesPanel(s, { col: 0, row: 0, cols, rows: 50 }, f.tool, f.ctx);
  return s.lines().map((line) => line.trim()).join(' ').replace(/\s+/g, ' ');
}

describe('T-798 the sanctum says what it lacks', () => {
  it('with no glowcap says so and where it comes from, wrapped, in place of "Requirements met"', () => {
    const f = sanctum('t798-none', 0);
    const zone = f.w.readers.of<BuildingsReader>('14').zone(f.zone)!;
    expect(f.w.readers.of<BuildingsReader>('14').roomDiagnostics(f.zone)?.missing).toEqual([]);
    expect(sanctumLines(f.ctx, zone)[0]).toEqual({ text: NO_GLOWCAP, tone: 'bad' });
    const text = panelText(f);
    expect(text).not.toContain('Requirements met');
    expect(text).toContain('No glowcap: apprentices wait. Glowcap grows in the dark under a glowstone lamp, from seeds the Mountainhome sells in spring or a glowcap patch in the caverns.');
  });

  it('with glowcap that no plot grows says how many sessions it lasts, and "Requirements met" stays', () => {
    const f = sanctum('t798-some', 6);
    const zone = f.w.readers.of<BuildingsReader>('14').zone(f.zone)!;
    expect(sanctumLines(f.ctx, zone)[0]?.text).toBe('6 glowcap: enough for 6 sessions.');
    expect(panelText(f)).toContain('Requirements met');
  });

  it('the apprentice picker shows profession and Wits, the wittiest first', () => {
    const f = sanctum('t798-picker', 0);
    const lines = f.tool.ownerLines(f.ctx).filter((line) => line.id.startsWith('apprentice:')).map((line) => line.text);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^○ Asa Deepdelver · .+ · Wits 75$/);
    expect(lines[1]).toMatch(/^○ Orm Ashbrow · .+ · Wits 60$/);
    expect(lines[2]).toBe('○ Kolbein Frosthelm · Mason · Wits 40');
  });
});

describe('T-798 the glowcap hints come earlier', () => {
  it('a sanctum with no glowcap seeds shows the glowcap hint; a glowcap patch seen shows its own', () => {
    const f = sanctum('t798-hint', 0);
    const ui = defaultUiState(Z);
    const hints = new HintEngine(f.w.game.registry, ui, new AnnouncementLog(strings, f.w.game.registry));
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_glowcap');
    expect(ui.hintsShown).not.toContain('hint_glowcap_patch');
    // A glowcap patch on a tile just discovered.
    const tile = f.w.index(X + 4, Y + 2, Z);
    f.w.map.setKind(tile, TileKind.Shrub, f.w.game.registry.table('materials').index('glowcap_patch'));
    expect(f.w.readers.of<{ speciesAt(i: number): string }>('07').speciesAt(tile)).toBe('glowcap_patch');
    hints.onEvents([{ type: 'TilesDiscovered', tiles: [f.w.index(X, Y, Z)] }, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_glowcap_patch');
    hints.onEvents([{ type: 'TilesDiscovered', tiles: [tile] }, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_glowcap_patch');
    expect(f.w.game.registry.table<{ id: string; text: string }>('hints').byId('hint_glowcap_patch')?.text).toBe('A glowcap patch: gather it [d g] for glowcap and, sometimes, its seed.');
  });
});
