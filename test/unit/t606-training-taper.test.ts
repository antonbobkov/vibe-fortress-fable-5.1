/**
 * T-606: a training session grants TRAIN_XP to each skill, halved for a skill already at
 * TRAIN_TAPER_LEVEL or above (16 § Training).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings/reader';
import { TRAIN_TAPER_LEVEL, TRAIN_XP } from '@systems/combat/constants';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { dwarfComponents } from '@systems/dwarves/rules/components';
import { makeDwarf } from '@systems/dwarves/rules/make-dwarf';

function spawnAdultDwarf(game: HeadlessGame, at: number): number {
  const record = makeDwarf(game.world.rngFor('testworld'), game.registry);
  record.ageYears = 25;
  return game.world.services.spawn.creature(
    game.registry.table('creatures').index('dwarf'),
    at,
    'fortress',
    {
      name: record.name,
      ageTicks: record.ageYears * TICKS_PER_YEAR,
      child: false,
      dwarf: dwarfComponents(record, game.registry, game.world.rngFor('10'), 'none'),
    },
  );
}

describe('T-606: a session\'s experience halves from TRAIN_TAPER_LEVEL', () => {
  it('T-606: a sparring pair gains TRAIN_XP in dodge below Proficient and half of it at Proficient', () => {
    const game = new HeadlessGame({ seed: 't606-taper', world: 'flat-test', embark: 'none' });
    const entities = game.world.entities;
    const tiles = [0, 1, 2, 3].map((k) => game.map.index(10 + k, 10, FLAT_TEST_SURFACE_Z));
    expect(game.world.applyCommand({ type: 'CreateZone', zoneType: 'barracks', tiles }).ok).toBe(true);
    const zoneId = game.world.readers.of<BuildingsReader>('14').zonesOfType('barracks')[0] as number;
    const a = spawnAdultDwarf(game, tiles[0] as number);
    const b = spawnAdultDwarf(game, tiles[1] as number);
    const dodge = game.registry.table('skills').index('dodge');
    const skilled = entities.get(a, C.Skills)!;
    skilled.level[dodge] = TRAIN_TAPER_LEVEL;
    skilled.xp[dodge] = 3700;
    const novice = entities.get(b, C.Skills)!;
    novice.level[dodge] = 0;
    novice.xp[dodge] = 0;
    game.world.applyCommand({ type: 'CreateSquad', name: 'Taper' });
    const squad = game.world.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
    game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [a, b] });
    game.world.applyCommand({ type: 'SetZoneSetting', zoneId, key: 'squad', value: squad.id });
    game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });
    let sessions = 0;
    game.world.onEvents((batch) => { for (const e of batch) if (e.type === 'TrainingSession') sessions += 1; });
    while (sessions === 0 && game.tick < 600) game.step(1);
    expect(sessions).toBe(1);
    expect(entities.get(a, C.Skills)!.xp[dodge]).toBe(3700 + Math.floor(TRAIN_XP / 2));
    expect(entities.get(b, C.Skills)!.xp[dodge]).toBe(TRAIN_XP);
  });
});
