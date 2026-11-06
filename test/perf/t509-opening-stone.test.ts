/**
 * T-509: the instrument's opening builds every building it places. The rock it digs drops a stone
 * from 30% of its tiles, so the stones move with the timeline. On `wildlife-taiga-3` two ticks
 * later they were 6 where they are 9 unshifted; the mason's blocks and the first workshops took
 * them all, the kitchen placed on day 3 waited for a stone all year, no meal was cooked, and 11
 * dwarves starved on days 110 to 112. On `wildlife-temperate_grassland-3` five stones left the
 * hearth one block short all year. A player whose building waits for stone digs more rock.
 */
import { describe, expect, it } from 'vitest';
import type { BuildingsReader } from '@systems/buildings';
import { playWildlifeYear } from './wildlife_year_fixture';

class Stop extends Error {}

describe('T-509 the opening digs for the stone its buildings wait for', () => {
  it.each([
    { seed: 'wildlife-taiga-3', biome: 'taiga', shift: 2 },
    { seed: 'wildlife-temperate_grassland-3', biome: 'temperate_grassland', shift: 0 },
  ])('$seed shifted $shift ticks: every opening building stands by day 20', ({ seed, biome, shift }) => {
    let states: Record<string, string> = {};
    try {
      playWildlifeYear(seed, biome, { shift, observe: (game) => {
        const buildings = game.world.readers.of<BuildingsReader>('14');
        states = Object.fromEntries(['carpenter', 'mason', 'still', 'hearth', 'kitchen', 'trade_depot']
          .map((type) => [type, buildings.byType(type).map((id) => buildings.get(id)!.state).join(',')]));
        throw new Stop('the first look of day 20');
      } });
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
    }
    expect(states).toEqual({ carpenter: 'built', mason: 'built', still: 'built', hearth: 'built', kitchen: 'built', trade_depot: 'built' });
  }, 600_000);
});
