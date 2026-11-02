import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { RngStream } from '@core/rng';
import { TICKS_PER_DAY } from '@core/constants';
import { caravanBudget, eligibleGoodsEntries, generateGoods } from '@systems/trade/goods';
import { arrivalTick, skipCaravan } from '@systems/trade/schedule';
import { CARAVAN_VALUE_BASE, CARAVAN_VALUE_PER_RENOWN, CARAVAN_VALUE_PER_REP, REQUEST_SHARE } from '@systems/trade/constants';

describe('T-M7-01 caravan schedule and cargo', () => {
  const registry = contentRegistry();

  it('uses the authored budget and season windows', () => {
    expect(caravanBudget(0, 0)).toBe(CARAVAN_VALUE_BASE);
    expect(caravanBudget(4, 50)).toBe(CARAVAN_VALUE_BASE + 4 * CARAVAN_VALUE_PER_RENOWN + 50 * CARAVAN_VALUE_PER_REP);
    const rng = new RngStream(41);
    const hillfolk = arrivalTick('hillfolk', 1, rng) / TICKS_PER_DAY;
    const wildwood = arrivalTick('wildwood', 1, rng) / TICKS_PER_DAY;
    const mountainhome = arrivalTick('mountainhome', 2, rng) / TICKS_PER_DAY;
    expect(hillfolk).toBeGreaterThanOrEqual(28 + 4);
    expect(hillfolk).toBeLessThanOrEqual(28 + 17);
    expect(wildwood).toBeGreaterThanOrEqual(56 + 4);
    expect(wildwood).toBeLessThanOrEqual(56 + 17);
    expect(mountainhome).toBeGreaterThanOrEqual(112 + 4);
    expect(mountainhome).toBeLessThanOrEqual(112 + 17);
  });

  it('spends the request share before weighted cargo', () => {
    const goods = generateGoods(registry, 'mountainhome', 0, 0, [{ itemType: 'bar', material: 'iron', priority: 3 }], new RngStream(14), new RngStream(15));
    const bars = goods.filter((good) => registry.table('items').idOf(good.type) === 'bar' && registry.table('materials').idOf(good.material) === 'iron');
    expect(bars.length).toBeGreaterThan(0);
    expect(goods[0]).toEqual(bars[0]);
    const requestValue = bars[0]?.value ?? 0;
    expect(requestValue).toBeLessThanOrEqual(CARAVAN_VALUE_BASE * REQUEST_SHARE / 100 * 1.2);
  });

  it('skips banned caravans and uses the temper-4 weather roll only there', () => {
    expect(skipCaravan(-50, 1, 0, 0, new RngStream(1))).toBe(true);
    expect(skipCaravan(0, 2, 2, 0, new RngStream(1))).toBe(true);
    const normal = new RngStream(24);
    for (let n = 0; n < 100; n += 1) expect(skipCaravan(0, 1, 0, 3, normal)).toBe(false);
    const weather = new RngStream(24);
    const skipped = Array.from({ length: 1000 }, () => skipCaravan(0, 1, 0, 4, weather)).filter(Boolean).length;
    expect(skipped).toBeGreaterThan(100);
    expect(skipped).toBeLessThan(200);
  });

  it('D-184: retains base cargo while rare variants require reputation', () => {
    const hasDeepsilver = (rep: number): boolean => eligibleGoodsEntries(registry, 'mountainhome', rep).some((e) => e.materials.some((m) => m.material === 'deepsilver'));
    expect(hasDeepsilver(0)).toBe(false);
    expect(hasDeepsilver(50)).toBe(false);
    expect(hasDeepsilver(75)).toBe(true);
    const livestock = (rep: number): string[] => eligibleGoodsEntries(registry, 'hillfolk', rep)
      .flatMap((e) => Array.isArray(e.item) ? e.item : [e.item]);
    expect(livestock(0)).not.toContain('horse');
    expect(livestock(50)).toContain('horse');
    const wildwood = (rep: number): string[] => eligibleGoodsEntries(registry, 'wildwood', rep)
      .flatMap((e) => Array.isArray(e.item) ? e.item : [e.item]);
    expect(wildwood(0)).not.toContain('bear');
    expect(wildwood(50)).toContain('bear');
  });

  it('D-186: caged livestock spends its authored species value from the request share', () => {
    const goods = generateGoods(registry, 'hillfolk', 0, 0, [{ itemType: 'cow', priority: 3 }], new RngStream(12), new RngStream(13));
    expect(goods[0]?.species).toBe(registry.table('creatures').index('cow'));
    expect(goods[0]?.type).toBe(registry.table('items').index('cage'));
    expect(goods[0]?.value).toBeGreaterThan(0);
  });
});
