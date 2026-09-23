import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_YEAR } from '@core/constants';
import { TestWorld } from '../../scenarios/test-world';

describe('T-M4-07 titles, children, aging and clothing', () => {
  it('keeps one holder per title while one dwarf can hold several', () => {
    const w = new TestWorld({ seed: 'm4-titles', world: 'flat-test', embark: 'none' });
    const a = w.spawnDwarf({ at: w.index(12, 12, 32) });
    const b = w.spawnDwarf({ at: w.index(13, 12, 32) });
    const assign = (dwarfId: number, title: 'thane' | 'warden') => w.game.world.applyCommand({ type: 'AssignTitle', dwarfId, title });
    expect(assign(a, 'thane')).toEqual({ ok: true });
    expect(assign(a, 'warden')).toEqual({ ok: true });
    expect(w.dwarves.reader().titles(a)).toEqual(['thane', 'warden']);
    expect(assign(b, 'thane')).toEqual({ ok: true });
    expect(w.dwarves.reader().titles(a)).toEqual(['warden']);
    expect(w.dwarves.reader().title(a)).toBe('warden');
    expect(w.dwarves.reader().holder('thane')).toBe(b);
    expect(assign(0, 'thane')).toEqual({ ok: true });
    expect(w.dwarves.reader().title(b)).toBe('none');
  });

  it('keeps child labor fixed, then enables the full labor grid at age twelve', () => {
    const w = new TestWorld({ seed: 'm4-adult', world: 'flat-test', embark: 'none', startTick: TICKS_PER_YEAR - 1 });
    const id = w.spawnDwarf({ at: w.index(12, 12, 32), ageYears: 11 });
    const labors = w.game.registry.table<{ id: string; children: boolean }>('labors');
    const enabled = w.game.world.entities.get(id, C.Labors)?.enabled;
    expect(enabled).toBeDefined();
    for (let k = 1; k <= labors.size; k += 1) {
      const on = (((enabled?.[k >> 3] ?? 0) as number) & (1 << (k & 7))) !== 0;
      expect(on).toBe(labors.byIndex(k)?.children);
    }
    expect(w.game.world.applyCommand({ type: 'SetLabor', dwarfId: id, labor: 'hauling', on: false })).toEqual({ ok: false, reason: 'child_labor' });
    w.step(3);
    expect(w.events('DwarfBecameAdult').filter((e) => e['id'] === id)).toHaveLength(1);
    expect(w.game.world.entities.get(id, C.Creature)?.ageTicks).toBe(12 * TICKS_PER_YEAR);
    const adult = w.game.world.entities.get(id, C.Labors)?.enabled;
    for (let k = 1; k <= labors.size; k += 1) expect(((adult?.[k >> 3] ?? 0) & (1 << (k & 7))) !== 0).toBe(true);
    w.step(1);
    expect(w.events('DwarfBecameAdult').filter((e) => e['id'] === id)).toHaveLength(1);
  });

  it('starts embarked dwarves in content-backed body, leg and foot garments', () => {
    const w = new TestWorld({ seed: 'm4-clothes', world: 'flat-test', embark: 'default' });
    const types = w.game.registry.table<{ id: string; category: string }>('items');
    for (const id of w.game.arrival?.dwarves ?? []) {
      const clothing = w.game.world.entities.get(id, C.Equipment)?.clothing;
      expect(clothing).toBeDefined();
      for (const slot of ['body', 'legs', 'feet'] as const) {
        const itemId = clothing?.[slot] ?? 0;
        expect(itemId).toBeGreaterThan(0);
        const item = w.game.world.entities.get(itemId, C.Item);
        expect(item?.carriedBy).toBe(id);
        expect(types.byIndex(item?.type ?? 0)?.category).toBe(`clothing/${slot}`);
      }
      expect(w.dwarves.reader().isUnclothed(id)).toBe(false);
    }
    const first = w.game.arrival?.dwarves[0] as number;
    const equipment = w.game.world.entities.get(first, C.Equipment);
    if (equipment === undefined) throw new Error('missing starting equipment');
    w.game.world.entities.add(first, C.Equipment, { ...equipment, clothing: { ...equipment.clothing, feet: 0 } });
    expect(w.dwarves.reader().isUnclothed(first)).toBe(true);
    w.game.world.entities.add(first, C.Equipment, equipment);
    w.items.destroy(equipment.clothing.body, 'test');
    expect(w.dwarves.reader().isUnclothed(first)).toBe(true);
  });

  it('lets a child complete a hauling job while mining remains unavailable', () => {
    const w = new TestWorld({ seed: 'm4-child-haul', world: 'flat-test', embark: 'none' });
    const at = w.index(12, 12, 32);
    const id = w.spawnDwarf({ at, ageYears: 8 });
    const zone = w.zone('stockpile', [w.index(10, 12, 32)]);
    expect(w.game.world.applyCommand({ type: 'SetStockpileFilter', zoneId: zone, filter: 'wood' })).toEqual({ ok: true });
    const log = w.spawnItem('log', 'oak', at);
    w.until((x) => x.events('JobCompleted').some((e) => e['jobType'] === 'haul_to_stockpile' && e['workerId'] === id), 500);
    expect(w.game.world.entities.get(log, C.Item)?.carriedBy).toBe(0);
  });
});
