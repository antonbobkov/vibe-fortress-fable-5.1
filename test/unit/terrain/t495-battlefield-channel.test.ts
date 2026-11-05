/**
 * T-495: a dead runecaster's channel among an old battlefield's arms (`03-terrain-and-mining.md`
 * stage 10, `25-runecraft.md` § Channels).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SPEC, FLAT_TEST_SURFACE_Z, HeadlessGame } from '@app/headless';
import { C } from '@core/components';
import { StateHasher } from '@core/serialize';
import type { EntityId, TileIndex } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader, SquadWithId } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { MagicReader } from '@systems/magic';
import { BATTLEFIELD_BAND_MAX, BATTLEFIELD_BAND_MIN, BATTLEFIELD_ITEM_COUNT } from '@systems/terrain/constants';
import { generateLocalMap } from '@systems/terrain/generate';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const CHANNELS = ['wand', 'staff'];

function battlefield(seed: string, traits: string[] = ['old_battlefield']): ReturnType<typeof generateLocalMap> {
  return generateLocalMap({ ...FLAT_TEST_SPEC, seed, traits }, registry);
}

describe('T-495 an old channel on an old battlefield', () => {
  it('a battlefield map sometimes holds one channel, never more: a stoneless iron staff or a wand with a stone', () => {
    const stones = registry.table<{ id: string; stone: string }>('spells').rows.map((r) => r.stone);
    const materials = registry.table<{ id: string; class: string }>('materials');
    const found: string[] = [];
    for (const seed of ['t495-0', 't495-1', 't495-2', 't495-11']) {
      const { map, result } = battlefield(seed);
      const channels = result.spawns.filter((s) => CHANNELS.includes(s.type));
      expect(channels.length).toBeLessThanOrEqual(1);
      expect(result.spawns.filter((s) => s.quality === 0 && s.material === 'iron' && !CHANNELS.includes(s.type))).toHaveLength(BATTLEFIELD_ITEM_COUNT);
      const c = channels[0];
      if (c === undefined) {
        found.push('none');
        continue;
      }
      found.push(c.type);
      expect(c).toMatchObject({ kind: 'item', quality: 0, source: 'old_battlefield' });
      expect(map.yOf(c.tile)).toBeGreaterThanOrEqual(BATTLEFIELD_BAND_MIN); // arrival edge n
      expect(map.yOf(c.tile)).toBeLessThanOrEqual(BATTLEFIELD_BAND_MAX);
      if (c.type === 'staff') {
        expect(c.material).toBe('iron');
        expect(c.stone).toBeUndefined();
      } else {
        expect(materials.byId(c.material ?? '')?.class).toBe('wood');
        expect(stones).toContain(c.stone);
      }
    }
    expect(found).toEqual(['none', 'none', 'staff', 'wand']);
  });

  it('the ordinary arms, the bones and the tiles are as before the channel pass', () => {
    // Measured with the code before this pass: the trait stage's spawns and the tiles of this map.
    const { map, result } = battlefield('traits', ['old_battlefield', 'gemsprings', 'sunken_halls']);
    expect(result.spawns.filter((s) => s.type === 'wand')).toHaveLength(1);
    const arms = result.spawns.filter((s) => !CHANNELS.includes(s.type));
    expect(new StateHasher().value(arms).digest()).toBe('e395cceab7c5cb88');
    const tiles = new StateHasher().array(map.kind).array(map.material).array(map.fluid).array(map.flags).digest();
    expect(tiles).toBe('2d4839cf6e636e1f');
  });

  it('no other map holds a channel', () => {
    const { result } = battlefield('t495-11', ['gemsprings']);
    expect(result.spawns.some((s) => CHANNELS.includes(s.type))).toBe(false);
  });

  it('the wand arrives with its stone and casts for a runecaster; a stoneless staff is claimed by none', () => {
    const spec = { ...FLAT_TEST_SPEC, seed: 'battlefield', traits: ['old_battlefield'] };
    const game = new HeadlessGame({ seed: 'battlefield', world: 'local', spec, embark: 'default' });
    const items = game.world.readers.of<ItemsReader>('13');
    const entry = game.local?.spawns.find((s) => s.type === 'wand');
    expect(entry?.stone).toBe('sapphire');
    const wand = items.at(entry?.tile as TileIndex).find((id) => items.def(items.get(id)?.type ?? 0)?.id === 'wand') as EntityId;
    expect(registry.table('materials').idOf(items.get(wand)?.stone ?? 0)).toBe('sapphire');
    expect(items.get(wand)?.quality).toBe(0);
    expect(game.world.readers.of<MagicReader>('25').spellOf(wand)?.id).toBe('dread');

    const w = new TestWorld({ seed: 't495-claim', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const Z = FLAT_TEST_SURFACE_Z;
    const staff = w.spawnItem('staff', 'iron', w.index(30, 31, Z), 1, 0);
    const caster = w.spawnDwarf({ at: w.index(30, 30, Z), skills: { runecraft: 4 } });
    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
    const s = w.readers.of<CombatReader>('16').squads().at(-1) as SquadWithId;
    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [caster] });
    w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(30, 30, Z) });
    w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
    w.step(2);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon ?? 0).not.toBe(staff);
    const old = w.spawnItem('wand', 'birch', w.index(30, 32, Z), 1, 0);
    w.game.world.entities.add(old, C.Item, { ...w.game.world.entities.get(old, C.Item)!, stone: registry.table('materials').index('quartz') });
    w.step(2);
    expect(w.game.world.entities.get(caster, C.Equipment)?.weapon).toBe(old);
  });
});
