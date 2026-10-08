import { describe, expect, it } from 'vitest';
import { loadContent, rawTables } from '@content/loader';
import { C } from '@core/components';
import { MAX_CREATURES } from '@core/constants';
import { EVENT_FIELDS } from '@core/event-types';
import { TileKind } from '@core/map3d';
import { roundTrip } from '@app/game-save';
import { dailySpawn } from '@systems/animals';
import type { SpeciesRow } from '@systems/animals';
import type { ItemsReader } from '@systems/items';
import { TestWorld } from '../scenarios/test-world';

function fauna(initial: number): TestWorld {
  const creatures = (rawTables()['creatures'] as SpeciesRow[]).map((row) => row.id === 'glow_beetle' ? { ...row, cavern: { ...row.cavern!, initial } } : row);
  const registry = loadContent({ overrides: { creatures, cavernSpawns: [] } });
  const w = new TestWorld({ seed: 't130-initial-fauna', registry, world: 'flat-test', embark: 'none' });
  for (let y = 40; y < 45; y++) for (let x = 40; x < 45; x++) w.carve(w.index(x, y, 21), TileKind.Floor);
  return w;
}

describe('T-130 retained animal and job decisions', () => {
  it('exports a nonzero fauna initial count without changing monster or default-zero parsing', async () => {
    const { parseCavern } = await import(new URL('../../scripts/lib/export/creatures.mjs', import.meta.url).href);
    expect(parseCavern('1 (40, cap 12, initial 3)')).toEqual({ tier: 1, weight: 40, cap: 12, initial: 3, respawnPermille: 0 });
    expect(parseCavern('1 (40, cap 12)')).toMatchObject({ initial: 0, weight: 40 });
    expect(parseCavern('1 (2 packs, cap 10, daily 80\u2030)')).toMatchObject({ initial: 2, weight: 0, respawnPermille: 80 });
  });

  it('D-109: initializes nonzero fauna once at first breach, including save/load and repeated notifications', () => {
    const w = fauna(3);
    w.step(2);
    expect(w.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(0);
    expect(w.animals.serialize()).not.toHaveProperty('initializedCaverns');
    w.game.terrain!.core.cavernBreached[0] = true;
    w.step(1);
    expect(w.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(3);
    expect(w.events('AnimalSpawned').filter((e) => e['species'] === 'glow_beetle')).toHaveLength(3);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    for (let n = 0; n < 3; n++) {
      w.game.world.emit({ type: 'CavernBreached', tier: 1 });
      loaded.world.emit({ type: 'CavernBreached', tier: 1 });
      w.step(1); loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
      expect(w.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(3);
    }
    // Daily respawning still operates after the one-time initial population.
    for (let day = 0; day < 200; day++) dailySpawn(w.animals.spawner, 0);
    expect(w.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(w.animals.spawner.facts.row(w.animals.facts.indexOf('glow_beetle'))!.cavern!.cap);
  });

  it('D-109: clamps initial fauna to species and global caps and never retries a full first breach', () => {
    const w = fauna(30);
    w.game.terrain!.core.cavernBreached[0] = true;
    w.step(1);
    expect(w.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(12);
    const full = fauna(3);
    for (let n = 0; n < MAX_CREATURES; n++) full.spawnCreature('cat', full.index(20, 20, 32), 'trader:hillfolk');
    full.game.terrain!.core.cavernBreached[0] = true;
    full.step(1);
    expect(full.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(0);
    expect(full.animals.serialize()).toMatchObject({ initializedCaverns: [1] });
    full.game.world.entities.destroy(full.game.world.entities.with(C.Creature)[0]!);
    full.step(1);
    expect(full.animals.reader().bySpecies('glow_beetle', true)).toHaveLength(0);
  });

  it('D-070: releases an equipped tool exactly once with its job id while it remains unsearchable', () => {
    const w = new TestWorld({ seed: 't130-tool-release', world: 'flat-test', embark: 'none' });
    const at = w.index(48, 48, 32);
    const dwarf = w.spawnDwarf({ at, skills: { mining: 5 } });
    const tool = w.spawnItem('pick', 'iron', at);
    const target = w.index(48, 47, 32);
    w.carve(target, TileKind.Wall);
    expect(w.game.world.applyCommand({ type: 'Designate', tiles: [target], kind: 'dig' })).toEqual({ ok: true });
    w.until(() => w.events('ToolEquipped').length > 0, 100);
    const jobId = w.events('JobClaimed').find((e) => e['workerId'] === dwarf)!['jobId'];
    expect(w.events('ItemReleased').filter((e) => e['itemId'] === tool)).toEqual([{ type: 'ItemReleased', itemId: tool, jobId }]);
    const items = w.readers.of<ItemsReader>('13');
    expect(items.get(tool)).toMatchObject({ carriedBy: dwarf, reservedBy: 0 });
    expect(w.game.world.entities.get(dwarf, C.Worker)?.toolId).toBe(tool);
    expect(items.findItem({ category: 'tool/pick' }, at)).toBe(0);
    w.until(() => w.map.kindAt(target) === TileKind.Floor, 1000);
    expect(w.events('ItemReleased').filter((e) => e['itemId'] === tool)).toHaveLength(1);
  });

  it('the generated catalog names real job and item payload fields', () => {
    for (const event of ['JobCreated', 'JobClaimed', 'JobStarted', 'JobCompleted', 'JobCancelled', 'JobBlocked', 'JobUnblocked'] as const) expect(EVENT_FIELDS[event]).toBe('jobId, jobType[, workerId, target, reason]');
    expect(EVENT_FIELDS.ItemCreated).toBe('id, itemType, material, count');
    expect(EVENT_FIELDS.ItemDestroyed).toBe('id, itemType, reason, crafterId');
  });
});
