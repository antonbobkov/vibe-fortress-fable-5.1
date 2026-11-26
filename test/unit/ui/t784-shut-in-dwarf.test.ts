/**
 * T-784: a dwarf walled in from the fortress's food says so. Its starving line says where it is shut
 * in, the starving hint reads reach before it lists animals to slaughter, and the build tool warns
 * when a placement seals dwarves away from the hall (`reports/data/2026-11-26-playtest-7.md`, finding 1).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { Command } from '@core/commands';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { sealedBy } from '@ui/seal-check';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;
/** A level under the surface, in no cavern band. */
const DEEP = Z - 2;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** Dig a room and open it to view, as a finished dig leaves it. */
function dig(w: TestWorld, x: number, y: number, z: number, width: number, height: number): void {
  w.digRoom(x, y, z, width, height);
  for (let dy = -1; dy <= height; dy += 1) for (let dx = -1; dx <= width; dx += 1) w.discover(w.index(x + dx, y + dy, z));
}

const starving = (id: EntityId, need = 'hunger'): GameEvent => ({ type: 'Starving', id, need } as GameEvent);

/** A dwarf in a pocket dug in the rock, with no way out, and a dwarf and ten meals on the surface. */
function walledIn(seed: string): { w: TestWorld; lida: EntityId; out: EntityId } {
  const w = world(seed);
  dig(w, 30, 12, DEEP, 3, 1);
  const lida = w.spawnDwarf({ at: w.index(31, 12, DEEP), name: 'Lida Crageye' });
  const out = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Asa Forgehall' });
  w.spawnItem('easy_meal', 'granite', w.index(12, 10, Z), 10);
  w.spawnItem('drink', 'ale', w.index(13, 10, Z), 10);
  w.step(1);
  return { w, lida, out };
}

describe('T-784 a dwarf shut in from the food says so', () => {
  it('the starving and thirst lines say where the dwarf is shut in, fold by day, and the others stay as they were', () => {
    const { w, lida, out } = walledIn('t784-lines');
    const log = announcer(w);
    const day = 10 * TICKS_PER_DAY;
    const first = log.announce(starving(lida), w.readers, day);
    expect(first?.severity).toBe('alert');
    expect(first?.focus).toBe(w.index(31, 12, DEEP));
    expect(first?.line.subject).toBe(lida);
    expect(lineText(first!.line, strings)).toBe(`! Lida Crageye is starving, shut in at (31,12,z${DEEP}) with no way to food.`);
    log.announce(starving(out), w.readers, day + 5);
    expect(log.lines.at(-1)?.text).toBe('Asa Forgehall is starving.');
    // The next day it folds into its line, and does not flash again.
    const second = log.announce(starving(lida), w.readers, day + TICKS_PER_DAY);
    expect(second?.folded).toBe(true);
    const third = log.announce(starving(lida, 'thirst'), w.readers, day + 2 * TICKS_PER_DAY);
    expect(lineText(third!.line, strings)).toBe(`! Lida Crageye is dying of thirst, shut in at (31,12,z${DEEP}) with no way to drink.`);
    expect(log.lines.filter((l) => l.key === 'announce.starving_shut_in').map((l) => lineText(l, strings))).toEqual([
      `! Lida Crageye is starving, shut in at (31,12,z${DEEP}) with no way to food. (2 days)`,
    ]);
  });

  it('hint_starving says the food is there and who cannot reach it, before any animal to slaughter', () => {
    const { w, lida } = walledIn('t784-hint');
    w.spawnTame('cow', w.index(20, 14, Z));
    w.setNeed(lida, 'hunger', 100);
    const ui = defaultUiState(Z);
    const log = announcer(w);
    const hints = new HintEngine(w.game.registry, ui, log);
    hints.onEvents([starving(lida)], w.readers);
    expect(log.lines.filter((l) => l.category === 'hint').map((l) => l.text)).toEqual([
      '☼ Food is in the stockpiles, but 1 dwarf cannot reach it: [u] lists them.',
    ]);
  });

  it('a coffin that closes a one-tile pocket warns on the status row and in the log, and is placed all the same', () => {
    const w = world('t784-coffin');
    // A corridor from the hearth to a dead end, a dwarf at its end.
    dig(w, 10, 10, DEEP, 7, 1);
    w.build('hearth', w.index(10, 10, DEEP), 'granite');
    const ranulf = w.spawnDwarf({ at: w.index(16, 10, DEEP), name: 'Ranulf Ashbrow' });
    w.spawnDwarf({ at: w.index(12, 10, DEEP) });
    w.step(1);
    expect(sealedBy(w.readers, [w.index(15, 10, DEEP)])).toEqual({ ids: [ranulf], home: 'hall' });
    expect(sealedBy(w.readers, [w.index(13, 10, DEEP)])).toEqual({ ids: [ranulf], home: 'hall' });
    // One that leaves a way round seals no one.
    dig(w, 13, 11, DEEP, 3, 1);
    w.step(1);
    expect(sealedBy(w.readers, [w.index(14, 10, DEEP)])).toBeNull();

    const sent: Command[] = [];
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(DEEP), submit: (cmd) => { sent.push(cmd); w.submit(cmd); },
      speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const screen = new FortressScreen(host, keymap, strings);
    screen.openPanel('build');
    screen.build.choose('f');
    screen.build.list.selected = screen.build.rows(screen.ctx).findIndex((row) => row.id === 'coffin');
    screen.build.arm();
    screen.place({ x: 16, y: 10, z: DEEP });
    expect(screen.statusRow2()).not.toContain('seals');
    screen.place({ x: 15, y: 10, z: DEEP });
    expect(screen.statusRow2().startsWith(`Coffin placed · seals 1 dwarf at (16,10,z${DEEP}) from the hall`)).toBe(true);
    const line = screen.log.lines.at(-1);
    expect(line?.severity).toBe('alert');
    expect(line?.text).toBe(`Coffin placed · seals 1 dwarf at (16,10,z${DEEP}) from the hall`);
    expect(line?.focus).toBe(w.index(16, 10, DEEP));
    expect(sent.filter((c) => c.type === 'PlaceBuilding')).toHaveLength(2);
  });
});
