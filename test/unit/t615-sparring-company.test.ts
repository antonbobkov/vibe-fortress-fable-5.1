/**
 * T-615: two dwarves sparring are in company. A sparring pair's training session is a talk between
 * them (16 § Training; 10 § Social, comfort, joy): both are relieved as by a talk, the talk counts
 * toward their friendship, and `Talked` is emitted. A solo drill is no talk.
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import type { GameEvent } from '@core/events';
import type { BuildingsReader } from '@systems/buildings/reader';
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

/** A squad of `count` at a barracks of four tiles, in `train` mode, its members' social need at `social`. */
function drill(seed: string, count: number, social: number): { game: HeadlessGame; members: number[]; events: GameEvent[] } {
  const game = new HeadlessGame({ seed, world: 'flat-test', embark: 'none' });
  const tiles = [0, 1, 2, 3].map((k) => game.map.index(10 + k, 10, FLAT_TEST_SURFACE_Z));
  expect(game.world.applyCommand({ type: 'CreateZone', zoneType: 'barracks', tiles }).ok).toBe(true);
  const zoneId = game.world.readers.of<BuildingsReader>('14').zonesOfType('barracks')[0] as number;
  const members = tiles.slice(0, count).map((t) => spawnAdultDwarf(game, t));
  for (const m of members) game.world.entities.add(m, C.Needs, { ...game.world.entities.get(m, C.Needs)!, social });
  game.world.applyCommand({ type: 'CreateSquad', name: 'Company' });
  const squad = game.world.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members });
  game.world.applyCommand({ type: 'SetZoneSetting', zoneId, key: 'squad', value: squad.id });
  game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'train' });
  const events: GameEvent[] = [];
  game.world.onEvents((batch) => { for (const e of batch) if (e.type === 'TrainingSession' || e.type === 'Talked') events.push(e); });
  return { game, members, events };
}

describe('T-615: sparring partners are in company', () => {
  it('T-615: a pair\'s session relieves both as a talk, counts toward their friendship and emits Talked', () => {
    const { game, members, events } = drill('t615-pair', 2, 30);
    const [a, b] = members as [number, number];
    while (!events.some((e) => e.type === 'TrainingSession') && game.tick < 600) game.step(1);
    game.step(1);
    const session = events.find((e) => e.type === 'TrainingSession');
    expect(session?.['members']).toEqual([a, b].sort((x, y) => x - y));
    // Below its want threshold the need is still relieved: sparring needs no want (10 § Social, comfort, joy).
    const talks = events.filter((e) => e.type === 'Talked');
    expect(talks).toHaveLength(1);
    expect([talks[0]?.['a'], talks[0]?.['b']].sort((x, y) => Number(x) - Number(y))).toEqual([a, b].sort((x, y) => x - y));
    for (const m of [a, b]) {
      // 30 − 40 clamps to 0; at most an hour's rise (2) since.
      expect(game.world.entities.get(m, C.Needs)!.social).toBeLessThanOrEqual(2);
    }
    const counts = new Map(game.world.entities.get(a, C.Relationships)!.talkCount);
    expect(counts.get(b)).toBe(1);
  });

  it('T-615: a soldier drilling alone has no talk', () => {
    const { game, members, events } = drill('t615-solo', 1, 30);
    while (!events.some((e) => e.type === 'TrainingSession') && game.tick < 600) game.step(1);
    game.step(1);
    expect(events.find((e) => e.type === 'TrainingSession')?.['members']).toEqual(members);
    expect(events.filter((e) => e.type === 'Talked')).toHaveLength(0);
    expect(game.world.entities.get(members[0]!, C.Needs)!.social).toBeGreaterThanOrEqual(30);
  });
});
