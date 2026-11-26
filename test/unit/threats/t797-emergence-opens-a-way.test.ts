/**
 * T-797: the Hollow-born come up where they can walk, and the panel counts them (18 § The Deep,
 * § Registrations, § Player-facing behavior; `panels.md` § Threats).
 */

import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { findCrackTiles, triggerDeepEmergence } from '@systems/threats/deep';
import type { ThreatsReader } from '@systems/threats';
import { AnnouncementLog } from '@ui/announcements';
import type { PanelContext } from '@ui/panels/context';
import { drawThreatsPanel, hollowText, ThreatsPanel } from '@ui/panels/threats';
import { strings, surface } from '../ui/ui-fixture';
import { TestWorld } from '../../scenarios/test-world';

const Y = 26;

function world(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function ctxOf(w: TestWorld): TickContext {
  return {
    world: w.game.world, registry: w.game.registry, readers: w.readers,
    get tick() { return w.tick; },
    terrain: w.game.world.services.terrain,
    emit: (e: GameEvent) => w.game.world.emit(e),
  } as unknown as TickContext;
}

function material(w: TestWorld, id: string): number {
  return w.game.registry.table('materials').index(id);
}

/**
 * Underground at level Y: a hall (10..21, 10..15), a tunnel east along y = 12 to x = 29, and a
 * deepsilver vein, walls of x 30..32, y 10..14, in the rock. The vein's west face at (30,12) is mined.
 */
function veinInRock(w: TestWorld): TileIndex {
  w.digRoom(10, 10, Y, 12, 6);
  w.digRoom(22, 12, Y, 8, 1);
  const ore = material(w, 'deepsilver_ore');
  for (let y = 10; y <= 14; y += 1) for (let x = 30; x <= 32; x += 1) w.carve(w.index(x, y, Y), TileKind.Wall, ore);
  for (let y = 8; y <= 16; y += 1) for (let x = 8; x <= 34; x += 1) w.discover(w.index(x, y, Y));
  const base = w.index(30, 12, Y);
  w.carve(base, TileKind.Floor, ore);
  w.pathing.connectivity.rebuildDirty();
  return base;
}

function tileOf(w: TestWorld, id: EntityId): TileIndex {
  const p = w.game.world.entities.get(id, C.Position)!;
  return w.index(p.x, p.y, p.z);
}

describe('T-797 the rock cracks into floor joined to the base', () => {
  it('a vein inside rock: rock walls crack to floor, the deepsilver stays, and every spawn shares the base label', () => {
    const w = world('t797-vein-rock');
    const base = veinInRock(w);
    const ore = material(w, 'deepsilver_ore');
    const hollow = new Set<EntityId>();
    const ids = triggerDeepEmergence(ctxOf(w), [base], [{ species: 'hollow_crawler', count: 3 }], hollow);
    w.step(1);
    w.pathing.connectivity.rebuildDirty();
    expect(ids).toHaveLength(3);
    const label = w.readers.pathing.labelOf(base, 'walker');
    expect(label).not.toBe(0);
    expect(w.readers.pathing.labelOf(w.index(15, 12, Y), 'walker')).toBe(label);
    for (const id of ids) {
      const at = tileOf(w, id);
      expect(w.map.kindAt(at)).toBe(TileKind.Floor);
      expect(w.map.materialAt(at)).not.toBe(ore);
      expect(w.readers.pathing.labelOf(at, 'walker')).toBe(label);
    }
    // The pale metal is not broken: every vein wall but the mined face still stands.
    for (let y = 10; y <= 14; y += 1) for (let x = 30; x <= 32; x += 1) {
      const t = w.index(x, y, Y);
      if (t !== base) expect(w.map.kindAt(t)).toBe(TileKind.Wall);
    }
  });

  it('a vein at a cavern floor: the walls beside the base crack, joined to the open floor', () => {
    const w = world('t797-vein-cavern');
    // A cavern floor (open above, floor below) with the vein's face in its east wall.
    w.digRoom(10, 10, Y, 10, 10);
    for (let y = 10; y < 20; y += 1) for (let x = 10; x < 20; x += 1) w.carve(w.index(x, y, Y + 1), TileKind.Open);
    const ore = material(w, 'deepsilver_ore');
    // The vein's face in the cavern's east wall: one deepsilver tile, mined, with rock around.
    w.carve(w.index(20, 14, Y), TileKind.Wall, ore);
    const base = w.index(19, 14, Y);
    w.carve(base, TileKind.Floor, ore);
    w.pathing.connectivity.rebuildDirty();
    const { cracked, spawn } = findCrackTiles(w.map, base, 4, (t) => w.readers.map.isWalkable(t, 'walker'), (m) => m === ore);
    expect(cracked).toHaveLength(4);
    expect(spawn).toEqual(cracked);
    for (const t of cracked) expect(w.map.kindAt(t)).toBe(TileKind.Wall);
    triggerDeepEmergence(ctxOf(w), [base], [{ species: 'hollow_crawler', count: 3 }], new Set());
    w.step(1);
    w.pathing.connectivity.rebuildDirty();
    const label = w.readers.pathing.labelOf(w.index(12, 12, Y), 'walker');
    for (const t of cracked) {
      expect(w.map.kindAt(t)).toBe(TileKind.Floor);
      expect(w.readers.pathing.labelOf(t, 'walker')).toBe(label);
    }
  });

  it('with no wall to crack (only deepsilver around), the Hollow-born come up on the base itself', () => {
    const w = world('t797-no-crack');
    const ore = material(w, 'deepsilver_ore');
    const base = w.index(30, 30, Y);
    w.carve(base, TileKind.Floor, ore);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) w.carve(w.index(30 + dx, 30 + dy, Y), TileKind.Wall, ore);
    const { cracked, spawn } = findCrackTiles(w.map, base, 4, (t) => w.readers.map.isWalkable(t, 'walker'), (m) => m === ore);
    expect(cracked).toEqual([]);
    expect(spawn).toEqual([base]);
  });

  it('a constructed wall is not cracked', () => {
    const w = world('t797-built-wall');
    w.digRoom(10, 10, Y, 3, 1);
    const base = w.index(12, 10, Y);
    const built = w.index(13, 10, Y);
    w.carve(built, TileKind.Wall);
    w.game.world.services.terrain.setFlag(built, TileFlag.Constructed, true);
    const { cracked } = findCrackTiles(w.map, base, 4, (t) => w.readers.map.isWalkable(t, 'walker'));
    expect(cracked).not.toContain(built);
    expect(cracked).toHaveLength(4);
  });
});

