/** T-M6-14: a real death produces a corpse; hauling buries it in its reserved tomb coffin. */
import { expect } from 'vitest';
import { C } from '@core/components';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';

const scenario: Scenario = {
  id: 'bd_burial', milestone: 6, seed: 'bd-burial', world: 'flat-test', embark: 'none',
  run: (w) => {
    const victim = w.spawnDwarf({ at: w.index(40, 40, 32) });
    w.spawnDwarf({ at: w.index(41, 40, 32) });
    const open = w.build('coffin', w.index(43, 40, 32), 'granite');
    const reserved = w.build('coffin', w.index(44, 40, 32), 'granite');
    w.zone('tomb', [w.index(43, 40, 32), w.index(44, 40, 32)]);
    expect(w.game.world.applyCommand({ type: 'AssignCoffin', coffinId: reserved, dwarfId: victim }).ok).toBe(true);
    w.step(2);
    const hp = w.game.world.entities.get(victim, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: victim, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === victim), 30);
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === victim)!['id'] as number;
    const buildings = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    w.until(() => w.events('Buried').some((e) => e['dwarfId'] === victim), 1500);
    const burial = w.events('Buried').find((e) => e['dwarfId'] === victim)!;
    expect(w.events('JobCompleted').some((e) => e['jobType'] === 'bury')).toBe(true);
    expect(burial['coffinId']).toBe(reserved);
    expect(burial['tombTier']).not.toBe('none');
    expect(buildings.get(reserved)?.settings['occupantId']).toBe(victim);
    expect(buildings.get(open)?.settings['occupantId'] ?? 0).toBe(0);
    expect(items.get(corpseId)).toBeUndefined();
  },
};
export default scenario;
