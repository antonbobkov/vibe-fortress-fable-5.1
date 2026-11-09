/**
 * T-531: starting loadouts are saved, listed, loaded, renamed and deleted on the embark screen
 * (`02` § Loadouts, `ui-screens/embark.md` § Saved loadouts), persist in the settings store
 * (`persistence.md` § Storage), survive a content change and never change the budget.
 */

import { describe, expect, it } from 'vitest';
import { EMBARK_SKILL_MAX_PER_SKILL } from '@core/constants';
import { LoadoutStore, LOADOUTS_KEY } from '@app/loadout-store';
import { MemoryStorage } from '@platform/storage';
import { applyLoadout, EmbarkSession, loadoutOf, readLoadouts, type SavedLoadout } from '@systems/embark';
import { EmbarkScreen, LOADOUTS_OPTION } from '@ui/screens/embark';
import type { LoadoutLibrary } from '@ui/screens/embark_loadouts';
import type { TextInputSpec } from '@ui/screens/text_input';
import { keymap, press, registry, strings, surface } from './ui-fixture';

/** An in-memory library over a {@link LoadoutStore}, as the app wires it. */
function library(store = new LoadoutStore(null)): LoadoutLibrary & { store: LoadoutStore } {
  return {
    store,
    list: () => store.list(),
    put: (l) => void store.put(l),
    rename: (from, to) => void store.rename(from, to),
    remove: (name) => void store.remove(name),
  };
}

interface Harness {
  s: EmbarkScreen;
  lib: ReturnType<typeof library>;
  asked: string[];
  prompts: TextInputSpec[];
  /** The next prompt answers and confirmation answers, in order. */
  answers: (string | null)[];
  yes: boolean[];
}

function screen(opts: { peril?: number; tempC?: number; lib?: ReturnType<typeof library> } = {}): Harness {
  const lib = opts.lib ?? library();
  const h: Harness = { s: undefined as unknown as EmbarkScreen, lib, asked: [], prompts: [], answers: [], yes: [] };
  h.s = new EmbarkScreen(
    registry,
    't531-loadouts',
    { name: 'Greenhollow', peril: opts.peril ?? 0, tempC: opts.tempC ?? 12 },
    {
      embark: () => {},
      back: () => {},
      loadouts: lib,
      confirm: (id, _params, answer) => {
        h.asked.push(id);
        answer(h.yes.shift() ?? false);
      },
      prompt: (spec, answer) => {
        h.prompts.push(spec);
        answer(h.answers.length > 0 ? (h.answers.shift() as string | null) : spec.value);
      },
    },
    keymap,
    strings,
  );
  return h;
}

function text(s: EmbarkScreen, cols = 100, rows = 45): string {
  const surf = surface(cols, rows);
  s.draw(surf);
  return surf.lines().join('\n');
}

function count(s: EmbarkScreen, entry: string): number {
  return s.session.supplies.find((l) => l.entry === entry)?.count ?? 0;
}

