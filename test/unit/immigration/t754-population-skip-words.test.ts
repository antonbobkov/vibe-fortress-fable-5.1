/**
 * T-754: the Population panel's last skip read 21's raw reason code ("Last skip: luck"), and after
 * Year 1's summer cousins it read "Eligible: no" though the autumn wave was guaranteed. The skip
 * reads in words, and eligibility answers for the evaluation to come (21 § Reader).
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '@core/constants';
import type { PanelContext } from '@ui/panels/context';
import { drawPopulationPanel } from '@ui/panels/population';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { ImmigrationSystem } from '@systems/immigration';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from '../ui/ui-fixture';

function panel(w: TestWorld): string {
  const ctx: PanelContext = { readers: w.readers, registry: w.game.registry, strings,
    submit: (command) => w.submit(command), focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  const s = surface(36, 14);
  drawPopulationPanel(s, { col: 0, row: 0, cols: 36, rows: 14 }, ctx);
  return s.lines().map((line) => line.trim()).join(' ').replace(/\s+/g, ' ');
}

describe('T-754 the Population panel tells the truth about the next wave and the last skip', () => {
  it('after the summer cousins of Year 1 the autumn wave is guaranteed: "Eligible: yes · the cousins are coming"', () => {
    const w = new TestWorld({ seed: 'm7-population-golden', world: 'flat-test', embark: 'none', startTick: 28 * TICKS_PER_DAY - 2 });
    for (let n = 0; n < 7; n += 1) w.spawnDwarf();
    w.until((world) => world.events('ImmigrantsArrived').length > 0, 200);
    w.submit({ type: 'SetPopulationCap', n: 40 });
    w.step(1);
    const im = w.readers.of<ImmigrationReader>('21');
    expect(im.eligibility()).toEqual({ eligible: true, reasons: [], guaranteed: true });
    expect(panel(w)).toContain('Next evaluation: Autumn');
    expect(panel(w)).toContain('Eligible: yes · the cousins are coming');
    expect(panel(w)).not.toContain('Eligible: no');
    // The evaluation of this season, asked for, is not the guaranteed one.
    expect(im.eligibility({ season: 1, year: 1 }).guaranteed).toBe(false);
  });

  it('a skip names its reason in words; a code with no row shows as it is', () => {
    const w = new TestWorld({ seed: 't754-skip', world: 'flat-test', embark: 'none' });
    for (let n = 0; n < 7; n += 1) w.spawnDwarf();
    w.step(1);
    const system = w.game.world.scheduler.byId('21') as ImmigrationSystem;
    const skipped = (reason: string): string => {
      system.deserialize({ ...system.serialize(), lastSkipReason: reason }, {
        world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor('21'), readers: w.readers, register: w.game.world.registrations,
      } as never);
      return panel(w);
    };
    expect(skipped('luck')).toContain('Last skip: no one set out');
    expect(skipped('luck')).not.toContain('Last skip: luck');
    expect(skipped('cap')).toContain('Last skip: population cap reached');
    expect(skipped('raid')).toContain('Last skip: a raid was under way');
    expect(skipped('winter')).toContain('Last skip: winter pass closed');
    expect(skipped('spirit')).toContain('Last skip: hall spirit below Content');
    expect(skipped('something_new')).toContain('Last skip: something_new');
  });
});
