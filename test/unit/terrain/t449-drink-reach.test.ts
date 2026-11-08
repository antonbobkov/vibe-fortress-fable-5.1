/**
 * T-449: a river site has water a dwarf can drink, by the game's own search and pathing
 * (`03-terrain-and-mining.md` § Local map generation stage 2; `10-dwarves.md` § Eating and drinking;
 * `02-embark-and-loadout.md` § Site summary; `ui-screens/menus-and-world.md` § Tutorial).
 *
 * From the arrival point at each relief and river shape, the real drink search must accept a stand
 * tile, and a floor or ramp bank must be reachable. A tree or a boulder on the bank does not count.
 */

import { appendFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { LOCAL_MAP_Z, WORLD_SIZE_STANDARD } from '@core/constants';
import { Map3D, TileKind } from '@core/map3d';
import type { TickContext } from '@core/system';
import { HeadlessGame, regionSpec } from '@app/headless';
import { localMapSpec, type LocalMapSpec } from '@systems/embark';
import { DRINK_SEARCH_RADIUS } from '@systems/dwarves/constants';
import { water } from '@systems/dwarves/activities';
import { FISH_BANK_DROP } from '@systems/foraging/constants';
import { generateLocal } from '@systems/terrain/generate';
import { COL_LAKE, COL_RIVER } from '@systems/terrain/generate/common';
import { generate } from '@systems/worldgen';
import { TUTORIAL_WORLD_SEED } from '@ui/constants';
import { tutorialRegion } from '@ui/tutorial';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const SIZE = 96;
/** A representative set; `T449_SEED_COUNT` widens it for the measurement in the report. */
const SEED_COUNT = Number(process.env['T449_SEED_COUNT'] ?? 2);
const OUT = process.env['T449_REACH_OUT'];
/** 10 § Eating and drinking: "8 levels up or down". */
const DRINK_SEARCH_LEVELS = 8;

type Edge = 'n' | 's' | 'e' | 'w';
interface Shape { readonly name: string; readonly class: 'brook' | 'river' | 'major'; readonly inflow: readonly Edge[]; readonly outflow: Edge | null }
const SHAPES: readonly Shape[] = [
  { name: 'brook w-s', class: 'brook', inflow: ['w'], outflow: 's' },
  { name: 'river n+w-e', class: 'river', inflow: ['n', 'w'], outflow: 'e' },
  { name: 'major e-n', class: 'major', inflow: ['e'], outflow: 'n' },
  { name: 'spring-s', class: 'brook', inflow: [], outflow: 's' },
  { name: 'river s-lake', class: 'river', inflow: ['s'], outflow: null },
];

interface Reach {
  /** The stand tile the real search chose from the arrival point; -1 when it found none. */
  readonly stand: number;
  readonly standKind: TileKind | null;
  /** Reachable floor or ramp tiles the search would accept, anywhere on the map. */
  readonly banks: number;
  /** Reachable floor or ramp tiles a fishing bank's drop reaches from. */
  readonly fishing: number;
  /** Horizontal and vertical distance from the arrival to the nearest such bank's water. */
  readonly nearest: number;
  readonly levels: number;
}

function reachFrom(spec: LocalMapSpec, seed: string): Reach {
  const map = new Map3D(SIZE, SIZE, LOCAL_MAP_Z);
  const local = generateLocal(spec, map, registry);
  const w = new TestWorld({ seed, registry, map, spec, systems: HeadlessGame.standardSystems(spec, local.layerStack, local), surfaceWildlife: 'none', embark: 'default' });
  w.step(1);
  const wagon = w.game.arrival!.wagon;
  const from = map.index(wagon.x, wagon.y, wagon.z);
  const ctx = { world: w.game.world, readers: w.readers, registry: w.game.registry, tick: w.tick } as unknown as TickContext;
  const stand = water(ctx, from, () => true);
  const pathing = w.readers.pathing;
  const usable = (t: number): boolean => {
    const k = map.kindAt(t);
    return (k === TileKind.Floor || k === TileKind.Ramp) && map.fluidLevelAt(t) === 0 && pathing.passable(t, 'walker') && pathing.reachable(from, t, 'walker');
  };
  const banks = new Set<number>();
  const fishing = new Set<number>();
  let nearest = Infinity;
  let levels = Infinity;
  for (let c = 0; c < SIZE * SIZE; c += 1) {
    if (((local.columns[c] as number) & (COL_RIVER | COL_LAKE)) === 0) continue;
    const x = c % SIZE;
    const y = Math.floor(c / SIZE);
    let z = local.surface[c] as number;
    while (map.fluidLevelAt(map.index(x, y, z + 1)) > 0) z += 1;
    const over = map.index(x, y, z + 1);
    if (map.kindAt(over) !== TileKind.Open || map.fluidLevelAt(over) !== 0) continue;
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const sx = x + dx;
      const sy = y + dy;
      if ((dx === 0 && dy === 0) || sx < 0 || sy < 0 || sx >= SIZE || sy >= SIZE) continue;
      if (usable(map.index(sx, sy, z + 1))) {
        banks.add(map.index(sx, sy, z + 1));
        nearest = Math.min(nearest, Math.max(Math.abs(sx - wagon.x), Math.abs(sy - wagon.y)));
        levels = Math.min(levels, Math.abs(z - wagon.z));
      }
      if (dx !== 0 && dy !== 0) continue;
      for (let drop = 1; drop <= FISH_BANK_DROP; drop += 1) if (usable(map.index(sx, sy, z + drop))) fishing.add(map.index(sx, sy, z + drop));
    }
  }
  return { stand, standKind: stand >= 0 ? map.kindAt(stand) : null, banks: banks.size, fishing: fishing.size, nearest, levels };
}

