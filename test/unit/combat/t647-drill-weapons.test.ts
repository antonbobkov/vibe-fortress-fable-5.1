/**
 * T-647: in the sweep's seed p4-6 at shift 150 a gloam archer stood in the barracks for ten days,
 * and the squad at drill landed 404 blows on it for 0 damage. The squad preferred swords and had
 * none: each soldier held a wooden training sword, which scores above a real weapon of another
 * class (the class's bonus), and a training weapon does 0 damage (16 § Training). 16 § Training
 * now: a training weapon is for drill. A soldier on duty who holds one with a hostile in hand takes
 * up a real weapon from stock, any class, and keeps it while it holds a target; with none free it
 * fights with the wooden one, and the Military panel's armed line says it does no harm.
 */
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C } from '@core/components';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { armedLines } from '@ui/panels/military';
import type { PanelContext } from '@ui/panels/context';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

/** A squad of one preferring swords, on duty, its soldier holding the training sword it was given. */
function drill(seed: string, spear: boolean) {
  const w = new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const soldier = w.spawnDwarf({ at: w.index(30, 30, Z), name: 'Liv Hammerfall', skills: { sword: 4, spear: 4 } });
  for (const labor of ['mining', 'woodcutting']) w.game.world.applyCommand({ type: 'SetLabor', dwarfId: soldier, labor, on: false });
  const wooden = w.spawnItem('training_sword', 'oak', w.index(31, 30, Z));
  const real = spear ? w.spawnItem('spear', 'iron', w.index(32, 30, Z)) : 0;
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Swords' });
  const combat = w.readers.of<CombatReader>('16');
  const squad = combat.squads()[0] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: squad.id, equipment: { weaponClass: 'sword' } });
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [soldier] });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'active' });
  const weapon = (): EntityId => w.game.world.entities.get(soldier, C.Equipment)?.weapon ?? 0;
  return { w, soldier, wooden, real, squad, combat, weapon };
}

/** Every blow the soldier lands, with its damage. */
function blows(w: TestWorld, soldier: EntityId): { outcome: string; amount: number }[] {
  const out: { outcome: string; amount: number }[] = [];
  w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'AttackResolved' && e['attackerId'] === soldier) out.push({ outcome: String(e['outcome']), amount: Number(e['amount'] ?? 0) });
    }
  });
  return out;
}

/** A tick that creates an item: every squad's kit is looked at (16 § Equipment). */
function refresh(w: TestWorld): void {
  w.spawnItem('bar', 'iron', w.index(10, 10, Z));
  w.step(1);
}

function panel(w: TestWorld): PanelContext {
  return { readers: w.readers, registry: w.game.registry, strings: new Strings(w.game.registry) } as unknown as PanelContext;
}

describe('T-647 a soldier holding a training weapon meets a raider', () => {
  it('drills with the wooden sword of its squad\'s class over a real spear', () => {
    const { wooden, weapon } = drill('t647-prefer', true);
    expect(weapon(), 'the class bonus puts a training sword above an iron spear').toBe(wooden);
  });

  it('takes up the real spear when it targets a raider, and harms it', () => {
    const { w, soldier, wooden, real, combat, weapon } = drill('t647-takes-up', true);
    const landed = blows(w, soldier);
    const raider = w.spawnCreature('gloam_archer', w.index(30, 33, Z), 'hostile:gloam');
    w.step(2);
    expect(combat.targetOf(soldier), 'the soldier on duty takes the raider').toBe(raider);
    w.step(1);
    expect(weapon(), 'and takes up the iron spear').toBe(real);
    expect(w.game.world.entities.get(wooden, C.Item)?.carriedBy, 'the wooden sword is put down').toBe(0);
    // A look at its kit during the fight does not hand the wooden sword back.
    refresh(w);
    expect(weapon()).toBe(real);
    for (let k = 0; k < 400 && w.game.world.entities.alive(raider) && !landed.some((b) => b.amount > 0); k += 1) w.step(1);
    expect(landed.some((b) => b.outcome === 'hit' && b.amount > 0), 'a blow with the spear does harm').toBe(true);
  });

  it('with no real weapon in stock fights with the wooden one, and the Military panel says it does no harm', () => {
    const { w, soldier, wooden, squad, combat, weapon } = drill('t647-wooden', false);
    const landed = blows(w, soldier);
    expect(armedLines(panel(w), combat.squads().find((s) => s.id === squad.id)!)?.text).toBe('Armed 1 of 1 (1 wooden)');
    const raider = w.spawnCreature('gloam_archer', w.index(30, 33, Z), 'hostile:gloam');
    w.step(2);
    expect(combat.targetOf(soldier)).toBe(raider);
    w.step(200);
    expect(weapon(), 'it keeps the wooden sword: there is nothing else').toBe(wooden);
    expect(landed.filter((b) => b.outcome === 'hit').length, 'it lands blows').toBeGreaterThan(0);
    expect(landed.every((b) => b.amount === 0), 'all for nothing').toBe(true);
    const line = armedLines(panel(w), combat.squads().find((s) => s.id === squad.id)!);
    expect(line?.text).toBe('Armed 1 of 1 (1 wooden) · wooden weapon, no harm done: Liv H.');
    expect(line?.alert).toBe(true);
  });

  it('after the fight a look at its kit hands back the wooden sword for drill', () => {
    const { w, soldier, wooden, real, combat, weapon } = drill('t647-after', true);
    const raider = w.spawnCreature('gloam_archer', w.index(30, 33, Z), 'hostile:gloam');
    w.step(3);
    expect(weapon()).toBe(real);
    w.game.world.entities.destroy(raider);
    w.step(2);
    expect(combat.targetOf(soldier)).toBe(0);
    refresh(w);
    expect(weapon(), 'drill with wood, fight with iron').toBe(wooden);
  });
});
