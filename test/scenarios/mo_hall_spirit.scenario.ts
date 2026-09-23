import { expect } from 'vitest';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import { TileFlag } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { MoraleReader } from '@systems/morale';
import type { Scenario } from './runner';
import { rect } from './m1-helpers';

const scenario: Scenario = {
  id: 'mo_hall_spirit', milestone: 4, seed: 'mo-hall-spirit', world: 'flat-test', embark: 'none',
  run: (w) => {
    const z = 25;
    w.digRoom(40, 40, z, 7, 7);
    w.digRoom(47, 42, z, 3, 1);
    w.digRoom(50, 40, z, 2, 3);
    const hall = rect(w, 40, 40, z, 7, 7);
    const bedroom = rect(w, 50, 40, z, 2, 3);
    for (const tile of [...hall, ...bedroom, ...rect(w, 47, 42, z, 3, 1)]) w.discover(tile);
    for (const tile of [...hall, ...bedroom]) w.game.world.services.terrain.setFlag(tile, TileFlag.Smoothed, true);
    const dwarf = w.spawnDwarf({ at: w.index(42, 42, z) });
    const hallZone = w.zone('hearth_hall', hall);
    const bedZone = w.zone('bedroom', bedroom);
    w.build('bed', w.index(50, 40, z), 'pine');
    w.build('hearth', w.index(43, 43, z), 'granite');
    const supply = w.index(48, 42, z);
    w.zone('stockpile', [supply]);
    w.spawnItem('fine_meal', 'dimcap', supply, 8, 3);
    w.spawnItem('drink', 'ale', supply, 20);
    w.step(10);
    const buildings = w.readers.of<BuildingsReader>('14');
    expect(buildings.room(hallZone)?.requirementsMet).toBe(true);
    expect(buildings.room(hallZone)?.tier).toBeGreaterThanOrEqual(2);
    expect(buildings.room(bedZone)?.requirementsMet).toBe(true);
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: bedZone, dwarfId: dwarf })).toEqual({ ok: true });
    w.until((world) => world.events('MealEaten').some((e) => e['id'] === dwarf)
      && world.events('DrankAlcohol').some((e) => e['id'] === dwarf), 7 * TICKS_PER_DAY);
    w.step(TICKS_PER_HOUR);
    const morale = w.readers.of<MoraleReader>('15');
    expect(morale.thoughts(dwarf).some((t) => t.id === 'hearth_lit')).toBe(true);
    expect(morale.thoughts(dwarf).some((t) => t.id === 'ate_fine_meal')).toBe(true);
    expect(morale.thoughts(dwarf).some((t) => t.id === 'drank_ale')).toBe(true);
    expect(morale.hallSpirit()).toBeGreaterThanOrEqual(65);
  },
};
export default scenario;
