/**
 * T-278: keys that did nothing in silence now say why; saving says "Saved"; an embark with no food or
 * no drink asks about each.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { MemoryStorage } from '@platform/storage';
import { SaveManager } from '@app/save-manager';
import { computeLayout } from '@render/cellbuffer';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { GameMenuScreen } from '@ui/screens/game_menu';
import { EmbarkScreen } from '@ui/screens/embark';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { keymap, press, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.step(1);
  const layout = computeLayout(80, 60, true);
  const submitted: unknown[] = [];
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => { submitted.push(c); w.submit(c); }, speed: () => 1, setSpeed: () => {},
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  screen.ui.sidebar = true;
  const key = (k: string, shift = false): boolean => screen.key(press(k, { shift }));
  return { w, screen, key, submitted };
}

describe('T-278 military keys', () => {
  it('say there is no squad, and do nothing else, with no squad selected', () => {
    const f = setup('t278-nosquad');
    f.screen.openPanel('military');
    for (const [k, shift] of [['v', false], ['K', true], ['S', true], ['A', true], ['r', false], ['w', false], ['J', true], ['M', true]] as const) {
      f.screen.clearNotice();
      f.key(k, shift);
      expect(f.screen.statusRow2(), `${shift ? 'Shift+' : ''}${k}`).toBe('No squad yet: [+] makes one.');
    }
    expect(f.screen.military.settingStation || f.screen.military.settingKill).toBe(false);
    expect(f.submitted).toEqual([]);
  });

  it('set a mode of work on a squad with no members, and say who is missing', () => {
    const f = setup('t278-nomembers');
    f.screen.openPanel('military');
    f.key('+');
    f.w.step(1);
    f.screen.clearNotice();
    f.key('v');
    expect(f.submitted[f.submitted.length - 1]).toMatchObject({ type: 'SetSquadMode', mode: 'active' });
    expect(f.screen.statusRow2()).toBe('The Hearthguard has no members: [S-a] adds them.');
    f.screen.clearNotice();
    f.key('T', true);
    expect(f.submitted[f.submitted.length - 1]).toMatchObject({ type: 'SetSquadMode', mode: 'train' });
    expect(f.screen.statusRow2()).toBe('The Hearthguard has no members: [S-a] adds them.');
    // Off needs no members.
    f.screen.clearNotice();
    f.key('O', true);
    expect(f.screen.statusRow2()).not.toContain('no members');
  });

  it('show what the armed pick waits for, and drop an older line', () => {
    const f = setup('t278-prompts');
    f.screen.openPanel('military');
    f.key('+');
    f.w.step(1);
    f.screen.notice('an old line');
    f.key('S', true);
    expect(f.screen.statusRow2()).toBe('Station: click a floor tile · [Esc] cancel');
    f.key('Esc');
    f.key('P', true);
    expect(f.screen.statusRow2()).toBe('Patrol point: click a floor tile · [Esc] cancel');
    f.key('Esc');
    f.key('K', true);
    expect(f.screen.statusRow2()).toBe('Kill order: click a creature · [Esc] cancel');
    f.key('Esc');
    f.key('F', true);
    expect(f.screen.statusRow2()).toBe('Follow order: click a dwarf · [Esc] cancel');
  });

  it('refuse a tile the squad cannot stand on, keep the pick armed, and bring the prompt back when the pointer moves', () => {
    const f = setup('t278-cannot-stand');
    f.screen.openPanel('military');
    f.key('+');
    f.w.step(1);
    f.key('S', true);
    // The open air above the floor cannot be stood on.
    const air = { x: 20, y: 20, z: z + 3 };
    const pickAt = (f.screen as unknown as { pickAt(at: typeof air, byKey: boolean): boolean }).pickAt.bind(f.screen);
    expect(pickAt(air, true)).toBe(true);
    expect(f.screen.statusRow2()).toBe('The squad cannot stand there: pick a floor tile.');
    expect(f.screen.military.settingStation).toBe(true);
    expect(f.submitted.some((c) => (c as { type: string }).type === 'SetSquadStation')).toBe(false);
    f.screen.pointerMove({ col: 5, row: 5, button: 0, shift: false, ctrl: false, alt: false, meta: false });
    expect(f.screen.statusRow2()).toBe('Station: click a floor tile · [Esc] cancel');
    // A floor tile is taken and the pick ends.
    expect(pickAt({ x: 20, y: 20, z }, true)).toBe(true);
    expect(f.submitted.some((c) => (c as { type: string }).type === 'SetSquadStation')).toBe(true);
    expect(f.screen.military.settingStation).toBe(false);
  });
});

describe('T-278 orders, designate and harvest', () => {
  it('Delete and x with no order say that none is selected', () => {
    const f = setup('t278-orders');
    f.screen.openPanel('orders');
    f.key('Delete');
    expect(f.screen.statusRow2()).toBe('No order is selected: [S-n] adds one.');
    f.screen.clearNotice();
    f.key('x');
    expect(f.screen.statusRow2()).toBe('No order is selected: [S-n] adds one.');
    f.screen.clearNotice();
    f.key('r');
    expect(f.screen.statusRow2()).toBe('There is no order to repeat yet.');
    f.screen.clearNotice();
    f.key('p', true);
    expect(f.screen.statusRow2()).toBe('No order is selected: [S-n] adds one.');
  });

  it('Ctrl+Z with nothing designated says there is nothing to undo', () => {
    const f = setup('t278-undo');
    f.screen.openPanel('designate');
    f.screen.key(press('z', { ctrl: true }));
    expect(f.screen.statusRow2()).toBe('Nothing to undo.');
  });

  it('a harvest rectangle with no ripe crops says so in the voice of its neighbours', () => {
    const f = setup('t278-harvest');
    f.screen.openPanel('designate');
    f.key('h');
    const sent = f.screen.commit({ x: 10, y: 10, z }, { x: 12, y: 12, z });
    expect(sent).toEqual([]);
    expect(f.screen.statusRow2()).toBe('No ripe crops here to harvest.');
  });
});

describe('T-278 saving', () => {
  it('the game menu shows a line under its title for three seconds, then drops it', () => {
    let now = 1000;
    const menu = new GameMenuScreen({
      fortressName: () => 'Grimvault', resume: () => {}, save: () => {}, load: () => {}, settings: () => {}, retire: () => {}, mainMenu: () => {},
      viewOnly: () => false, now: () => now,
    });
    menu.flash('Saved Grimvault, Day 1 of Spring, Year 1.');
    const lines = (): string[] => { const s = surface(80, 25); menu.draw(s); return s.lines().map((l) => l.trim()); };
    const title = lines().findIndex((l) => l === 'Deepholm · Grimvault');
    expect(lines()[title + 1]).toBe('Saved Grimvault, Day 1 of Spring, Year 1.');
    now = 3999;
    expect(lines()[title + 1]).toBe('Saved Grimvault, Day 1 of Spring, Year 1.');
    now = 4000;
    expect(lines()[title + 1]).toBe('');
  });

  it('Save in the game menu shows the line and writes it to the log; the menu stays open', async () => {
    const g = new Game({ canvas: new MockCanvas(), seed: 't278-save', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
    await g.start({ embark: 'default' });
    g.openGameMenu('save');
    g.handleKey(press('Enter'));
    const shown = (): boolean => { g.render(); return g.textRows().some((l) => /^Saved \S+, Day/.test(l.trim())); };
    for (let n = 0; n < 250 && !shown(); n += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    g.render();
    const rows = g.textRows().map((l) => l.trim());
    expect(rows.some((l) => /^Saved \S+, Day \d+ of \w+, Year \d+\.$/.test(l))).toBe(true);
    expect(g.fortress.log.lines.some((l) => /^Saved /.test(l.text))).toBe(true);
    expect(rows.some((l) => l === 'Resume' || l.endsWith('[r] Resume'))).toBe(true);
  });

  it('F9 with no quick save says so at once and asks nothing', async () => {
    const g = new Game({ canvas: new MockCanvas(), seed: 't278-f9', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800, saves: new SaveManager(new MemoryStorage()) });
    await g.start({ embark: 'default' });
    g.handleKey(press('F9'));
    for (let n = 0; n < 250 && g.fortress.statusRow2() !== 'There is no quick save to load.'; n += 1) await new Promise((resolve) => setTimeout(resolve, 20));
    g.render();
    expect(g.fortress.statusRow2()).toBe('There is no quick save to load.');
    expect(g.textRows().join('\n')).not.toContain('Unsaved progress will be lost');
  });
});

describe('T-278 embark with no food or drink', () => {
  it('asks about food and about drink separately, in that order, after the pick and the axe', () => {
    const asked: string[] = [];
    const s = new EmbarkScreen(registry, 't278-embark', { name: 'Greenhollow', peril: 0, tempC: 12 }, {
      embark: () => {}, back: () => {}, confirm: (id, _p, answer) => { asked.push(id); answer(true); },
    }, keymap, strings);
    s.applyPreset('balanced');
    const drop = (category: string): void => {
      const catalog = registry.table<{ id: string; item?: string }>('embarkCatalog');
      const items = registry.table<{ id: string; category?: string }>('items');
      for (const line of s.session.supplies) {
        const cat = items.byId(catalog.byId(line.entry)?.item ?? '')?.category ?? '';
        if (cat === category || cat.startsWith(`${category}/`)) s.apply({ type: 'SetSupply', entry: line.entry, count: 0 });
      }
    };
    drop('food');
    drop('drink');
    s.key(press('Enter'));
    expect(asked).toEqual(['c_embark_no_food', 'c_embark_no_drink']);
    expect(strings.get('confirm.c_embark_no_food')).toBe('Embark with no food?');
    expect(strings.get('confirm.c_embark_no_drink')).toBe('Embark with no drink?');
  });
});
