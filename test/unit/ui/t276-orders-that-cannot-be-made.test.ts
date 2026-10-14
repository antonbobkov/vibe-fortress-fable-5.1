/**
 * T-276: an order nothing can make says so at once, the Jobs panel lists the orders waiting, and
 * the picker ranks what a built workshop can make first and asks for a choice before Enter adds.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, carpenter = false) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  if (carpenter) w.build('carpenter', w.index(15, 15, z));
  w.step(1);
  const layout = computeLayout(80, 60, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => 1, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 60); screen.draw(s); return s.lines(); };
  const type = (text: string): void => { for (const ch of text) screen.key(press(ch)); };
  const open = (): void => { screen.openPanel('orders'); screen.key(press('N', { shift: true })); };
  return { w, screen, draw, type, open };
}

describe('T-276 the line after an order', () => {
  it('warns at once when no workshop is built that could make it', () => {
    const f = setup('t276-noforge');
    f.open();
    f.type('mail');
    f.screen.key(press('Enter'));
    expect(f.screen.statusRow2()).toBe('Ordered: ×1 Mail shirt. No forge is built yet: [b] Build > Workshops.');
  });

  it('says what the workshop waits for when it is built but lacks an input', () => {
    const f = setup('t276-waiting', true);
    f.open();
    f.type('door');
    f.screen.key(press('5'));
    f.screen.key(press('Enter'));
    expect(f.screen.statusRow2()).toBe('Ordered: ×5 Door. Waiting for log (0 in stock).');
  });
});

describe('T-276 the picker', () => {
  it('lists a recipe a built workshop can make before one with no workshop, and dims the other', () => {
    const f = setup('t276-rank', true);
    f.open();
    f.type('barrel');
    const ids = f.screen.orders.pickerRecipes(f.screen.ctx).map((r) => r.id);
    expect(ids.indexOf('make_barrel')).toBeLessThan(ids.indexOf('forge_barrel'));
    const text = f.draw().join('\n');
    expect(text).toContain('Metal barrel · no forge');
    expect(text).not.toContain('Barrel · no');
  });

  it('with no workshop at all, both barrels show their missing workshop', () => {
    const f = setup('t276-rank-none');
    f.open();
    f.type('barrel');
    const text = f.draw().join('\n');
    expect(text).toContain('· no carpenter');
    expect(text).toContain('· no forge');
  });

  it('Enter adds nothing until a name is typed or a recipe is chosen', () => {
    const f = setup('t276-empty-enter', true);
    f.open();
    f.screen.key(press('Enter'));
    expect(f.screen.statusRow2()).toBe('Type a name or choose a recipe.');
    expect(f.screen.orders.picker.open).toBe(true);
    f.screen.key(press('ArrowDown'));
    f.screen.key(press('Enter'));
    expect(f.screen.orders.picker.open).toBe(false);
  });

  it('a quantity cannot become 0, and PageDown moves by a screen', () => {
    const f = setup('t276-quantity', true);
    f.open();
    f.screen.key(press('0'));
    expect(f.screen.orders.picker.quantity).toBe(1);
    f.draw();
    const before = f.screen.orders.picker.list.selected;
    f.screen.key(press('PageDown'));
    expect(f.screen.orders.picker.list.selected - before).toBe(f.screen.orders.picker.height - 1);
  });
});

describe('T-276 orders waiting in Jobs', () => {
  it('lists the orders no job serves with their reason, and a click opens Orders on one', () => {
    const f = setup('t276-jobs', true);
    f.open();
    f.type('door');
    f.screen.key(press('3'));
    f.screen.key(press('Enter'));
    f.w.step(1);
    f.screen.openPanel('jobs');
    const lines = f.draw();
    expect(lines.join('\n')).toContain('Orders waiting (1)');
    const row = lines.findIndex((l) => l.includes('Door') && l.includes('waiting for log'));
    expect(row).toBeGreaterThan(0);
    f.screen.pointerDown({ col: (lines[row] as string).indexOf('Door'), row, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.selectedRow(f.screen.ctx)).toMatchObject({ kind: 'live' });
  });
});