describe('T-531 loadouts: the session', () => {
  it('a loadout taken from one session loads into another whole', () => {
    const a = new EmbarkSession(registry, 'seed-a', 0);
    a.apply({ type: 'ApplyPreset', preset: 'warband' });
    a.apply({ type: 'SetSupply', entry: 'e_pick_iron', count: 3 });
    a.apply({ type: 'SetSkill', dwarf: 6, skill: 'brewing', level: 4 });
    const loadout = loadoutOf(a);
    const b = new EmbarkSession(registry, 'seed-b', 2);
    b.apply({ type: 'ApplyPreset', preset: 'farmstead' });
    const result = applyLoadout(b, registry, loadout);
    expect(result).toEqual({ missing: [], unavailable: [], lowered: [], extraDwarves: 0 });
    expect(loadoutOf(b)).toEqual(loadout);
    expect(b.preset).toBeNull();
    expect(b.party[6]?.skills['brewing']).toBe(4);
  });

  it('drops rows that no longer exist, leaves out what the site does not offer, lowers what is over its limit', () => {
    const session = new EmbarkSession(registry, 'seed-c', 0);
    const result = applyLoadout(session, registry, {
      supplies: [
        { entry: 'e_pick_iron', count: 2 },
        { entry: 'e_gone_from_the_game', count: 4 },
        { entry: 'e_yak', count: 1 },
        { entry: 'e_pig', count: 99 },
      ],
      skills: [{ masonry: 3, lost_art: 2 }, { mining: EMBARK_SKILL_MAX_PER_SKILL + 4 }, {}, {}, {}, {}, {}, { cooking: 2 }, { brewing: 1 }],
    }, (entry) => entry !== 'e_yak');
    expect(result.missing).toEqual(['e_gone_from_the_game', 'lost_art']);
    expect(result.unavailable).toEqual(['e_yak']);
    expect(result.lowered).toEqual(['e_pig', 'mining']);
    expect(result.extraDwarves).toBe(2);
    expect(session.supplies).toEqual([{ entry: 'e_pick_iron', count: 2 }, { entry: 'e_pig', count: registry.table<{ id: string; max: number }>('embarkCatalog').byId('e_pig')?.max }]);
    expect(session.party[0]?.skills).toEqual({ masonry: 3 });
    expect(session.party[1]?.skills).toEqual({ mining: EMBARK_SKILL_MAX_PER_SKILL });
  });

  it('an over-budget loadout loads whole and the budget stays the site\'s', () => {
    const session = new EmbarkSession(registry, 'seed-d', 0);
    const budget = session.budget();
    applyLoadout(session, registry, { supplies: [{ entry: 'e_anvil', count: 1 }, { entry: 'e_pick_iron', count: 7 }, { entry: 'e_mail_iron', count: 4 }], skills: [] });
    expect(session.budget()).toBe(budget);
    expect(session.total()).toBeGreaterThan(budget);
    expect(count({ session } as EmbarkScreen, 'e_pick_iron')).toBe(7);
    expect(session.canEmbark()).toEqual({ ok: false, reason: 'over_budget' });
  });

  it('reads a stored list defensively: no name, bad lines and repeated names are dropped; sorted by name', () => {
    const list = readLoadouts([
      { name: 'zeta', supplies: [{ entry: 'e_ale', count: 2 }, { entry: 'e_ale', count: 5 }, { entry: 'e_bed', count: -1 }, 'junk'], skills: [{ mining: 2, cooking: 'x' }, null] },
      { name: '  ', supplies: [] },
      { name: 'Alpha', supplies: 'none' },
      { name: 'ZETA', supplies: [] },
      7,
    ]);
    expect(list.map((l) => l.name)).toEqual(['Alpha', 'zeta']);
    expect(list[1]).toEqual({ name: 'zeta', supplies: [{ entry: 'e_ale', count: 2 }], skills: [{ mining: 2 }, {}] });
    expect(readLoadouts(undefined)).toEqual([]);
    expect(readLoadouts({ not: 'a list' })).toEqual([]);
  });
});

describe('T-531 loadouts: the store', () => {
  it('persists in the settings store under `loadouts` and reads back after a reload', async () => {
    const storage = new MemoryStorage();
    const store = new LoadoutStore(storage);
    await store.load();
    const loadout: SavedLoadout = { name: 'Deep start', supplies: [{ entry: 'e_pick_iron', count: 3 }], skills: [{ mining: 5 }] };
    await store.put(loadout);
    await store.put({ name: 'Farm', supplies: [], skills: [] });
    expect(await storage.keys('settings')).toEqual([LOADOUTS_KEY]);
    const again = new LoadoutStore(storage);
    await again.load();
    expect(again.list()).toEqual([loadout, { name: 'Farm', supplies: [], skills: [] }]);
    await again.put({ name: 'deep START', supplies: [], skills: [] });
    expect(again.list().map((l) => l.name)).toEqual(['deep START', 'Farm']);
    await again.rename('Farm', 'Acre');
    await again.remove('deep START');
    const third = new LoadoutStore(storage);
    await third.load();
    expect(third.list().map((l) => l.name)).toEqual(['Acre']);
  });

  it('an unreadable stored value reads as no loadouts', async () => {
    const storage = new MemoryStorage();
    await storage.put('settings', LOADOUTS_KEY, 'garbage');
    const store = new LoadoutStore(storage);
    await store.load();
    expect(store.list()).toEqual([]);
  });
});

