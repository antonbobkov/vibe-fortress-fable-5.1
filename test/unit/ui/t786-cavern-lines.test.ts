/**
 * T-786: the cavern lines say which cavern, where, and what lives there; the Threats panel says how
 * many of a cavern's monsters can walk to the halls (`reports/data/2026-11-26-playtest-7.md`, finding 3).
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { TICKS_PER_DAY } from '@core/constants';
import { TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import type { ThreatsReader } from '@systems/threats';
import { AnnouncementLog, lineText } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { cavernMonstersText } from '@ui/panels/threats';
import { TestWorld } from '../../scenarios/test-world';
import { strings } from './ui-fixture';

const Z = FLAT_TEST_SURFACE_Z;
/** A level of cavern 2's band (03 § Caverns). */
const CAVERN_Z = 12;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function announcer(w: TestWorld): AnnouncementLog {
  const log = new AnnouncementLog(strings, w.game.registry);
  log.register(w.game.world.registrations.announcements);
  return log;
}

/** A pocket of floor deep in the rock, sealed from the surface. */
function sealedPocket(w: TestWorld): TileIndex[] {
  const tiles: TileIndex[] = [];
  for (let x = 10; x < 13; x += 1) {
    const i = w.index(x, 10, CAVERN_Z);
    w.carve(i, TileKind.Floor);
    tiles.push(i);
  }
  w.step(1);
  return tiles;
}

function spawned(id: EntityId, cavern: number): GameEvent {
  return { type: 'MonsterSpawned', id, cavern } as unknown as GameEvent;
}

describe('T-786 the cavern lines say where', () => {
  it('the breach line names the cavern and the place, and goes there', () => {
    const w = world('t786-breach');
    const log = announcer(w);
    const tile = w.index(2, 14, 13);
    const done = log.announce({ type: 'CavernBreached', cavern: 2, tile } as unknown as GameEvent, w.readers, 10);
    expect(done?.severity).toBe('alert');
    expect(done?.focus).toBe(tile);
    expect(lineText(done!.line, strings)).toBe('! Cavern 2 is open at (2,14,z13). What lives there can walk in.');
    expect(done?.line.key).toBe('announce.cavern_breached');
  });

  it('a respawn names its species and cavern, folds by cavern and day, and is silent when it cannot reach', () => {
    const w = world('t786-respawn');
    const log = announcer(w);
    w.spawnDwarf({ at: w.index(20, 20, Z) });
    const pocket = sealedPocket(w);
    const stalker = w.spawnCreature('blind_stalker', w.index(30, 20, Z), 'hostile:cavern');
    const crawlers = [w.spawnCreature('cave_crawler', w.index(31, 20, Z), 'hostile:cavern'), w.spawnCreature('cave_crawler', w.index(32, 20, Z), 'hostile:cavern')];
    const sealed = w.spawnCreature('cave_crawler', pocket[0] as TileIndex, 'hostile:cavern');
    w.step(1);
    expect(log.announce(spawned(sealed, 2), w.readers, 100)).toBeNull();
    const first = log.announce(spawned(stalker, 2), w.readers, 110);
    expect(first?.severity).toBe('note');
    expect(lineText(first!.line, strings)).toBe('A blind stalker has appeared in cavern 2.');
    expect(first?.line.subject).toBe(stalker);
    expect(log.announce(spawned(crawlers[0] as EntityId, 2), w.readers, 120)).toBeNull();
    expect(log.announce(spawned(crawlers[1] as EntityId, 2), w.readers, 130)).toBeNull();
    expect(log.lines.map((l) => lineText(l, strings))).toEqual(['A blind stalker and 2 cave crawlers have appeared in cavern 2.']);
    expect(log.lines[0]?.key).toBe('announce.monster_spawned_many');
    // Another cavern, or the next day, is a line of its own.
    expect(log.announce(spawned(crawlers[0] as EntityId, 1), w.readers, 140)).not.toBeNull();
    expect(log.announce(spawned(stalker, 2), w.readers, 110 + TICKS_PER_DAY)).not.toBeNull();
    expect(log.lines.map((l) => lineText(l, strings))).toEqual([
      'A blind stalker and 2 cave crawlers have appeared in cavern 2.',
      'A cave crawler has appeared in cavern 1.',
      'A blind stalker has appeared in cavern 2.',
    ]);
  });

  it('the Threats row counts the monsters that can reach the halls: a sealed pocket and an open one', () => {
    const w = world('t786-threats');
    w.spawnDwarf({ at: w.index(20, 20, Z) });
    const pocket = sealedPocket(w);
    const open = w.spawnCreature('blind_stalker', w.index(30, 20, Z), 'hostile:cavern');
    const sealed = [w.spawnCreature('cave_crawler', pocket[0] as TileIndex, 'hostile:cavern'), w.spawnCreature('cave_crawler', pocket[2] as TileIndex, 'hostile:cavern')];
    w.step(1);
    const threats = w.readers.of<ThreatsReader>('18');
    const monsters = new Map<number, EntityId[]>([[1, sealed], [2, [open, ...sealed]], [3, []]]);
    vi.spyOn(threats, 'cavernMonsters').mockImplementation((n) => monsters.get(n) ?? []);
    const ctx: PanelContext = {
      readers: w.readers, registry: w.game.registry, strings,
      submit: () => {}, focusOn: () => {}, look: () => {}, openPanel: () => {}, shiftClick: () => false,
    };
    expect(cavernMonstersText(ctx, threats, 1)).toBe('2 monsters, none can reach the halls');
    expect(cavernMonstersText(ctx, threats, 2)).toBe('3 monsters, 1 can reach the halls');
    expect(cavernMonstersText(ctx, threats, 3)).toBe('no monsters');
  });
});
