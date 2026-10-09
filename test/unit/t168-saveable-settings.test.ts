import { describe, expect, it } from 'vitest';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { RngStream } from '@core/rng';
import { TestWorld } from '../scenarios/test-world';

function setup(): { w: TestWorld; hospital: number; barracks: number; gather: number } {
  const w = new TestWorld({ seed: 't115-commands', world: 'flat-test', embark: 'none' });
  const hospital = w.zone('hospital', [w.index(30, 30, 32)]);
  const barracks = w.zone('barracks', [w.index(31, 30, 32)]);
  const gather = w.zone('gather', [w.index(32, 30, 32)]);
  return { w, hospital, barracks, gather };
}

describe('T-168 settings remain typed and saveable', () => {
  it.each([null, 'cloth', [], { cloth: NaN }, { cloth: Infinity }, { cloth: -1 },
    { cloth: 0.5 }, { cloth: 1000 }, { unknown: 1 }])('rejects malformed hospital supplies %j', (wants) => {
    const { w, hospital } = setup();
    const before = w.game.hash();
    expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: hospital, wants }))
      .toEqual({ ok: false, reason: 'bad_setting' });
    expect(w.game.hash()).toBe(before);
    expect(roundTrip(w.game).game.hash()).toBe(before);
  });
  it('rejects the NaN zone probe and a nonexistent squad without changing state', () => {
    const { w, barracks } = setup();
    const before = w.game.hash();
    for (const value of [NaN, Infinity, 1.5, 'squad', -1, 999999]) {
      expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: barracks, key: 'squad', value }))
        .toEqual({ ok: false, reason: 'bad_setting' });
      expect(w.game.hash()).toBe(before);
    }
    expect(roundTrip(w.game).game.hash()).toBe(before);
  });
  it.each([NaN, Infinity, -1, 0, 10, 0.5, '5', null])('rejects invalid gather priority %j', (value) => {
    const { w, gather } = setup();
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: gather, key: 'priority', value }))
      .toEqual({ ok: false, reason: 'bad_setting' });
  });
  it('validates owner settings through room assignment and seasonal crop settings through farming rules', () => {
    const { w } = setup();
    const owner = w.spawnDwarf({ at: w.index(40, 40, 32), ageYears: 30 });
    const bedroom = w.zone('bedroom', [w.index(41, 40, 32)]);
    w.build('bed', w.index(41, 40, 32), 'oak');
    w.step(10);
    for (const value of [NaN, 999999, 'owner', null]) {
      expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: bedroom, key: 'owner', value }))
        .toEqual({ ok: false, reason: 'bad_setting' });
    }
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: bedroom, key: 'owner', value: owner })).toEqual({ ok: true });
    const room = w.game.world.entities.with(C.Room).find((id) => w.game.world.entities.get(id, C.Room)?.zoneId === bedroom)!;
    expect(w.game.world.entities.get(room, C.Room)?.ownerId).toBe(owner);
    const plot = w.zone('farm_plot', [w.index(42, 40, 32)]);
    const beforeCrop = w.game.hash();
    for (const value of [NaN, [NaN, 0, 0, 0], [0], ['barley', NaN, 0, 0], [0, null, 0, 0], ['dimcap', 0, 0, 0], ['no_plant', 0, 0, 0]]) {
      expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: plot, key: 'crop per season', value }))
        .toEqual({ ok: false, reason: 'bad_setting' });
    }
    expect(w.game.hash()).toBe(beforeCrop);
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: plot, key: 'crop per season', value: ['barley', 0, 0, 0] })).toEqual({ ok: true });
    expect(w.game.world.entities.get(plot, C.Zone)?.settings['crop_per_season']).toEqual([w.game.registry.table('plants').index('barley'), 0, 0, 0]);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
  it('a malformed crop choice cannot clear an existing seasonal choice', () => {
    const { w } = setup();
    const plot = w.zone('farm_plot', [w.index(42, 40, 32)]);
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: plot, season: 0, speciesId: 'barley' })).toEqual({ ok: true });
    const before = w.game.hash();
    for (const speciesId of [null, {}, NaN, Infinity, -1, 0.5]) {
      expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: plot, season: 0, speciesId })).toEqual({ ok: false, reason: 'not_found' });
      expect(w.game.hash()).toBe(before);
    }
    expect(w.game.world.applyCommand({ type: 'SetPlotCrop', zoneId: plot, season: 0, speciesId: 0 })).toEqual({ ok: true });
    expect(w.game.world.entities.get(plot, C.Zone)?.settings['crop_per_season']).toEqual([0, 0, 0, 0]);
  });
  it('remains saveable through 1,000 deterministic random setting commands', () => {
    const { w, hospital, barracks, gather } = setup();
    const rng = RngStream.forStream('t168-setting-stream', 'commands');
    const values: unknown[] = [NaN, Infinity, -1, 0, 1, 9, 999, 1000, 'cloth', null,
      [], { cloth: 2 }, { cloth: NaN }, { thread: -2 }, { unknown: 1 }];
    for (let i = 0; i < 1000; i += 1) {
      const value = values[rng.int(0, values.length - 1)];
      const choice = rng.int(0, 3);
      const result = w.game.world.applyCommand(choice === 0
        ? { type: 'SetHospitalSupplies', zoneId: hospital, wants: value }
        : { type: 'SetZoneSetting', zoneId: choice === 1 ? hospital : choice === 2 ? barracks : gather,
          key: choice === 1 ? 'desired supplies' : choice === 2 ? 'squad' : 'priority', value });
      if (!result.ok) expect(result.reason).toBe('bad_setting');
      if (i % 100 === 0) expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
    }
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });

  it('a generic hospital setting stores a copy where supply hauling reads it', () => {
    const { w, hospital } = setup();
    const wants = { cloth: 2 };
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: hospital, key: 'desired supplies', value: wants })).toEqual({ ok: true });
    wants.cloth = NaN;
    expect(w.game.world.entities.get(hospital, C.Zone)?.settings['desired supplies']).toEqual({ cloth: 2 });
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });

  it('stores valid supplies, squads and priorities and preserves them on load', () => {
    const { w, hospital, barracks, gather } = setup();
    const wants = { cloth: 999, thread: 0, splints: 2, crutches: 3, brightleaf: 4, buckets: 1 };
    expect(w.game.world.applyCommand({ type: 'SetHospitalSupplies', zoneId: hospital, wants })).toEqual({ ok: true });
    expect(w.game.world.entities.get(hospital, C.Zone)?.settings['desired supplies']).toEqual(wants);
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' })).toEqual({ ok: true });
    const squad = w.game.world.entities.with(C.Squad)[0]!;
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: barracks, key: 'squad', value: squad })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'SetZoneSetting', zoneId: gather, key: 'priority', value: 9 })).toEqual({ ok: true });
    expect(w.game.world.entities.get(barracks, C.Zone)?.settings['squad']).toBe(squad);
    expect(roundTrip(w.game).game.hash()).toBe(w.game.hash());
  });
});
