/**
 * T-645: how long the Jobs panel takes to draw on the 80-dwarf furniture fixture, and how many times
 * one draw copies the job list (`JobsReader.list()`). It prints the first draw of a fresh panel, a
 * second draw in the same tick, and a draw with a text filter set. A probe, not a budget: it asserts
 * only that the fixture has jobs.
 *
 *   npx vitest run -c vitest.perf.config.ts test/perf/t645_jobs_open.test.ts
 */
import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import { computeLayout } from '@render/cellbuffer';
import type { JobsReader } from '@systems/jobs';
import { drawJobsPanel } from '@ui/panels/jobs';
import { FortressScreen, type FortressHost } from '@ui/screens/fortress';
import { defaultUiState } from '@ui/ui-state';
import { keymap, strings, surface } from '../unit/ui/ui-fixture';
import { ensureScriptedFurniture } from './scripted-furniture';

describe('T-645 Jobs open time on the furniture fixture', () => {
  it('prints the first, the next and a filtered draw, with the list copies each makes', async () => {
    const now = (): number => performance.now();
    const game = await ensureScriptedFurniture(now);
    const world = game.world;
    // The fixture has a few dozen jobs; the audit's 80-dwarf fortress had 922 blocked. Dig 1,000
    // tiles of buried rock no one can reach, in rows of 40, so the list has the audit's size.
    const map = world.readers.map;
    const tiles: TileIndex[] = [];
    for (let y = 10; y < map.h - 10 && tiles.length < 1_000; y += 3) {
      for (let x = 10; x < 50 && tiles.length < 1_000; x += 1) {
        const z = map.columnSurfaceZ(x, y) - 12;
        if (z < 0) continue;
        const at = map.index(x, y, z);
        if (map.kindAt(at) === TileKind.Wall) tiles.push(at);
      }
    }
    world.applyCommand({ type: 'Designate', kind: 'dig', tiles });
    game.step(2);
    const reader = world.readers.of<JobsReader>('11');
    const live = reader.list().filter((j) => j.state !== 'done' && j.state !== 'cancelled');
    const jobs = live.length;
    const blocked = live.filter((j) => j.state === 'blocked').length;
    expect(jobs).toBeGreaterThan(900);
    // Count the copies of the whole list each draw makes.
    let lists = 0;
    const list = reader.list.bind(reader);
    (reader as { list: JobsReader['list'] }).list = (state) => { lists += 1; return list(state); };
    const host: FortressHost = {
      readers: world.readers, registry: game.registry, ui: defaultUiState(0), submit: () => {},
      speed: () => 0, setSpeed: () => {}, pan: () => {}, changeZ: () => {}, centerOn: () => {}, home: () => {}, zoom: () => {},
      layout: () => computeLayout(80, 50, true), precondition: () => true,
      registeredPanels: () => world.registrations.panels, announcements: () => world.registrations.announcements, now: () => 0,
    };
    const rect = { col: 0, row: 0, cols: 36, rows: 44 };
    const time = (f: FortressScreen): { ms: number; lists: number } => {
      const s = surface(36, 44);
      lists = 0;
      const start = performance.now();
      drawJobsPanel(s, rect, f.jobs, f.ctx);
      return { ms: Math.round(performance.now() - start), lists };
    };
    const rows: Record<string, number>[] = [];
    for (let pass = 0; pass < 3; pass += 1) {
      const f = new FortressScreen(host, keymap, strings);
      f.openPanel('jobs');
      const first = time(f);
      const next = time(f);
      f.jobs.filter.value = 'a';
      const filtered = time(f);
      // The whole screen, sidebar title and all, with the filter set.
      lists = 0;
      const start = performance.now();
      f.draw(surface(80, 50));
      const screen = { ms: Math.round(performance.now() - start), lists };
      rows.push({ pass, first: first.ms, next: next.ms, filtered: filtered.ms, screen: screen.ms, firstLists: first.lists, filteredLists: filtered.lists, screenLists: screen.lists });
    }
    (reader as { list: JobsReader['list'] }).list = list;
    console.log(`t645_jobs_open: ${JSON.stringify({ jobs, blocked, rows })}`);
  });
});
