/**
 * T-803: in playtest 9 a fortress six levels into rock read "Waiting for stone (0 available) - dig
 * down to rock: the soil here is … levels deep". A dug rock tile gives a stone three times in ten
 * (`MINING_STONE_DROP_PERMILLE`), and once rock has been dug (`terrain.rockDug()`) the advice says to
 * dig more, and names the standing orders that take the stone (`fortress-screen.md` § Build tool).
 */
import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import { gameHeader, gameSections, inMemorySave, restoreGame } from '@app/game-save';
import { SAVE_FORMAT_VERSION } from '@app/save-manager';
import type { TerrainReader } from '@systems/terrain';
import type { ItemsReader } from '@systems/items';
import { stoneAdvice, workshopBlockText, type MessageEnv } from '@ui/messages';
import { TestWorld } from '../../scenarios/test-world';
import { onlyMiner, rect, stairShaft } from '../../scenarios/m1-helpers';
import { strings } from './ui-fixture';

function envOf(w: TestWorld): MessageEnv {
  return { readers: w.readers, registry: w.game.registry, strings };
}

describe('T-803 the stone advice in a fortress that has dug rock', () => {
  it('every rock tile dug gives a stone; the advice then says dig more and names the orders that take stone', () => {
    const w = new TestWorld({ seed: 't803-advice', world: 'flat-test', embark: 'default' });
    const terrain = w.readers.of<TerrainReader>('03');
    expect(terrain.rockDug()).toBe(false);
    expect(stoneAdvice(envOf(w))).toMatch(/^dig down to rock: the soil here is \d+ levels? deep$/);
    stairShaft(w, 48, 12, 32, 29);
    onlyMiner(w);
    const items = w.readers.of<ItemsReader>('13');
    const stoneType = w.game.registry.table('items').index('raw_stone');
    const before = items.countAvailable({ type: stoneType });
    const room = rect(w, 49, 11, 29, 3, 3);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: room, kind: 'dig', priority: 5 }).ok).toBe(true);
    w.until((world) => room.every((t) => world.map.kindAt(t) === TileKind.Floor), 3000);
    expect(terrain.rockDug()).toBe(true);
    const dug = items.countAvailable({ type: stoneType }) - before;
    expect(dug).toBeGreaterThan(0);
    expect(dug).toBeLessThanOrEqual(room.length);
    expect(stoneAdvice(envOf(w))).toBe('dig more rock: 3 in 10 tiles give a stone');

    const mason = w.build('mason', w.index(20, 20, 32));
    const crafts = w.build('craftdwarf', w.index(26, 20, 32));
    w.step(1);
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: mason,
      order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 30, priority: 5 } })).toEqual({ ok: true });
    expect(w.game.world.applyCommand({ type: 'AddWorkOrder', workshopId: crafts,
      order: { recipeId: 'craft_stone', mode: 'once', remaining: 951, priority: 5 } })).toEqual({ ok: true });
    const text = workshopBlockText(envOf(w), 'waiting for raw_stone');
    expect(text).toBe(`Waiting for stone (${items.countAvailable({ type: stoneType })} available) — dig more rock: 3 in 10 tiles give a stone · stone goes to Craftsdwarf's workshop #1 (×951 Stone crafts); Mason's workshop #1 (≥30 Blocks)`);

    // The flag is saved.
    const header = { ...gameHeader(w.game, 'manual'), formatVersion: SAVE_FORMAT_VERSION, compressed: false };
    const loaded = restoreGame(inMemorySave(header, gameSections(w.game)));
    expect(loaded.game.world.readers.of<TerrainReader>('03').rockDug()).toBe(true);
  }, 120_000);
});
