/**
 * T-539: since a struck wolf fights back (T-538), wolves held the three-year script's hearth alert
 * for weeks. On seed `three-years-p2-6` at shift 150 the squad's soldiers walked to a pack one at a
 * time from wherever the alert found them, and three died fighting it alone in nine days; the squad
 * was left with two weapons, did not hunt, and two hungry wolves wandering in and out of sight
 * raised 46 alerts in 40 days, each lowered before T-387's half day, so the dining hall was never
 * dug. The script now counts T-387's half day from the first alert of an episode, and an armed
 * squad musters at the gatehouse stair before it sets out after wild animals.
 */
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat';
import { TestWorld } from '../scenarios/test-world';
import { HALL_Z, Z, checkFortressDefense, musteredAt, type FortressState } from '../scenarios/three_years_fortress';

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

/** A wolf asleep for good this far south of the gate. */
function sleepingWolf(w: TestWorld, dy: number): EntityId {
  const wolf = w.spawnCreature('wolf', w.index(GATE.x, GATE.y + dy, Z), 'wild');
  const wild = w.game.world.entities.get(wolf, C.Wild)!;
  w.game.world.entities.add(wolf, C.Wild, { ...wild, state: 'sleep', stateUntil: w.tick + 100 * TICKS_PER_DAY, hungry: false });
  return wolf;
}

describe('T-539 the three-year script answers a wolf pack as one episode, and musters before it hunts', () => {
  it('lifts the alerts of one episode after half a day in all, though each was lowered sooner', () => {
    const w = new TestWorld({ seed: 't539-episode', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    w.spawnDwarf({ at: w.index(GATE.x - 4, GATE.y + 4, Z) });
    const state = fortress(0); // no squad: nobody hunts the wolves
    const alert = (): string => w.game.world.fortress.alert;
    let raised = 0;
    for (let round = 0; round < 4; round += 1) {
      const wolf = sleepingWolf(w, 6);
      w.step(1);
      checkFortressDefense(w, state);
      if (alert() === 'hearth') raised += 1;
      else break;
      // The wolf wanders out of sight: the alert is lowered after the all-clear, sooner than half a day.
      w.step(100);
      w.game.world.entities.destroy(wolf);
      w.step(320);
      checkFortressDefense(w, state);
      expect(alert(), `round ${round}: the alert is lowered`).toBe('calm');
      w.step(40);
    }
    // Each alert stood ~420 ticks, under T-387's 600; the third comes past the episode's half day.
    expect(raised, 'two alerts, then the episode is past half a day').toBe(2);
    expect(state.wildQuietUntil, 'no alert for wild animals for a day').toBeGreaterThan(w.tick + TICKS_PER_DAY - 100);
    w.step(20);
    checkFortressDefense(w, state);
    expect(alert()).toBe('calm');
  }, 60_000);

  it('musters its armed members at the gatehouse stair before it orders the kill, and leaves the unarmed behind', () => {
    const w = new TestWorld({ seed: 't539-muster', world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
    const items = w.game.registry.table('items');
    const iron = w.game.registry.table('materials').index('iron');
    // Three armed soldiers far apart, each about fourteen tiles from the gate.
    const soldiers = [[-14, 0], [0, -14], [14, -10]].map(([dx, dy]) => {
      const at = w.index(GATE.x + dx!, GATE.y + dy!, Z);
      const id = w.spawnDwarf({ at });
      const spear = w.spawnItem(items.index('spear'), iron, at, 1, 1);
      // Held, so that no other member claims it.
      w.game.world.entities.add(spear, C.Item, { ...w.game.world.entities.get(spear, C.Item)!, carriedBy: id });
      w.game.world.entities.add(id, C.Equipment, {
        weapon: spear, shield: 0, armor: { head: 0, body: 0, arms: 0, legs: 0, feet: 0 },
        clothing: { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
      });
      return id;
    });
    // A fourth member with no weapon, by the gate.
    const unarmed = w.spawnDwarf({ at: w.index(GATE.x + 1, GATE.y - 2, Z) });
    expect(w.game.world.applyCommand({ type: 'CreateSquad', name: 'Gate Guard' }).ok).toBe(true);
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squads()[0] as SquadWithId;
    expect(w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: squad.id, members: [...soldiers, unarmed] }).ok).toBe(true);
    expect(w.game.world.applyCommand({ type: 'SetSquadMode', squadId: squad.id, mode: 'off' }).ok).toBe(true);
    const state = fortress(squad.id);
    const wolf = sleepingWolf(w, 9);
    const post = w.index(GATE.x, GATE.y, Z);
    w.step(1);

    checkFortressDefense(w, state);
    expect(w.game.world.fortress.alert).toBe('hearth');
    const orders = (): string[] => (combat.squad(squad.id)?.orders ?? []).map((o) => o.kind);
    expect(orders(), 'it musters first: a station and no kill').toEqual(['station']);

    let killAt = -1;
    for (let t = 0; t < 600 && killAt < 0; t += 20) {
      w.step(20);
      const before = musteredAt(w, state, post);
      checkFortressDefense(w, state);
      if (orders().includes('kill')) {
        killAt = w.tick;
        expect(before, 'the kill is ordered only once three armed members stand at the post').toBe(true);
      }
    }
    expect(killAt, 'the mustered squad sets out after the wolf').toBeGreaterThan(0);
    expect((combat.squad(squad.id)?.orders ?? [])[0]).toEqual({ kind: 'kill', targetId: wolf });
    expect(combat.squad(squad.id)?.members, 'the member with no weapon stays behind').toEqual(soldiers);
  }, 60_000);
});
