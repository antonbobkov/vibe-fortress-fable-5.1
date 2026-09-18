import { describe, it, expect } from 'vitest';
import { C, COMPONENT_TYPES } from '@core/components';
import { bodyFor, partMaxHp } from '@core/spawn';
import { BODY_SLOTS } from '@core/types';
import { TileKind } from '@core/map3d';
import type { JobsReader } from '@systems/jobs';
import { TestWorld } from '../scenarios/test-world';

/**
 * `schemas/components.md` § Component ownership: the components a dwarf carries in M1 — the
 * core's, 22's `Motion`, the spawner's `Creature`, 17's `Body`, 10's eight and 11's two (D-060).
 */
const DWARF_SET = [
  'Position',
  'Motion',
  'Creature',
  'Body',
  'Attributes',
  'Skills',
  'Needs',
  'Personality',
  'Schedule',
  'Relationships',
  'Title',
  'Brain',
  'Labors',
  'Worker',
] as const;

function componentsOf(w: TestWorld, id: number): string[] {
  const e = w.game.world.entities;
  return COMPONENT_TYPES.filter((t) => e.has(id, t)).map((t) => t.name);
}

describe('T-M1-11 spawn API', () => {
  it('a spawned dwarf has every component of the dwarf set, is alive and indexed at its tile', () => {
    const w = new TestWorld({ seed: 'spawn', world: 'flat-test' });
    const at = w.index(30, 30, 32);
    const id = w.spawnDwarf({ at });
    expect(w.game.world.entities.alive(id)).toBe(true);
    expect(w.game.world.entities.kind(id)).toBe('creature');
    for (const name of DWARF_SET) expect([name, componentsOf(w, id).includes(name)]).toEqual([name, true]);
    expect(componentsOf(w, id)).not.toContain('Wild');
    expect(w.spatial.at(at)).toContain(id);
    expect(w.game.world.entities.get(id, C.Position)).toEqual({ x: 30, y: 30, z: 32 });
    expect(w.game.world.entities.get(id, C.Creature)?.faction).toBe('fortress');
    // All labors on for an adult (`02` § Arrival step 5).
    expect(w.readers.of<JobsReader>('11').laborEnabled(id, 'mining')).toBe(true);
  });

  it('a child dwarf gets hauling only', () => {
    const w = new TestWorld({ seed: 'spawn-child', world: 'flat-test' });
    const id = w.spawnDwarf({ ageYears: 6 });
    const reader = w.readers.of<JobsReader>('11');
    expect(reader.laborEnabled(id, 'hauling')).toBe(true);
    expect(reader.laborEnabled(id, 'mining')).toBe(false);
  });

  it('a spawned wild animal has Wild and no dwarf components; its body comes from its plan', () => {
    const w = new TestWorld({ seed: 'spawn-wolf', world: 'flat-test' });
    const at = w.index(40, 40, 32);
    const id = w.spawnCreature('wolf', at, 'wild');
    const names = componentsOf(w, id);
    expect(names).toContain('Wild');
    for (const n of ['Position', 'Motion', 'Creature', 'Body']) expect(names).toContain(n);
    for (const n of ['Brain', 'Labors', 'Skills']) expect(names).not.toContain(n);
    expect(w.game.world.entities.get(id, C.Wild)?.homeChunk).toBe(w.map.chunkOf(at));
    const creatures = w.game.registry.table<{ id: string; size: number; speed: number; plan: string }>('creatures');
    const wolf = creatures.byId('wolf') as { size: number; speed: number; plan: string };
    expect(w.game.world.entities.get(id, C.Motion)?.speed).toBe(wolf.speed);
    const plan = w.game.registry.table<{ id: string; parts: Record<string, { hpFactor: number }> }>('bodyPlans').byId(wolf.plan);
    const body = w.game.world.entities.get(id, C.Body);
    expect(body?.parts).toHaveLength(6);
    BODY_SLOTS.forEach((slot, k) => {
      const hp = partMaxHp(wolf.size, plan?.parts[slot]?.hpFactor ?? 0);
      expect(body?.parts[k]).toEqual({ hp, maxHp: hp, wounds: [], destroyed: false });
    });
    expect(bodyFor(plan as never, 100).parts[1]?.maxHp).toBe(partMaxHp(100, plan?.parts['torso']?.hpFactor ?? 0));
    // A tame animal (fortress) is not wild.
    const cow = w.spawnCreature('cow', w.index(41, 40, 32), 'fortress');
    expect(componentsOf(w, cow)).not.toContain('Wild');
  });

  it('spawn.item is a stub until M2: it records the intended item and makes no entity', () => {
    const w = new TestWorld({ seed: 'spawn-item', world: 'flat-test' });
    const before = w.game.world.entities.count;
    const log = w.game.registry.table('items').index('log');
    expect(w.game.world.services.spawn.item(log, 3, w.index(1, 1, 32), 2)).toBe(0);
    expect(w.game.world.entities.count).toBe(before);
    expect(w.game.spawn.intendedItems).toEqual([{ type: log, material: 3, at: w.index(1, 1, 32), count: 2, quality: 1, tick: 0 }]);
  });

  it('03 drops its items through the spawn API', () => {
    const w = new TestWorld({ seed: 'spawn-drop', world: 'flat-test', embark: 'default' });
    const hematite = w.game.registry.table('materials').index('hematite');
    const t = w.index(48, 10, 32);
    w.game.world.services.terrain.setKind(t, TileKind.Wall, hematite);
    w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'dig' });
    w.until((x) => x.map.kindAt(t) === TileKind.Floor, 1500);
    const ore = w.game.registry.table('items').index('ore');
    expect(w.game.spawn.intendedItems.filter((i) => i.type === ore)).toEqual([
      expect.objectContaining({ type: ore, material: hematite, at: t, count: 1 }),
    ]);
  });

  it('the embark arrival spawns its seven dwarves through the spawn API', () => {
    const w = new TestWorld({ seed: 'spawn-embark', world: 'flat-test', embark: 'default' });
    const ids = w.game.arrival?.dwarves ?? [];
    expect(ids).toHaveLength(7);
    for (const id of ids) {
      for (const name of DWARF_SET) expect([name, componentsOf(w, id).includes(name)]).toEqual([name, true]);
    }
  });
});
