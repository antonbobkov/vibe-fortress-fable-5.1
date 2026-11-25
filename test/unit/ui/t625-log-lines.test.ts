/**
 * T-625: log lines that say why (`reports/audits/2026-11-18-t618-first-year-ux.md`, findings
 * 16-20). A death says how it came, the immigrants line names the newcomers and what they do, a
 * breach marks its tile and the threats panel says where it is, the log panel opens on its newest
 * entry, and the Mood panel marks a cut thought with `»`.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog } from '@ui/announcements';
import { drawThreatsPanel } from '@ui/panels/threats';
import { tableRow } from '@ui/widgets/table';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState, fromSaved, shownCursor, toSaved } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

function screenOf(w: TestWorld, ui = defaultUiState(Z)): FortressScreen {
  const host: FortressHost = {
    readers: w.readers, registry: w.game.registry, ui, submit: (cmd) => w.submit(cmd),
    speed: () => 1, setSpeed: () => {}, pan: () => {}, changeZ: (dz) => { ui.z += dz; }, centerOn: (_x, _y, z) => { ui.z = z; }, home: () => {}, zoom: () => {},
    layout: () => computeLayout(80, 42, true), precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
    now: () => 1000, confirm: (_id, _params, reply) => reply(true),
  };
  return new FortressScreen(host, keymap, strings);
}

function nameOf(w: TestWorld, id: EntityId): string {
  return w.game.world.entities.get(id, C.Creature)?.name ?? '';
}

/** A dwarf whose skills are all 0 but the ones given. */
function dwarfWith(w: TestWorld, x: number, skills: Record<string, number>, ageYears?: number): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, 20, Z), ...(ageYears === undefined ? {} : { ageYears }) });
  const component = w.game.world.entities.get(id, C.Skills);
  if (component !== undefined) {
    const table = w.game.registry.table('skills');
    const level = new Uint8Array(component.level.length);
    for (const [skill, n] of Object.entries(skills)) level[table.index(skill)] = n;
    w.game.world.entities.add(id, C.Skills, { ...component, level });
  }
  return id;
}

