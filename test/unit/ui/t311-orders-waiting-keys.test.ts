/** T-311: the "Orders waiting" rows of the Jobs panel can be reached by keyboard. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const RECIPES = ['make_door_wood', 'make_table_wood', 'make_chair_wood', 'make_bed', 'make_cabinet_wood'];

function setup(seed: string, orders: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.build('carpenter', w.index(15, 15, z));
  for (const recipeId of RECIPES.slice(0, orders)) w.submit({ type: 'AddWorkOrder', workshopId: 0, order: { recipeId, mode: 'once', threshold: 0, remaining: 2, priority: 5 } });
  w.step(1);
  const layout = computeLayout(80, 60, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c), speed: () => 1, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  screen.openPanel('jobs');
  const draw = (): string[] => { const s = surface(80, 60); screen.draw(s); return s.lines().map((l) => l.slice(45)); };
  return { w, screen, draw, key: (k: string, shift = false) => screen.key(press(k, { shift })) };
}

describe('T-311 the waiting orders in Jobs', () => {
  it('Tab moves the cursor to the waiting rows and back; the arrows move it; Enter opens Orders on that order', () => {
    const f = setup('t311-keys', 3);
    expect(f.screen.jobs.focusWaiting).toBe(false);
    f.key('Tab');
    expect(f.screen.jobs.focusWaiting).toBe(true);
    expect(f.screen.ui.sidebar).toBe(true);
    const marked = (): number => f.draw().filter((l) => l.startsWith('►')).length;
    f.draw();
    expect(marked()).toBe(1);
    f.key('↓');
    f.key('↓');
    expect(f.screen.jobs.waitingList.selected).toBe(2);
    f.key('↑');
    expect(f.screen.jobs.waitingList.selected).toBe(1);
    f.key('Enter');
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.workshopId).toBe(0);
    expect(f.screen.orders.list.selected).toBe(f.screen.orders.waiting(f.screen.ctx)[1]?.index);
    f.screen.openPanel('jobs');
    f.key('Tab');
    expect(f.screen.jobs.focusWaiting).toBe(false);
  });

  it('lists every waiting order, three at a time, and the cursor scrolls the rest into view', () => {
    const f = setup('t311-scroll', 5);
    const rows = (): string[] => f.draw().filter((l) => /^ ?x2 /.test(l.replace('►', ' ')) || l.startsWith('►'));
    expect(f.draw().join('\n')).toContain('Orders waiting (5)');
    expect(rows().length).toBe(3);
    f.key('Tab');
    for (let k = 0; k < 4; k += 1) f.key('↓');
    expect(f.screen.jobs.waitingList.selected).toBe(4);
    f.draw();
    expect(f.screen.jobs.waitingList.scroll).toBe(2);
    const shown = f.draw();
    const last = shown.findIndex((l) => l.startsWith('►'));
    expect(last).toBeGreaterThan(0);
    expect(shown[last]).toContain('Cabinet');
    f.key('Enter');
    expect(f.screen.ui.panel).toBe('orders');
    expect(f.screen.orders.list.selected).toBe(f.screen.orders.waiting(f.screen.ctx)[4]?.index);
  });

  it('with no waiting order Tab is still the sidebar key', () => {
    const f = setup('t311-none', 0);
    expect(f.screen.ui.sidebar).toBe(true);
    f.key('Tab');
    expect(f.screen.jobs.focusWaiting).toBe(false);
    expect(f.screen.ui.sidebar).toBe(false);
  });
});
