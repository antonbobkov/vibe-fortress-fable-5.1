/**
 * T-509: the instrument's opening builds every building it places. On `wildlife-taiga-3` shifted
 * two ticks, the rock the opening digs dropped 6 stones where it drops 9 unshifted; the mason's
 * blocks and workshops took them all, and the kitchen, placed on day 3, waited for a stone all
 * year: no meal was cooked, and 11 dwarves starved on days 110 to 112. A player whose kitchen
 * waits for stone digs more rock.
 */
import { describe, expect, it } from 'vitest';
import type { BuildingsReader } from '@systems/buildings';
import { playWildlifeYear } from './wildlife_year_fixture';

class Stop extends Error {}

describe('T-509 the opening digs for the stone its buildings wait for', () => {
  it('wildlife-taiga-3 two ticks later: every opening building stands by day 20', () => {
    let states: Record<string, string> = {};
    try {
      playWildlifeYear('wildlife-taiga-3', 'taiga', { shift: 2, observe: (game) => {
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
