import { describe, expect, it } from 'vitest';
import { HeadlessGame } from '@app/headless';
import { Strings } from '@ui/strings';
import type { AnnouncementSpec } from '@core/system';

function keysForSpec(spec: AnnouncementSpec): string[] {
  if (spec.keyField === undefined) {
    return [spec.stringKey];
  }
  if (spec.oneOf !== undefined) {
    return spec.oneOf.values.map((v) => `${spec.stringKey}.${v}`);
  }
  if (spec.keyField === 'season') {
    return [0, 1, 2, 3].map((s) => `${spec.stringKey}.${s}`);
  }
  return [spec.stringKey];
}

describe('F-09a: announcement text', () => {
  it('F-09a: every registered announcement has text', () => {
    const game = new HeadlessGame({ seed: 'announcement-text', world: 'flat-test' });
    const strings = new Strings(game.registry);
    const registrations = game.world.registrations.announcements;
    expect(registrations.length).toBeGreaterThan(0);

    const allKeys: string[] = [];
    for (const { spec } of registrations) {
      const keys = keysForSpec(spec);
      for (const key of keys) {
        allKeys.push(key);
        expect(strings.get(key, {}), `Missing text for key ${key}`).not.toBe(key);
      }
    }

    // Verify the previously missing keys are present and resolved
    expect(allKeys).toContain('announce.mood_tier');
    expect(allKeys).toContain('announce.sulk.day_off');
    expect(allKeys).toContain('announce.sulk.argue');
    expect(allKeys).toContain('announce.sulk.weep');
    expect(allKeys).toContain('announce.sulk_break');
    expect(allKeys).toContain('announce.thought');
    expect(allKeys).toContain('announce.fish_pool_depleted');
  });
});
