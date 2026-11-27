/** T-813 (built in T-806): the Thane's line for a grander hall and an engraved bedroom; deepfire is counted, not kept. */
import { describe, expect, it } from 'vitest';
import type { Command } from '@core/commands';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { DwarvesReader } from '@systems/dwarves';
import type { PanelContext } from '@ui/panels/context';
import { whimLine } from '@ui/panels/units';
import { whimProgressText } from '@ui/messages';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = 25;
const SEASON = TICKS_PER_DAY * DAYS_PER_SEASON;

function fixture(seed: string) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: SEASON + 5 });
  w.digRoom(10, 10, Z, 8, 5);
  for (let y = 9; y <= 15; y += 1) for (let x = 9; x <= 18; x += 1) w.discover(w.index(x, y, Z));
  const id = w.spawnDwarf({ at: w.index(12, 12, Z) });
  expect(w.game.world.applyCommand({ type: 'AssignTitle', dwarfId: id, title: 'thane' })).toEqual({ ok: true });
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (cmd: Command) => { expect(w.game.world.applyCommand(cmd)).toMatchObject({ ok: true }); },
    focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false } as PanelContext;
  return { w, ctx };
}

const nb = (s: string): string => s.replace(/ /g, ' ');

describe('T-813 the Thane\'s line', () => {
  it('a grander hall names the tier now and the tier wished for', () => {
    expect(whimProgressText(strings, new TestWorld({ seed: 't806-l', world: 'flat-test', embark: 'none' }).game.registry, 'whim_hall_tier', 2, 3))
      .toBe('Decent now, Fine wished for');
    const { w, ctx } = fixture('t806-line-tier');
    w.build('hearth', w.index(14, 12, Z), 'granite');
    w.dwarves.whim = { id: 'whim_hall_tier', setTick: SEASON, target: 5 };
    const view = w.readers.of<DwarvesReader>('10').whim()!;
    expect(view).toMatchObject({ kind: 'tier', count: 5, met: false });
    expect(whimLine(ctx, view)).toMatch(/^The Thane wishes for a grander hearth hall by the end of summer: \w+ now, Royal wished for, not yet\.$/);
  });

  it('an engraved bedroom counts its tiles', () => {
    const registry = new TestWorld({ seed: 't806-l2', world: 'flat-test', embark: 'none' }).game.registry;
    expect(nb(whimProgressText(strings, registry, 'whim_engraved_room', 3, 12))).toBe('3 of 12 tiles engraved');
  });

  it('the deepfire a whim counts is counted in stock, and nothing says it is kept', () => {
    const { w, ctx } = fixture('t813-line-deepfire');
    w.dwarves.whim = { id: 'whim_spirits', setTick: SEASON };
    const barrel = w.spawnItem('barrel', 'pine', w.index(15, 12, Z));
    w.spawnItem('drink', 'deepfire', { containerId: barrel }, 4);
    expect(whimLine(ctx, w.readers.of<DwarvesReader>('10').whim()!))
      .toBe('The Thane wishes for something strong by the end of summer: 4 of 10 deepfire in stock, not yet. Made at a still.');
  });
});
