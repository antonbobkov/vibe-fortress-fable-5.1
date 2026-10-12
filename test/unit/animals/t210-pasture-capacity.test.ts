/** T-210: capacity must sustain the herd, rather than only postpone starvation. */
import { describe, expect, it } from 'vitest';
import { buildFlatTestMap, FLAT_TEST_SURFACE_Z as Z, HeadlessGame, FLAT_TEST_SPEC, FLAT_TEST_LAYERS } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import { GRASS_PER_GRAZER } from '@systems/animals/constants';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
function pasture(tilesPerGrazer: number, winter = false, cave = false) {
  // A single feeding rule: no immigration, wild arrivals or new births compete with this fixed herd.
  const w = new TestWorld({ seed: 't210-pasture-capacity', registry, map: buildFlatTestMap(registry, 32, 32), embark: 'none', surfaceWildlife: 'none', systems: HeadlessGame.standardSystems(FLAT_TEST_SPEC, FLAT_TEST_LAYERS).filter(system => system.id !== '21'), startTick: winter ? 84 * TICKS_PER_DAY : 0 });
  const tiles: number[] = [];
  const z = cave ? Z - 1 : Z;
  // Separate adjacent pastures exercise one grazer per capacity allocation, without
  // allowing several simultaneous grazers to get relief from the same pending grass tile.
  const ids = ['cow', 'cow', 'sheep', 'sheep', 'goat', 'goat'].map((species, animal) => {
    const own: number[] = [];
    const width = tilesPerGrazer <= 6 ? 3 : 8;
    for (let n = 0; n < tilesPerGrazer; n += 1) {
      const tile = w.index(3 + (animal % 3) * 9 + n % width, 3 + Math.floor(animal / 3) * 6 + Math.floor(n / width), z);
      if (cave) { w.map.setKind(tile, TileKind.Floor, registry.table('materials').index('cave_loam')); w.map.setFlag(tile, TileFlag.Discovered, true); }
      w.map.setFlag(tile, TileFlag.Grass, true); own.push(tile); tiles.push(tile);
    }
    const zoneId = w.zone('pasture', own);
    const id = w.spawnTame(species, own[0]!, { sex: 1 });
    expect(w.game.world.applyCommand({ type: 'AssignPasture', animalId: id, zoneId }).ok).toBe(true);
    return id;
  });
  let maximum = 0;
  const daily: { day: number; grass: number; condition: number[] }[] = [];
  function run(days: number) {
    for (let d = 0; d < days; d += 1) {
      for (let hour = 0; hour < 24; hour += 1) {
        w.step(TICKS_PER_DAY / 24);
        for (const id of ids) maximum = Math.max(maximum, w.game.world.entities.get(id, C.Tame)?.condition ?? 100);
      }
      daily.push({ day: d + 1, grass: tiles.filter(t => w.map.hasFlag(t, TileFlag.Grass)).length, condition: ids.map(id => w.game.world.entities.get(id, C.Tame)?.condition ?? 100) });
    }
    return { tiles: tiles.length, winter, cave, maximum, starving: w.events('AnimalStarving').filter(e => ids.includes(e['id'] as number)).length, deaths: w.events('CreatureDied').filter(e => ids.includes(e['id'] as number)).length, daily };
  }
  return { w, ids, run };
}

describe('T-210 a pasture at its stated capacity feeds six grazers', () => {
  it('keeps every grazer below starvation through spring, summer and early autumn', () => {
    const p = pasture(GRASS_PER_GRAZER);
    const result = p.run(60); console.log('T-210 pasture:', JSON.stringify(result));
    expect(result.maximum).toBeLessThan(100);
    expect(result.starving).toBe(0); expect(result.deaths).toBe(0);
    expect(p.ids.every(id => p.w.game.world.entities.alive(id))).toBe(true);
  });
  it('supports the same herd on unsnowed cave moss during winter', () => {
    const p = pasture(GRASS_PER_GRAZER, true, true);
    const result = p.run(28); console.log('T-210 winter cave pasture:', JSON.stringify(result));
    expect(result.maximum).toBeLessThan(100); expect(result.starving).toBe(0); expect(result.deaths).toBe(0);
    expect(p.w.events('GrassRegrown').length).toBeGreaterThan(0);
  });
  it('does not promise winter renewal for an outdoor pasture', () => {
    const p = pasture(GRASS_PER_GRAZER, true);
    const result = p.run(28); console.log('T-210 winter surface pasture:', JSON.stringify(result));
    expect(result.daily.at(-1)!.grass).toBeLessThan(result.daily[0]!.grass);
    expect(p.w.events('GrassRegrown')).toHaveLength(0);
  });
});
