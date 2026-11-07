import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { DAYS_PER_SEASON, HOURS_PER_DAY } from '@core/constants';
import { PlantFacts, advance, growthPerHour, isMature, stageLength, type PlantRow } from '@systems/plants';
import { growthModifier } from '@systems/weather/transitions';
import { ripensInTime } from '../scenarios/three_years_economy';

/**
 * T-512: on `three-years-p0-3` the script sowed strawberries and barley late in summer and turnips,
 * cabbage and strawberries late in autumn; none ripened, the frost killed 101 crops in year 2 and
 * 165 in year 3, and their seed with them. It now sows, in the season under way, only what ripens
 * before winter. The first fix (T-507's branch) counted days without the season's growth percent
 * and let turnips be sown in the first days of autumn, where at 80% they cannot ripen.
 */
const facts = new PlantFacts(contentRegistry());
const row = (id: string): PlantRow => facts.row(facts.indexOf(id))!;
const temperate = { seasonTemp: [10, 21, 11, 0], referenceTempC: 0, tempC: 0, temper: 0, traits: [] as string[] };

/** The game's own growth (07), hour by hour from `fromDay` of `season` to winter, in one weather. */
function ripensByWinter(plant: PlantRow, season: number, fromDay: number, weather: 'overcast' | 'clear'): boolean {
  const length = stageLength(plant);
  let progress = { stage: 0, growth: 0 };
  for (let s = season; s < 3; s += 1) {
    const modifier = growthModifier(s, weather, temperate);
    for (let day = s === season ? fromDay : 1; day <= DAYS_PER_SEASON; day += 1) {
      for (let h = 0; h < HOURS_PER_DAY; h += 1) {
        progress = advance(progress, growthPerHour(plant, false, { season: s, lit: true, lamped: false, tempC: plant.minC + 1, growthModifier: modifier }), length);
        if (isMature(progress, length)) return true;
      }
    }
  }
  return false;
}

describe('T-512 the three-year script sows only surface crops that ripen before winter', () => {
  it('names the days a player would read: strawberry and barley in spring, turnip in summer, pumpkin in the first half of summer, nothing in autumn', () => {
    for (const id of ['strawberry', 'barley']) {
      expect(ripensInTime(row(id), 0, 1)).toBe(true);
      expect(ripensInTime(row(id), 0, 28)).toBe(true);
      expect(ripensInTime(row(id), 1, 1)).toBe(false);
    }
    expect(ripensInTime(row('turnip'), 1, 1)).toBe(true);
    expect(ripensInTime(row('turnip'), 1, 28)).toBe(true);
    expect(ripensInTime(row('pumpkin'), 1, 14)).toBe(true);
    expect(ripensInTime(row('pumpkin'), 1, 15)).toBe(false);
    expect(ripensInTime(row('cabbage'), 0, 20)).toBe(true);
    expect(ripensInTime(row('cabbage'), 0, 21)).toBe(false);
    for (const id of ['turnip', 'cabbage', 'pumpkin']) for (const day of [1, 5, 28]) expect(ripensInTime(row(id), 2, day), `${id} autumn day ${day}`).toBe(false);
  });

  it('a turnip sown on the fifth day of autumn, the last the first fix allowed, does not ripen even in clear weather', () => {
    expect(ripensByWinter(row('turnip'), 2, 6, 'clear')).toBe(false);
  });

  it('agrees with the game\'s growth for every surface crop and sowing day: three days to sow it, overcast throughout', () => {
    const crops = facts.farmedPlants().filter((p) => !facts.isCave(p)).map((p) => facts.row(p)!);
    expect(crops.length).toBeGreaterThan(0);
    for (const plant of crops) {
      for (let season = 0; season < 3; season += 1) {
        if (plant.seasons !== undefined && !plant.seasons.includes(season)) continue;
        for (let day = 1; day <= DAYS_PER_SEASON; day += 1) {
          // Growing from the fourth day after today; a sowing that runs out of its season starts the next one.
          const from = day + 4;
          const game = from > DAYS_PER_SEASON ? season < 2 && ripensByWinter(plant, season + 1, 1, 'overcast') : ripensByWinter(plant, season, from, 'overcast');
          expect(ripensInTime(plant, season, day), `${plant.id} season ${season} day ${day}`).toBe(game);
        }
      }
    }
  });
});