describe('T-797 the emergence line and the Threats panel', () => {
  it('"The rock cracks at (x,y,z): 3 hollow crawlers come up." is a danger line whose focus is the base', () => {
    const w = world('t797-line');
    const base = veinInRock(w);
    const ids = triggerDeepEmergence(ctxOf(w), [base], [{ species: 'hollow_crawler', count: 3 }], new Set());
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const done = log.announce({ type: 'MonsterEmerged', ids, tile: base } as unknown as GameEvent, w.readers, 10);
    expect(done?.severity).toBe('danger');
    expect(done?.focus).toBe(base);
    expect(done?.line.text).toBe(`The rock cracks at (30,12,z${Y}): 3 hollow crawlers come up.`);
    const one = log.announce({ type: 'MonsterEmerged', ids: [ids[0]], tile: base } as unknown as GameEvent, w.readers, 5000);
    expect(one?.line.text).toBe(`The rock cracks at (30,12,z${Y}): a hollow crawler comes up.`);
  });

  it('the Deep section wraps its lines and counts the Hollow-born at the vein, then in the halls', () => {
    const w = world('t797-panel');
    const base = veinInRock(w);
    w.spawnDwarf({ at: w.index(12, 12, Y) });
    for (let k = 0; k < 5; k += 1) w.game.world.emit({ type: 'DeepsilverMined', tile: base, minerId: 0 } as unknown as GameEvent);
    w.step(2);
    const threats = w.readers.of<ThreatsReader>('18');
    expect(threats.deepLevel()).toBe(1);
    expect(threats.hollowBorn()).toHaveLength(3);
    expect(threats.emergenceBase()).toBe(base);
    const ctx = { readers: w.readers, registry: w.game.registry, strings, focusOn: () => {} } as unknown as PanelContext;
    expect(hollowText(ctx, threats)?.text).toBe('3 hollow crawlers at the vein');
    const s = surface(36, 40);
    drawThreatsPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, new ThreatsPanel(), ctx, true);
    const text = s.lines().map((l) => l.trimEnd()).join('\n');
    expect(text).toContain('(level 1)');
    expect(text).not.toContain('»');
    expect(text.replace(/\s+/g, ' ')).toContain('"The Deep stirs. Something has noticed the pale metal being taken."');
    expect(text).toContain('3 hollow crawlers at the vein');
    // One walks into the hall: the count says so.
    const first = threats.hollowBorn()[0] as EntityId;
    expect(w.game.world.services.movement!.teleport(first, w.index(12, 14, Y))).toBe(true);
    expect(hollowText(ctx, threats)?.text).toBe('3 hollow crawlers in the halls');
  });
});

