/**
 * T-801: deepsilver seen is deepsilver found (03 § Discovery; 18 § Player-facing behavior; 02 § Site
 * summary; `ui-keymap-and-screens.md` § Hints).
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { DEEPSILVER_Z_MAX, WORLD_SIZE_SMALL } from '@core/constants';
import { TileFlag, TileKind } from '@core/map3d';
import type { GameEvent } from '@core/events';
import { localMapSpec, siteSummary } from '@systems/embark';
import { baseSurfaceZ } from '@systems/terrain/generate/height';
import { generate } from '@systems/worldgen';
import { AnnouncementLog } from '@ui/announcements';
import { HintEngine } from '@ui/hints';
import { defaultUiState, type UiState } from '@ui/ui-state';
import { registry, strings } from '../ui/ui-fixture';
import { TestWorld } from '../../scenarios/test-world';

/** Cavern three's band, on the flat-test map: a small cavern pocket at z6 with a three-tile deepsilver vein in its east wall. */
const Z = 6;

function setup(seed: string): TestWorld {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ore = w.game.registry.table('materials').index('deepsilver_ore');
  for (let y = 20; y <= 22; y += 1) {
    for (let x = 20; x <= 24; x += 1) w.carve(w.index(x, y, Z), TileKind.Floor);
    w.carve(w.index(25, y, Z), TileKind.Wall, ore);
  }
  // A tunnel that ends one rock tile short of the pocket.
  w.carve(w.index(18, 21, Z), TileKind.Floor);
  for (let y = 18; y <= 24; y += 1) for (let x = 15; x <= 27; x += 1) {
    for (let z = Z - 1; z <= Z + 1; z += 1) w.game.world.services.terrain.setFlag(w.index(x, y, z), TileFlag.Discovered, false);
  }
  w.game.world.services.terrain.setFlag(w.index(18, 21, Z), TileFlag.Discovered, true);
  w.step(1);
  return w;
}

/** Whether the hint engine, given the event, has the hint pending or shown. */
function hinted(w: TestWorld, event: GameEvent, id: string): boolean {
  const ui: UiState = defaultUiState(Z);
  const log = new AnnouncementLog(strings, w.game.registry);
  new HintEngine(w.game.registry, ui, log).onEvents([event], w.readers);
  return ui.hintPending.includes(id) || ui.hintsShown.includes(id);
}

describe('T-801 a deepsilver vein is found when it is seen', () => {
  it('a breach that reveals the vein emits VeinFound with no finder, once; mining it later emits nothing more', () => {
    const w = setup('t801-breach');
    const core = w.game.terrain!.core;
    expect(core.cavernBreached[2]).toBe(false);
    expect(w.events('VeinFound')).toHaveLength(0);
    // Dig the last rock between the tunnel and the pocket: the breach discovers cavern three and its rim.
    const rock = w.index(19, 21, Z);
    w.game.world.services.terrain.setKind(rock, TileKind.Floor, w.map.materialAt(rock));
    expect(core.checkBreach(rock)).toBe(3);
    w.step(1);
    const found = w.events('VeinFound');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ material: 'deepsilver_ore', tile: w.index(25, 20, Z), finderId: 0 });
    expect(w.map.hasFlag(w.index(25, 22, Z), TileFlag.Discovered)).toBe(true);

    // The line and the hint.
    const log = new AnnouncementLog(strings, w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const done = log.announce(found[0] as GameEvent, w.readers, w.tick);
    expect(done?.line.text).toBe(`Deepsilver has been seen at (25,20,z${Z}).`);
    expect(done?.severity).toBe('note');
    expect(hinted(w, found[0] as GameEvent, 'hint_deep')).toBe(true);

    // A miner takes a tile of the same vein: DeepsilverMined, and no second VeinFound.
    expect(w.game.world.applyCommand({ type: 'ConfirmDeepsilver' }).ok).toBe(true);
    const miner = w.spawnDwarf({ at: w.index(23, 21, Z), skills: { mining: 5 } });
    w.setLabor(miner, 'mining');
    const pick = w.spawnItem('pick', 'iron', w.index(23, 21, Z));
    w.game.world.services.items!.attachToCarrier(pick, miner);
    w.game.world.entities.add(miner, C.Worker, { ...w.game.world.entities.get(miner, C.Worker)!, toolId: pick });
    expect(w.game.world.applyCommand({ type: 'Designate', kind: 'dig', tiles: [w.index(25, 21, Z)], priority: 1 }).ok).toBe(true);
    w.until((t) => t.events('DeepsilverMined').length > 0, 3000);
    expect(w.events('VeinFound')).toHaveLength(1);
  });

  it('other minerals are still found only by mining', () => {
    const w = setup('t801-other-ore');
    const iron = w.game.registry.table('materials').index('magnetite');
    w.carve(w.index(24, 18, Z), TileKind.Wall, iron);
    const core = w.game.terrain!.core;
    core.discoverAround(w.index(24, 19, Z));
    w.step(1);
    expect(w.events('VeinFound').filter((e) => e['material'] === 'magnetite')).toHaveLength(0);
  });
});

describe('T-801 the site summary says how deep deepsilver lies', () => {
  it('"deepsilver likely, beside the Sea of Fire (about N levels down)", N the base surface less DEEPSILVER_Z_MAX', () => {
    const world = generate('site-0', WORLD_SIZE_SMALL, registry);
    const region = world.regions.find((r) => r.biome !== 'ocean' && r.biome !== 'glacier');
    if (region === undefined) throw new Error('no land region');
    const spec = { ...localMapSpec(world, region.id, registry), wealth: 3 };
    const summary = siteSummary(spec, registry);
    expect(summary.deepsilver).toBe(true);
    expect(summary.deepsilverDepth).toBe(baseSurfaceZ(spec.elevation) - DEEPSILVER_Z_MAX);
    expect(strings.get('ui.site.deepsilver', { n: summary.deepsilverDepth }))
      .toBe(`deepsilver likely, beside the Sea of Fire (about ${summary.deepsilverDepth} levels down)`);
  });

  it('the first breach of cavern three gives the deepsilver hint of where it lies', () => {
    const w = setup('t801-hint');
    expect(hinted(w, { type: 'CavernBreached', cavern: 3, tile: w.index(20, 21, Z) } as unknown as GameEvent, 'hint_deep_cavern')).toBe(true);
    expect(strings.get('hint.hint_deep_cavern')).toContain('Deepsilver lies within two tiles of magma, at the bottom of the world');
  });
});
