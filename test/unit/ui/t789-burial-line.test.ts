/**
 * T-789: in a fortress that loses three to eight in a raid the burial line never cleared, and it
 * said "build coffins" when none were in stock to build. The line now says the next step it needs:
 * build coffins while some are in stock, order them (and where to build them) while none are
 * (15 § Registrations). The tomb's own coffins-ready rule was measured and not adopted.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { UNBURIED_DAYS } from '@systems/morale/constants';
import { AnnouncementLog, lineText } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function twoDead(w: TestWorld): number {
  for (let k = 0; k < 2; k += 1) {
    const dwarf = w.spawnDwarf({ at: w.index(20 + 4 * k, 20, Z) });
    w.step(1);
    const hp = w.game.world.entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === dwarf), 30);
  }
  return w.tick;
}

describe('T-789 the burial line says build or order', () => {
  it('with no coffin in stock the line says to order coffins and where to build them; with some, to build', () => {
    const w = world('t789-line');
    const died = twoDead(w);
    const log = new AnnouncementLog(strings, w.game.registry);
    const day = died + UNBURIED_DAYS * TICKS_PER_DAY + 10;
    const noTomb = log.unburiedAlert(w.readers, day);
    expect(lineText(noTomb!.line, strings)).toBe('! 2 dead wait for burial and no coffin is free or in stock: [o] order coffins, and zone a tomb [z] for them.');
    const tomb = w.zone('tomb', [w.index(40, 40, Z), w.index(41, 40, Z), w.index(42, 40, Z)]);
    expect(tomb).toBeGreaterThan(0);
    const withTomb = log.unburiedAlert(w.readers, day + TICKS_PER_DAY);
    expect(lineText(withTomb!.line, strings)).toBe('! 2 dead wait for burial and no coffin is free or in stock: [o] order coffins, then build them in Tomb #1 [b > Furniture].');
    w.build('coffin', w.index(44, 44, Z), 'granite');
    const few = log.unburiedAlert(w.readers, day + 2 * TICKS_PER_DAY);
    expect(lineText(few!.line, strings)).toBe('! 2 dead wait for burial, only 1 coffin is free and none in stock: [o] order 1 more.');
    w.spawnItem('coffin', 'granite', w.index(30, 40, Z));
    const build = log.unburiedAlert(w.readers, day + 3 * TICKS_PER_DAY);
    expect(lineText(build!.line, strings)).toBe('! 2 dead wait for burial and only 1 coffin is free: build 1 more [b > Furniture].');
  });
});
