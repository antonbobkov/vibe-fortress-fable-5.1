import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../scenarios/test-world';

function kill(w: TestWorld, dwarf: number): void {
  const hp = w.game.world.entities.get(dwarf, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: dwarf, attackerId: 0,
    part: 'torso', damageType: 'blunt', amount: hp * 2 });
  w.until(() => w.events('CreatureDied').some((event) => event['id'] === dwarf), 5);
}

describe('T-165 bedrooms and pets lose a dead owner, coffin reservations survive', () => {
  it('frees the bedroom in the death tick and assigns it to another dwarf on the next day', () => {
    const w = new TestWorld({ seed: 't115-death2', world: 'flat-test', embark: 'none' });
    const entities = w.game.world.entities;
    const buildings = w.readers.of<BuildingsReader>('14');
    w.digRoom(10, 30, 25, 2, 2);
    for (let y = 29; y <= 32; y += 1) for (let x = 9; x <= 12; x += 1) w.discover(w.index(x, y, 25));
    const bedroom = w.zone('bedroom', [w.index(10, 30, 25), w.index(11, 30, 25),
      w.index(10, 31, 25), w.index(11, 31, 25)]);
    const bed = w.build('bed', w.index(10, 30, 25), 'oak');
    const coffin = w.build('coffin', w.index(43, 40, 32), 'granite');
    const victim = w.spawnDwarf({ at: w.index(11, 31, 25), ageYears: 30 });
    const other = w.spawnDwarf({ at: w.index(11, 30, 25), ageYears: 30 });
    w.step(10);
    expect(buildings.room(bedroom)).toMatchObject({ enclosed: true, requirementsMet: true });
    expect(w.game.world.applyCommand({ type: 'AssignRoom', zoneId: bedroom, dwarfId: victim })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'AssignCoffin', coffinId: coffin, dwarfId: victim })).toEqual({ ok: true });
    kill(w, victim);
    expect(buildings.ownerOf(bedroom)).toBe(0);
    expect(buildings.freeBeds()).toContain(bed);
    expect(entities.get(coffin, C.Building)?.ownerId).toBe(victim);
    w.until(() => buildings.ownerOf(bedroom) === other, TICKS_PER_DAY + 1);
    expect(buildings.bedroomOf(other)).toBe(bedroom);
    expect(entities.get(coffin, C.Building)?.ownerId).toBe(victim);
  });

  it('a dead owner\'s cat is unclaimed immediately and can adopt again', () => {
    const w = new TestWorld({ seed: 't115-death2', world: 'flat-test', embark: 'none' });
    const entities = w.game.world.entities;
    const victim = w.spawnDwarf({ at: w.index(40, 40, 32), ageYears: 30 });
    const other = w.spawnDwarf({ at: w.index(41, 40, 32), ageYears: 30 });
    const cat = w.spawnTame('cat', w.index(42, 40, 32));
    entities.add(cat, C.Tame, { ...entities.get(cat, C.Tame)!, petOf: victim });
    entities.add(victim, C.Relationships, { ...entities.get(victim, C.Relationships)!, pets: [cat] });
    kill(w, victim);
    expect(entities.get(cat, C.Tame)?.petOf).toBe(0);
    for (let chance = 0; chance < 100 && entities.get(cat, C.Tame)?.petOf === 0; chance += 1) {
      w.animals.seasonDue = true;
      w.step(1);
    }
    expect(entities.get(cat, C.Tame)?.petOf).toBe(other);
    expect(entities.get(other, C.Relationships)?.pets).toContain(cat);
    expect(w.events('PetAdopted').some((event) => event['animalId'] === cat && event['dwarfId'] === other)).toBe(true);
  });
});
