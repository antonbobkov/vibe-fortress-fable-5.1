/**
 * T-773: after a lost fight the dead lay unburied for days, the Mood panel's top thought was "The
 * dead lie unburied." with nothing under it, and the log said nothing of coffins (playtest
 * 2026-11-25, finding 6). A daily alert counts the dead and the free coffins and says how many more
 * to build (15 § Registrations, 24 § Announcements and the log), and the Mood panel says what helps.
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { MoraleReader, ThoughtView } from '@systems/morale';
import { UNBURIED_DAYS } from '@systems/morale/constants';
import type { ItemsReader } from '@systems/items';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import type { GameEvent } from '@core/events';
import type { PanelContext } from '@ui/panels/context';
import { drawMoodPanel, MoodPanel } from '@ui/panels/mood';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings, surface } from './ui-fixture';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** Three dwarves killed where they stand; their corpses' ids, the first one dead first, and the tick the last fell. */
function threeDead(w: TestWorld): { corpses: EntityId[]; died: number } {
  const ids = [0, 1, 2].map((k) => w.spawnDwarf({ at: w.index(20 + 4 * k, 20, Z) }));
  w.step(1);
  const corpses: EntityId[] = [];
  for (const dwarf of ids) {
    const hp = w.game.world.entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === dwarf), 30);
    corpses.push(w.events('CorpseCreated').find((e) => e['creatureId'] === dwarf)!['id'] as EntityId);
    w.step(5);
  }
  return { corpses, died: w.tick };
}

describe('T-773 the unburied dead say how many coffins are missing', () => {
  it('three bodies past UNBURIED_DAYS: no coffin, one coffin, three coffins; nothing before', () => {
    const w = world('t773-coffins');
    const { corpses, died } = threeDead(w);
    const log = announcer(w);
    const oldest = w.readers.of<ItemsReader>('13').tileOf(corpses[0]!);
    // Not yet: no body has lain unburied past UNBURIED_DAYS.
    expect(log.unburiedAlert(w.readers, died + UNBURIED_DAYS * TICKS_PER_DAY - 200)).toBeNull();
    const day = died + UNBURIED_DAYS * TICKS_PER_DAY + 10;
    const none = log.unburiedAlert(w.readers, day);
    expect(none?.severity).toBe('alert');
    expect(lineText(none!.line, strings)).toBe('! 3 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z].');
    expect(none?.focus).toBe(oldest);
    expect(none?.line.subject).toBe(corpses[0]);

    const one = w.build('coffin', w.index(40, 30, Z), 'granite');
    const few = log.unburiedAlert(w.readers, day + TICKS_PER_DAY);
    expect(lineText(few!.line, strings)).toBe('! 3 dead wait for burial and only 1 coffin is free: build 2 more [b > Furniture].');
    expect(few?.focus).toBe(oldest);

    w.build('coffin', w.index(42, 30, Z), 'granite');
    w.build('coffin', w.index(44, 30, Z), 'granite');
    expect(one).toBeGreaterThan(0);
    const enough = log.unburiedAlert(w.readers, day + 2 * TICKS_PER_DAY);
    expect(lineText(enough!.line, strings)).toBe('! 3 dead wait for burial: 3 coffins are free.');
  });

  it('the alert is a standing alert: the next day with the same words folds into its line', () => {
    const w = world('t773-fold');
    const { died } = threeDead(w);
    const log = announcer(w);
    const day = died + (UNBURIED_DAYS + 1) * TICKS_PER_DAY;
    const first = log.unburiedAlert(w.readers, day);
    const second = log.unburiedAlert(w.readers, day + TICKS_PER_DAY);
    expect(first?.folded).toBeUndefined();
    expect(second?.folded).toBe(true);
    expect(log.lines.filter((l) => l.key === 'announce.unburied')).toHaveLength(1);
    expect(second?.line.days).toBe(2);
  });

  it('the fortress screen gives the alert on DayPassed', () => {
    const w = world('t773-screen');
    threeDead(w);
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => w.submit(cmd),
      speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const f = new FortressScreen(host, keymap, strings);
    const dayPassed = { type: 'DayPassed' } as unknown as GameEvent;
    f.onEvents([dayPassed]);
    expect(f.log.lines.filter((l) => l.key === 'announce.unburied')).toHaveLength(0);
    w.step((UNBURIED_DAYS + 1) * TICKS_PER_DAY);
    f.onEvents([dayPassed]);
    expect(f.log.lines.filter((l) => l.key === 'announce.unburied').map((l) => lineText(l, strings))).toEqual([
      '! 3 dead wait for burial and no coffin is free: build coffins [b > Furniture], best in a tomb [z].',
    ]);
  });

  it('the Mood panel says what helps under "The dead lie unburied."', () => {
    const w = world('t773-mood');
    ['Asa', 'Njal'].forEach((name, k) => w.spawnDwarf({ at: w.index(10 + k, 10, Z), name }));
    w.step(2);
    const thoughts: ThoughtView[] = [{ id: 'unburied_dead', text: 'The dead lie unburied.', value: -4, remainingHours: null }];
    vi.spyOn(w.readers.of<MoraleReader>('15'), 'thoughts').mockImplementation(() => thoughts.map((t) => ({ ...t })));
    const ctx: PanelContext = {
      readers: w.readers, registry: w.game.registry, strings,
      submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
    };
    const s = surface(60, 30);
    drawMoodPanel(s, { col: 0, row: 0, cols: 60, rows: 30 }, new MoodPanel(), ctx);
    const rows = s.lines().map((r) => r.trim()).filter((r) => r !== '');
    const at = rows.findIndex((r) => r.startsWith('-4 The dead lie unburied.'));
    expect(at).toBeGreaterThanOrEqual(0);
    // The Helps line and the rows it wraps onto, up to the next section.
    const end = rows.findIndex((r, k) => k > at && r.startsWith('Name'));
    const helps = rows.slice(at + 1, end).join(' ').replace(/ +/g, ' ');
    expect(helps).toBe('Helps: a coffin [b > Furniture] in a tomb zone [z] for each body, or a memorial slab for one who is lost');
  });
});
