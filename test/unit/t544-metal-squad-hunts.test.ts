/**
 * T-544: the three-year script hunts a wolf pack or a bear with its mustered squad once the squad is
 * armed in metal (three members with a metal weapon, helm, body armour and greaves), and shelters
 * from it as T-539 does while it is not. In the wild-squad arena three Novices in mail alone lose
 * two or three of themselves to a pack of six; in helm, mail and greaves they beat it.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, armedInMetal, checkFortressDefense, musteredAt, type FortressState } from '../scenarios/three_years_fortress';

const CX = 34;
const CY = 34;
const GATE = { x: CX + 6, y: CY + 6 };

function fortress(squadId: EntityId): FortressState {
  return {
    cx: CX, cy: CY, z: Z, hallZ: HALL_Z, placedIds: {}, economy: { phases: new Set(['gate walls']), specialists: {} },
    gateDoorId: 0, gateDoorPlaced: false, gateDoorId2: 0, gateDoorPlaced2: false,
    squadId, answered: '', lastDangerTick: -1, shutOut: false, eventsRead: 0, warnedUntil: -1, alertSince: -1, wildQuietUntil: -1,
  } as unknown as FortressState;
}

/** A wild animal asleep for good this far south of the gate. */
function sleeping(w: TestWorld, species: string, dy: number): EntityId {
  const id = w.spawnCreature(species, w.index(GATE.x, GATE.y + dy, Z), 'wild');
  const wild = w.game.world.entities.get(id, C.Wild)!;
  w.game.world.entities.add(id, C.Wild, { ...wild, state: 'sleep', stateUntil: w.tick + 100 * TICKS_PER_DAY, hungry: false });
  return id;
}

/**
 * Three soldiers about fourteen tiles from the gate, each with an iron short sword and an iron mail
 * shirt, and, when `full`, an iron helm and greaves; a fourth with a sword and no armour by the gate.
 */
function gateGuard(w: TestWorld, full: boolean): { squad: SquadWithId; soldiers: EntityId[]; bare: EntityId } {
  const ent = w.game.world.entities;
  const kit = (id: EntityId, at: number, armour: readonly string[]): void => {
    const piece = (type: string): EntityId => {
      const item = w.spawnItem(type, 'iron', at, 1, 1);
      w.items.attachToCarrier(item, id);
      w.items.setOwner(item, id);
      return item;
    };
    ent.add(id, C.Equipment, {
      weapon: piece('short_sword'), shield: 0,
      armor: { head: armour.includes('helm') ? piece('helm') : 0, body: armour.includes('mail_shirt') ? piece('mail_shirt') : 0,
        arms: 0, legs: armour.includes('greaves') ? piece('greaves') : 0, feet: 0 },
      clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
    });
  };
  const soldiers = [[-14, 0], [0, -14], [14, -10]].map(([dx, dy]) => {
    const at = w.index(GATE.x + dx!, GATE.y + dy!, Z);
    const id = w.spawnDwarf({ at });
    kit(id, at, full ? ['helm', 'mail_shirt', 'greaves'] : ['mail_shirt']);
    return id;
  });
  const bareAt = w.index(GATE.x + 1, GATE.y - 2, Z);
  const bare = w.spawnDwarf({ at: bareAt });
  kit(bare, bareAt, []);
  expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
  const squad = w.readers.of<CombatReader>('16').squads()[0] as SquadWithId;
  expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [...soldiers, bare] }).ok).toBe(true);
  expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' }).ok).toBe(true);
  return { squad, soldiers, bare };
}

describe('T-544 a squad armed in metal hunts wolves and bears', () => {
  it('a member is armed in metal with a metal weapon, helm, body armour and greaves', () => {
    const w = new TestWorld({ seed: 't544-in-metal', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const full = gateGuard(w, true);
    expect(full.soldiers.map((id) => armedInMetal(w, id))).toEqual([true, true, true]);
    expect(armedInMetal(w, full.bare)).toBe(false);
    const w2 = new TestWorld({ seed: 't544-in-mail', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    expect(gateGuard(w2, false).soldiers.map((id) => armedInMetal(w2, id))).toEqual([false, false, false]);
  }, 60_000);

  for (const species of ['wolf', 'bear']) {
    it(`musters its members armed in metal at the gatehouse stair, then hunts a ${species}`, () => {
      const w = new TestWorld({ seed: `t544-hunt-${species}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
      const { squad, soldiers } = gateGuard(w, true);
      const combat = w.readers.of<CombatReader>('16');
      const state = fortress(squad.id);
      const animal = sleeping(w, species, 9);
      const post = w.index(GATE.x, GATE.y, Z);
      w.step(1);

      checkFortressDefense(w, state);
      expect(w.game.world.fortress.alert).toBe('hearth');
      const orders = (): string[] => (combat.squad(squad.id)?.orders ?? []).map((o) => o.kind);
      expect(orders(), 'it musters first: a station and no kill').toEqual(['station']);
      let killAt = -1;
      for (let t = 0; t < 600 && killAt < 0; t += 20) {
        w.step(20);
        const before = musteredAt(w, state, post, true);
        checkFortressDefense(w, state);
        if (orders().includes('kill')) {
          killAt = w.tick;
          expect(before, 'the kill is ordered only once three members armed in metal stand at the post').toBe(true);
        }
      }
      expect(killAt, `the mustered squad sets out after the ${species}`).toBeGreaterThan(0);
      expect((combat.squad(squad.id)?.orders ?? [])[0]).toEqual({ kind: 'kill', targetId: animal });
      expect(combat.squad(squad.id)?.members, 'the member with no armour stays behind').toEqual(soldiers);
    }, 60_000);
  }

  it('shelters from a wolf while its soldiers wear mail alone', () => {
    const w = new TestWorld({ seed: 't544-mail-shelters', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const { squad } = gateGuard(w, false);
    const combat = w.readers.of<CombatReader>('16');
    const state = fortress(squad.id);
    sleeping(w, 'wolf', 9);
    w.step(1);
    for (let t = 0; t < 400; t += 20) {
      checkFortressDefense(w, state);
      expect(w.game.world.fortress.alert).toBe('hearth');
      expect((combat.squad(squad.id)?.orders ?? []).map((o) => o.kind), 'no kill order for a wolf').toEqual(['station']);
      w.step(20);
    }
  }, 60_000);
});
