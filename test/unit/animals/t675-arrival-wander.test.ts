import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z, regionSpec } from '@app/headless';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import type { EntityId, TileIndex } from '@core/types';
import { CAT_ROAM_RADIUS, TAME_AMBLE_RADIUS, TAME_AMBLE_SHY_RADIUS } from '@systems/animals/constants';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../../scenarios/test-world';

/** 08 § Tame behavior, *Before the hall* (T-675): the wagon's animals amble and graze about the wagon. */

function embark(preset: string): TestWorld {
  return new TestWorld({ seed: `t675-${preset}`, world: 'local', spec: regionSpec(`t675-${preset}`, { biome: 'temperate_forest' }), embark: { preset } });
}

function speciesOf(w: TestWorld, id: EntityId): string {
  const s = w.game.world.entities.get(id, C.Creature)?.species ?? 0;
  return w.game.registry.table<{ id: string }>('creatures').byIndex(s)?.id ?? '?';
}

function wagonTile(w: TestWorld): TileIndex {
  return w.readers.of<{ wagonTile(): TileIndex }>('10').wagonTile();
}

function far(w: TestWorld, a: TileIndex, b: TileIndex): number {
  const m = w.game.map;
  return Math.max(Math.abs(m.xOf(a) - m.xOf(b)), Math.abs(m.yOf(a) - m.yOf(b)));
}

describe('T-675 the wagon\'s animals amble and graze on arrival', () => {
  for (const preset of ['balanced', 'farmstead', 'testing_fortress']) {
    it(`${preset}: in the first day every animal but a war dog moves about the wagon, and the grazers stand on grass`, () => {
      const w = embark(preset);
      const wagon = wagonTile(w);
      expect(wagon).toBeGreaterThanOrEqual(0);
      expect(w.readers.of<BuildingsReader>('14').hearthHallTiles()).toEqual([]);
      const entities = w.game.world.entities;
      const ids = entities.with(C.Tame);
      expect(ids.length).toBeGreaterThan(0);
      const seen = new Map<EntityId, Set<TileIndex>>(ids.map((id) => [id, new Set<TileIndex>()]));
      const onGrass = new Set<EntityId>();
      const targets: [EntityId, TileIndex][] = [];
      const map = w.game.map;
      for (let k = 0; k < 48; k += 1) {
        w.step(25);
        for (const id of ids) {
          const at = w.game.movement.tileOf(id);
          seen.get(id)?.add(at);
          // Never far from the wagon (a walk may bend round a tree or the wagon, and so may cross a
          // tile of the map's edge on its way: the walks' targets below never lie on one).
          const radius = speciesOf(w, id) === 'cat' ? CAT_ROAM_RADIUS : TAME_AMBLE_RADIUS;
          expect(far(w, at, wagon), `${speciesOf(w, id)} ${id}`).toBeLessThanOrEqual(radius * 2);
          const to = w.game.movement.walkTarget(id);
          if (to >= 0 && entities.get(id, C.Tame)?.trained !== 'war') targets.push([id, to]);
          if (map.hasFlag(at, TileFlag.Grass) && w.game.movement.walkTarget(id) < 0) onGrass.add(id);
        }
      }
      for (const id of ids) {
        const war = entities.get(id, C.Tame)?.trained === 'war';
        const tiles = seen.get(id)?.size ?? 0;
        if (war) expect(tiles, 'a war dog keeps its station').toBe(1);
        else expect(tiles, `${speciesOf(w, id)} ${id} visited ${tiles} tiles`).toBeGreaterThanOrEqual(4);
      }
      // Where they walk to lies within their ground: 6 tiles of the wagon, 12 for a cat.
      for (const [id, to] of targets) {
        expect(far(w, to, wagon), `${speciesOf(w, id)} ${id}`).toBeLessThanOrEqual(speciesOf(w, id) === 'cat' ? CAT_ROAM_RADIUS : TAME_AMBLE_RADIUS);
        expect(map.xOf(to) > 0 && map.yOf(to) > 0 && map.xOf(to) < map.w - 1 && map.yOf(to) < map.h - 1, `${speciesOf(w, id)} ${id} walks to the edge`).toBe(true);
      }
      const grazers = ids.filter((id) => ['cow', 'sheep', 'goat'].includes(speciesOf(w, id)));
      for (const id of grazers) expect(onGrass.has(id), `${speciesOf(w, id)} ${id} grazed`).toBe(true);
    });
  }

  it('an amble keeps clear of a hostile the animal sees', () => {
    const w = new TestWorld({ seed: 't675-shy', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const map = w.game.map;
    const Z = FLAT_TEST_SURFACE_Z;
    w.dwarves.wagonTile = map.index(30, 30, Z);
    const ids = [0, 1, 2, 3].map((k) => w.spawnTame('dog', map.index(29 + k, 31, Z)));
    w.step(300);
    // A trollkin comes to the edge of the animals' ground, east of the wagon.
    const foe = w.spawnCreature('trollkin', map.index(30 + TAME_AMBLE_RADIUS + 1, 30, Z), 'hostile:gloam');
    w.step(10);
    const before = new Map<EntityId, TileIndex>(ids.map((id) => [id, w.game.movement.walkTarget(id)]));
    let chosen = 0;
    for (let k = 0; k < 60; k += 1) {
      w.step(10);
      const foeAt = w.game.movement.tileOf(foe);
      if (!w.game.world.entities.alive(foe) || foeAt < 0) break;
      for (const id of ids) {
        const to = w.game.movement.walkTarget(id);
        if (to < 0 || to === before.get(id)) continue;
        before.set(id, to);
        chosen += 1;
        expect(far(w, to, foeAt), `dog ${id}`).toBeGreaterThan(TAME_AMBLE_SHY_RADIUS - 2);
      }
    }
    expect(chosen).toBeGreaterThan(0);
  });
});
