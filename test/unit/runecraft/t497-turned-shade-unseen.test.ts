/**
 * T-497: a turned shade is never spotted by its own summoner (`25-runecraft.md` § Summons, Turning;
 * `18-threats-monsters-and-raids.md` § Stealth, § The Deep; `docs/fun-features.md`).
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { roundTrip } from '@app/game-save';
import { C, type Equipment } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import { contentRegistry } from '@content/loader';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { TestWorld } from '../../scenarios/test-world';

const registry = contentRegistry();
const Z = FLAT_TEST_SURFACE_Z;
/** A seed whose first deep shade comes through turned (T-475). */
const TURN_SEED = 't475-turn-27';

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

/** A Proficient caster in a squad at (30, 30) with a deepsilver staff of glowstone, and a goblin held in a cell 8 tiles north. */
function caller(w: TestWorld): EntityId {
  const at = w.index(30, 30, Z);
  const mage = w.spawnDwarf({ at, skills: { runecraft: 10 } });
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [mage] });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: false } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: at });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  w.game.world.entities.add(mage, C.Soldier, { ...w.game.world.entities.get(mage, C.Soldier)!, stance: 'hold' });
  w.game.world.entities.add(mage, C.Rune, { current: 50_000 });
  const staff = w.spawnItem('staff', 'deepsilver', at, 1, 1);
  w.game.world.entities.add(staff, C.Item, { ...w.game.world.entities.get(staff, C.Item)!, stone: registry.table('materials').index('glowstone') });
  const items = w.game.world.services.items!;
  items.attachToCarrier(staff, mage);
  items.setOwner(staff, mage);
  w.game.world.entities.add(mage, C.Equipment, { ...(w.game.world.entities.get(mage, C.Equipment) as Equipment), weapon: staff });
  for (let dx = -1; dx <= 1; dx += 1) for (let dy = -1; dy <= 1; dy += 1) if (dx !== 0 || dy !== 0) w.carve(w.index(30 + dx, 22 + dy, Z), TileKind.Fortification);
  w.spawnCreature('gloam_warrior', w.index(30, 22, Z), 'hostile:gloam');
  return mage;
}

function turnedShade(w: TestWorld): EntityId {
  w.until(() => w.events('SummonTurned').length > 0, 400);
  return w.events('SummonTurned')[0]!['id'] as EntityId;
}

describe('T-497 a turned shade is never spotted by its own summoner', () => {
  it('beside its caster it stays hidden; another dwarf within spot radius sees it', () => {
    const w = arena(TURN_SEED);
    const mage = caller(w);
    const shade = turnedShade(w);
    const entities = w.game.world.entities;
    expect(entities.get(shade, C.Summoned)).toMatchObject({ summonerId: 0, turnedFrom: mage });
    w.step(20);
    expect(entities.get(shade, C.Hostile)).toMatchObject({ role: 'hollow', stealthed: true, spotted: false });
    // A second dwarf comes within 6 tiles with a line to it.
    const p = entities.get(shade, C.Position)!;
    w.spawnDwarf({ at: w.index(p.x, p.y + 4, Z) });
    w.step(2);
    expect(entities.get(shade, C.Hostile)).toMatchObject({ stealthed: false, spotted: true });
  });

  it('the caster it came through survives a save; an answered call carries no turnedFrom', () => {
    const w = arena(TURN_SEED);
    const mage = caller(w);
    const shade = turnedShade(w);
    w.step(1);
    const { game } = roundTrip(w.game);
    expect(game.hash()).toBe(w.game.hash());
    expect(game.world.entities.get(shade, C.Summoned)?.turnedFrom).toBe(mage);

    const other = arena('t497-answered');
    caller(other);
    other.until(() => other.events('SummonCalled').length > 0 || other.events('SummonTurned').length > 0, 400);
    const called = other.events('SummonCalled')[0];
    expect(called).toBeDefined();
    expect(other.game.world.entities.get(called!['id'] as EntityId, C.Summoned)).not.toHaveProperty('turnedFrom');
  });
});
