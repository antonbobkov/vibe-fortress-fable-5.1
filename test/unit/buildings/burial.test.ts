import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M6-14 named memorial', () => {
  it('engraves a slab for a dead dwarf whose corpse rotted, then placement resolves the unburied dead', () => {
    const w = new TestWorld({ seed: 'm614-memorial', world: 'flat-test', embark: 'none' });
    const dead = w.spawnDwarf({ at: w.index(40, 40, 32) });
    w.step(1);
    const hp = w.game.world.entities.get(dead, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: dead, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CorpseCreated').some((e) => e['creatureId'] === dead), 30);
    const corpseId = w.events('CorpseCreated').find((e) => e['creatureId'] === dead)!['id'] as number;
    const buildings = w.readers.of<BuildingsReader>('14');
    const items = w.readers.of<ItemsReader>('13');
    expect(buildings.memorialEligible(dead)).toBe(false);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: 0,
      order: { recipeId: 'make_memorial_slab', mode: 'once', count: 1, memorialDwarfId: dead } }).ok).toBe(false);
    w.until(() => items.rotStage(corpseId) === 3, 22 * TICKS_PER_DAY);
    expect(buildings.memorialEligible(dead)).toBe(true);
    expect(items.unburiedDead(w.tick)).toBe(true);

    const mason = w.build('mason', w.index(44, 40, 32), 'granite');
    w.spawnDwarf({ at: w.index(48, 42, 32), skills: { engraving: 10 } });
    w.spawnItem('raw_stone', 'granite', w.index(47, 42, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: mason,
      order: { recipeId: 'make_memorial_slab', mode: 'once', count: 1, memorialDwarfId: dead } })).toEqual({ ok: true });
    w.until(() => w.events('ItemCrafted').some((e) => e['recipeId'] === 'make_memorial_slab'), 2000);
    const slab = w.events('ItemCrafted').find((e) => e['recipeId'] === 'make_memorial_slab')!['itemId'] as number;
    expect(items.get(slab)?.memorialDwarfId).toBe(dead);
    w.build('memorial_slab', w.index(50, 40, 32), 'granite', 0, slab);
    w.until(() => w.events('Buried').some((e) => e['dwarfId'] === dead), 20);
    expect(w.events('Buried').find((e) => e['dwarfId'] === dead)).toMatchObject({ coffinId: 0, tombTier: 'none' });
    expect(items.unburiedDead(w.tick)).toBe(false);
    expect(buildings.memorialEligible(dead)).toBe(false);
  });
});
