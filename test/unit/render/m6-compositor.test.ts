import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { loadContent } from '@content/loader';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { glyphChars } from '@render/atlas';
import { Compositor, OVERLAY_SQUAD_STATIONS } from '@render/compositor';
import { Palette } from '@render/palette';
import { TestWorld } from '../../scenarios/test-world';

const registry = loadContent();
const palette = new Palette(registry);
const chars = glyphChars(registry);
const z = FLAT_TEST_SURFACE_Z;

function cell(w: TestWorld, x: number, y: number, frame = 0, overlays?: string[]) {
  const compositor = new Compositor({ registry, palette });
  const view = { camX: x, camY: y, z, sidebarOpen: false, cursor: null, animFrame: frame, ...(overlays ? { overlays } : {}) };
  return compositor.compose(w.readers, view, 3, 8).get(0, 0);
}

describe('T-M6-17 combat compositor', () => {
  it('hides unspotted stealth, then draws spotted hostiles in hostile color', () => {
    const w = new TestWorld({ seed: 'm6-stealth-render', world: 'flat-test', embark: 'none', startTick: 8 * 50 });
    const tile = w.index(20, 20, z);
    const id = w.spawnCreature('gloam_warrior', tile, 'hostile:gloam');
    const hostile = { partyId: 0, role: 'thief', behaviorState: 'sneak', stealthed: true,
      spotted: false, breakingDoorId: 0, breakingSince: 0 };
    w.game.world.entities.add(id, C.Hostile, hostile);
    expect(chars[cell(w, 20, 20).glyph]).not.toBe('G');
    w.game.world.entities.add(id, C.Hostile, { ...hostile, spotted: true });
    expect(cell(w, 20, 20)).toMatchObject({ glyph: chars.indexOf('G'), fg: palette.color('hostile') });
  });

  it('draws webs, projectiles in the ray direction, and an unconscious blink', () => {
    const w = new TestWorld({ seed: 'm6-layers-render', world: 'flat-test', embark: 'none', startTick: 8 * 50 });
    const tile = w.index(20, 20, z);
    w.map.setFlag(tile, TileFlag.Web, true);
    expect(cell(w, 20, 20)).toMatchObject({ glyph: chars.indexOf('*'), fg: palette.color('silk_white') });
    const dwarf = w.spawnDwarf({ at: tile });
    const body = w.game.world.entities.get(dwarf, C.Body)!;
    body.conscious = false;
    expect(chars[cell(w, 20, 20, 0).glyph]).toBe('☺');
    expect(chars[cell(w, 20, 20, 2).glyph]).toBe('_');
    const proj = w.game.world.entities.create('projectile');
    w.game.world.entities.add(proj, C.Projectile, { itemId: 0, from: w.index(19, 19, z), to: tile,
      progress: 1, shooterId: dwarf, targetId: 0, hitRoll: 1, damage: 1, damageType: 'pierce', line: [tile] });
    w.game.world.entities.add(proj, C.Position, { x: 20, y: 20, z });
    expect(chars[cell(w, 20, 20).glyph]).toBe('\\');
  });

  it('D-179: flashes only the first attack of a pair for one second', () => {
    const w = new TestWorld({ seed: 'm6-flash-render', world: 'flat-test', embark: 'none', startTick: 8 * 50 });
    const tile = w.index(20, 20, z);
    const defender = w.spawnDwarf({ at: tile });
    const attacker = w.spawnCreature('gloam_warrior', w.index(21, 20, z), 'hostile:gloam');
    const compositor = new Compositor({ registry, palette });
    const draw = (frame: number) => compositor.compose(w.readers, { camX: 20, camY: 20, z,
      sidebarOpen: false, cursor: null, animFrame: frame }, 3, 8).get(0, 0);
    const attack = { type: 'AttackResolved' as const, attackerId: attacker, defenderId: defender };
    const ordinary = draw(5).bg;
    compositor.onEvents([attack], 5);
    expect(draw(5).bg).toBe(palette.color('red'));
    expect(draw(6).bg).toBe(palette.color('red'));
    expect(draw(7).bg).toBe(ordinary);
    compositor.onEvents([attack], 8);
    expect(draw(8).bg).toBe(ordinary);
  });

  it('D-179: tints squad station and patrol tiles without replacing a creature', () => {
    const w = new TestWorld({ seed: 'm6-stations-render', world: 'flat-test', embark: 'none' });
    const station = w.index(20, 20, z);
    const patrol = w.index(21, 20, z);
    const dwarf = w.spawnDwarf({ at: station });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate' }).ok).toBe(true);
    const squadId = w.readers.of<{ squads(): readonly { id: number }[] }>('16').squads()[0]!.id;
    expect(w.game.world.applyCommand({ type: 'SetSquadStation', squadId, tile: station }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadPatrol', squadId, tiles: [patrol] }).ok).toBe(true);
    const plain = cell(w, 20, 20);
    const marked = cell(w, 20, 20, 0, [OVERLAY_SQUAD_STATIONS]);
    expect(marked.glyph).toBe(plain.glyph);
    expect(marked.bg).not.toBe(plain.bg);
    expect(cell(w, 21, 20, 0, [OVERLAY_SQUAD_STATIONS]).bg).not.toBe(cell(w, 21, 20).bg);
    expect(w.game.world.entities.alive(dwarf)).toBe(true);
  });
});
