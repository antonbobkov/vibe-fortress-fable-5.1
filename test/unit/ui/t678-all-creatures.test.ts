/**
 * T-678: the Units panel's All tab lists every creature the map draws, dwarves, tame and wild
 * animals, visitors and hostiles, by kind with one fact each; a stealthed hostile nobody has
 * spotted is not listed; `[g]` and the kind line show one kind; `Enter` or a click on the cursor's
 * row opens the creature's view, `c` centres; it keeps up with more than a hundred creatures.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { allCreatures } from '@ui/panels/units-all';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, press, strings, surface } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;
const LAYOUT = computeLayout(80, 42, true);

interface Fixture {
  readonly w: TestWorld;
  readonly screen: FortressScreen;
  readonly centred: TileIndex[];
}

function setup(seed: string): Fixture {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const centred: TileIndex[] = [];
  const host: FortressHost = {
    readers: w.readers,
    registry: w.game.registry,
    ui: defaultUiState(z),
    submit: (cmd) => w.submit(cmd),
    speed: () => 0,
    setSpeed: () => {},
    pan: () => {},
    changeZ: () => {},
    centerOn: (x, y, zz) => { centred.push(w.index(x, y, zz)); },
    home: () => {},
    zoom: () => {},
    layout: () => LAYOUT,
    precondition: () => true,
    registeredPanels: () => w.game.world.registrations.panels,
    announcements: () => w.game.world.registrations.announcements,
    now: () => 1000,
    confirm: (_id, _params, reply) => reply(true),
  };
  return { w, screen: new FortressScreen(host, keymap, strings), centred };
}

/** The sidebar as text, with the hit regions of the draw. */
function draw(f: Fixture): { lines: string[]; hits: ReturnType<typeof surface>['hits'] } {
  const s = surface(80, 42);
  f.screen.draw(s);
  const bar = LAYOUT.sidebar;
  const lines = bar === null ? [] : s.lines().map((line) => Array.from(line).slice(bar.col + 1).join('').trimEnd());
  return { lines, hits: s.hits };
}

function hostile(w: TestWorld, at: TileIndex, stealthed: boolean, spotted: boolean): EntityId {
  const id = w.spawnCreature('gloam_warrior', at, 'hostile:gloam');
  w.game.world.entities.add(id, C.Hostile, { partyId: 0, role: 'raider', behaviorState: 'attack', stealthed, spotted, breakingDoorId: 0, breakingSince: 0 });
  return id;
}

/** Every kind on the map, and one hostile hidden by stealth. */
function everyKind(f: Fixture): { dwarf: EntityId; dog: EntityId; deer: EntityId; merchant: EntityId; mule: EntityId; raider: EntityId; spotted: EntityId; hidden: EntityId } {
  const w = f.w;
  const at = (x: number): TileIndex => w.index(x, 20, z);
  const dwarf = w.spawnDwarf({ at: at(20), name: 'Ketil Ironvein' });
  const dog = w.spawnTame('dog', at(22));
  const deer = w.spawnCreature('deer', at(24), 'wild');
  w.game.world.entities.add(deer, C.Wild, { ...(w.readers.entities.get(deer, C.Wild) as NonNullable<ReturnType<typeof w.readers.entities.get<{ state: string }>>>), state: 'graze' } as never);
  const merchant = w.spawnCreature('human', at(26), 'trader:hillfolk');
  w.game.world.entities.add(merchant, C.Merchant, { partyId: 0, goods: [] });
  const mule = w.spawnCreature('mule', at(27), 'trader:hillfolk');
  const raider = hostile(w, at(28), false, false);
  const spotted = hostile(w, at(29), true, true);
  const hidden = hostile(w, at(30), true, false);
  return { dwarf, dog, deer, merchant, mule, raider, spotted, hidden };
}