describe('T-531 loadouts: the embark screen', () => {
  it('`l` opens the panel; the presets menu offers it as its last option', () => {
    const h = screen();
    expect(text(h.s)).not.toContain('Saved loadouts');
    h.s.key(press('p'));
    const options = h.s.presetOptions();
    expect(options[options.length - 1]).toMatchObject({ id: LOADOUTS_OPTION, label: 'Saved loadouts…', detail: '0 saved' });
    h.s.choosePreset(LOADOUTS_OPTION);
    expect(h.s.presets.open).toBe(false);
    expect(h.s.loadouts?.open).toBe(true);
    expect(text(h.s)).toContain('No saved loadouts yet: [s] saves the current one.');
    h.s.key(press('Esc'));
    expect(h.s.loadouts?.open).toBe(false);
    h.s.key(press('l'));
    expect(h.s.loadouts?.open).toBe(true);
  });

  it('saves under a name, lists it with its cost, and loads it back', () => {
    const h = screen();
    h.s.setTab(1);
    h.s.apply({ type: 'SetSupply', entry: 'e_pick_iron', count: 3 });
    h.s.apply({ type: 'SetSkill', dwarf: 0, skill: 'cooking', level: 1 });
    const saved = loadoutOf(h.s.session);
    h.s.key(press('l'));
    h.answers.push('Deep start');
    h.s.key(press('s'));
    expect(h.prompts[0]).toMatchObject({ title: 'Save the loadout as', value: 'Loadout 1', maxLength: 32 });
    expect(h.lib.list()).toEqual([{ name: 'Deep start', ...saved }]);
    const t = text(h.s);
    expect(t).toContain('Saved Deep start.');
    expect(t).toMatch(/► Deep start +1,588 ☼/);
    // Back to Balanced, then load: the screen is unedited, so no question.
    h.s.key(press('Esc'));
    h.s.applyPreset('balanced');
    expect(count(h.s, 'e_pick_iron')).toBe(2);
    h.s.key(press('l'));
    h.s.key(press('Enter'));
    expect(h.asked).toEqual([]);
    expect(count(h.s, 'e_pick_iron')).toBe(3);
    expect(h.s.session.party[0]?.skills['cooking']).toBe(1);
    expect(text(h.s)).toContain('Loaded Deep start.');
    expect(h.s.edited).toBe(false);
  });

  it('asks before a load replaces edits, the safe answer being No', () => {
    const h = screen();
    h.lib.put({ name: 'Bare', supplies: [], skills: [] });
    h.s.apply({ type: 'SetSupply', entry: 'e_pick_iron', count: 4 });
    h.s.key(press('l'));
    h.yes.push(false);
    h.s.key(press('Enter'));
    expect(h.asked).toEqual(['c_load_loadout']);
    expect(count(h.s, 'e_pick_iron')).toBe(4);
    h.yes.push(true);
    h.s.key(press('Enter'));
    expect(h.s.session.supplies).toEqual([]);
  });

  it('a taken name asks before it is replaced; renaming to a taken name is refused; delete asks', () => {
    const h = screen();
    h.lib.put({ name: 'Alpha', supplies: [], skills: [] });
    h.lib.put({ name: 'Beta', supplies: [], skills: [] });
    h.s.key(press('l'));
    h.answers.push('alpha');
    h.yes.push(false);
    h.s.key(press('s'));
    expect(h.asked).toEqual(['c_overwrite_loadout']);
    expect(h.lib.list()[0]?.supplies).toEqual([]);
    h.answers.push('ALPHA');
    h.yes.push(true);
    h.s.key(press('s'));
    expect(h.lib.list().map((l) => l.name)).toEqual(['ALPHA', 'Beta']);
    expect(h.lib.list()[0]?.supplies.length).toBeGreaterThan(0);
    // Rename Beta to a taken name, then to a free one.
    h.s.key(press('↓'));
    expect(h.s.loadouts?.selected()?.name).toBe('Beta');
    h.answers.push('alpha');
    h.s.key(press('n'));
    expect(text(h.s)).toContain('A loadout named alpha exists already.');
    h.answers.push('Gamma');
    h.s.key(press('n'));
    expect(h.lib.list().map((l) => l.name)).toEqual(['ALPHA', 'Gamma']);
    expect(h.s.loadouts?.selected()?.name).toBe('Gamma');
    h.yes.push(false);
    h.s.key(press('x'));
    expect(h.lib.list()).toHaveLength(2);
    h.yes.push(true);
    h.s.key(press('x'));
    expect(h.lib.list().map((l) => l.name)).toEqual(['ALPHA']);
    expect(h.asked.slice(-2)).toEqual(['c_delete_loadout', 'c_delete_loadout']);
  });

  it('an over-budget load is shown, never trimmed: the panel says by how much and Embark says why', () => {
    const h = screen();
    h.lib.put({ name: 'Rich', supplies: [{ entry: 'e_anvil', count: 1 }, { entry: 'e_pick_iron', count: 7 }, { entry: 'e_mail_iron', count: 4 }, { entry: 'e_gone', count: 1 }], skills: [] });
    h.s.key(press('l'));
    const listed = text(h.s);
    expect(listed).toMatch(/► Rich +[\d,]+ ☼ +over budget/);
    h.s.key(press('Enter'));
    const over = h.s.session.total() - h.s.session.budget();
    expect(over).toBeGreaterThan(0);
    expect(h.s.loadouts?.note).toBe(`Loaded Rich. No longer in the game, left out: e_gone. It costs 2,106 ☼, ${over} ☼ over the budget here: trim it to embark.`);
    const t = text(h.s);
    expect(t).toContain('No longer in the game, left out: e_gone.');
    expect(t).toContain('trim it to embark.');
    expect(h.s.reason()).toContain('Over budget by');
    expect(h.s.session.budget()).toBe(1500);
  });

  it('the panel is modal: embark keys do nothing behind it', () => {
    const h = screen();
    h.s.key(press('l'));
    const party = h.s.session.party.map((d) => d.name);
    h.s.key(press('2'));
    h.s.key(press('r'));
    expect(h.s.tab).toBe(0);
    expect(h.s.session.party.map((d) => d.name)).toEqual(party);
    expect(h.s.translatedKeys()).toEqual(['panel']);
  });

  it('keeps every caption whole at eighty columns', () => {
    const h = screen();
    h.lib.put({ name: 'A name of thirty-two characters!', supplies: [{ entry: 'e_anvil', count: 9 }], skills: [] });
    h.s.key(press('l'));
    const t = text(h.s, 80, 50);
    expect(t).toContain('[s] Save current  [Enter] Load  [n] Rename  [x] Delete  [Esc] Close');
    expect(t).toMatch(/A name of thirty-two characters! +[\d,]+ ☼ +over budget/);
  });

  it('a screen without a library offers no loadouts', () => {
    const s = new EmbarkScreen(registry, 't531-none', { name: 'Greenhollow', peril: 0, tempC: 12 }, { embark: () => {}, back: () => {} }, keymap, strings);
    expect(s.loadouts).toBeNull();
    expect(s.presetOptions().some((o) => o.id === LOADOUTS_OPTION)).toBe(false);
    expect(s.key(press('l'))).toBe(false);
  });
});
