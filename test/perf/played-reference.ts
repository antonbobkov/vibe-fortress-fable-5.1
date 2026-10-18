/** T-M6-18: saved, played reference fortress used by the M6 performance gate. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generatedSpec, type HeadlessGame } from '@app/headless';
import { loadGame, saveGame } from '@app/game-save';
import { TICKS_PER_HOUR, TICKS_PER_YEAR } from '@core/constants';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { BuildingsReader } from '@systems/buildings';
import { TestWorld } from '../scenarios/test-world';
import { digWaterfall } from '../scenarios/waterfall';

export const PLAYED_PATH = fileURLToPath(new URL('../fixtures/played-fortress.deepholm', import.meta.url));
const SEED = 'perf-1';
const PLAY_TICKS = 4_200;

function apply(w: TestWorld, command: Command): void {
  const result = w.game.world.applyCommand(command);
  if (!result.ok) throw new Error(`${command['type']}: ${result.reason}`);
}

function firstZone(w: TestWorld, type: string, used: Set<number>, count: number, x0: number, y0: number): number[] {
  const reader = w.readers.of<BuildingsReader>('14');
  const tiles: number[] = [];
  for (let radius = 1; radius < 35 && tiles.length < count; radius += 1) {
    for (let y = Math.max(2, y0 - radius); y <= Math.min(w.map.h - 3, y0 + radius); y += 1) {
      for (let x = Math.max(2, x0 - radius); x <= Math.min(w.map.w - 3, x0 + radius); x += 1) {
        const z = w.map.columnSurfaceZ(x, y);
        if (z < 0) continue;
        const tile = w.index(x, y, z);
        if (used.has(tile) || !reader.zoneTileQualifies(type, tile)) continue;
        used.add(tile);
        tiles.push(tile);
        if (tiles.length === count) return tiles;
      }
    }
  }
  throw new Error(`no ${type} zone tiles`);
}

/** Bootstrap only the settlement; all its workers then run for 2,000 ticks on their own brains. */
export function buildPlayedReference(observe?: (w: TestWorld) => void): { world: TestWorld; naturalWaterTiles: number[]; settledAt: number } {
  const w = new TestWorld({ seed: SEED, world: 'local', spec: generatedSpec(SEED), embark: 'default',
    startTick: 2 * TICKS_PER_YEAR + 8 * TICKS_PER_HOUR });
  observe?.(w);
  const wagon = w.game.arrival?.wagon;
  if (wagon === undefined) throw new Error('no wagon');
  // Arrival sets the calendar to spring year one; position the authored gate at year three.
  w.game.world.calendar.setTick(2 * TICKS_PER_YEAR + 8 * TICKS_PER_HOUR);
  const map = w.map;
  const naturalWaterTiles: number[] = [];
  for (let tile = 0; tile < map.tileCount; tile += 1) {
    if (w.fluids.sim.hasWater(tile)) naturalWaterTiles.push(tile);
  }
  const dwarves = w.readers.entities.with(C.Brain);
  for (let k = dwarves.length; k < 20; k += 1) {
    const x = Math.min(map.w - 2, wagon.x + (k % 5) - 2);
    const y = Math.min(map.h - 2, wagon.y + Math.floor(k / 5) - 2);
    w.spawnDwarf({ at: w.index(x, y, map.columnSurfaceZ(x, y)) });
  }

  // A 40-tile source channel, three-level drop and breached cavern below the surface.
  const y = Math.min(map.h - 12, wagon.y + 12);
  const x0 = Math.max(2, Math.min(map.w - 45, wagon.x - 20));
  let top = map.columnSurfaceZ(x0, y);
  for (let x = x0; x <= x0 + 40; x += 1) top = Math.min(top, map.columnSurfaceZ(x, y));
  const channelZ = Math.max(5, top - 2);
  digWaterfall(w, x0, y, channelZ, 40, 3);
  w.digRoom(x0 + 32, y - 12, channelZ - 3, 20, 20);
  const caveZ = Math.max(5, channelZ - 8);
  w.digRoom(x0 + 28, y - 8, caveZ, 18, 14);
  for (let z = caveZ + 1; z <= channelZ - 3; z += 1) w.carve(w.index(x0 + 40, y, z), TileKind.Open);

  // Disturb the naturally generated lake/river as fl_settle does.
  for (let tile = 0; tile < map.tileCount; tile += 1) {
    if (w.fluids.sim.hasWater(tile) && !w.fluids.sim.isSource(tile)) w.fluids.sim.touch(tile);
  }

  const buildings = w.readers.of<BuildingsReader>('14');
  const workshopOrders: readonly [string, string][] = [
    ['carpenter', 'make_bed'], ['mason', 'make_stone_block'], ['mechanic', 'make_mechanism'],
    ['craftdwarf', 'craft_stone'], ['still', 'brew'], ['kitchen', 'cook_easy_meal'],
  ];
  const workshopIds: number[] = [];
  const used = new Set<number>();
  for (const [type, recipeId] of workshopOrders) {
    let placed = false;
    for (let radius = 2; radius < 30 && !placed; radius += 1) {
      for (let y1 = Math.max(2, wagon.y - radius); y1 < Math.min(map.h - 5, wagon.y + radius) && !placed; y1 += 1) {
        for (let x1 = Math.max(2, wagon.x - radius); x1 < Math.min(map.w - 5, wagon.x + radius); x1 += 1) {
          const z = map.columnSurfaceZ(x1, y1);
          if (z < 0) continue;
          const tile = w.index(x1, y1, z);
          if (buildings.ghost(type, tile, 0).reason !== null) continue;
          const id = w.build(type, tile, 'oak');
          workshopIds.push(id);
          for (const t of buildings.get(id)?.footprint ?? []) used.add(t);
          w.step(1);
          apply(w, { type: 'AddWorkOrder', workshopId: id,
            order: { recipeId, mode: 'maintain', remaining: 1, threshold: 60, priority: 5 } });
          placed = true;
          break;
        }
      }
    }
    if (!placed) throw new Error(`no site for ${type}`);
  }

  for (let k = 0; k < 2; k += 1) {
    const tiles = firstZone(w, 'stockpile', used, 16, wagon.x + k * 8, wagon.y + 8);
    const id = w.zone('stockpile', tiles);
    apply(w, { type: 'SetStockpileFilter', zoneId: id, filter: 'everything' });
  }
  const farm = w.zone('farm_plot', firstZone(w, 'farm_plot', used, 16, wagon.x - 8, wagon.y + 12));
  for (let season = 0; season < 4; season += 1) apply(w, { type: 'SetPlotCrop', zoneId: farm, season, speciesId: 'barley' });
  apply(w, { type: 'CreateSquad', name: 'Gate' });
  const squadId = w.readers.of<{ squads(): readonly { id: number }[] }>('16').squads()[0]?.id;
  if (squadId === undefined) throw new Error('no squad');
  apply(w, { type: 'SetSquadMembers', squadId, members: dwarves.slice(0, 4) });
  apply(w, { type: 'SetSquadStation', squadId, tile: w.index(wagon.x, wagon.y, wagon.z) });

  // Inputs begin at the work sites, with more loose items feeding both hauling stockpiles.
  for (const id of workshopIds) {
    const tile = buildings.get(id)?.origin;
    if (tile === undefined) continue;
    for (let n = 0; n < 12; n += 1) {
      w.spawnItem('raw_stone', 'granite', tile);
      w.spawnItem('log', 'oak', tile);
      w.spawnItem('plant_food', 'barley', tile);
    }
  }
  let settledAt = 0;
  for (let t = 1; t <= PLAY_TICKS; t += 1) {
    w.step(1);
    if (t >= 2_000 && t % 25 === 0 && naturalWaterTiles.every((tile) => w.fluids.sim.isActive[tile] !== 1)) {
      settledAt = t;
      break;
    }
  }
  return { world: w, naturalWaterTiles, settledAt };
}

export async function ensurePlayedReference(now: () => number): Promise<HeadlessGame> {
  if (existsSync(PLAYED_PATH)) return (await loadGame(readFileSync(PLAYED_PATH), { now })).game;
  const { world: w } = buildPlayedReference();
  const bytes = await saveGame(w.game, { kind: 'manual' });
  mkdirSync(fileURLToPath(new URL('../fixtures/', import.meta.url)), { recursive: true });
  writeFileSync(PLAYED_PATH, bytes);
  return (await loadGame(bytes, { now })).game;
}
