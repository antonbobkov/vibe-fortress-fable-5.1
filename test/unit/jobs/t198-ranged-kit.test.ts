import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

interface Kit { w: TestWorld; dwarves: EntityId[]; bow: EntityId; crossbow: EntityId }

/** Seven hunters, five deer, one bow, one crossbow and three stacks of bolts; arrows only when asked. */
function hunters(seed: string, arrows: boolean): Kit {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const items = w.game.registry.table('items');
  const iron = w.game.registry.table('materials').index('iron');
  const oak = w.game.registry.table('materials').index('oak');
  const dwarves: EntityId[] = [];
  for (let i = 0; i < 7; i += 1) {
    const id = w.spawnDwarf({ at: w.index(20 + i, 20, Z), skills: { crossbow: 5, bow: 5, hunting: 5 } });
    w.setLabor(id, 'hunting', true);
    dwarves.push(id);
  }
  const bow = w.spawnItem(items.index('bow'), oak, w.index(22, 22, Z));
  const crossbow = w.spawnItem(items.index('crossbow'), iron, w.index(23, 22, Z));
  w.spawnItem(items.index('bolt'), iron, w.index(24, 22, Z), 25);
  w.spawnItem(items.index('bolt'), iron, w.index(25, 22, Z), 15);
  w.spawnItem(items.index('bolt'), iron, w.index(26, 22, Z), 15);
  if (arrows) w.spawnItem(items.index('arrow'), oak, w.index(21, 22, Z), 20);
  const deer = w.game.registry.table('creatures').index('deer');
  for (let i = 0; i < 5; i += 1) w.game.world.services.spawn.creature(deer, w.index(30 + 2 * i, 24, Z), 'wild');
  return { w, dwarves, bow, crossbow };
}

/** What each dwarf holds: a launcher, and ammunition by item id. */
function held(w: TestWorld, id: EntityId): { launcher: string; ammo: string[] } {
  const reader = w.readers.of<ItemsReader>('13');
  const ent = w.game.world.entities;
  const out = { launcher: '', ammo: [] as string[] };
  const equip = ent.get(id, C.Equipment);
  const candidates = new Set<EntityId>([equip?.weapon ?? 0, equip?.quiver ?? 0, ent.get(id, C.Worker)?.toolId ?? 0, ...reader.carriedItems(id)]);
  for (const itemId of candidates) {
    const it = reader.get(itemId);
    if (it === undefined || it.carriedBy !== id) continue;
    const def = reader.def(it.type);
    if (def?.category === 'weapon/ranged') out.launcher = def.id;
    else if (def?.category.startsWith('ammo/')) out.ammo.push(def.id);
  }
  return out;
}

describe('T-198 a ranged hunt takes a launcher and its own ammunition together', () => {
  it('five hunts and seven hunters: two are armed in full, nobody holds ammunition alone, and both shoot', () => {
    const { w, dwarves } = hunters('t198-kit', true);
    const jobs = w.readers.of<JobsReader>('11');
    const ammoAlone: string[] = [];
    let claimedMost = 0;
    w.until((v) => {
      for (const id of dwarves) {
        const h = held(v, id);
        if (h.ammo.length > 0 && h.launcher === '') ammoAlone.push(`t${v.tick} dwarf ${id}: ${h.ammo.join(',')}`);
        if (h.launcher === 'bow') expect(h.ammo.every((a) => a === 'arrow'), 'a bow takes arrows').toBe(true);
        if (h.launcher === 'crossbow') expect(h.ammo.every((a) => a === 'bolt'), 'a crossbow takes bolts').toBe(true);
      }
      claimedMost = Math.max(claimedMost, jobs.list().filter((j) => jobs.typeOf(j.id) === 'hunt' && j.workerId !== 0).length);
      // Both armed hunters have loosed a shot: the hunts are real, whatever the dice then say.
      return new Set(v.events('ProjectileFired').map((e) => e['shooterId'])).size >= 2;
    }, TICKS_PER_DAY);
    expect(ammoAlone).toEqual([]);
    expect(w.events('HuntAbandoned')).toEqual([]);
    // Two launchers arm two hunters; the other hunts stay with nobody.
    expect(claimedMost).toBe(2);
    expect(w.events('HuntStarted')).toHaveLength(2);
  });

  it('a bow with no arrows in the fortress is left where it lies; the crossbow hunter still hunts', () => {
    const { w, dwarves, bow } = hunters('t198-no-arrows', false);
    const reader = w.readers.of<ItemsReader>('13');
    const jobs = w.readers.of<JobsReader>('11');
    let claimedMost = 0;
    w.until((v) => {
      expect(reader.get(bow)?.carriedBy ?? 0, 'nobody takes the bow').toBe(0);
      for (const id of dwarves) {
        const h = held(v, id);
        expect(h.ammo.length > 0 && h.launcher === '', `dwarf ${id} holds ammunition alone`).toBe(false);
      }
      claimedMost = Math.max(claimedMost, jobs.list().filter((j) => jobs.typeOf(j.id) === 'hunt' && j.workerId !== 0).length);
      return v.events('ProjectileFired').length >= 1;
    }, TICKS_PER_DAY);
    expect(claimedMost).toBe(1);
    expect(w.events('HuntAbandoned')).toEqual([]);
    expect(w.events('HuntStarted')).toHaveLength(1);
  });
});
