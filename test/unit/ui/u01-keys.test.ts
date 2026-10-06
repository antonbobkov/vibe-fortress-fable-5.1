/**
 * U-01: the embark default and its confirmations, safe confirmation defaults, and the small key
 * fixes (`docs/archive/ui-fixes/README.md` D-U3, D-U9; UI audit Q1, Q9, Q10, Q11, S1, S5).
 */

import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { InputSource, type EventTargetLike, type KeyPress } from '@platform/input';
import { computeLayout } from '@render/cellbuffer';
import type { EmbarkSession } from '@systems/embark';
import type { WorldMap } from '@systems/worldgen';
import { EMBARK_DEFAULT_PRESET } from '@ui/constants';
import type { ConfirmRow } from '@ui/screens/confirm';
import { EmbarkScreen } from '@ui/screens/embark';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { WorldGenScreen } from '@ui/screens/world_gen';
import type { WorldMapCompositor } from '@render/world-map';
import { defaultUiState } from '@ui/ui-state';
import type { Speed } from '@ui/status';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, registry, strings } from './ui-fixture';

function embark(answers: boolean[] = []): { s: EmbarkScreen; asked: string[]; embarked: EmbarkSession[] } {
  const asked: string[] = [];
  const embarked: EmbarkSession[] = [];
  const s = new EmbarkScreen(registry, 'u01-embark', { name: 'Greenhollow', peril: 0, tempC: 12 }, {
    embark: (session) => embarked.push(session),
    back: () => {},
    confirm: (id, _params, answer) => { asked.push(id); answer(answers.shift() ?? false); },
  }, keymap, strings);
  return { s, asked, embarked };
}

/** Zero every supply line whose catalog row brings an item of these categories. */
function drop(s: EmbarkScreen, prefix: string): void {
  const catalog = registry.table<{ id: string; item?: string }>('embarkCatalog');
  const items = registry.table<{ id: string; category?: string }>('items');
  for (const line of s.session.supplies.slice()) {
    const category = items.byId(catalog.byId(line.entry)?.item ?? '')?.category ?? '';
    if (category === prefix || category.startsWith(`${prefix}/`)) s.session.apply({ type: 'SetSupply', entry: line.entry, count: 0 });
  }
}

describe('U-01 embark opens with Balanced and asks before a start without a pick, food or drink (D-U3, Q1)', () => {
  it('opens with the Balanced preset applied: a pick, food and drink, nothing to ask', () => {
    const { s, asked, embarked } = embark();
    expect(s.session.preset).toBe(EMBARK_DEFAULT_PRESET);
    expect(s.session.total()).toBe(1480);
    expect(s.edited).toBe(false);
    expect(s.missing()).toEqual({ pick: false, food: false, drink: false });
    s.key(press('Enter'));
    expect(asked).toEqual([]);
    expect(embarked).toHaveLength(1);
  });

  it('no pick: "Embark without a pick?", No stays on the screen', () => {
    const { s, asked, embarked } = embark([false]);
    drop(s, 'tool/pick');
    expect(s.missing().pick).toBe(true);
    s.key(press('Enter'));
    expect(asked).toEqual(['c_embark_no_pick']);
    expect(embarked).toHaveLength(0);
  });

  it('no pick and no drink: both are asked in turn, and Yes to both embarks', () => {
    const { s, asked, embarked } = embark([true, true]);
    drop(s, 'tool/pick');
    drop(s, 'drink');
    s.key(press('Enter'));
    expect(asked).toEqual(['c_embark_no_pick', 'c_embark_no_food_drink']);
    expect(embarked).toHaveLength(1);
    expect(strings.get('confirm.c_embark_no_pick')).toBe('Embark without a pick?');
    expect(strings.get('confirm.c_embark_no_food_drink')).toBe('Embark without food or drink?');
  });
});

describe('U-01 every confirmation defaults to the safe answer (D-U9, S5)', () => {
  it('no row of the confirmations table defaults to Yes', () => {
    const table = registry.table<ConfirmRow>('confirmations');
    for (const id of table.ids()) expect(table.byId(id)?.default, id).toBe('no');
  });
});

