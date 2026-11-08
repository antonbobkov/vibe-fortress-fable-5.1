import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import { TestWorld } from '../scenarios/test-world';
import { checkInvariants, watchInvariants, type Finding } from '../scenarios/invariants';

function fixture() {
  const w = new TestWorld({ seed: 't176-invariant-controls', world: 'flat-test', embark: 'none' });
  const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
  return { w, dwarf };
}

function scriptedIdle(routine: boolean) {
  const { w, dwarf } = fixture();
  const entities = w.game.world.entities;
  const brain = entities.get(dwarf, C.Brain)!;
  entities.add(dwarf, C.Brain, { ...brain, behavior: 'idle', activity: 'No job' });
  w.game.world.step = () => {
    const tick = w.tick + 1;
    w.game.world.calendar.setTick(tick);
    if (!routine) return;
    const phase = tick % TICKS_PER_DAY;
    if (phase === 300)
      entities.add(dwarf, C.Brain, { ...brain, behavior: 'sleep', activity: 'sleep' });
    if (phase === 600) {
      entities.add(dwarf, C.Brain, { ...brain, behavior: 'idle', activity: 'No job' });
      w.movement.teleport(dwarf, w.index(11, 10, 32));
    }
    if (phase === 1000) w.movement.teleport(dwarf, w.index(10, 10, 32));
  };
  return w;
}

describe('T-176 invariant checker controls', () => {
  it('accepts a fresh world and reports a dead item holder rather than losing that item', () => {
    const { w } = fixture();
    const item = w.spawnItem('pick', 'iron', w.index(12, 10, 32));
    expect(checkInvariants(w.game)).toEqual([]);
    const record = w.game.world.entities.get(item, C.Item)!;
    w.game.world.entities.add(item, C.Item, { ...record, carriedBy: 999999 });
    expect(checkInvariants(w.game).map((f) => f.inv)).toContain('item.carrier-dead');
  });

  it('reports an item listed by a container it does not name', () => {
    const { w } = fixture();
    const barrel = w.spawnItem('barrel', 'oak', w.index(12, 10, 32));
    const food = w.spawnItem('plant_food', 'barley', w.index(13, 10, 32));
    expect(checkInvariants(w.game)).toEqual([]);
    const container = w.game.world.entities.get(barrel, C.Container)!;
    w.game.world.entities.add(barrel, C.Container, { ...container, contents: [food] });
    expect(checkInvariants(w.game).map((f) => f.inv)).toContain('container.content-mismatch');
  });

  it('detects an actually unchanged dwarf after two days', () => {
    const w = scriptedIdle(false);
    const findings: Finding[] = [];
    const stop = watchInvariants(w.game, (rows) => findings.push(...rows));
    w.step(2 * TICKS_PER_DAY);
    stop();
    expect(findings.some((f) => f.inv === 'dwarf.frozen-2d')).toBe(true);
  });

  it('does not mistake a daily returning sleeper and walker for an unchanged dwarf', () => {
    const w = scriptedIdle(true);
    const stop = watchInvariants(w.game, (rows) => expect(rows).toEqual([]));
    w.step(3 * TICKS_PER_DAY);
    stop();
    expect(checkInvariants(w.game)).toEqual([]);
  });

  it('observing a played day changes no simulation hash', () => {
    const a = fixture().w;
    const b = fixture().w;
    const stop = watchInvariants(a.game, (rows) => expect(rows).toEqual([]));
    a.step(TICKS_PER_DAY);
    b.step(TICKS_PER_DAY);
    stop();
    expect(a.hash()).toBe(b.hash());
  });

  it('T-528: a dwarf in retreat is no finding in the tick the alert falls, before a step has run, and is one after', () => {
    const { w, dwarf } = fixture();
    const entities = w.game.world.entities;
    const stop = watchInvariants(w.game, () => {});
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'hearth' }).ok).toBe(true);
    w.step(2);
    const brain = entities.get(dwarf, C.Brain)!;
    entities.add(dwarf, C.Brain, { ...brain, behavior: 'retreat', activity: 'Retreating' });
    const retreating = (): string[] => checkInvariants(w.game).filter((f) => f.inv === 'dwarf.retreat-without-hearth-alert').map((f) => f.inv);
    expect(retreating()).toEqual([]);
    // A script lowers the alert between two steps, as the sweep's last command does: 10 has not stepped since.
    expect(w.game.world.applyCommand({ type: 'SetAlert', level: 'calm' }).ok).toBe(true);
    expect(retreating()).toEqual([]);
    // A step later the alert is down in a tick the dwarf has lived through, so a dwarf still in retreat is a finding.
    w.step(1);
    entities.add(dwarf, C.Brain, { ...entities.get(dwarf, C.Brain)!, behavior: 'retreat', activity: 'Retreating' });
    expect(retreating()).toEqual(['dwarf.retreat-without-hearth-alert']);
    stop();
  });
});