function record(row: unknown): void {
  if (OUT !== undefined) appendFileSync(OUT, JSON.stringify(row) + '\n');
}

describe('T-449 a river site has water a dwarf can drink', () => {
  it('the real search has the radius 10 says', () => {
    expect(DRINK_SEARCH_RADIUS).toBe(64);
  });

  for (const relief of [1, 2, 3] as const) {
    for (const shape of SHAPES) {
      it(`relief ${relief}, ${shape.name}: a reachable bank from the arrival point`, () => {
        for (let s = 0; s < SEED_COUNT; s += 1) {
          const seed = `t449-reach-${s}`;
          const spec = regionSpec(seed, { peril: 0, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: [], relief, river: { class: shape.class, inflow: [...shape.inflow], outflow: shape.outflow } }, registry);
          const reach = reachFrom(spec, seed);
          record({ relief, shape: shape.name, seed, ...reach });
          if (OUT !== undefined) continue;
          expect(reach.banks, `${seed}: floor or ramp banks`).toBeGreaterThan(0);
          expect(reach.fishing, `${seed}: fishing banks`).toBeGreaterThan(0);
          // The search looks DRINK_SEARCH_RADIUS tiles and DRINK_SEARCH_LEVELS levels from the dwarf. T-453:
          // a lake lies in the arrival edge's half of the map, so its bank is always inside the radius.
          if (shape.inflow.length > 0 && shape.outflow === null) expect(reach.nearest, `${seed}: the lake's nearest bank`).toBeLessThan(DRINK_SEARCH_RADIUS);
          if (reach.nearest < DRINK_SEARCH_RADIUS && reach.levels <= DRINK_SEARCH_LEVELS) expect(reach.stand, `${seed}: the drink search`).toBeGreaterThanOrEqual(0);
          if (reach.stand >= 0) expect(reach.standKind === TileKind.Floor || reach.standKind === TileKind.Ramp || reach.standKind === TileKind.Shrub, `${seed}: stand kind ${reach.standKind}`).toBe(true);
        }
      }, 600_000);
    }
  }

  // T-453: a river from the south edge into a lake, a wagon on the north edge. Before the lake kept to
  // the arrival half, the nearest bank of seeds 7, 9 and 10 lay 65 to 67 tiles from the wagon, past
  // the search, at every relief.
  for (const relief of [0, 1] as const) {
    it(`relief ${relief}, river s-lake: the drink search finds the far lake's water from the wagon (T-453)`, () => {
      for (const s of [7, 9, 10]) {
        const seed = `t449-reach-${s}`;
        const spec = regionSpec(seed, { peril: 0, wealth: 2, biome: 'temperate_forest', geology: 'mixed', traits: [], relief, river: { class: 'river', inflow: ['s'], outflow: null } }, registry);
        const reach = reachFrom(spec, seed);
        expect(reach.nearest, `${seed}: the lake's nearest bank`).toBeLessThan(DRINK_SEARCH_RADIUS);
        expect(reach.stand, `${seed}: the drink search`).toBeGreaterThanOrEqual(0);
      }
    }, 600_000);
  }

  it('the tutorial region, ranked as having water, has a reachable bank the search accepts', () => {
    const world = generate(TUTORIAL_WORLD_SEED, WORLD_SIZE_STANDARD, registry);
    const spec = localMapSpec(world, tutorialRegion(world, registry), registry);
    expect(spec.river).not.toBeNull();
    const reach = reachFrom(spec, TUTORIAL_WORLD_SEED);
    record({ tutorial: true, relief: spec.relief, ...reach });
    expect(reach.banks).toBeGreaterThan(0);
    expect(reach.stand).toBeGreaterThanOrEqual(0);
  }, 600_000);
});
