/**
 * T-699: a starving fortress is told the food at hand. The first `Starving` for hunger shows
 * `hint_starving`, naming the animals to slaughter, the water to fish, the ripe shrubs to gather and
 * a caravan's food, or that nothing is at hand; `hint_food` warns at `HINT_FOOD_DAYS` (5) days.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import type { GameEvent } from '@core/events';
import { Designation, TileFlag, TileKind } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const z = FLAT_TEST_SURFACE_Z;

function fortress(seed: string, dwarves = 3) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids: EntityId[] = [];
  for (let k = 0; k < dwarves; k += 1) ids.push(w.spawnDwarf({ at: w.index(10 + k, 10, z), name: `Dwarf${String(k).padStart(2, '0')} Stone` }));
  const ui = defaultUiState(z);
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  const hints = new HintEngine(w.game.registry, ui, log);
  const hintLines = (): string[] => log.lines.filter((line) => line.category === 'hint').map((line) => line.text);
  return { w, ids, ui, log, hints, hintLines };
}

/** A 3 × 3 pond of deep water dug into the flat surface, open to the sky. */
function pond(w: TestWorld): void {
  for (let y = 30; y < 33; y += 1) for (let x = 30; x < 33; x += 1) {
    const tile = w.index(x, y, z);
    w.carve(tile, TileKind.Floor);
    w.map.setFlag(tile, TileFlag.Outdoor, true);
    w.setFluid(tile, 7);
  }
}

function shrub(w: TestWorld, tile: TileIndex, species: string): void {
  w.game.world.services.terrain.setKind(tile, TileKind.Shrub, w.game.registry.table('materials').index(species));
}

const starving = (id: EntityId, need = 'hunger'): GameEvent => ({ type: 'Starving', id, need } as GameEvent);

describe('T-699 hint_starving names the food at hand', () => {
  it('names the tame animals to slaughter and the lake to fish, once, with the butcher\'s shop to build', () => {
    const f = fortress('t699-herd');
    for (const [species, x] of [['cow', 20], ['cow', 21], ['goat', 22], ['chicken', 23]] as const) f.w.spawnTame(species, f.w.index(x, 14, z));
    // A war dog is not for the slaughter.
    f.w.spawnTame('dog', f.w.index(24, 14, z), { trained: 'war' });
    pond(f.w);
    f.hints.onEvents([starving(f.ids[0] as EntityId)], f.w.readers);
    expect(f.ui.hintsShown).toContain('hint_starving');
    expect(f.hintLines()).toEqual([
      '☼ Dwarves are starving, and there is food at hand: 1 chicken, 2 cows and 1 goat to slaughter ([n] then [S-s]) at a butcher\'s shop [b > Workshops]; ' +
      'a lake to fish (a fishing zone, [z] then [i]).',
    ]);
    f.hints.onEvents([starving(f.ids[1] as EntityId), starving(f.ids[0] as EntityId)], f.w.readers);
    expect(f.hintLines()).toHaveLength(1);
  });

  it('names the ripe edible shrubs to gather, not one a gather designation covers or a fibre plant', () => {
    const f = fortress('t699-shrubs');
    for (let x = 20; x < 25; x += 1) shrub(f.w, f.w.index(x, 20, z), 'bramble');
    shrub(f.w, f.w.index(26, 20, z), 'wild_flax');
    f.w.map.setDesignation(f.w.index(20, 20, z), Designation.Gather, 4);
    f.hints.onEvents([starving(f.ids[0] as EntityId)], f.w.readers);
    expect(f.hintLines()).toEqual(['☼ Dwarves are starving, and there is food at hand: 4 ripe shrubs to gather ([d] then [g]).']);
  });

  it('says nothing to eat is at hand when there is none; a fishing zone already made is not advice', () => {
    const f = fortress('t699-none');
    pond(f.w);
    f.w.zone('fishing', [f.w.index(29, 31, z)]);
    f.hints.onEvents([starving(f.ids[0] as EntityId)], f.w.readers);
    expect(f.hintLines()).toEqual(['☼ Dwarves are starving, and nothing to eat is at hand: dig down to a cavern, or trade with the next caravan.']);
  });

  it('waits for hunger: a dwarf starving for thirst alone does not show it, and disabled hints show nothing', () => {
    const f = fortress('t699-thirst');
    f.hints.onEvents([starving(f.ids[0] as EntityId, 'thirst')], f.w.readers);
    f.hints.onEvents([starving(f.ids[0] as EntityId)], f.w.readers, false);
    expect(f.ui.hintsShown).not.toContain('hint_starving');
  });

  it('follows the day\'s starving line when a dwarf starves in the running game', () => {
    const f = fortress('t699-live', 1);
    f.w.game.world.onEvents((batch) => {
      for (const e of batch) f.log.announce(e, f.w.readers, f.w.game.world.calendar.tick);
      f.hints.onEvents(batch, f.w.readers);
    });
    f.w.spawnTame('sheep', f.w.index(20, 14, z));
    f.w.setNeed(f.ids[0] as EntityId, 'hunger', 100);
    f.w.until((w) => w.events('Starving').length > 0, TICKS_PER_DAY);
    const texts = f.log.lines.map((line) => line.text);
    const line = texts.findIndex((text) => text === 'Dwarf00 Stone is starving.');
    expect(line).toBeGreaterThanOrEqual(0);
    expect(texts[line + 1]).toMatch(/^☼ Dwarves are starving, and there is food at hand: 1 sheep to slaughter/);
  });

  it('the advice works: a starving dwarf with no food idles, then gathers the shrubs designated and eats', () => {
    const f = fortress('t699-gather', 1);
    const dwarf = f.ids[0] as EntityId;
    for (let x = 14; x < 17; x += 1) shrub(f.w, f.w.index(x, 12, z), 'bramble');
    f.w.setNeed(dwarf, 'hunger', 100);
    f.w.step(TICKS_PER_DAY / 4);
    // 10 § Eating and drinking: no food to reach and no order, so no work: it does not forage unasked.
    expect(f.w.events('MealEaten').length).toBe(0);
    f.w.submit({ type: 'Designate', kind: 'gather', tiles: [14, 15, 16].map((x) => f.w.index(x, 12, z)) });
    f.w.until((w) => w.events('MealEaten').some((e) => e['id'] === dwarf), TICKS_PER_DAY);
    expect(f.w.events('MealEaten').some((e) => e['id'] === dwarf)).toBe(true);
  });
});

describe('T-699 hint_food warns at five days of food', () => {
  it('fires below five days for the population and not at five', () => {
    // Eight dwarves eat ceil(8 × 5 / 4) = 10 units in five days.
    const short = fortress('t699-food-short', 8);
    short.w.spawnItem('easy_meal', 'granite', short.w.index(12, 12, z), 9);
    short.hints.onEvents([{ type: 'HourPassed', hour: 0 }], short.w.readers);
    expect(short.ui.hintsShown).toContain('hint_food');
    const enough = fortress('t699-food-ok', 8);
    enough.w.spawnItem('easy_meal', 'granite', enough.w.index(12, 12, z), 10);
    enough.hints.onEvents([{ type: 'HourPassed', hour: 0 }], enough.w.readers);
    expect(enough.ui.hintsShown).not.toContain('hint_food');
  });
});