describe('T-625 a death says how it came', () => {
  it('a dwarf\'s death line by cause; a cause with no line keeps "has died."', () => {
    const w = world('t625-causes');
    const log = announcer(w);
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const lines: Record<string, string> = {};
    for (const cause of ['bled_out', 'starvation', 'infection', 'frozen', 'bridge_crush', 'drowned', 'fell', 'burnt', 'magma', 'lightning', 'killed', 'old_age']) {
      const event = { type: 'CreatureDied', id: 9999, cause, killerId: 0, tile: w.index(10, 10, Z), species: dwarf, name: 'Ivar Coaleye', faction: 'fortress' } as unknown as GameEvent;
      const done = log.announce(event, w.readers, 1000 * Object.keys(lines).length);
      expect(done?.severity).toBe('danger');
      lines[cause] = done?.line.text ?? '';
    }
    expect(lines).toEqual({
      bled_out: 'Ivar Coaleye has bled to death.',
      starvation: 'Ivar Coaleye has starved to death.',
      infection: 'Ivar Coaleye has died of an infection.',
      frozen: 'Ivar Coaleye has frozen to death in the ice.',
      bridge_crush: 'Ivar Coaleye has been crushed by a bridge.',
      drowned: 'Ivar Coaleye has drowned.',
      fell: 'Ivar Coaleye has died in a fall.',
      burnt: 'Ivar Coaleye has burned to death.',
      magma: 'Ivar Coaleye has died in magma.',
      lightning: 'Ivar Coaleye has been struck dead by lightning.',
      killed: 'Ivar Coaleye has died of wounds.',
      old_age: 'Ivar Coaleye has died.',
    });
  });

  it('a dwarf killed by a boar that dies in the same tick: the event carries the killer, and the line names it', () => {
    const w = world('t625-boar');
    const log = announcer(w);
    const dwarf = w.spawnDwarf({ at: w.index(20, 20, Z) });
    const boar = w.spawnCreature('boar', w.index(21, 20, Z), 'wild');
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: boar, part: 'torso', damageType: 'edge', amount: 999 });
    w.game.world.emit({ type: 'DamageDealt', defenderId: boar, attackerId: dwarf, part: 'torso', damageType: 'edge', amount: 999 });
    w.step(5);
    expect(w.game.world.entities.alive(boar)).toBe(false);
    const died = w.events('CreatureDied').find((e) => e['id'] === dwarf);
    expect(died?.['cause']).toBe('killed');
    expect(died?.['killerName']).toBe(nameOf(w, boar) || 'boar');
    expect(died?.['killerSpecies']).toBe(w.game.registry.table('creatures').index('boar'));
    expect(log.announce(died!, w.readers, w.tick)?.line.text).toMatch(/ has been killed by a boar\.$/);
  });

  it('a fall that destroys the torso is a death with cause fell', () => {
    const w = world('t625-fall');
    const ids = Array.from({ length: 8 }, (_, k) => w.spawnDwarf({ at: w.index(10 + 2 * k, 30, Z) }));
    for (const id of ids) w.game.world.emit({ type: 'Fell', id, levels: 12, landedOn: w.index(10, 30, Z) });
    w.step(5);
    const deaths = w.events('CreatureDied').filter((e) => ids.includes(e['id'] as number));
    expect(deaths.length).toBeGreaterThan(0);
    for (const death of deaths) expect(death['cause']).toBe('fell');
  });

  it('a pet and a wild creature say how they died too', () => {
    const w = world('t625-animals');
    const log = announcer(w);
    const dog = w.spawnCreature('dog', w.index(10, 10, Z), 'wild');
    const species = w.game.world.entities.get(dog, C.Creature)?.species ?? 0;
    const line = log.announce({ type: 'CreatureDied', id: dog, cause: 'drowned', killerId: 0, tile: w.index(10, 10, Z), species, faction: 'wild' } as unknown as GameEvent, w.readers, 1);
    expect(line?.line.text).toBe('A dog has drowned.');
    expect(line?.severity).toBe('note');
  });
});

describe('T-625 the immigrants line names the newcomers', () => {
  it('names a small wave with each one\'s best skill, a child as a child', () => {
    const w = world('t625-wave');
    const log = announcer(w);
    const a = dwarfWith(w, 10, { farming: 5, brewing: 2 });
    const b = dwarfWith(w, 12, { woodcutting: 3 });
    const c = dwarfWith(w, 14, {});
    const line = log.announce({ type: 'ImmigrantsArrived', ids: [a, b, c], count: 3, children: 0, guaranteed: true } as unknown as GameEvent, w.readers, 1);
    expect(line?.line.text).toBe(`${nameOf(w, a)} (Farming 5), ${nameOf(w, b)} (Woodcutting 3) and ${nameOf(w, c)} have come to join the hall.`);
    expect(line?.severity).toBe('alert');
    const child = dwarfWith(w, 16, {}, 5);
    const one = log.announce({ type: 'ImmigrantsArrived', ids: [child], count: 1, children: 1, guaranteed: false } as unknown as GameEvent, w.readers, 2000);
    expect(one?.line.text).toBe(`${nameOf(w, child)} (a child) has come to join the hall.`);
  });

  it('counts a wave larger than LOG_IMMIGRANT_NAMES and says where to see them', () => {
    const w = world('t625-big-wave');
    const log = announcer(w);
    const ids = Array.from({ length: 6 }, (_, k) => dwarfWith(w, 10 + 2 * k, {}));
    const line = log.announce({ type: 'ImmigrantsArrived', ids, count: 6, children: 2, guaranteed: false } as unknown as GameEvent, w.readers, 1);
    expect(line?.line.text).toBe('6 dwarves have come to join the hall, 2 of them children. [u] lists them.');
  });
});

