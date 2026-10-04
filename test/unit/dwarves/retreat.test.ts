import { describe, expect, it, vi } from 'vitest';
import { C } from '@core/components';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { roundTrip } from '@app/game-save';
import { TileFlag, TileKind } from '@core/map3d';
import type { DefenseReader } from '@systems/defense';
import type { DwarvesSystem } from '@systems/dwarves';
import { TestWorld } from '../../scenarios/test-world';

function shutOut() {
  const w = new TestWorld({ seed: 'three-years-p2-1', map: buildFlatTestMap(contentRegistry(), 48, 48), embark: 'none' });
  const at = w.index(36, 0, 32);
  const dwarf = w.spawnDwarf({ at });
  const granite = w.game.registry.table('materials').index('granite');
  for (let x = 0; x < w.map.w; x += 1) if (x !== 36) w.game.world.services.terrain.setKind(w.index(x, 2, 32), TileKind.Wall, granite);
  const door = w.build('door', w.index(36, 2, 32), 'oak');
  w.build('hearth', w.index(36, 6, 32), 'granite');
  for (let y = 3; y < 9; y += 1) for (let x = 34; x < 39; x += 1) w.game.world.services.terrain.setFlag(w.index(x, y, 32), TileFlag.Outdoor, false);
  expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'locked' }).ok).toBe(true);
  w.step(1);
  expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
  w.step(2);
  const brain = () => w.game.world.entities.get(dwarf, C.Brain);
  return { w, dwarf, door, at, brain };
}

describe('F-16 retreat without shelter', () => {
  it('D-217: the shut-out edge civilian continues needs and retreats when the door opens', () => {
    const { w, dwarf, door, at, brain } = shutOut();
    expect(w.readers.of<DefenseReader>('19').retreatTile(dwarf)).toBe(-1);
    expect(brain()?.behavior).not.toBe('retreat');
    expect(brain()?.targetTile).toBe(at);
    w.spawnItem('drink', 'dimcap_ale', w.index(37, 0, 32), 10);
    w.setNeed(dwarf, 'thirst', 90);
    w.until(() => brain()?.behavior === 'need', 60);
    expect(brain()?.targetTile).toBeGreaterThanOrEqual(0);
    expect(w.game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' }).ok).toBe(true);
    w.until(() => brain()?.behavior === 'retreat', 5);
    expect(brain()?.targetTile).toBeGreaterThanOrEqual(0);
  });

  it('a nearby hostile still makes the shut-out civilian flee', () => {
    const { w, brain } = shutOut();
    w.spawnCreature('gloam_warrior', w.index(36, 5, 32), 'hostile:gloam');
    // Threat perception is geometric; the locked gate does not change flee precedence.
    w.until(() => brain()?.behavior === 'flee', 10);
    expect(brain()?.targetTile).toBeGreaterThanOrEqual(0);
  });

  it('rechecks shut-out civilians on connectivity rebuild, without a per-tick shelter search', () => {
    const { w, dwarf, brain } = shutOut();
    const defense = w.readers.of<DefenseReader>('19');
    const spy = vi.spyOn(defense, 'retreatTile');
    w.step(5);
    expect(spy).not.toHaveBeenCalled();
    // An excavated bypass reconnects the hall without any door state event.
    w.game.world.services.terrain.setKind(w.index(35, 2, 32), TileKind.Floor, w.game.registry.table('materials').index('granite'));
    w.until(() => brain()?.behavior === 'retreat', 5);
    expect(defense.retreatTile(dwarf)).toBeGreaterThanOrEqual(0);
  });

  it('a legacy retreat with target -1 falls through instead of remaining frozen', () => {
    const { w, dwarf, brain } = shutOut();
    const b = brain();
    if (!b) throw new Error('missing brain');
    w.game.world.entities.add(dwarf, C.Brain, { ...b, behavior: 'retreat', targetTile: -1 });
    w.step(1);
    expect(brain()?.behavior).not.toBe('retreat');
    expect(brain()?.targetTile).toBeGreaterThanOrEqual(0);
    expect((w.game.world.scheduler.byId('10') as DwarvesSystem).shutOut.has(dwarf)).toBe(true);
  });

  it('keeps shelter watching deterministic across save/load during a need', () => {
    const { w, dwarf, door } = shutOut();
    w.spawnItem('drink', 'dimcap_ale', w.index(37, 0, 32), 10);
    w.setNeed(dwarf, 'thirst', 90);
    w.until(() => w.game.world.entities.get(dwarf, C.Brain)?.behavior === 'need', 60);
    const loaded = roundTrip(w.game).game;
    expect(loaded.hash()).toBe(w.hash());
    for (const game of [w.game, loaded]) {
      expect(game.world.applyCommand({ type: 'SetDoorMode', buildingId: door, mode: 'open' }).ok).toBe(true);
    }
    for (let tick = 0; tick < 10; tick += 1) {
      w.step(1);
      loaded.step(1);
      expect(loaded.hash()).toBe(w.hash());
    }
    expect(w.game.world.entities.get(dwarf, C.Brain)?.behavior).toBe('retreat');
  });
});
