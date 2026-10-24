/**
 * T-437: a designation whose job is not done blinks on the fast clock (23 § Animation): queued
 * alternates with the bare tile, assigned pulses brighter, blocked stays steady, and Reduced motion
 * stops it.
 */

import { describe, expect, it } from 'vitest';
import { TileKind } from '@core/map3d';
import type { TileIndex } from '@core/types';
import type { Cell } from '@render/cellbuffer';
import { Compositor } from '@render/compositor';
import { Palette, relativeLuminance } from '@render/palette';
import type { TerrainReader } from '@systems/terrain';
import { helpGlyphRows } from '@ui/panels/help';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const Z = 32;

function world(): { w: TestWorld; reachable: TileIndex[]; enclosed: TileIndex } {
  const w = new TestWorld({ seed: 't437', world: 'flat-test', embark: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(20, 21, Z) });
  const granite = w.game.registry.table('materials').index('granite');
  const reachable = [w.index(20, 20, Z), w.index(24, 20, Z)];
  for (const t of reachable) w.carve(t, TileKind.Wall, granite);
  // A wall inside a ring of walls: no dwarf can stand beside it.
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) w.carve(w.index(40 + dx, 40 + dy, Z), TileKind.Wall, granite);
  }
  const enclosed = w.index(40, 40, Z);
  for (const t of [...reachable, enclosed]) w.discover(t);
  w.spawnItem('pick', 'copper', w.index(20, 21, Z));
  w.game.world.applyCommand({ type: 'SetLabor', dwarfId: dwarf, labor: 'mining', on: true });
  w.game.world.applyCommand({ type: 'Designate', tiles: [...reachable, enclosed], kind: 'dig' });
  return { w, reachable, enclosed };
}

function cell(compositor: Compositor, w: TestWorld, tile: TileIndex, animFrame: number, reducedMotion = false): Cell {
  const x = tile % w.map.w;
  const y = Math.floor(tile / w.map.w) % w.map.h;
  const cells = compositor.compose(w.readers, { camX: x - 2, camY: y - 2, z: Z, sidebarOpen: false, cursor: null, animFrame, reducedMotion }, 40, 20);
  return cells.get(2, 2);
}

describe('T-437 blinking designations', () => {
  const { w, reachable, enclosed } = world();
  const terrain = (): TerrainReader => w.readers.of<TerrainReader>('03');

  it('03 says where each designation\'s work stands', () => {
    expect(terrain().designationWork(reachable[0] as TileIndex)).toBe('queued');
    for (let t = 0; t < 400 && !(terrain().designationWork(enclosed) === 'blocked' && reachable.some((r) => terrain().designationWork(r) === 'assigned')); t += 1) w.step(1);
    expect(terrain().designationWork(enclosed)).toBe('blocked');
    expect(reachable.map((r) => terrain().designationWork(r)).sort()).toEqual(['assigned', 'queued']);
    expect(terrain().designationWork(w.index(10, 10, Z))).toBeNull();
  });

  it('queued alternates with the bare tile, assigned pulses brighter, blocked is steady', () => {
    const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
    const queued = reachable.find((r) => terrain().designationWork(r) === 'queued') as TileIndex;
    const assigned = reachable.find((r) => terrain().designationWork(r) === 'assigned') as TileIndex;
    // Phase 0 is the steady tint for every state, so a still frame (animFrame 0) is unchanged.
    const steady = cell(compositor, w, queued, 0).bg;
    for (const t of [assigned, enclosed]) expect(cell(compositor, w, t, 0).bg).toBe(steady);
    expect(cell(compositor, w, queued, 1).bg).not.toBe(steady);
    expect(relativeLuminance(cell(compositor, w, assigned, 1).bg)).toBeGreaterThan(relativeLuminance(steady));
    expect(cell(compositor, w, enclosed, 1).bg).toBe(steady);
    // The blink follows the frame clock, whatever the tick: the next periods repeat it.
    expect(cell(compositor, w, queued, 2).bg).toBe(steady);
    expect(cell(compositor, w, queued, 3).bg).not.toBe(steady);
  });

  it('Reduced motion keeps every designation steady', () => {
    const compositor = new Compositor({ registry: w.game.registry, palette: new Palette(w.game.registry) });
    const steady = cell(compositor, w, enclosed, 0).bg;
    for (const t of [...reachable, enclosed]) expect(cell(compositor, w, t, 1, true).bg).toBe(steady);
  });

  it('the Legend says what the blink means', () => {
    const rows = helpGlyphRows(w.game.registry, () => '?', new Strings(w.game.registry)).filter((r) => r.category === 'Overlays').map((r) => r.text);
    expect(rows).toContain('∙  designation blinking: waiting for a worker');
    expect(rows).toContain('∙  designation pulsing brighter: a worker is on it');
    expect(rows).toContain('∙  designation steady: blocked, or Reduced motion is on');
  });
});