function fortress(speed: { value: Speed }, calls: string[]): FortressScreen {
  const w = new TestWorld({ seed: 'u01-keys', world: 'flat-test', embark: 'none' });
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(FLAT_TEST_SURFACE_Z),
    submit: () => {},
    speed: () => speed.value,
    setSpeed: (v) => { speed.value = v; },
    pan: () => {},
    changeZ: () => {},
    centerOn: () => {},
    home: () => {},
    zoom: () => {},
    layout: () => computeLayout(80, 42, true),
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 0,
    quickSave: () => calls.push('quick'),
    saveMenu: () => calls.push('menu'),
  };
  return new FortressScreen(host, keymap, strings);
}

describe('U-01 keys (Q10)', () => {
  it('- and + while paused stay paused and set the speed the game resumes at', () => {
    const speed = { value: 0 as Speed };
    const screen = fortress(speed, []);
    screen.key(press('+'));
    expect(speed.value).toBe(0);
    expect(screen.statusRow2()).toBe('Paused · speed on resume: 2×');
    screen.key(press('-'));
    expect(speed.value).toBe(0);
    screen.key(press('+'));
    screen.key(press('+'));
    screen.key(press(' '));
    expect(speed.value).toBe(4);
  });

  it('Ctrl+S opens the save menu', () => {
    const calls: string[] = [];
    const screen = fortress({ value: 0 }, calls);
    expect(screen.key(press('s', { ctrl: true }))).toBe(true);
    expect(calls).toEqual(['menu']);
  });

  it('the browser gets neither Ctrl+S nor Ctrl+wheel', () => {
    const listeners: { type: string; fn: (e: unknown) => void; options?: unknown }[] = [];
    const dom: EventTargetLike = {
      addEventListener: (type: string, fn: (e: never) => void, options?: unknown) => { listeners.push({ type, fn: fn as (e: unknown) => void, options }); },
      removeEventListener: () => {},
    };
    const keys: KeyPress[] = [];
    new InputSource(dom, dom, { onKey: (k) => keys.push(k), onWheel: () => {} }).attach();
    const fire = (type: string, event: unknown): void => { for (const l of listeners.filter((x) => x.type === type)) l.fn(event); };
    const key = vi.fn();
    fire('keydown', { key: 's', ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, preventDefault: key });
    expect(key).toHaveBeenCalled();
    const wheel = vi.fn();
    fire('wheel', { clientX: 0, clientY: 0, deltaY: -1, ctrlKey: true, shiftKey: false, altKey: false, metaKey: false, preventDefault: wheel });
    expect(wheel).toHaveBeenCalled();
    expect(listeners.find((l) => l.type === 'wheel')?.options).toEqual({ passive: false });
    const plain = vi.fn();
    fire('wheel', { clientX: 0, clientY: 0, deltaY: -1, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, preventDefault: plain });
    expect(plain).not.toHaveBeenCalled();
  });
});

describe('U-01 world generation: [g] Generate works from the seed field (Q11)', () => {
  function worldGen(): { s: WorldGenScreen; seeds: string[] } {
    const seeds: string[] = [];
    const s = new WorldGenScreen({
      randomSeed: () => 'deep-1',
      generate: (seed) => { seeds.push(seed); return { size: 1, regions: [], rivers: [] } as unknown as WorldMap; },
      back: () => {},
      continueTo: () => {},
    }, keymap, strings, {} as WorldMapCompositor);
    return { s, seeds };
  }

  it('g generates while the drawn seed is untouched, and types once the seed is edited', () => {
    const a = worldGen();
    expect(a.s.focus).toBe('seed');
    a.s.key(press('g'));
    expect(a.seeds).toEqual(['deep-1']);
    expect(a.s.seed.value).toBe('deep-1');
    const b = worldGen();
    b.s.key(press('x'));
    b.s.key(press('g'));
    expect(b.s.seed.value).toBe('deep-1xg');
    expect(b.seeds).toEqual([]);
    expect(strings.get('ui.worldgen.seed_hint')).toBe('[Enter] done · [g] Generate');
  });
});
