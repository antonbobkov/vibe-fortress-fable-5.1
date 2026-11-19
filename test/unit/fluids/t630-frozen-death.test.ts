/**
 * T-630: a creature the ice closes over dies through 17's death, with the fields every death
 * carries: a fortress dwarf frozen into a pond is announced by name at danger, and its friends
 * grieve.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { MoraleReader } from '@systems/morale';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { POND_Z } from '../../scenarios/pond';

describe('T-630 a dwarf frozen into the ice', () => {
  it('dies by name at danger, with its fields, and its friend grieves', () => {
    const w = new TestWorld({ seed: 't630-frozen', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    // A one-tile pond under the sky, with rock all round it within two tiles: no walkable tile to be pushed to.
    const pond = w.index(41, 41, POND_Z);
    const granite = w.game.registry.table('materials').index('granite');
    for (let y = 39; y <= 43; y += 1) for (let x = 39; x <= 43; x += 1) {
      if (x !== 41 || y !== 41) w.carve(w.index(x, y, POND_Z + 1), TileKind.Wall, granite);
    }
    w.carve(pond, TileKind.Floor);
    const above = w.map.above(pond);
    w.carve(above, TileKind.Open);
    w.map.setFlag(above, TileFlag.Outdoor, true);
    w.map.setFlag(pond, TileFlag.Outdoor, true);
    w.discover(pond);
    w.setFluid(pond, 2);
    w.fluids.freezer.tilesChanged([pond]);

    const dwarf = w.spawnDwarf({ at: pond, name: 'Ivar Coaleye' });
    const friend = w.spawnDwarf({ at: w.index(10, 10, POND_Z + 1) });
    const rel = w.game.world.entities.get(friend, C.Relationships)!;
    w.game.world.entities.add(friend, C.Relationships, { ...rel, friends: [dwarf] });
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    w.step(1);

    w.forceTemperature(pond, -10);
    w.until((world) => world.events('CreatureDied').some((e) => e['id'] === dwarf), 60);
    expect(w.fluids.sim.isFrozen(pond)).toBe(true);
    const died = w.events('CreatureDied').find((e) => e['id'] === dwarf)!;
    expect(died).toMatchObject({
      cause: 'frozen', killerId: 0, tile: pond, name: 'Ivar Coaleye', faction: 'fortress',
      species: w.game.registry.table('creatures').index('dwarf'),
    });
    expect(typeof died['ageTicks']).toBe('number');
    expect(Array.isArray(died['wornItems'])).toBe(true);
    // One death, whatever else the tick did.
    expect(w.events('CreatureDied').filter((e) => e['id'] === dwarf)).toHaveLength(1);

    // The line is read after the dwarf is gone, from the event alone.
    w.step(1);
    expect(w.game.world.entities.alive(dwarf)).toBe(false);
    const line = log.announce(died, w.readers, w.tick);
    expect(line?.line.text).toBe('Ivar Coaleye has frozen to death in the ice.');
    expect(line?.severity).toBe('danger');
    expect(line?.focus).toBe(pond);

    const thoughts = w.readers.of<MoraleReader>('15').thoughts(friend).map((t) => t.id);
    expect(thoughts).toEqual(expect.arrayContaining(['friend_died', 'dwarf_died']));
  });
});
