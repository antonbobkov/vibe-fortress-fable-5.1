/**
 * T-705: the goods a building holds open from the tile list (24 § Inspection). Under the wagon's row
 * each stack takes a digit after the wagon's and opens its item view, "In Wagon #1"; `Backspace`
 * from that view, and from the wagon's Building panel opened with its digit, returns to the tile
 * list. The wagon's `[v] see the items` says what it opens.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import type { EntityId } from '@core/types';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

function screenOver(w: TestWorld): FortressScreen {
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return new FortressScreen(host, keymap, strings);
}

/** The sidebar as text, its title row first. */
function sidebar(screen: FortressScreen): string[] {
  const s = surface(80, 42);
  screen.draw(s);
  const bar = LAYOUT.sidebar;
  if (bar === null) return [];
  return s.lines().map((line) => Array.from(line).slice(bar.col + 1).join('').trimEnd());
}

/** A click on the first place the sidebar writes `text`. */
function clickText(screen: FortressScreen, text: string): void {
  const s = surface(80, 42);
  screen.draw(s);
  const left = LAYOUT.sidebar?.col ?? 0;
  const lines = s.lines();
  const row = lines.findIndex((line) => Array.from(line).slice(left).join('').includes(text));
  expect(row, `"${text}" in the sidebar`).toBeGreaterThanOrEqual(0);
  const col = left + Array.from(lines[row] as string).slice(left).join('').indexOf(text);
  const hit = s.hits.find((h) => h.rect.row <= row && row < h.rect.row + h.rect.rows && h.rect.col <= col && col < h.rect.col + h.rect.cols);
  expect(hit, `a button at "${text}"`).toBeDefined();
  hit?.action();
}

describe('T-705 a building\'s goods open from the tile list', () => {
  const w = new TestWorld({ seed: 't705', world: 'flat-test', embark: 'default', surfaceWildlife: 'none' });
  const b = w.readers.of<BuildingsReader>('14');
  const items = w.readers.of<ItemsReader>('13');
  const wagon = b.byTag('container').find((id) => b.get(id)?.typeId === 'wagon') as EntityId;
  const centre = items.tileOf(items.inContainer(wagon)[0] as EntityId);
  const at = { x: w.game.world.map.xOf(centre), y: w.game.world.map.yOf(centre), z };

  it('numbers the wagon\'s stacks after the wagon, and a stack\'s digit opens its item view, In Wagon #1', () => {
    const screen = screenOver(w);
    screen.look(at);
    const rows = sidebar(screen);
    const numbered = screen.lookView.numbered;
    const wagonDigit = numbered.findIndex((t) => t.kind === 'building' && t.id === wagon) + 1;
    expect(wagonDigit).toBeGreaterThan(0);
    const good = numbered[wagonDigit];
    expect(good?.kind).toBe('item');
    expect(items.get(good?.id ?? 0)?.containerId).toBe(wagon);
    // The stack's row reads its digit, then its count and name indented under the wagon's.
    const wagonRow = rows.findIndex((row) => row.startsWith(` ${wagonDigit} `) && row.includes('Wagon'));
    expect(wagonRow).toBeGreaterThan(0);
    expect(rows[wagonRow + 1]).toMatch(new RegExp(`^ ${wagonDigit + 1} {5}\\d+ \\S`));

    expect(screen.key(press(String(wagonDigit + 1)))).toBe(true);
    expect(screen.lookAt).toMatchObject({ kind: 'item', id: good?.id });
    expect(sidebar(screen)[2]).toMatch(/^ In Wagon #\d+$/);

    // Backspace: back to the tile list.
    expect(screen.key(press('Backspace'))).toBe(true);
    expect(screen.ui.panel).toBe('look');
    expect(screen.lookAt.kind).toBe('tile');
    expect(screen.ui.cursor).toEqual({ x: at.x, y: at.y });
  });

  it('the wagon\'s Building panel opened with its digit shows [Bksp] back, and Backspace returns to the list', () => {
    const screen = screenOver(w);
    screen.look(at);
    sidebar(screen);
    const wagonDigit = screen.lookView.numbered.findIndex((t) => t.kind === 'building' && t.id === wagon) + 1;
    expect(screen.key(press(String(wagonDigit)))).toBe(true);
    expect(screen.ui.panel).toBe('building');
    expect(screen.building.id).toBe(wagon);
    expect(sidebar(screen).some((row) => row.trim() === '[Bksp] back')).toBe(true);
    expect(screen.key(press('Backspace'))).toBe(true);
    expect(screen.ui.panel).toBe('look');
    expect(screen.lookAt.kind).toBe('tile');
    expect(screen.ui.cursor).toEqual({ x: at.x, y: at.y });

    // The button does the same; through an item's view, back twice: the item, then the list.
    screen.key(press(String(wagonDigit + 1)));
    const good = screen.lookAt;
    expect(good.kind).toBe('item');
    clickText(screen, 'Wagon #');
    expect(screen.ui.panel).toBe('building');
    clickText(screen, '[Bksp] back');
    expect(screen.ui.panel).toBe('look');
    expect(screen.lookAt).toMatchObject({ kind: 'item', id: good.kind === 'item' ? good.id : 0 });
    expect(screen.key(press('Backspace'))).toBe(true);
    expect(screen.lookAt.kind).toBe('tile');
  });

  it('a building opened from the map, not from Look, has no way back and no [Bksp] back', () => {
    const screen = screenOver(w);
    screen.openBuilding(wagon);
    expect(sidebar(screen).some((row) => row.includes('[Bksp] back'))).toBe(false);
    screen.key(press('Backspace'));
    expect(screen.ui.panel).toBe('building');
  });

  it('[v] see the items says what it opens: the tile list, each stack opening with its digit', () => {
    const screen = screenOver(w);
    screen.openBuilding(wagon);
    const line = screen.building.lines(screen.ctx).find((l) => l.id === 'see_items');
    expect(line?.help).toBe("Opens Look's tile list on the tile where they lie: each stack opens with its digit.");
    line?.run?.();
    expect(screen.ui.panel).toBe('look');
    expect(screen.lookView.key).toBe('');
    sidebar(screen);
    expect(screen.lookView.numbered.some((t) => t.kind === 'item' && items.get(t.id)?.containerId === wagon)).toBe(true);
  });
});