describe('T-797 the deep end, from level 0 to level 2', () => {
  it('the Hollow-born walk out and fight, a squad with a kill order reaches them, and deepsilver can still be mined', () => {
    const w = world('t797-deep-end');
    const base = veinInRock(w);
    const Z = FLAT_TEST_SURFACE_Z;
    expect(Y).toBeLessThan(Z);
    const miner = w.spawnDwarf({ at: w.index(20, 12, Y), skills: { mining: 5 } });
    w.setLabor(miner, 'mining');
    const pick = w.spawnItem('pick', 'iron', w.index(20, 12, Y));
    w.game.world.services.items!.attachToCarrier(pick, miner);
    w.game.world.entities.add(miner, C.Worker, { ...w.game.world.entities.get(miner, C.Worker)!, toolId: pick });
    const soldiers = [w.index(12, 11, Y), w.index(12, 13, Y), w.index(13, 12, Y)].map((at) => {
      const id = w.spawnDwarf({ at, skills: { axe: 8, dodge: 5, armor_use: 4 } });
      const axe = w.spawnItem('axe', 'iron', at, 1, 3);
      w.game.world.services.items!.attachToCarrier(axe, id);
      w.game.world.entities.add(id, C.Equipment, {
        weapon: axe, shield: 0, quiver: 0,
        armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 },
      });
      return id;
    });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' });
    const squad = w.game.world.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: soldiers }).ok).toBe(true);

    // Level 1: five tiles' worth of pressure at the mined face.
    for (let k = 0; k < 5; k += 1) w.game.world.emit({ type: 'DeepsilverMined', tile: base, minerId: miner } as unknown as GameEvent);
    w.step(2);
    const emerged = w.events('MonsterEmerged');
    expect(emerged).toHaveLength(1);
    const ids = emerged[0]!['ids'] as EntityId[];
    expect(ids).toHaveLength(3);

    // They walk out and fight within a day.
    const start = w.tick;
    w.until((t) => t.events('AttackResolved').some((e) => ids.includes(e['attackerId'] as EntityId)), TICKS_PER_DAY);
    expect(w.tick - start).toBeLessThanOrEqual(TICKS_PER_DAY);

    // The squad, sent to kill them, reaches them.
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' }).ok).toBe(true);
    for (const targetId of ids) {
      if (w.game.world.entities.alive(targetId)) w.game.world.applyCommand({ type: 'SquadOrder', squadId: squad.id, order: { kind: 'kill', targetId } });
    }
    w.until((t) => t.events('AttackResolved').some((e) => soldiers.includes(e['attackerId'] as EntityId) && ids.includes(e['defenderId'] as EntityId)), TICKS_PER_DAY);
    w.until((t) => ids.every((id) => !t.game.world.entities.alive(id)), 3 * TICKS_PER_DAY);

    // After the fight, the vein can still be mined.
    expect(w.game.world.applyCommand({ type: 'ConfirmDeepsilver' }).ok).toBe(true);
    const face = w.index(31, 12, Y);
    expect(w.map.kindAt(face)).toBe(TileKind.Wall);
    const before = w.events('DeepsilverMined').length;
    // The first miner may well have fallen to them, as in playtest 8: a new one takes up the pick.
    const next = w.spawnDwarf({ at: w.index(15, 12, Y), skills: { mining: 5 } });
    w.setLabor(next, 'mining');
    const pick2 = w.spawnItem('pick', 'iron', w.index(15, 12, Y));
    w.game.world.services.items!.attachToCarrier(pick2, next);
    w.game.world.entities.add(next, C.Worker, { ...w.game.world.entities.get(next, C.Worker)!, toolId: pick2 });
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [face], priority: 1 }).ok).toBe(true);
    w.until((t) => t.events('DeepsilverMined').length > before, 2 * TICKS_PER_DAY);

    // Level 2 comes with more pressure, and its Hollow-born come up on floor joined to the tunnel.
    for (let k = 0; k < 9; k += 1) w.game.world.emit({ type: 'DeepsilverMined', tile: face, minerId: miner } as unknown as GameEvent);
    w.step(2);
    expect(w.readers.of<ThreatsReader>('18').deepLevel()).toBe(2);
    const second = w.events('MonsterEmerged')[1]!['ids'] as EntityId[];
    expect(second.length).toBeGreaterThan(0);
    w.pathing.connectivity.rebuildDirty();
    const label = w.readers.pathing.labelOf(w.index(25, 12, Y), 'walker');
    for (const id of second) expect(w.readers.pathing.labelOf(tileOf(w, id), 'walker')).toBe(label);
  });
});
