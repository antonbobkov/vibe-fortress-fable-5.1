/** T-351: a restless dead that collapses at dawn drops its rusted sword on its tile. */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { ItemsReader } from '@systems/items';
import type { RegionRecord } from '@systems/worldgen';
import { TestWorld } from '../../scenarios/test-world';
import { checkInvariants } from '../../scenarios/invariants';

describe('T-351 the restless dead drop what they carry when they collapse at dawn', () => {
  it('leaves the sword on the tile where the creature stood, carried by nobody', () => {
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
    // Every risen dead carries a sword here, whatever the roll gave, through the same calls as the rise.
    const swords = new Map<number, number>();
    for (const id of restless) {
      let sword = ent.get(id, C.Equipment)?.weapon ?? 0;
      if (sword === 0) {
        const p = ent.get(id, C.Position)!;
        sword = w.spawnItem('short_sword', 'iron', w.index(p.x, p.y, p.z), 1);
        ent.add(id, C.Equipment, { weapon: sword, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
          clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0 });
        w.game.world.services.items?.attachToCarrier(sword, id);
      }
      swords.set(id, sword);
    }
    const lastTile = new Map<number, number>();
    w.game.world.onEvents((events) => {
      for (const e of events) if (e.type === 'CreatureDied' && e['species'] === 'restless_dead') lastTile.set(e['id'] as number, e['tile'] as number);
    });
    w.step(14 * TICKS_PER_HOUR);
    const items = w.readers.of<ItemsReader>('13');
    for (const [id, sword] of swords) {
      expect(ent.alive(id)).toBe(false);
      const item = ent.get(sword, C.Item);
      expect(item, `sword ${sword}`).toBeDefined();
      expect(item?.carriedBy ?? -1).toBe(0);
      if (lastTile.has(id)) expect(items.tileOf(sword)).toBe(lastTile.get(id));
      else expect(items.tileOf(sword)).toBeGreaterThanOrEqual(0);
    }
    expect(checkInvariants(w.game).filter((f) => f.inv.startsWith('item.')).map((f) => f.inv)).toEqual([]);
  });
});
