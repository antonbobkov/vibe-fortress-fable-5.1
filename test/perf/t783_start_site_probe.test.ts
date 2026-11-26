/**
 * T-783's probe: where the world map's cursor starts on the thirty probe worlds (`probe-1` …
 * `probe-30`, standard size), and what the start site has: biome, missing essentials, frostbite.
 * For each world it prints the screen's start beside the frostbite rule's alone (the nearest site
 * with no frostbite from the first night, by Chebyshev distance from the centre, ties to the lowest
 * id), how far the cursor moved from it, and how long the screen took to place it.
 *
 * Local measurement only (`T783_PROBE=1`, `T783_SEEDS`); not part of `npm test`.
 */
import { describe, it, vi } from 'vitest';
import { performance } from 'node:perf_hooks';
import { WORLD_SIZE_STANDARD } from '@core/constants';
import { WorldMapCompositor } from '@render/world-map';
import { localMapSpec, siteFrostbite, siteSummary } from '@systems/embark';
import { generate } from '@systems/worldgen';
import { WorldMapScreen } from '@ui/screens/world_map';
import { keymap, palette, registry, strings } from '../unit/ui/ui-fixture';

const SEEDS = (process.env['T783_SEEDS'] ?? Array.from({ length: 30 }, (_, k) => `probe-${k + 1}`).join(',')).split(',');
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

describe('T-783 probe: the start site of thirty worlds', () => {
  it.runIf(process.env['T783_PROBE'] === '1')('prints each world\'s start beside the frostbite rule\'s', () => {
    const compositor = new WorldMapCompositor(registry, palette);
    const biomes = registry.table<{ id: string; embarkable: boolean }>('biomes');
    const tally: Record<string, number> = {};
    const count = (k: string): void => { tally[k] = (tally[k] ?? 0) + 1; };
    for (const seed of SEEDS) {
      const w = generate(seed, WORLD_SIZE_STANDARD, registry);
      const size = w.size;
      const mid = Math.floor(size / 2);
      const dist = (id: number): number => Math.max(Math.abs((id % size) - mid), Math.abs(Math.floor(id / size) - mid));
      const t0 = performance.now();
      const start = new WorldMapScreen(w, { embark: vi.fn(), back: vi.fn() }, keymap, strings, compositor, registry).regionId;
      const ms = performance.now() - t0;
      const sites = w.regions.filter((r) => biomes.byId(r.biome)?.embarkable === true).sort((a, b) => dist(a.id) - dist(b.id));
      const before = sites.find((r) => siteFrostbite(localMapSpec(w, r.id, registry), registry)?.arrival !== true)?.id ?? sites[0]?.id ?? -1;
      const describe = (id: number): string => {
        const s = siteSummary(localMapSpec(w, id, registry), registry);
        const f = s.climate.frostbite;
        return `${id} ${w.regions[id]?.biome} lacks[${s.lacks.join(',') || 'nothing'}] frostbite ${f === null ? 'none' : `${SEASONS[f.season]} ${f.nightC}`}`;
      };
      const moved = Math.max(Math.abs((start % size) - (before % size)), Math.abs(Math.floor(start / size) - Math.floor(before / size)));
      const lacks = siteSummary(localMapSpec(w, start, registry), registry).lacks.length;
      const lacksBefore = siteSummary(localMapSpec(w, before, registry), registry).lacks.length;
      count(`before lacks ${lacksBefore}`);
      count(`after lacks ${lacks}`);
      count(`moved ${moved}`);
      console.log(`${seed} (${ms.toFixed(1)} ms) moved ${moved}, ${dist(start)} from the centre | before ${describe(before)} | after ${describe(start)}`);
    }
    console.log(`TALLY ${JSON.stringify(tally)}`);
  });
});
