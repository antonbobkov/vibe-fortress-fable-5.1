/**
 * T-787: a cavern monster or a creature of the Deep fighting in the halls opens the engagement line
 * as a danger line, with the Calm tail; in a cavern band it stays an alert
 * (`reports/data/2026-11-26-playtest-7.md`, finding 3).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { EntityId, TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import { AnnouncementLog, inHalls, lineText } from '@ui/announcements';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import type { Speed } from '@ui/status';
import { defaultUiState } from '@ui/ui-state';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, strings } from './ui-fixture';

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

/** A floor tile under a roof: the halls. */
function indoor(w: TestWorld, x: number, y: number, z: number): TileIndex {
  const i = w.index(x, y, z);
  w.carve(i, TileKind.Floor);
  w.game.world.map.setFlag(i, TileFlag.Outdoor, false);
  return i;
}

function blow(attackerId: EntityId, defenderId: EntityId): GameEvent {
  return { type: 'AttackResolved', attackerId, defenderId, outcome: 'hit', part: 'torso', damageType: 'edge', amount: 5 } as unknown as GameEvent;
}

describe('T-787 a cavern monster fighting in the halls is a danger line', () => {
  it('a blind stalker in the hall opens a danger line with the Calm tail; later blows refresh it', () => {
    const w = world('t787-hall');
    const log = announcer(w);
    const tiles = [indoor(w, 20, 20, Z), indoor(w, 21, 20, Z), indoor(w, 19, 20, Z), indoor(w, 20, 21, Z)];
    const stalker = w.spawnCreature('blind_stalker', tiles[0] as TileIndex, 'hostile:cavern');
    const [a, b, c] = [1, 2, 3].map((k) => w.spawnDwarf({ at: tiles[k] as TileIndex }));
    expect(inHalls(w.readers, tiles[0])).toBe(true);
    const first = log.engage(blow(stalker, a as EntityId), w.readers, 10);
    expect(first?.severity).toBe('danger');
    expect(first?.focus).toBe(tiles[1]);
    expect(lineText(first!.line, strings)).toBe('!! A blind stalker is in the halls! ' +
      `${w.game.world.entities.get(a as EntityId, C.Creature)?.name ?? ''} is fighting it. ` +
      'The alert is Calm: [m] [3] sends the civilians to shelter; [m] [+] makes a squad.');
    expect(first?.line.key).toBe('announce.engagement.halls.one_one');
    expect(log.engage(blow(b as EntityId, stalker), w.readers, 20)).toBeNull();
    expect(log.engage(blow(stalker, c as EntityId), w.readers, 30)).toBeNull();
    expect(log.lines).toHaveLength(1);
    expect(lineText(log.lines[0]!, strings)).toBe('!! A blind stalker is in the halls! 3 dwarves are fighting it. ' +
      'The alert is Calm: [m] [3] sends the civilians to shelter; [m] [+] makes a squad.');
  });

  it('a cave crawler met in its cavern stays an alert, and turns into the danger line once it fights in the halls', () => {
    const w = world('t787-cavern');
    const log = announcer(w);
    const below = w.index(20, 20, CAVERN_Z);
    w.carve(below, TileKind.Floor);
    w.carve(w.index(21, 20, CAVERN_Z), TileKind.Floor);
    const crawler = w.spawnCreature('cave_crawler', below, 'hostile:cavern');
    const miner = w.spawnDwarf({ at: w.index(21, 20, CAVERN_Z) });
    expect(inHalls(w.readers, below)).toBe(false);
    const first = log.engage(blow(crawler, miner), w.readers, 10);
    expect(first?.severity).toBe('alert');
    expect(first?.line.key).toBe('announce.engagement.one');
    // The miner runs up to the hall with the crawler behind.
    const hall = [indoor(w, 20, 20, Z), indoor(w, 21, 20, Z)];
    w.game.world.services.movement?.teleport(miner, hall[1] as TileIndex);
    w.game.world.services.movement?.teleport(crawler, hall[0] as TileIndex);
    const turned = log.engage(blow(crawler, miner), w.readers, 40);
    expect(turned?.severity).toBe('danger');
    expect(turned?.line).toBe(first?.line);
    expect(turned?.line.key).toBe('announce.engagement.halls.one_one');
    expect(log.engage(blow(crawler, miner), w.readers, 50)).toBeNull();
  });

  it('a raider in the hall, or a wolf outdoors, keeps the alert', () => {
    const w = world('t787-raider');
    const log = announcer(w);
    const tiles = [indoor(w, 20, 20, Z), indoor(w, 21, 20, Z)];
    const raider = w.spawnCreature('gloam_warrior', tiles[0] as TileIndex, 'hostile:gloam');
    const dwarf = w.spawnDwarf({ at: tiles[1] as TileIndex });
    expect(log.engage(blow(raider, dwarf), w.readers, 10)?.severity).toBe('alert');
    const w2 = world('t787-outdoor');
    const log2 = announcer(w2);
    const stalker = w2.spawnCreature('blind_stalker', w2.index(20, 20, Z), 'hostile:cavern');
    const dwarf2 = w2.spawnDwarf({ at: w2.index(21, 20, Z) });
    expect(log2.engage(blow(stalker, dwarf2), w2.readers, 10)?.severity).toBe('alert');
  });

  it('the fortress screen pins the danger line and pauses', () => {
    const w = world('t787-screen');
    const tiles = [indoor(w, 20, 20, Z), indoor(w, 21, 20, Z)];
    const stalker = w.spawnCreature('blind_stalker', tiles[0] as TileIndex, 'hostile:cavern');
    const dwarf = w.spawnDwarf({ at: tiles[1] as TileIndex });
    let speed: Speed = 1;
    const host: FortressHost = {
      readers: w.readers, registry: w.game.registry, ui: defaultUiState(Z), submit: (cmd) => w.submit(cmd),
      speed: () => speed, setSpeed: (s) => { speed = s; }, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 42, true), precondition: () => true,
      registeredPanels: () => w.game.world.registrations.panels, announcements: () => w.game.world.registrations.announcements,
      now: () => 1000, confirm: (_id, _params, reply) => reply(true),
    };
    const f = new FortressScreen(host, keymap, strings);
    f.onEvents([blow(stalker, dwarf)]);
    expect(speed).toBe(0);
    const danger = f.log.lines.filter((l) => l.severity === 'danger');
    expect(danger.map((l) => l.key)).toEqual(['announce.engagement.halls.one_one']);
  });
});