describe('T-678 the Units panel\'s All tab', () => {
  it('lists each kind the map draws, by kind, with one fact each, and not a hidden hostile', () => {
    const f = setup('t678-kinds');
    const ids = everyKind(f);
    const rows = allCreatures(f.w.readers, f.w.game.registry);
    expect(rows.map((r) => r.id)).not.toContain(ids.hidden);
    expect(rows.map((r) => r.kind)).toEqual(['dwarf', 'tame', 'wild', 'visitor', 'visitor', 'hostile', 'hostile']);
    expect(rows.slice(0, 3).map((r) => r.id)).toEqual([ids.dwarf, ids.dog, ids.deer]);
    expect(rows.slice(3).map((r) => r.id).sort((a, b) => a - b)).toEqual([ids.merchant, ids.mule, ids.raider, ids.spotted].sort((a, b) => a - b));
    f.screen.openPanel('units');
    expect(f.screen.key(press('2'))).toBe(true);
    const { lines } = draw(f);
    const text = lines.join('\n');
    expect(lines[0]).toContain('Units · all (7)');
    expect(text).toContain('[1] Dwarves (1)  [2] All (7)');
    expect(text).toMatch(/1 dwarf · 1 tame · 1 wild\n *2 visitors · 2 hostile\n/);
    const row = (name: string): string => lines.find((l) => l.includes(name)) ?? '';
    expect(row('K. Ironvein'), 'a long name shortens so the fact fits').toMatch(/Idle/);
    expect(row('dog')).toContain('Tame');
    expect(row('deer')).toContain('Wild, grazing');
    expect(row('mule')).toContain('Caravan');
    expect(lines.filter((l) => l.includes('Hostile, attacking'))).toHaveLength(2);
    expect(text).toContain('Merchant');
    expect(text).toContain('[g] show: all');
    // The hidden hostile shows up once a dwarf spots it.
    f.w.game.world.entities.add(ids.hidden, C.Hostile, { ...(f.w.readers.entities.get(ids.hidden, C.Hostile) as object), spotted: true } as never);
    expect(f.screen.units.rows(f.screen.ctx)).toContain(ids.hidden);
  });

  it('g steps through the kinds on the map, a click on a kind shows it, and 1 goes back to the dwarves', () => {
    const f = setup('t678-kind');
    const ids = everyKind(f);
    f.screen.openPanel('units');
    f.screen.key(press('2'));
    const shown: (string | null)[] = [];
    for (let k = 0; k < 6; k += 1) {
      f.screen.key(press('g'));
      shown.push(f.screen.units.kind);
    }
    expect(shown).toEqual(['dwarf', 'tame', 'wild', 'visitor', 'hostile', null]);
    // A click on "2 hostile" in the kind line.
    const s = surface(80, 42);
    f.screen.draw(s);
    const hits = s.hits;
    const line = s.lines().findIndex((l) => l.includes('2 hostile'));
    const col = Array.from(s.lines()[line] as string).indexOf('2'.charAt(0), Array.from(s.lines()[line] as string).join('').indexOf('2 hostile') - 1);
    const hit = hits.find((h) => h.rect.row === line && h.rect.col <= col && col < h.rect.col + h.rect.cols);
    hit?.action();
    expect(f.screen.units.kind).toBe('hostile');
    expect(f.screen.units.rows(f.screen.ctx)).toEqual([ids.raider, ids.spotted]);
    expect(draw(f).lines[0]).toContain('Units · hostile (2)');
    f.screen.key(press('1'));
    expect(f.screen.units.rows(f.screen.ctx)).toEqual([ids.dwarf]);
  });

  it('Enter, or a click on the cursor\'s row, opens the creature\'s view; c centres; the dwarf keys say they are the Dwarves tab\'s', () => {
    const f = setup('t678-open');
    const ids = everyKind(f);
    f.screen.openPanel('units');
    f.screen.key(press('2'));
    f.screen.key(press('g'));
    f.screen.key(press('g'));
    f.screen.key(press('g'));
    f.screen.key(press('g'));
    f.screen.key(press('g'));
    expect(f.screen.units.kind).toBe('hostile');
    f.screen.key(press('↓'));
    expect(f.screen.units.selectedId(f.screen.ctx)).toBe(ids.spotted);
    f.centred.length = 0;
    expect(f.screen.key(press('c'))).toBe(true);
    expect(f.centred).toEqual([f.w.index(29, 20, z)]);
    expect(f.screen.ui.panel).toBe('units');
    expect(f.screen.key(press('t'))).toBe(true);
    expect(f.screen.ui.panel, 't does not open Threats on the All tab').toBe('units');
    expect(f.screen.statusRow2()).toContain('Dwarves tab');
    f.screen.key(press('Enter'));
    expect(f.screen.ui.panel).toBe('look');
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: ids.spotted });
    // The mouse: a click selects a row, a second click on it opens the view.
    f.screen.openPanel('units');
    const rowHit = (): (() => void) | undefined => {
      const { lines, hits } = draw(f);
      const line = lines.findIndex((l) => l.includes('Hostile') && !l.includes('·'));
      return hits.find((h) => h.rect.row === line && h.rect.cols > 10)?.action;
    };
    f.screen.units.list.selected = 1;
    const first = rowHit();
    expect(first).toBeDefined();
    first?.();
    expect(f.screen.ui.panel).toBe('units');
    expect(f.screen.units.selectedId(f.screen.ctx)).toBe(ids.raider);
    rowHit()?.();
    expect(f.screen.ui.panel).toBe('look');
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: ids.raider });
  });

  it('keeps up with a hundred and twenty creatures: every one listed, the last one reached and opened', () => {
    const f = setup('t678-many');
    for (let k = 0; k < 120; k += 1) f.w.spawnCreature('deer', f.w.index(5 + (k % 40), 5 + Math.floor(k / 40), z), 'wild');
    f.w.spawnDwarf({ at: f.w.index(20, 20, z) });
    f.screen.openPanel('units');
    f.screen.key(press('2'));
    expect(f.screen.units.rows(f.screen.ctx)).toHaveLength(121);
    const started = performance.now();
    for (let k = 0; k < 120; k += 1) f.screen.key(press('↓'));
    expect(draw(f).lines.some((l) => l.includes('deer'))).toBe(true);
    const elapsed = performance.now() - started;
    const last = f.screen.units.selectedId(f.screen.ctx);
    expect(last).toBe(f.screen.units.rows(f.screen.ctx)[120]);
    f.screen.key(press('Enter'));
    expect(f.screen.lookAt).toMatchObject({ kind: 'creature', id: last });
    // A loose bound: 120 key presses and a draw, far under a second on any machine.
    expect(elapsed).toBeLessThan(3000);
  });
});
