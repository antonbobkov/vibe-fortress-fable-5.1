/**
 * T-708: an animal's row in the tile list and its status bar summary say what it is doing, as its
 * view's activity line does (`creatureActivity`): "wolf  Asleep", "deer, Grazing". A dwarf's row
 * and summary are unchanged.
 */

import { describe, expect, it } from 'vitest';
import { C, type Wild } from '@core/components';
import type { EntityId, TileIndex } from '@core/types';
import { creatureSummary, tileListRows } from '@ui/panels/look';
import { activityLabel } from '@ui/panels/units';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = 32;

function wild(w: TestWorld, species: string, at: TileIndex, state: string): EntityId {
  const id = w.spawnCreature(species, at, 'wild');
  const row: Wild = { state, homeChunk: 0, stateUntil: 1_000_000, hungry: false, lastThinkTick: 0, arrivedTick: 0 };
  w.game.world.entities.add(id, C.Wild, row);
  return id;
}

describe('T-708 an animal says what it is doing in the tile list and the status bar', () => {
  const w = new TestWorld({ seed: 't708-activity', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const registry = w.game.registry;

  it('a sleeping wolf on a crowded tile reads Asleep; the dwarf beside it keeps its activity', () => {
    const tile = w.index(10, 10, Z);
    const dwarf = w.spawnDwarf({ at: tile });
    w.step(5);
    const wolf = wild(w, 'wolf', tile, 'sleep');
    const rows = tileListRows(w.readers, registry, strings, tile);
    const wolfRow = rows.find((r) => r.target?.kind === 'creature' && r.target.id === wolf);
    expect(wolfRow?.fact).toBe('Asleep');
    const dwarfRow = rows.find((r) => r.target?.kind === 'creature' && r.target.id === dwarf);
    expect(dwarfRow?.fact).toBe(activityLabel({ readers: w.readers, registry, strings }, dwarf));
    expect(dwarfRow?.fact).not.toBe('');
  });

  it('the status bar sums a grazing deer as "deer, Grazing"', () => {
    const deer = wild(w, 'deer', w.index(14, 10, Z), 'graze');
    const name = w.readers.entities.get(deer, C.Creature)?.name ?? '';
    expect(creatureSummary(w.readers, registry, strings, deer)).toBe(`${name}, Grazing`);
    expect(name).toBe('deer');
  });
});
