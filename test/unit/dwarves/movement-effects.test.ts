import { describe, it, expect } from 'vitest';
import { TICKS_PER_HOUR } from '@core/constants';
import type { Brain } from '@core/components';
import type { GameEvent } from '@core/events';
import { MIST_THOUGHT_COOLDOWN } from '@systems/dwarves/constants';
import { movementEffects, type MoveFacts } from '@systems/dwarves/movement-effects';
import { TestWorld } from '../../scenarios/test-world';
import { digWaterfall } from '../../scenarios/waterfall';

const brain: Brain = { behavior: 'idle', behaviorUntil: 0, targetTile: -1, activity: '', lastMistTick: 0, lastOutdoorThoughtHour: -1, daysUnderground: 0 };

function facts(over: Partial<MoveFacts>): MoveFacts {
  return { isMisty: () => false, nearSpring: () => false, isOutdoor: () => false, weather: () => null, ...over };
}

describe('T-M3-07 movement side effects (10 § Movement)', () => {
  it('DwarfFeltMist once per MIST_THOUGHT_COOLDOWN', () => {
    const out: GameEvent[] = [];
    const f = facts({ isMisty: () => true });
    let b = movementEffects(1, 5, 6, 100, brain, f, (e) => out.push(e));
    expect(out.map((e) => e.type)).toEqual(['DwarfFeltMist']);
    b = movementEffects(1, 6, 7, 100 + MIST_THOUGHT_COOLDOWN - 1, b, f, (e) => out.push(e));
    expect(out.length).toBe(1);
    movementEffects(1, 7, 8, 100 + MIST_THOUGHT_COOLDOWN, b, f, (e) => out.push(e));
    expect(out.length).toBe(2);
  });

  it('DwarfOutdoorsIn { weather } once per hour, only outdoors in rain, storm, snow, heatwave or cold snap', () => {
    const out: GameEvent[] = [];
    let weather = 'clear';
    const f = facts({ isOutdoor: (i) => i !== 99, weather: () => weather });
    let b = movementEffects(1, 5, 6, 10, brain, f, (e) => out.push(e));
    expect(out).toEqual([]);
    weather = 'rain';
    b = movementEffects(1, 6, 99, 20, b, f, (e) => out.push(e));
    expect(out).toEqual([]);
    b = movementEffects(1, 99, 7, 30, b, f, (e) => out.push(e));
    expect(out).toEqual([{ type: 'DwarfOutdoorsIn', id: 1, weather: 'rain' }]);
    b = movementEffects(1, 7, 8, TICKS_PER_HOUR - 1, b, f, (e) => out.push(e));
    expect(out.length).toBe(1);
    weather = 'cold_snap';
    movementEffects(1, 8, 9, TICKS_PER_HOUR, b, f, (e) => out.push(e));
    expect(out[1]).toEqual({ type: 'DwarfOutdoorsIn', id: 1, weather: 'cold_snap' });
  });

  it('DwarfNearSpring on stepping into a warm spring’s neighbourhood', () => {
    const out: GameEvent[] = [];
    const f = facts({ nearSpring: (i) => i >= 10 });
    movementEffects(1, 5, 10, 1, brain, f, (e) => out.push(e));
    movementEffects(1, 10, 11, 2, brain, f, (e) => out.push(e));
    movementEffects(1, 11, 5, 3, brain, f, (e) => out.push(e));
    expect(out.map((e) => e.type)).toEqual(['DwarfNearSpring']);
  });

  it('a dwarf walking through a waterfall’s mist emits DwarfFeltMist through 10’s EntitiesMoved hook', () => {
    const w = new TestWorld({ seed: 'mist-dwarf', world: 'flat-test' });
    const fall = digWaterfall(w, 30, 40, 31, 10, 3);
    w.until((ww) => ww.events('MistProduced').length > 0, 600);
    const x = w.map.xOf(fall.landing);
    const y = w.map.yOf(fall.landing);
    const z = w.map.zOf(fall.landing);
    const id = w.spawnDwarf({ at: w.index(x - 1, y - 1, z) });
    w.movement.teleport(id, w.index(x + 1, y - 1, z));
    w.step(2);
    expect(w.events('DwarfFeltMist').map((e) => e['id'])).toContain(id);
  });
});
