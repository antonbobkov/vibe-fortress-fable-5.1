/**
 * T-804: an engraving rolls quality as an item does, but only an item's masterwork was told. An
 * engraving of masterwork quality emits `MasterworkCreated` with its tile, gives the engraver
 * `made_masterwork`, and is announced (03 § Digging as a job).
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import type { GameEvent } from '@core/events';
import { TileFlag, TileKind } from '@core/map3d';
import type { TerrainReader } from '@systems/terrain';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

describe('T-804 a masterwork engraving is told', () => {
  it('a Legendary engraver engraves a masterwork: the event with the tile, the thought and the line', () => {
    const w = new TestWorld({ seed: 't804-engrave', world: 'flat-test', embark: 'default' });
    const reader = w.readers.of<TerrainReader>('03');
    const t = w.index(40, 15, 29);
    const terrain = w.game.world.services.terrain;
    terrain.setKind(w.index(40, 14, 32), TileKind.StairsDown, 1);
    terrain.setKind(w.index(40, 14, 31), TileKind.StairsUpDown, 1);
    terrain.setKind(w.index(40, 14, 30), TileKind.StairsUpDown, 1);
    terrain.setKind(w.index(40, 14, 29), TileKind.StairsUp, w.map.materialAt(t));
    terrain.setKind(t, TileKind.Floor, w.map.materialAt(t));
    const dwarves = w.game.arrival?.dwarves ?? [];
    const engraver = dwarves[0] as number;
    for (const id of dwarves) for (const labor of ['masonry', 'crafts']) w.setLabor(id, labor, id === engraver);
    w.setSkill(engraver, 'engraving', 21);
    w.discover(t);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'smooth' })).toEqual({ ok: true });
    w.until((x) => x.map.hasFlag(t, TileFlag.Smoothed), 2000);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [t], kind: 'engrave' })).toEqual({ ok: true });
    w.until((x) => x.map.hasFlag(t, TileFlag.Engraved), 3000);
    expect(reader.engravingAt(t)?.quality).toBe(5);
    const made = w.events('MasterworkCreated');
    expect(made).toHaveLength(1);
    expect(made[0]).toMatchObject({ itemId: 0, crafterId: engraver, tile: t });
    w.step(5);
    const thoughts = w.events('ThoughtGained').filter((e) => e['id'] === engraver).map((e) => String(e['thoughtId']));
    const index = String(w.game.registry.table('thoughts').index('made_masterwork'));
    expect(thoughts.some((id) => id === 'made_masterwork' || id === index)).toBe(true);
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const told = log.announce(made[0] as GameEvent, w.readers, w.tick);
    const name = w.game.world.entities.get(engraver, C.Creature)?.name ?? '';
    // The test map has no room on the tile: the line without a place.
    expect(told?.line.text).toBe(`${name} has engraved a masterwork.`);
  }, 120_000);
});
