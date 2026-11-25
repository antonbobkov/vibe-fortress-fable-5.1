/**
 * T-633: a slaughtered animal and a restless dead returning to rest die by 17's death, with every
 * field of the event catalog's `CreatureDied` row, and leave only the remains their own systems make.
 */
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { RegionRecord } from '@systems/worldgen';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from './../scenarios/test-world';

const CATALOG_FIELDS = ['id', 'cause', 'killerId', 'tile', 'species', 'name', 'faction', 'ageTicks', 'wornItems'];

describe('T-633 a slaughter and a restless dead carry a death\'s fields', () => {
  it('a slaughtered animal dies with its name, age and faction, leaves one corpse, and its line names it', () => {
    const registry = contentRegistry();
    const w = new TestWorld({ seed: 'slaughter-path', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none' });
    w.build('butcher', w.index(15, 15, 32));
    const cow = w.spawnTame('cow', w.index(11, 15, 32), { sex: 0 });
    expect(w.game.world.applyCommand({ type: 'NameAnimal', animalId: cow, name: 'Moss' }).ok).toBe(true);
    w.spawnDwarf({ at: w.index(14, 15, 32), skills: { butchery: 5 } });
    const log = new AnnouncementLog(new Strings(registry), registry);
    log.register(w.game.world.registrations.announcements);
    expect(w.game.world.applyCommand({ type: 'MarkSlaughter', animalId: cow }).ok).toBe(true);
    w.until((v) => v.events('CreatureDied').some((e) => e['id'] === cow), 1600);

    const died = w.events('CreatureDied').find((e) => e['id'] === cow) as GameEvent;
    for (const field of CATALOG_FIELDS) expect(died, field).toHaveProperty(field);
    expect(died).toMatchObject({
      cause: 'slaughter', killerId: 0, name: 'Moss', faction: 'fortress', noCorpse: true,
      species: registry.table('creatures').index('cow'),
    });
    expect(typeof died['tile']).toBe('number');
    expect(typeof died['ageTicks']).toBe('number');
    expect(died['wornItems']).toEqual([]);
    expect(w.events('CreatureDied').filter((e) => e['id'] === cow)).toHaveLength(1);

    // The slaughter's own corpse is the only one: 13 makes none for it.
    w.step(5);
    expect(w.events('CorpseCreated').filter((e) => e['creatureId'] === cow)).toHaveLength(1);
    expect(w.game.world.entities.with(C.Corpse)).toHaveLength(1);

    // The line is read after the animal is gone, from the event alone.
    expect(w.game.world.entities.alive(cow)).toBe(false);
    expect(log.announce(died, w.readers, w.tick)?.line.text).toBe('Moss has been slaughtered.');
  });

  it('a restless dead returning to rest dies with its species as a row index and leaves bones, not a corpse', () => {
    const w = new TestWorld({
      seed: 'th-restless',
      world: 'local',
      spec: regionSpec('th-restless', { traits: ['old_battlefield'], temper: 2 } as Partial<RegionRecord>),
      embark: 'none',
      startTick: 56 * TICKS_PER_DAY + 17 * TICKS_PER_HOUR,
    });
    w.spawnDwarf({ at: w.index(24, 24, FLAT_TEST_SURFACE_Z) });
    w.step(3 * TICKS_PER_HOUR);
    const ent = w.game.world.entities;
    const restless = ent.with(C.Hostile).filter((id) => ent.get(id, C.Hostile)?.role === 'restless');
    expect(restless.length).toBeGreaterThan(0);
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const deaths: GameEvent[] = [];
    w.game.world.onEvents((events) => {
      for (const e of events) if (e.type === 'CreatureDied' && restless.includes(e['id'] as number)) deaths.push(e);
    });
    w.step(14 * TICKS_PER_HOUR);

    const species = w.game.registry.table('creatures').index('restless_dead');
    const rested = deaths.filter((e) => e['cause'] === 'dawn');
    expect(rested.length).toBeGreaterThan(0);
    for (const died of rested) {
      for (const field of CATALOG_FIELDS) expect(died, field).toHaveProperty(field);
      expect(died).toMatchObject({ killerId: 0, species, noCorpse: true });
      expect(typeof died['faction']).toBe('string');
      expect(typeof died['tile']).toBe('number');
      expect(Array.isArray(died['wornItems'])).toBe(true);
      expect(ent.alive(died['id'] as number)).toBe(false);
      // Its bones are its remains: no corpse of it.
      expect(w.events('CorpseCreated').some((e) => e['creatureId'] === died['id'])).toBe(false);
      // Its own line: it falls to dust at dawn (T-714).
      expect(log.announce(died, w.readers, w.tick)?.line.text).toBe('A restless dead has fallen to dust.');
    }
    expect(ent.with(C.Corpse).filter((id) => ent.get(id, C.Corpse)?.species === species)).toEqual([]);
  });
});
