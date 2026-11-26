/**
 * T-765: on world seed `probe-5` the default embark (the alpine site nearest the centre, the Balanced
 * preset) lost six or seven of its seven dwarves in its first week. The chain: spring nights of −25 to
 * −30 °C on snow cover; an hourly frostbite of 5 damage on a random limb that stacked until the limb was
 * destroyed; a destroyed limb is lost with a grievous cut at the stump, bleeding 6 a health tick; and the
 * party idled and slept at the wagon, outdoors, though a room had been dug below.
 *
 * Now frostbite is a light wound on any creature and never severs a limb (17 § Wound creation, Heat and
 * cold), the season's first frostbitten dwarf raises the `Frostbitten` alert (17 § Player-facing
 * behavior), a dwarf idles and sleeps on the nearest covered floor while the wagon is colder than
 * `COLD_SHELTER_C` (10 § Behavior selection, step 9), and the site summary warns of a site whose first
 * nights frostbite (02 § Site summary).
 */
import { describe, expect, it, vi } from 'vitest';
import { FLAT_TEST_SURFACE_Z as Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C } from '@core/components';
import { TICKS_PER_DAY, TICKS_PER_HOUR, WORLD_SIZE_STANDARD } from '@core/constants';
import type { Command } from '@core/commands';
import { TileFlag, TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteSummary } from '@systems/embark';
import { COLD_INJURY_C } from '@systems/materials/constants';
import { generate as generateWorld, type WorldMap } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { TestWorld } from '../../scenarios/test-world';
import { keymap, palette, registry, strings } from '../ui/ui-fixture';

/** A flat world whose 21 × 21 tiles around (10, 10) are held at `c` °C. */
function frozen(seed: string, c: number) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  for (let y = 0; y <= 20; y += 1) for (let x = 0; x <= 20; x += 1) w.forceTemperature(w.index(x, y, Z), c);
  return w;
}

const limbs = (w: TestWorld, id: EntityId) => w.game.world.entities.get(id, C.Body)!.parts.slice(2);

describe('T-765 frostbite is a light wound that never severs a limb', () => {
  it('three days at −40 °C leave every limb of a dwarf and a cat at 1 hp or more, every frost wound light and none bleeding', () => {
    const w = frozen('t765-limbs', -40);
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    const cat = w.spawnTame('cat', w.index(11, 10, Z));
    w.step(3 * TICKS_PER_DAY);
    expect(w.events('LimbLost')).toEqual([]);
    for (const id of [dwarf, cat]) {
      expect(w.game.world.entities.alive(id)).toBe(true);
      const parts = limbs(w, id);
      expect(parts.every((p) => !p.destroyed && p.hp >= 1)).toBe(true);
      const wounds = parts.flatMap((p) => p.wounds);
      expect(wounds.length).toBeGreaterThan(0);
      expect(wounds.every((wd) => wd.type === 'frost' && wd.severity === 'light' && wd.bleed === 0)).toBe(true);
    }
    // The dwarf, unclothed, takes one every hour until its limbs are at their last hit point.
    expect(limbs(w, dwarf).some((p) => p.hp === 1)).toBe(true);
    expect(w.events('NoDressing')).toEqual([]);
  });
});

describe('T-765 the first frostbite of a season is an alert', () => {
  it('names the dwarf and the shelter, once a season, and the season is kept in the save', () => {
    const w = frozen('t765-alert', -40);
    const a = w.spawnDwarf({ at: w.index(10, 10, Z), name: 'Ketil Ironvein' });
    const b = w.spawnDwarf({ at: w.index(12, 10, Z) });
    w.step(TICKS_PER_DAY);
    const first = w.events('Frostbitten');
    expect(first.length).toBe(1);
    expect([a, b]).toContain(first[0]!['id']);
    expect(strings.get('announce.frostbitten', { dwarf: 'Ketil Ironvein' })).toContain('dig a room underground, where they will idle and sleep');
    const loaded = roundTrip(w.game).game;
    w.replaceGame(loaded);
    w.step(TICKS_PER_DAY);
    expect(w.events('Frostbitten').length).toBe(1);
  });
});

/** The embarkable region nearest the centre, where the world map started before T-779 passed over a site with frostbite from the first night (T-759). */
function defaultSite(world: WorldMap): number {
  const biomes = registry.table<{ id: string; embarkable: boolean }>('biomes');
  const mid = Math.floor(world.size / 2);
  let best = -1;
  let bestD = Infinity;
  for (const r of world.regions) {
    if (biomes.byId(r.biome)?.embarkable !== true) continue;
    const d = Math.max(Math.abs((r.id % world.size) - mid), Math.abs(Math.floor(r.id / world.size) - mid));
    if (d < bestD) { best = r.id; bestD = d; }
  }
  return best;
}

