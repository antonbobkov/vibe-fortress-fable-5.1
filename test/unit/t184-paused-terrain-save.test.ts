import { describe, expect, it } from 'vitest';
import { roundTrip, gameSections, gameHeader, inMemorySave, restoreGame } from '@app/game-save';
import { SAVE_FORMAT_VERSION, jsonSection, readJsonSection } from '@app/save-manager';
import { TileKind } from '@core/map3d';
import type { TerrainStateV1 } from '@systems/terrain/state';
import { TestWorld } from '../scenarios/test-world';
import { prepareBusyFortress } from '../scenarios/core_save_roundtrip.scenario';

describe('T-184 paused designation save continuation', () => {
  it.each([false, true])(
    'keeps deferred terrain effects at every resumed tick (busy=%s)',
    (busy) => {
      const w = new TestWorld({
        seed: 't184-paused-terrain',
        world: 'flat-test',
        embark: 'default',
      });
      if (busy) prepareBusyFortress(w);
      w.step(busy ? 5000 : 700);
      w.game.world.submit({
        type: 'Designate',
        kind: 'channel',
        tiles: [60, 61].map((x) => w.index(x, 60, 32)),
        priority: 4,
      });
      w.game.world.commandPhase(true);
      const loaded = roundTrip(w.game).game;
      expect(loaded.hash()).toBe(w.hash());
      for (let n = 0; n < 50; n += 1) {
        w.step(1);
        loaded.step(1);
        expect(loaded.hash(), `resumed tick ${w.tick}`).toBe(w.hash());
      }
    },
  );
  it('retains discovery and relighting and returns independent sorted snapshots without flushing', () => {
    const w = new TestWorld({ seed: 't184-notifications', world: 'flat-test', embark: 'none' });
    w.step(1);
    const core = w.game.terrain!.core;
    const tile = w.index(60, 60, 31);
    core.setKind(tile, TileKind.Floor, w.game.registry.table('materials').index('granite'));
    core.discoverAround(tile);
    const hash = w.hash();
    const pending = core.savePending()!;
    expect(pending.changed.length).toBeGreaterThan(0);
    expect(pending.discovered.length).toBeGreaterThan(0);
    expect(pending.litDirty).toContain(31);
    pending.changed.length = 0;
    pending.discovered.length = 0;
    pending.litDirty.length = 0;
    expect(w.hash()).toBe(hash);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(hash);
    expect(core.savePending()).toEqual(loaded.terrain!.core.savePending());
    w.step(1);
    loaded.step(1);
    expect(w.hash()).toBe(loaded.hash());
    expect(core.savePending()).toBeUndefined();
  });

  it('loads an older terrain state with no pending field as an empty batch', () => {
    const w = new TestWorld({ seed: 't184-legacy', world: 'flat-test', embark: 'default' });
    w.step(1);
    const sections = gameSections(w.game);
    const at = sections.findIndex((s) => s.name === 'systems');
    const systems = readJsonSection(sections[at]!) as Record<
      string,
      { state: TerrainStateV1; stateVersion: number }
    >;
    delete systems['03']!.state.pendingTerrain;
    sections[at] = jsonSection('systems', systems);
    const loaded = restoreGame(
      inMemorySave(
        { ...gameHeader(w.game, 'manual'), formatVersion: SAVE_FORMAT_VERSION, compressed: false },
        sections,
      ),
    ).game;
    expect(loaded.terrain!.core.savePending()).toBeUndefined();
    expect(loaded.hash()).toBe(w.hash());
  });
});
