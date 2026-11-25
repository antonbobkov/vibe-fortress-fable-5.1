/**
 * T-624: the Hearth alert with no shelter says so (the military panel's alert line, the activity
 * "Idle (no shelter)" since T-629), the predator hint asks for a hall first while there is none, a squad
 * on Train with no barracks says it cannot train (and the barracks row reads a zone made while
 * paused), and activities read as words: need errands as verbs, a craft job with its recipe, and
 * "Idle" on the hover line as in Units (10 § Player-facing behavior, `ui-screens/panels.md` § Military).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import type { Command } from '@core/commands';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { DwarvesReader } from '@systems/dwarves';
import { HintEngine } from '@ui/hints';
import { creatureSummary } from '@ui/panels/look';
import { activityLabel } from '@ui/panels/units';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, keymap, press, strings, surface, theme } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function setup(seed: string, count = 3) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const dwarves: EntityId[] = [];
  for (let k = 0; k < count; k += 1) dwarves.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const sent: Command[] = [];
  const layout = computeLayout(80, 42, true);
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui: defaultUiState(z), submit: (c) => { sent.push(c); w.submit(c); },
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
    layout: () => layout, precondition: () => false,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements, now: () => 0,
    prompt: () => {}, laborManager: () => {},
  };
  const screen = new FortressScreen(host, keymap, strings);
  const draw = () => { const s = surface(80, 42); screen.draw(s); return s; };
  return { w, host, screen, sent, dwarves, draw };
}

const text = (s: ReturnType<ReturnType<typeof setup>['draw']>): string => s.lines().join('\n');
const rowOf = (s: ReturnType<ReturnType<typeof setup>['draw']>, part: string): number => s.lines().findIndex((l) => l.includes(part));
/** The sidebar's text as one line: wrapped lines joined, borders and padding dropped. */
const panel = (s: ReturnType<ReturnType<typeof setup>['draw']>): string => s.lines().map((l) => l.split('│')[1] ?? '').join(' ').replace(/\s+/g, ' ');

describe('T-624 the Hearth alert with no shelter', () => {
  it('the alert line counts the dwarves left at the wagon, in the alert colour, and their activity says why', () => {
    const f = setup('t624-no-shelter');
    f.screen.openPanel('military');
    f.screen.key(press('3'));
    f.w.step(5);
    const reader = f.w.readers.of<DwarvesReader>('10');
    expect(reader.unsheltered()).toEqual(f.dwarves);
    const s = f.draw();
    expect(text(s)).toContain('Hearth: civilians stop work and');
    expect(panel(s)).toContain('No shelter: 3 dwarves keep working in the open. Make a Hearth hall [z] or a room behind a door.');
    const row = rowOf(s, 'No shelter:');
    expect(fgOfText(s, row, 'No shelter:')).toBe(hexOf(theme.alert));
    // Units, the hover line and Look: an idle dwarf the alert has no shelter for reads "Idle (no shelter)" (T-629).
    f.screen.openPanel('units');
    expect(text(f.draw())).toContain('Idle (no');
    const ctx = { readers: f.w.readers, registry: f.w.game.registry, strings };
    expect(creatureSummary(f.w.readers, f.w.game.registry, strings, f.dwarves[0] as EntityId)).toBe('Dwarf00 Stone, Idle (no shelter)');
    // Calm again: the line is gone and the dwarves are idle.
    f.screen.openPanel('military');
    f.screen.key(press('1'));
    f.w.step(1);
    expect(reader.unsheltered()).toEqual([]);
    expect(text(f.draw())).not.toContain('No shelter');
    expect(activityLabel(ctx, f.dwarves[0] as EntityId)).toBe('Idle');
  });

  it('a hearth is a hall the dwarves shelter in; with a hall, those left out cannot reach it', () => {
    const f = setup('t624-hall', 2);
    f.w.build('hearth', f.w.index(30, 30, z), 'granite');
    f.screen.openPanel('military');
    f.screen.key(press('3'));
    f.w.step(2);
    expect(f.w.readers.of<DwarvesReader>('10').unsheltered()).toEqual([]);
    expect(panel(f.draw())).not.toContain('No shelter');
    // A dwarf the hall does not take in (a gate locked on it): the line says it cannot reach the hall.
    const real = f.w.readers;
    const left = f.dwarves[1] as EntityId;
    (f.host as { readers: ReaderSet }).readers = new Proxy(real, {
      get: (target, key) => key === 'of'
        ? (system: string) => system === '10' ? { ...target.of<DwarvesReader>('10'), unsheltered: () => [left] } : target.of(system)
        : Reflect.get(target, key) as unknown,
    });
    expect(panel(f.draw())).toContain('No shelter: 1 dwarf keeps working, unable to reach the hall or a room behind a door.');
  });
});