describe('T-765 the default embark on probe-5', () => {
  const world = generateWorld('probe-5', WORLD_SIZE_STANDARD, registry);
  const region = defaultSite(world);

  it('its site summary warns of frostbite from the first night', () => {
    const summary = siteSummary(localMapSpec(world, region, registry), registry);
    expect(world.regions[region]!.biome).toBe('alpine');
    expect(summary.climate.frostbite).toEqual({ season: 0, nightC: -31, limitC: -25, arrival: true });
    const screen = new WorldMapScreen(world, { embark: vi.fn(), back: vi.fn() }, keymap, strings, new WorldMapCompositor(registry, palette), registry);
    screen.cursor = { x: region % world.size, y: Math.floor(region / world.size) };
    const text = screen.regionLines().join(' ').replace(/\s+/g, ' ');
    expect(text).toContain('Frostbite from the first night: nights fall to about -31°C, and below -25°C dwarves outside are wounded.');
  });

  it('keeps its seven dwarves through the first week: they sleep below once a room is dug', () => {
    const w = new TestWorld({ seed: 'probe-5', world: 'local', spec: localMapSpec(world, region, registry), embark: 'default' });
    const map = w.map;
    const wagon = w.game.arrival!.wagon;
    // A newcomer's first order: a stair shaft four levels down beside the wagon, a 5 × 5 room at its foot.
    let dug = false;
    for (let r = 3; r <= 12 && !dug; r += 1) {
      for (let y = wagon.y - r; y <= wagon.y + r && !dug; y += 1) for (let x = wagon.x - r; x <= wagon.x + r && !dug; x += 1) {
        if (Math.max(Math.abs(x - wagon.x), Math.abs(y - wagon.y)) !== r || x < 3 || y < 3 || x > map.w - 8 || y > map.h - 8) continue;
        const z = map.columnSurfaceZ(x, y);
        if (map.kindAt(w.index(x, y, z)) !== TileKind.Floor) continue;
        const ok = w.game.world.applyCommand({ type: 'DesignateStairwell', x, y, zTop: z, zBottom: z - 4, priority: 4 } as Command).ok;
        if (!ok) continue;
        const room: number[] = [];
        for (let dy = -2; dy <= 2; dy += 1) for (let dx = 1; dx <= 5; dx += 1) room.push(w.index(x + dx, y + dy, z - 4));
        expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', priority: 4, tiles: room.filter((t) => map.kindAt(t) === TileKind.Wall) } as Command).ok).toBe(true);
        dug = true;
      }
    }
    expect(dug).toBe(true);
    const entities = w.game.world.entities;
    const dwarves = entities.with(C.Brain);
    expect(dwarves.length).toBe(7);
    const materials = w.readers.of<{ temperatureAt(i: number): number }>('05');
    const wagonTile = w.index(wagon.x, wagon.y, map.columnSurfaceZ(wagon.x, wagon.y));
    let coldHours = 0;
    let coveredDwarfHours = 0;
    let dwarfHours = 0;
    for (let h = 0; h < 7 * 24; h += 1) {
      w.step(TICKS_PER_HOUR);
      // From the third day, when the room is dug, at every hour the wagon is within ten degrees of frostbite.
      if (h < 48 || materials.temperatureAt(wagonTile) >= COLD_INJURY_C + 10) continue;
      coldHours += 1;
      for (const id of dwarves) {
        const p = entities.get(id, C.Position)!;
        dwarfHours += 1;
        if (!map.hasFlag(w.index(p.x, p.y, p.z), TileFlag.Outdoor)) coveredDwarfHours += 1;
      }
    }
    expect(dwarves.every((id) => entities.alive(id))).toBe(true);
    expect(w.events('LimbLost')).toEqual([]);
    expect(w.events('WoundInflicted').filter((e) => e['woundType'] === 'frost').every((e) => e['severity'] === 'light')).toBe(true);
    // The night was cold: the alert came on the first night, and most of the party spent the cold hours under rock.
    expect(w.events('Frostbitten').length).toBe(1);
    expect(coldHours).toBeGreaterThan(40);
    expect(coveredDwarfHours / dwarfHours).toBeGreaterThan(0.75);
  }, 120_000);
});
