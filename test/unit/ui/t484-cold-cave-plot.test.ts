/**
 * T-484: a cave plot within two levels of the surface freezes in a cold winter and three levels
 * down does not; the farm plot panel says when its tiles are under the crop's minimum.
 */
import { describe, expect, it } from 'vitest';
import { Game } from '@app/game';
import { loadContent } from '@content/loader';
import { Map3D, TileFlag, TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import type { MaterialsSystem } from '@systems/materials';
import { NEAR_SURFACE_DEPTH, UNDERGROUND_BASE_C } from '@systems/materials/constants';
import { baseTemperature } from '@systems/materials/temperature';
import type { PlantRow } from '@systems/plants';
import { growthPerHour } from '@systems/plants/growth';
import { drawZonesPanel } from '@ui/panels/zones';
import { MockCanvas, mockCanvasFactory } from '../render/canvas-mock';
import { registry, strings, surface } from './ui-fixture';

const dimcap = registry.table<PlantRow>('plants').byId('dimcap') as PlantRow;

/** The temperature of a covered tile `depth` levels under a surface at `surfaceC`. */
function tileUnder(depth: number, surfaceC: number): number {
  const map = new Map3D(4, 4, 40);
  map.kind.fill(TileKind.Wall);
  for (let z = 31; z < 40; z += 1) map.kind[map.index(1, 1, z)] = TileKind.Open;
  map.setFlag(map.index(1, 1, 30), TileFlag.Outdoor, true);
  return baseTemperature(map, map.index(1, 1, 30 - depth), surfaceC);
}

function grows(tempC: number): boolean {
  return growthPerHour(dimcap, true, { season: 3, lit: false, lamped: false, tempC, growthModifier: 100 }) > 0;
}

describe('T-484 cave temperature by depth in a taiga winter', () => {
  it('the rules: one level down is below the dimcap minimum, three levels down is warm', () => {
    expect(dimcap.minC).toBe(2);
    // A taiga winter's surface is -12 C (06, biome table).
    expect(tileUnder(1, -12)).toBe(-5);
    expect(grows(tileUnder(1, -12))).toBe(false);
    expect(tileUnder(2, -12)).toBe(2);
    expect(grows(tileUnder(2, -12))).toBe(true);
    // On a colder night (-18 C) two levels down is under the minimum as well.
    expect(tileUnder(1, -18)).toBe(-9);
    expect(tileUnder(2, -18)).toBe(0);
    expect(grows(tileUnder(2, -18))).toBe(false);
    // From NEAR_SURFACE_DEPTH levels down the tile is the underground base in every weather.
    expect(NEAR_SURFACE_DEPTH).toBe(3);
    for (const surfaceC of [-30, -18, -12, 0, 20]) {
      expect(tileUnder(NEAR_SURFACE_DEPTH, surfaceC)).toBe(UNDERGROUND_BASE_C);
      expect(grows(tileUnder(NEAR_SURFACE_DEPTH, surfaceC))).toBe(true);
    }
  });
});

describe('T-484 the farm plot panel says when its crop is too cold', () => {
  async function plot(): Promise<{ g: Game; zoneId: number; tiles: number[] }> {
    const g = new Game({ canvas: new MockCanvas(), seed: 't484', registry: loadContent(), createCanvas: mockCanvasFactory(), devicePixelRatio: 1, width: 1280, height: 800 });
    await g.start({ embark: 'default' });
    const map = g.host.readers.map;
    const tiles = [map.index(40, 30, g.ui.z), map.index(41, 30, g.ui.z), map.index(42, 30, g.ui.z)];
    g.host.submit({ type: 'CreateZone', zoneType: 'farm_plot', tiles });
    g.host.step(1);
    const zoneId = g.host.readers.of<BuildingsReader>('14').zoneAt(tiles[0] as number);
    g.host.submit({ type: 'SetPlotCrop', zoneId, season: g.host.readers.calendar.season, speciesId: 'barley' });
    g.host.step(1);
    g.fortress.zones.selected = zoneId;
    g.ui.panel = 'zones';
    g.ui.sidebar = true;
    return { g, zoneId, tiles };
  }

  function rows(g: Game): string[] {
    const s = surface(36, 40);
    drawZonesPanel(s, { col: 0, row: 0, cols: 36, rows: 40 }, g.fortress.zones, g.fortress.ctx);
    return s.lines().map((line) => line.trimEnd());
  }

  it('names the cold tiles, the minimum and the crop, and the depth that stays warm', async () => {
    const { g, tiles } = await plot();
    const materials = g.host.world.scheduler.byId('05') as MaterialsSystem;
    for (const tile of tiles) materials.forceTemperature(tile, 10);
    expect(rows(g).some((line) => line.includes('Too cold'))).toBe(false);

    // The default embark's plot lies in the light, so the crop is a surface one; the rule is the same.
    const minC = (registry.table<PlantRow>('plants').byId('barley') as PlantRow).minC;
    materials.forceTemperature(tiles[0] as number, -5);
    materials.forceTemperature(tiles[1] as number, minC - 1);
    const text = rows(g).join('\n');
    expect(text).toContain('Too cold to grow: 2 of 3 tiles are');
    expect(text).toContain(`under ${minC}°C for barley.`);
    expect(text).toContain('Rock 3 levels below the surface');
    expect(text).toContain('stays warm all year.');
    expect(strings.get('ui.zone.farm_cold', { n: 2, m: 3, min: 2, name: 'dimcap' })).toBe('Too cold to grow: 2 of 3 tiles are under 2°C for dimcap.');

    materials.forceTemperature(tiles[0] as number, minC);
    materials.forceTemperature(tiles[1] as number, minC);
    expect(rows(g).some((line) => line.includes('Too cold'))).toBe(false);
  });

  it('draws no note for a plot with no crop chosen and none planted', async () => {
    const { g, zoneId, tiles } = await plot();
    g.host.submit({ type: 'SetPlotCrop', zoneId, season: g.host.readers.calendar.season, speciesId: 0 });
    g.host.step(1);
    const materials = g.host.world.scheduler.byId('05') as MaterialsSystem;
    for (const tile of tiles) materials.forceTemperature(tile, -20);
    expect(rows(g).some((line) => line.includes('Too cold'))).toBe(false);
  });
});
