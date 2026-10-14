/**
 * T-273: the game says that wild beasts kill, and what stops them, before it matters: the arrival
 * of a dangerous species is an alert that pauses once, three hints, the Threats panel's Wildlife
 * section, the Military panel's lines, the embark hint and the world map note.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine, hintPredicate } from '@ui/hints';
import { pluralName } from '@ui/messages';
import { EMBARK_HINT_SECONDS } from '@ui/constants';
import type { Speed } from '@ui/status';
import { EmbarkScreen } from '@ui/screens/embark';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, registry, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, dwarves = 3) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids: EntityId[] = [];
  for (let k = 0; k < dwarves; k += 1) ids.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const layout = computeLayout(80, 42, true);
  const state = { speed: 1 as Speed };
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => w.submit(c),
    speed: () => state.speed, setSpeed: (s) => { state.speed = s; },
    pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {}, layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = (): string[] => { const s = surface(80, 42); screen.draw(s); return s.lines(); };
  return { w, screen, host, state, ids, draw };
}

const spawned = (species: string): GameEvent => ({ type: 'AnimalSpawned', id: 1, species });

describe('T-273 the arrival of a dangerous species', () => {
  it('is an alert for a bear and a lynx, a note for a deer', () => {
    const f = setup('t273-alert');
    const log = new AnnouncementLog(strings, f.w.game.registry);
    log.register(f.w.game.world.registrations.announcements);
    const bear = log.announce(spawned('bear'), f.w.readers, 1);
    expect(bear?.severity).toBe('alert');
    expect(bear?.line.text).toBe('A bear has come to the valley.');
    expect(log.announce(spawned('lynx'), f.w.readers, 2)?.severity).toBe('alert');
    const deer = log.announce(spawned('deer'), f.w.readers, 3);
    expect(deer?.severity).toBe('note');
    expect(deer?.line.text).toBe('A deer has arrived.');
    // A timid carnivore and a cavern species are not announced as a beast at the valley.
    expect(log.announce(spawned('fox'), f.w.readers, 4)?.severity).toBe('note');
    expect(log.announce(spawned('blind_stalker'), f.w.readers, 5)?.severity).toBe('note');
  });

  it('is one line per species with the count, and pauses the game once per fortress', () => {
    const f = setup('t273-pause');
    f.screen.onEvents([spawned('wolf'), spawned('wolf'), spawned('wolf'), spawned('deer')]);
    const lines = f.screen.log.lines.map((l) => l.text);
    expect(lines).toContain('3 wolves have come to the valley.');
    expect(lines.filter((t) => t.includes('wolf') || t.includes('wolves'))).toHaveLength(1);
    expect(f.state.speed).toBe(0);
    expect(f.screen.ui.wildlifeAlerted).toBe(true);
    f.state.speed = 1;
    f.screen.onEvents([spawned('bear')]);
    expect(f.screen.log.lines.map((l) => l.text)).toContain('A bear has come to the valley.');
    expect(f.state.speed).toBe(1);
  });

  it('keeps the pause flag in the saved interface state', () => {
    const f = setup('t273-saved');
    f.screen.onEvents([spawned('boar')]);
    const restored = defaultUiState(z);
    fromSaved(restored, toSaved(f.screen.ui, f.screen.log.lines));
    expect(restored.wildlifeAlerted).toBe(true);
    const fresh = defaultUiState(z);
    fromSaved(fresh, toSaved(defaultUiState(z), []));
    expect(fresh.wildlifeAlerted).toBe(false);
  });

  it('writes plurals of creature names', () => {
    expect(pluralName('wolf')).toBe('wolves');
    expect(pluralName('lynx')).toBe('lynxes');
    expect(pluralName('bear')).toBe('bears');
    expect(pluralName('snow leopard')).toBe('snow leopards');
    expect(pluralName('badger')).toBe('badgers');
  });
});

describe('T-273 hints', () => {
  const log = (f: ReturnType<typeof setup>): AnnouncementLog => f.screen.log;
  it('hint_predator follows the first dangerous arrival, not a deer', () => {
    const f = setup('t273-predator');
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, log(f));
    hints.onEvents([spawned('deer'), { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_predator');
    hints.onEvents([spawned('bear'), { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_predator');
    expect(log(f).lines.some((l) => l.text.includes('A beast that hunts dwarves is near.'))).toBe(true);
  });

  it('hint_alert also follows the first fortress dwarf wounded by an animal', () => {
    const f = setup('t273-wounded');
    const bear = f.w.spawnCreature('bear', f.w.index(30, 30, z), 'wild');
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, log(f));
    hints.onEvents([{ type: 'AttackResolved', attackerId: bear, defenderId: bear, part: 0, damageType: 'cut', amount: 1, outcome: 'hit' }, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_alert');
    hints.onEvents([{ type: 'AttackResolved', attackerId: bear, defenderId: f.ids[0] as number, part: 0, damageType: 'cut', amount: 1, outcome: 'hit' }, { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_alert');
  });

  it('hint_shelter waits for day 3 of the first spring and needs no squad', () => {
    const base = { tick: 0, year: 1, season: 0, day: 3 };
    const facts = (extra: object) => ({ ...base, ...extra }) as Parameters<typeof hintPredicate>[1];
    expect(hintPredicate('hint_shelter', facts({ squadExists: false }))).toBe(true);
    expect(hintPredicate('hint_shelter', facts({ squadExists: true }))).toBe(false);
    expect(hintPredicate('hint_shelter', facts({ squadExists: false, day: 2 }))).toBe(false);
    expect(hintPredicate('hint_shelter', facts({ squadExists: false, season: 1 }))).toBe(false);
  });

  it('hint_shelter shows on day 3 with no squad, and not once a squad exists', () => {
    const f = setup('t273-shelter');
    f.w.step(3 * TICKS_PER_DAY);
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, log(f));
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).not.toContain('hint_shelter');
    const g = setup('t273-shelter-none');
    g.w.step(3 * TICKS_PER_DAY);
    const ui2 = defaultUiState(z);
    new HintEngine(g.w.game.registry, ui2, log(g)).onEvents([{ type: 'HourPassed', hour: 0 }], g.w.readers);
    expect(ui2.hintsShown).toContain('hint_shelter');
  });

  it('hint_food fires when the edible stock is below two days for the population', () => {
    const f = setup('t273-food', 8);
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, log(f));
    hints.onEvents([{ type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_food');
    const g = setup('t273-food-ok', 8);
    g.w.spawnItem('easy_meal', 'granite', g.w.index(12, 12, z), 6);
    const ui2 = defaultUiState(z);
    new HintEngine(g.w.game.registry, ui2, log(g)).onEvents([{ type: 'HourPassed', hour: 0 }], g.w.readers);
    expect(ui2.hintsShown).not.toContain('hint_food');
  });
});

describe('T-273 panels and screens', () => {
  it('the Threats panel lists dangerous species with a count, near or far, and reads Active: wildlife', () => {
    const f = setup('t273-threats');
    f.screen.openPanel('threats');
    expect(f.draw().join('\n')).toContain('Active: none');
    f.w.spawnCreature('bear', f.w.index(14, 10, z), 'wild');
    f.w.spawnCreature('wolf', f.w.index(70, 70, z), 'wild');
    f.w.spawnCreature('wolf', f.w.index(71, 70, z), 'wild');
    f.w.spawnCreature('deer', f.w.index(12, 12, z), 'wild');
    f.w.step(1);
    const text = f.draw().join('\n');
    expect(text).toContain('Active: wildlife');
    expect(text).toContain('Wildlife');
    expect(text).toContain('bear x1  near the hall');
    expect(text).toContain('wolf x2  far');
    expect(text).not.toContain('deer');
  });

  it('the Military panel says what the alert does and what a first squad needs', () => {
    const f = setup('t273-military');
    f.screen.openPanel('military');
    let text = f.draw().join('\n');
    expect(text).toContain('Calm: everyone works.');
    expect(text).toContain('A squad of three with iron spears');
    expect(text).toContain('and a kill order holds off boars.');
    f.w.submit({ type: 'SetAlert', level: 'watchful' });
    f.w.step(1);
    text = f.draw().join('\n');
    expect(text).toContain('Watch: squads stand to;');
    f.w.submit({ type: 'SetAlert', level: 'hearth' });
    f.w.step(1);
    text = f.draw().join('\n');
    expect(text).toContain('Hearth: civilians go to the');
  });

  it('the embark hint alternates every five seconds of real time and on a tab change', () => {
    let now = 0;
    const s = new EmbarkScreen(registry, 'embark-ui', { name: 'Greenhollow', peril: 0, tempC: 12 },
      { embark: () => {}, back: () => {}, now: () => now }, keymap, strings);
    const hint = (): string => { const surf = surface(100, 45); s.draw(surf); return surf.lines().join('\n'); };
    s.setTab(1);
    const first = hint();
    const a = first.includes('Hint: two picks and one axe') ? 'picks' : 'beasts';
    now += EMBARK_HINT_SECONDS * 1000;
    const second = hint();
    expect(second.includes('Hint: two picks and one axe')).toBe(a !== 'picks');
    expect(second.includes('clubs lose to boars') || first.includes('clubs lose to boars')).toBe(true);
    expect(second).not.toBe(first);
  });
});
