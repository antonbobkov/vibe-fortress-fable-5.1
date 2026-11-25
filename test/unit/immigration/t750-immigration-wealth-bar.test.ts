/**
 * T-750: a wealth skip names the bar. "No immigrants this season: the hall is not yet wealthy
 * enough (4,100 of 6,000 ☼).", and the Population panel shows the bar while it holds the next wave
 * back ("Next wave asks 6,000 ☼ of wealth (now 4,100 ☼)") and the last skip with its figures.
 */
import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { ReaderSet } from '@core/readers';
import type { ImmigrationSystem } from '@systems/immigration';
import type { ImmigrationReader } from '@systems/immigration/reader';
import type { ItemsReader } from '@systems/items';
import type { MoraleSystem } from '@systems/morale';
import { AnnouncementLog } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { drawPopulationPanel } from '@ui/panels/population';
import { TestWorld } from '../../scenarios/test-world';
import { registry, strings, surface } from '../ui/ui-fixture';

const YEAR_TWO_SUMMER = (112 + 28) * TICKS_PER_DAY;

function initCtx(w: TestWorld, id: string) {
  return { world: w.game.world, registry: w.game.registry, rng: w.game.world.rngFor(id), readers: w.readers, register: w.game.world.registrations };
}

/** A fortress of 4 after three waves, hall spirit Content, just before Summer of Year 2. */
function fortress(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none', startTick: YEAR_TWO_SUMMER - 4 });
  for (let n = 0; n < 4; n += 1) w.spawnDwarf();
  w.step(1);
  const morale = w.game.world.scheduler.byId('15') as MoraleSystem;
  morale.deserialize({ ...morale.serialize(), hallSpirit: 60, hallSpiritTier: 2 }, initCtx(w, '15'));
  const im = w.game.world.scheduler.byId('21') as ImmigrationSystem;
  im.deserialize({ ...im.serialize(), wavesSoFar: 3, guaranteedDone: [true, true] }, initCtx(w, '21'));
  return w;
}

/** Bring the fortress's wealth to `to` through a building's value (13 counts it in `wealth()`). */
function setWealth(w: TestWorld, to: number): void {
  const now = w.readers.of<ItemsReader>('13').wealth();
  w.game.world.emit({ type: 'BuildingCompleted', id: 0, value: to - now } as unknown as GameEvent);
  w.step(1);
  expect(w.readers.of<ItemsReader>('13').wealth()).toBe(to);
}

/** The Population panel's text, its wrapped lines joined. */
function panel(readers: ReaderSet): string {
  const ctx: PanelContext = { readers, registry, strings,
    submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false };
  const s = surface(36, 14);
  drawPopulationPanel(s, { col: 0, row: 0, cols: 36, rows: 14 }, ctx);
  return s.lines().map((l) => l.trim()).filter((l) => l !== '').join(' ');
}

describe('T-750 a wealth skip names the bar the next wave asks', () => {
  it('3 waves, 4,100 ☼: the skip line and the panel name "4,100 of 6,000 ☼"; at 7,000 ☼ the bar line is gone', () => {
    const w = fortress('t750-bar');
    setWealth(w, 4100);
    w.until((world) => world.events('ImmigrationSkipped').length > 0, 10);
    const skipped = w.events('ImmigrationSkipped')[0];
    expect(skipped).toMatchObject({ reason: 'wealth', wealth: 4100, need: 6000 });
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const done = log.announce(skipped as GameEvent, w.readers, w.tick);
    expect(done?.line.text).toBe('No immigrants this season: the hall is not yet wealthy enough (4,100 of 6,000 ☼).');

    const im = w.readers.of<ImmigrationReader>('21');
    expect(im.wealthBar()).toEqual({ wealth: 4100, need: 6000 });
    expect(im.lastSkipWealth()).toEqual({ wealth: 4100, need: 6000 });
    const text = panel(w.readers);
    // The bar shows whatever the eligibility line's first reason is (here hall spirit has fallen since).
    expect(text).toContain('Eligible: no ·');
    expect(text).toContain('Next wave asks 6,000 ☼ of wealth (now 4,100 ☼)');
    expect(text).toContain('Last skip: wealth (4,100 of 6,000 ☼)');

    setWealth(w, 7000);
    const after = panel(w.readers);
    expect(after).not.toContain('Next wave asks');
    // The last skip keeps the figures it was made with.
    expect(after).toContain('Last skip: wealth (4,100 of 6,000 ☼)');
  });

  it('a save and load keep the last skip\'s figures; an older save shows the skip without them', () => {
    const w = fortress('t750-save');
    setWealth(w, 4100);
    w.until((world) => world.events('ImmigrationSkipped').length > 0, 10);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    expect(loaded.world.readers.of<ImmigrationReader>('21').lastSkipWealth()).toEqual({ wealth: 4100, need: 6000 });
    expect(panel(loaded.world.readers)).toContain('Last skip: wealth (4,100 of 6,000 ☼)');

    // An older save: the skip's reason without its figures.
    const im = w.game.world.scheduler.byId('21') as ImmigrationSystem;
    const { lastSkipWealth: _dropped, ...older } = im.serialize();
    im.deserialize(older, initCtx(w, '21'));
    expect(w.readers.of<ImmigrationReader>('21').lastSkipWealth()).toBeNull();
    const text = panel(w.readers);
    expect(text).toContain('Last skip: wealth');
    expect(text).not.toContain('Last skip: wealth (');
  });

  it('a skip for another reason clears the figures', () => {
    const w = fortress('t750-other');
    setWealth(w, 4100);
    w.until((world) => world.events('ImmigrationSkipped').length > 0, 10);
    const im = w.game.world.scheduler.byId('21') as ImmigrationSystem;
    expect(im.serialize().lastSkipWealth).toEqual({ wealth: 4100, need: 6000 });
    // The next evaluation's skip is for spirit: its state has no wealth figures.
    const morale = w.game.world.scheduler.byId('15') as MoraleSystem;
    morale.deserialize({ ...morale.serialize(), hallSpirit: 40, hallSpiritTier: 1 }, initCtx(w, '15'));
    w.game.world.emit({ type: 'SeasonChanged', season: 2, year: 2 } as unknown as GameEvent);
    w.until((world) => world.events('ImmigrationSkipped').length > 1, 3);
    expect(w.events('ImmigrationSkipped')[1]?.['reason']).toBe('spirit');
    expect(im.serialize().lastSkipWealth).toBeUndefined();
    expect(w.readers.of<ImmigrationReader>('21').lastSkipWealth()).toBeNull();
  });
});
