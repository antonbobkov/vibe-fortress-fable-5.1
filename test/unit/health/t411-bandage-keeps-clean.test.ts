/**
 * T-411: a bandaged wound is covered and is not rolled for infection. Under one loaded medic the
 * suture and the cleaning come days after the bandage, and every serious cut that waited for them
 * rolled for infection each day until they came.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { RngStream, seedFor } from '@core/rng';
import { INFECTION_PERMILLE } from '@systems/health';
import { TestWorld } from '../../scenarios/test-world';

/** A real saved state of the health stream whose next draws would all infect. */
function infectingState(): ReturnType<RngStream['state']> {
  for (let n = 0; n < 100_000; n += 1) {
    const rng = new RngStream(seedFor(`t411-infect-${n}`, '17'));
    const state = rng.state();
    if ([0, 1, 2, 3].every(() => rng.int(0, 999) < INFECTION_PERMILLE)) return state;
  }
  throw new Error('no infecting state');
}

/** A dwarf with a day-old serious cut and nobody to treat it; the next day's roll would infect it. */
function oldCut(seed: string, treat: (w: { bandaged: boolean; bleed: number; cleaned: boolean; sutured: boolean }) => void) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const world = w.game.world;
  const id = w.spawnDwarf({ at: w.index(10, 10, Z) });
  for (const l of w.game.registry.table<{ id: string }>('labors').ids()) w.setLabor(id, l, false);
  world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'edge', amount: 21 });
  w.step(2);
  const cut = world.entities.get(id, C.Body)!.parts.flatMap((p) => p.wounds)[0]!;
  expect(cut.type).toBe('cut');
  treat(cut);
  w.until(() => w.tick % TICKS_PER_DAY === TICKS_PER_DAY - 5, TICKS_PER_DAY);
  cut.createdTick = w.tick - TICKS_PER_DAY;
  world.rngFor('17').setState(infectingState());
  w.step(10);
  return { w, cut, infections: () => w.events('InfectionStarted').filter((e) => e['id'] === id) };
}

describe('T-411 a bandage keeps a wound clean', () => {
  it('an unbandaged, uncleaned, unsutured cut a day old is infected by the roll', () => {
    // Its bleeding stopped without a bandage (the dwarf would have bled out in the day otherwise).
    const a = oldCut('t411-open', (cut) => { cut.bleed = 0; });
    expect(a.infections()).toHaveLength(1);
    expect(a.cut.infected).toBe(true);
  });

  it('a bandaged cut a day old is not rolled for infection', () => {
    const a = oldCut('t411-bandaged', (cut) => { cut.bandaged = true; cut.bleed = 0; });
    expect(a.infections()).toHaveLength(0);
    expect(a.cut.infected).toBe(false);
  });
});