describe('T-624 the predator hint asks for a hall first', () => {
  const spawned = (species: string): GameEvent => ({ type: 'AnimalSpawned', id: 1, species });

  it('with no shelter the hint says the alert needs a hall with a door; a later beast with a shelter gives the full hint', () => {
    const f = setup('t624-hint');
    const ui = defaultUiState(z);
    const hints = new HintEngine(f.w.game.registry, ui, f.screen.log);
    hints.onEvents([spawned('bear'), { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_predator_open');
    expect(ui.hintsShown).not.toContain('hint_predator');
    expect(f.screen.log.lines.some((l) => l.text.includes('raises the Hearth alert once your hall has a door'))).toBe(true);
    // A bedroom is a shelter: the next beast brings the hint that asks for the alert.
    f.w.zone('bedroom', [f.w.index(40, 40, z)]);
    hints.onEvents([spawned('bear'), { type: 'HourPassed', hour: 0 }], f.w.readers);
    expect(ui.hintsShown).toContain('hint_predator');
  });
});

describe('T-624 training needs a barracks', () => {
  it('Train with no barracks says so on the status row and in the barracks row, which reads a zone made while paused', () => {
    const f = setup('t624-train', 2);
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    const squadId = f.w.readers.of<{ squads(): { id: EntityId }[] }>('16').squads()[0]?.id ?? 0;
    f.w.submit({ type: 'SetSquadMembers', squadId, members: f.dwarves });
    f.w.step(1);
    f.screen.openPanel('military');
    f.screen.key(press('T', { shift: true }));
    expect(f.screen.currentNotice).toBe('No barracks: the squad cannot train. [z] Barracks, then [b].');
    f.w.step(1);
    let s = f.draw();
    // The barracks row says so in the alert colour; the warning in words is the mode line's (T-729).
    expect(panel(s)).toContain('No barracks [b] assign');
    expect(fgOfText(s, rowOf(s, 'No barracks  [b]'), 'No barracks')).toBe(hexOf(theme.alert));
    // A barracks made now (as while paused, before any tick) is the squad's default at once.
    const ticks = f.w.readers.calendar.tick;
    f.w.zone('barracks', [f.w.index(20, 20, z), f.w.index(21, 20, z)]);
    s = f.draw();
    expect(f.w.readers.calendar.tick).toBe(ticks);
    expect(text(s)).toContain('Barracks #1 (default)  [b] set');
    expect(panel(s)).not.toContain('No barracks');
    // With a barracks, unarmed members are told they drill dodging only.
    f.screen.key(press('O', { shift: true }));
    f.w.step(1);
    f.screen.key(press('T', { shift: true }));
    expect(f.screen.currentNotice).toBe('Unarmed members train dodging only: see the Armed line.');
  });

  it('a squad that is off with no barracks keeps the quiet row', () => {
    const f = setup('t624-off', 1);
    f.w.submit({ type: 'CreateSquad', name: 'The Hearthguard' });
    f.w.step(1);
    f.screen.openPanel('military');
    expect(text(f.draw())).toContain('No barracks  [b] assign');
  });
});

describe('T-624 activity words', () => {
  function withActivity(f: ReturnType<typeof setup>, id: EntityId, activity: string): void {
    const brain = f.w.game.world.entities.get(id, C.Brain);
    if (brain === undefined) throw new Error('no brain');
    f.w.game.world.entities.add(id, C.Brain, { ...brain, activity });
  }

  it('need errands read as verbs, and the hover line says Idle as Units does', () => {
    const f = setup('t624-words', 1);
    const id = f.dwarves[0] as EntityId;
    const ctx = { readers: f.w.readers, registry: f.w.game.registry, strings };
    const cases: [string, string][] = [['hunger', 'Eating'], ['thirst', 'Drinking'], ['sleep', 'Sleeping'], ['social', 'Talking'], ['comfort', 'Resting'], ['joy', 'Visiting the hearth'], ['Dig', 'Dig'], ['No job', 'Idle']];
    for (const [raw, shown] of cases) {
      withActivity(f, id, raw);
      expect(activityLabel(ctx, id)).toBe(shown);
    }
    withActivity(f, id, 'No job');
    expect(creatureSummary(f.w.readers, f.w.game.registry, strings, id)).toBe('Dwarf00 Stone, Idle');
    withActivity(f, id, 'hunger');
    f.screen.openPanel('units');
    expect(text(f.draw())).toContain('Eating');
  });

  it('a job named for its recipe names the recipe of the dwarf\'s job', () => {
    const f = setup('t624-recipe', 1);
    const id = f.dwarves[0] as EntityId;
    const raw = f.w.readers;
    // The dwarf works a craft job for the bed recipe.
    const readers = {
      ...raw,
      has: (system: string) => raw.has(system),
      of: (system: string) => system === '11' ? { forWorker: (worker: EntityId) => worker === id ? { data: { recipe: 'make_bed' } } : undefined } : raw.of(system),
    } as unknown as ReaderSet;
    withActivity(f, id, 'Craft (recipe)');
    expect(activityLabel({ readers, registry: f.w.game.registry, strings }, id)).toBe('Craft: bed');
    // Without the job's recipe the name stays as 10 gives it.
    expect(activityLabel({ readers: raw, registry: f.w.game.registry, strings }, id)).toBe('Craft (recipe)');
  });
});
