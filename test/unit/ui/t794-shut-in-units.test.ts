/**
 * T-794: the Units list and a dwarf's view say when a dwarf is shut in. A dwarf at a critical hunger
 * or thirst that none of the fortress's stores can reach reads "Shut in" in the Units list, in the
 * alert colour, first in the list; its view's Helps line asks for a way out instead of the stocks.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_HOUR } from '@core/constants';
import type { Command } from '@core/commands';
import type { EntityId } from '@core/types';
import type { PanelContext } from '@ui/panels/context';
import { drawCreatureView } from '@ui/panels/look';
import { dwarfHelpsText } from '@ui/panels/mood';
import { creatureFact } from '@ui/panels/units-all';
import { drawUnitsPanel, isShutIn, UnitsPanel, unitsActivity } from '@ui/panels/units';
import { shutInNeed } from '@ui/shut-in';
import { TestWorld } from '../../scenarios/test-world';
import { fgOfText, hexOf, strings, surface, theme } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;
const DEEP = Z - 2;

function ctxOf(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { w.game.world.applyCommand(cmd); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
}

/** Two dwarves on the surface with meals and ale stored there, and Lida in a pocket dug in the rock, with no way out. */
function walledIn(seed: string): { w: TestWorld; lida: EntityId; asa: EntityId; bryn: EntityId } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(30, 12, DEEP, 3, 1);
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 3; dx += 1) w.discover(w.index(30 + dx, 12 + dy, DEEP));
  const asa = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Asa Forgehall' });
  const bryn = w.spawnDwarf({ at: w.index(11, 10, Z), name: 'Bryn Ashdelve' });
  const lida = w.spawnDwarf({ at: w.index(31, 12, DEEP), name: 'Lida Crageye' });
  w.spawnItem('easy_meal', 'granite', w.index(12, 10, Z), 10);
  w.spawnItem('drink', 'ale', w.index(13, 10, Z), 10);
  w.step(1);
  return { w, lida, asa, bryn };
}

describe('T-794 the Units list and a dwarf\'s view say when a dwarf is shut in', () => {
  it('a dwarf shut away from the drink at a critical thirst reads "Shut in", first, in the alert colour', () => {
    const { w, lida, asa } = walledIn('t794-units');
    const ctx = ctxOf(w);
    expect(isShutIn(ctx, lida), 'not yet thirsty').toBe(false);
    w.setNeed(lida, 'thirst', 90);
    w.setNeed(asa, 'thirst', 90);
    expect(shutInNeed(w.readers, lida)).toBe('thirst');
    expect(shutInNeed(w.readers, asa), 'the surface dwarf reaches the ale').toBeNull();
    expect(unitsActivity(ctx, lida)).toBe('Shut in');
    expect(creatureFact(ctx, { id: lida, kind: 'dwarf', name: 'Lida Crageye' } as never)).toBe('Shut in');
    const panel = new UnitsPanel();
    expect(panel.rows(ctx)[0], 'the shut-in dwarf comes first').toBe(lida);
    panel.toggleWounded();
    expect(panel.rows(ctx)[0], 'before the wounded too').toBe(lida);
    panel.toggleWounded();
    panel.list.selected = 1;
    const s = surface(40, 30);
    drawUnitsPanel(s, { col: 0, row: 0, cols: 40, rows: 30 }, panel, ctx);
    const row = s.lines().findIndex((l) => l.includes('Lida Crageye'));
    expect(s.lines()[row]).toContain('Shut in');
    expect(fgOfText(s, row, 'Shut in')).toBe(hexOf(theme.alert));
  });

  it('the view keeps its Activity line and its Helps line asks for a way out', () => {
    const { w, lida } = walledIn('t794-view');
    w.setNeed(lida, 'hunger', 90);
    w.step(TICKS_PER_HOUR + 1);
    expect(shutInNeed(w.readers, lida)).toBe('hunger');
    expect(dwarfHelpsText(w.readers, strings, lida, 'hungry'))
      .toBe("Helps: a way out: food is stored but none is on this dwarf's side (a wall, a coffin or a locked door)");
    expect(dwarfHelpsText(w.readers, strings, lida, 'thirsty'), 'not shut in from drink while it is not thirsty').toBe('Helps: drink they can reach; see Stocks [s]');
    const s = surface(80, 60);
    drawCreatureView(s, { col: 0, row: 0, cols: 80, rows: 60 }, w.readers, w.game.registry, strings, lida, DEEP);
    const text = s.lines().map((l) => l.trim()).join(' ');
    expect(text).toContain('Helps: a way out: food is stored');
    expect(text).not.toContain('Activity: Shut in');
  });
});
