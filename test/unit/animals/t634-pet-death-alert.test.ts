/**
 * T-634: 08 § Death, a pet's death is an alert and a tame animal's a note. The animal is gone when
 * the line is drawn, so the death says whose pet it was (`petOf`, taken when it died), and the log
 * reads that and not the live `Tame`.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { GameEvent } from '@core/events';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

/** Make `animal` the pet of `owner`, as a cat's adoption leaves it (08 § Pets). */
function makePet(w: TestWorld, animal: EntityId, owner: EntityId): void {
  const ent = w.game.world.entities;
  ent.add(animal, C.Tame, { ...ent.get(animal, C.Tame)!, petOf: owner });
  const rel = ent.get(owner, C.Relationships)!;
  ent.add(owner, C.Relationships, { ...rel, pets: [...rel.pets, animal] });
}

function name(w: TestWorld, animal: EntityId, value: string): void {
  expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: animal, name: value }).ok).toBe(true);
}

describe('T-634 a pet\'s death is an alert', () => {
  it('a pet dog starving to death is an alert naming it; a tame dog that is no pet stays a note', () => {
    const w = new TestWorld({ seed: 't634-starve', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const owner = w.spawnDwarf({ at: w.index(10, 10, FLAT_TEST_SURFACE_Z) });
    const rex = w.spawnTame('dog', w.index(12, 10, FLAT_TEST_SURFACE_Z));
    const fang = w.spawnTame('dog', w.index(14, 10, FLAT_TEST_SURFACE_Z));
    name(w, rex, 'Rex');
    name(w, fang, 'Fang');
    makePet(w, rex, owner);
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);

    w.game.world.emit({ type: 'Starvation', id: rex });
    w.game.world.emit({ type: 'Starvation', id: fang });
    w.until((v) => [rex, fang].every((id) => v.events('CreatureDied').some((e) => e['id'] === id)), 10);
    const died = (id: EntityId): GameEvent => w.events('CreatureDied').find((e) => e['id'] === id)!;
    expect(died(rex)).toMatchObject({ cause: 'starvation', name: 'Rex', petOf: owner });
    expect(died(fang)).toMatchObject({ cause: 'starvation', name: 'Fang', petOf: 0 });

    // The lines are read after the dogs are gone, from the events alone.
    w.step(1);
    expect(w.game.world.entities.alive(rex)).toBe(false);
    expect(w.game.world.entities.alive(fang)).toBe(false);
    const pet = log.announce(died(rex), w.readers, w.tick);
    expect(pet?.line.text).toBe('Rex has starved to death.');
    expect(pet?.severity).toBe('alert');
    const tame = log.announce(died(fang), w.readers, w.tick);
    expect(tame?.line.text).toBe('Fang has starved to death.');
    expect(tame?.severity).toBe('note');
  });

  it('a pet slaughtered is an alert naming it', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 't634-slaughter', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    w.build('butcher', w.index(15, 15, 32));
    const owner = w.spawnDwarf({ at: w.index(14, 15, 32), skills: { butchery: 5 } });
    const cat = w.spawnTame('cat', w.index(11, 15, 32), { sex: 0 });
    name(w, cat, 'Tibbles');
    makePet(w, cat, owner);
    const log = new AnnouncementLog(new Strings(registry), registry);
    log.register(w.game.world.registrations.announcements);
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: cat }).ok).toBe(true);
    w.until((v) => v.events('CreatureDied').some((e) => e['id'] === cat), 1600);

    const died = w.events('CreatureDied').find((e) => e['id'] === cat)!;
    expect(died).toMatchObject({ cause: 'slaughter', name: 'Tibbles', petOf: owner });
    w.step(1);
    expect(w.game.world.entities.alive(cat)).toBe(false);
    const line = log.announce(died, w.readers, w.tick);
    expect(line?.line.text).toBe('Tibbles has been slaughtered.');
    expect(line?.severity).toBe('alert');
  });
});