describe('T-625 a breach is marked and placed', () => {
  it('marks its tile on its own level, records it for the threats panel, and the record is saved', () => {
    const w = world('t625-breach');
    const ui = defaultUiState(Z);
    const f = screenOf(w, ui);
    const map = w.readers.map;
    const tile = map.index(30, 25, Z - 2);
    f.onEvents([{ type: 'CavernBreached', cavern: 1, tile } as unknown as GameEvent]);
    expect(ui.breaches).toEqual([[1, tile]]);
    expect(ui.mark).toEqual({ x: 30, y: 25, z: Z - 2 });
    // The mark is drawn as the cursor on its own level only, and the cursor wins over it.
    expect(shownCursor(ui)).toBeNull();
    ui.z = Z - 2;
    expect(shownCursor(ui)).toEqual({ x: 30, y: 25 });
    ui.cursor = { x: 1, y: 1 };
    expect(shownCursor(ui)).toEqual({ x: 1, y: 1 });
    ui.cursor = null;

    w.game.terrain!.core.cavernBreached[0] = true;
    const s = surface(36, 32);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 36, rows: 32 }, f.threats, f.ctx, false, ui.breaches);
    const text = s.lines().join('\n');
    expect(text).toContain(`1: breached at (30,25,z${Z - 2})`);
    expect(text).toMatch(/ {3}monsters \d+/);
    // Without the record (an older save) the row is as before.
    const old = surface(36, 32);
    drawThreatsPanel(old, { col: 0, row: 0, cols: 36, rows: 32 }, f.threats, f.ctx);
    expect(old.lines().join('\n')).toMatch(/1: breached · monsters \d+/);

    const restored = defaultUiState(Z);
    fromSaved(restored, toSaved(ui, []));
    expect(restored.breaches).toEqual([[1, tile]]);
    expect(restored.mark).toBeNull();
  });

  it('a log line the view goes to is marked; Esc closing the panel clears the mark', () => {
    const w = world('t625-focus');
    const ui = defaultUiState(Z);
    const f = screenOf(w, ui);
    const tile = w.readers.map.index(12, 14, Z);
    f.log.append('alert', 'Something here.', 1, tile);
    f.openPanel('log');
    f.draw(surface(80, 42));
    f.key(press('Enter'));
    expect(ui.mark).toEqual({ x: 12, y: 14, z: Z });
    f.key(press('Esc'));
    expect(ui.panel).toBeNull();
    expect(ui.mark).toBeNull();
  });
});

describe('T-625 the log panel opens on its newest entry', () => {
  it('a choice holds while the panel is open; reopened, it shows the newest entry, unmarked', () => {
    const w = world('t625-reopen');
    const f = screenOf(w);
    for (let k = 0; k < 5; k += 1) f.log.append('note', `Line ${k}.`, k * 1000);
    f.openPanel('log');
    f.logView.move(1);
    f.logView.move(1);
    f.logView.move(1);
    expect(f.logView.chosen).toBe(true);
    expect(f.logView.selected).toBe(2);
    f.openPanel('log');
    expect(f.logView.selected).toBe(2);
    f.openPanel(null);
    f.log.append('note', 'A fortnight later.', 20000);
    f.openPanel('log');
    expect(f.logView.chosen).toBe(false);
    expect(f.logView.selected).toBe(0);
  });
});

describe('T-625 the Mood panel marks a cut thought', () => {
  it('a cell that does not fit its column ends with »', () => {
    const columns = [{ title: 'Name', width: 6 }, { title: 'Top', width: 12, mark: true }];
    expect(tableRow(columns, ['Ivar', '+5 Had a fine meal.'], 18)).toBe('Ivar  +5 Had a fi»');
    expect(tableRow(columns, ['Ivar', '+5 Ate.'], 18)).toBe('Ivar  +5 Ate.     ');
    // A column marks its cut by default (T-703: no widget clips without the mark); `mark: false` clips it bare.
    expect(tableRow([{ title: 'Name', width: 6 }, { title: 'Top', width: 12 }], ['Ivar', '+5 Had a fine meal.'], 18)).toBe('Ivar  +5 Had a fi»');
    expect(tableRow([{ title: 'Name', width: 6 }, { title: 'Top', width: 12, mark: false }], ['Ivar', '+5 Had a fine meal.'], 18)).toBe('Ivar  +5 Had a fin');
  });
});
