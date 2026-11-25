/**
 * T-736: a thought many dwarves gain from one event is one log line (`reports/data/2026-11-25-playtest-3.md`,
 * finding 3). "We drove them off." came once per dwarf at a raid's end; now the `ThoughtGained` events of
 * one thought in one tick make one line: one dwarf named, two named, more counted (15 § Registrations,
 * 24 § Announcements and the log).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import type { EntityId } from '@core/types';
import { AnnouncementLog } from '@ui/announcements';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;
const event = (fields: Record<string, unknown>): GameEvent => fields as unknown as GameEvent;

const NAMES = ['Alrik Hollowfell', 'Vali Asheye', 'Yngvar Craggate', 'Asa Forgehall', 'Njal Coaleye', 'Liv Ironvein', 'Orm Ashbrow',
  'Ketil Stonehand', 'Dagny Goldstone', 'Sigrun Deepdelver', 'Bjorn Flintbeard', 'Ragna Emberhall', 'Halvar Ironfell'];

function world(seed: string, dwarves: number): { w: TestWorld; ids: EntityId[] } {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ids: EntityId[] = [];
  for (let k = 0; k < dwarves; k += 1) {
    const name = NAMES[k] as string;
    const id = w.spawnDwarf({ at: w.index(10 + k, 10, Z), name });
    w.game.world.entities.get(id, C.Creature)!.name = name;
    ids.push(id);
  }
  return { w, ids };
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

const gained = (id: EntityId, thoughtId: string, value = 8): GameEvent => event({ type: 'ThoughtGained', id, thoughtId, value });

describe('T-736 a thought many dwarves gain at once is one line', () => {
  it('a raid\'s end gives 13 dwarves "We drove them off." in one tick: one line with the count, its key, the first dwarf\'s place and no subject', () => {
    const { w, ids } = world('t736-raid', 13);
    const log = announcer(w);
    const tick = w.tick;
    const raidOver = log.announce(event({ type: 'RaidEnded', partyId: 0, outcome: 'repelled' }), w.readers, tick);
    const first = log.announce(gained(ids[0] as EntityId, 'raid_repelled'), w.readers, tick);
    expect(first).not.toBeNull();
    // The day's deaths may come between the thoughts of one tick: the line keeps its place.
    log.append('danger', 'Orm Ashbrow has bled to death.', tick, undefined, undefined, 'announce.died.bled');
    const rest = ids.slice(1).map((id) => log.announce(gained(id, 'raid_repelled'), w.readers, tick));
    expect(rest.every((done) => done === null)).toBe(true);
    const lines = log.lines.filter((l) => l.text.includes('We drove them off.'));
    expect(lines).toHaveLength(1);
    const line = lines[0]!;
    expect(line.text).toBe('13 dwarves: "We drove them off."');
    expect(line.count).toBe(1);
    expect(line.key).toBe('announce.thought_many');
    expect(line.subject).toBeUndefined();
    expect(line.focus).toBe(w.index(10, 10, Z));
    expect(log.lines.indexOf(line)).toBeLessThan(log.lines.findIndex((l) => l.text.includes('bled to death')));
    expect(raidOver === null || log.lines.indexOf(raidOver.line) < log.lines.indexOf(line)).toBe(true);
  });

  it('a lone dwarf\'s thought reads as before, keyed `announce.thought`, about that dwarf', () => {
    const { w, ids } = world('t736-lone', 1);
    const log = announcer(w);
    const id = ids[0] as EntityId;
    const done = log.announce(gained(id, 'raid_repelled'), w.readers, w.tick);
    expect(done?.line.text).toBe('Alrik Hollowfell: "We drove them off."');
    expect(done?.line.key).toBe('announce.thought');
    expect(done?.line.subject).toBe(id);
    expect(log.lines).toHaveLength(1);
  });

  it('an argument names both dwarves (`announce.thought_pair`)', () => {
    const { w, ids } = world('t736-argue', 2);
    const log = announcer(w);
    log.announce(gained(ids[0] as EntityId, 'argued', -5), w.readers, w.tick);
    log.announce(gained(ids[1] as EntityId, 'argued', -5), w.readers, w.tick);
    expect(log.lines.map((l) => [l.text, l.key, l.subject])).toEqual([
      ['Alrik Hollowfell and Vali Asheye: "Had an argument."', 'announce.thought_pair', undefined],
    ]);
  });

  it('another thought, or the same thought on a later tick, is a line of its own', () => {
    const { w, ids } = world('t736-apart', 3);
    const log = announcer(w);
    const [a, b, c] = ids as [EntityId, EntityId, EntityId];
    log.announce(gained(a, 'raid_repelled'), w.readers, 100);
    log.announce(gained(b, 'made_masterwork', 10), w.readers, 100);
    log.announce(gained(c, 'raid_repelled'), w.readers, 100);
    log.announce(gained(c, 'argued', -5), w.readers, 101);
    log.announce(gained(a, 'raid_repelled'), w.readers, 101);
    expect(log.lines.map((l) => l.text)).toEqual([
      'Alrik Hollowfell and Yngvar Craggate: "We drove them off."',
      'Vali Asheye: "I made a masterwork."',
      'Yngvar Craggate: "Had an argument."',
      'Alrik Hollowfell: "We drove them off."',
    ]);
  });

  it('a dwarf whose words merged into an earlier identical line leaves it as it was when the line grows', () => {
    const { w, ids } = world('t736-split', 2);
    const log = announcer(w);
    const [a, b] = ids as [EntityId, EntityId];
    log.announce(gained(a, 'raid_repelled'), w.readers, 100);
    // A second raid repelled the same day: Alrik's words merge with the line of the first, then Vali's come.
    log.announce(gained(a, 'raid_repelled'), w.readers, 200);
    expect(log.lines[0]?.count).toBe(2);
    log.announce(gained(b, 'raid_repelled'), w.readers, 200);
    expect(log.lines.map((l) => [l.text, l.count, l.key])).toEqual([
      ['Alrik Hollowfell: "We drove them off."', 1, 'announce.thought'],
      ['Alrik Hollowfell and Vali Asheye: "We drove them off."', 1, 'announce.thought_pair'],
    ]);
  });

  it('the hearth lit in a fortress of 7 makes one line', () => {
    const { w } = world('t736-hearth', 7);
    const log = announcer(w);
    w.game.world.onEvents((events) => {
      for (const e of events) if (e.type === 'ThoughtGained') log.announce(e, w.readers, w.tick);
    });
    const at = w.index(30, 20, Z);
    const placed = w.game.world.applyCommand({ type: 'PlaceBuilding', buildingType: 'hearth', origin: at } as never) as { ok: boolean };
    expect(placed.ok).toBe(true);
    const id = w.readers.of<{ at(t: number): EntityId }>('14').at(at);
    w.step(1);
    (w.game.world.scheduler.byId('14') as unknown as { completeNow(id: EntityId, m: number): void }).completeNow(id, 0);
    w.step(2);
    expect(w.events('HearthLit')).toHaveLength(1);
    expect(w.events('ThoughtGained').filter((e) => e['thoughtId'] === 'hearth_lit')).toHaveLength(7);
    expect(log.lines.map((l) => [l.text, l.key])).toEqual([['7 dwarves: "The hearth is lit. This is home now."', 'announce.thought_many']]);
  });
});
