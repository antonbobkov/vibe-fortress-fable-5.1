import { describe, expect, it } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_HOUR } from '@core/constants';
import type { GameEvent } from '@core/events';
import { advanceSulkCounter, currentValue, eventPredicate, moodValue, NEED_PRESSURE_THOUGHTS, personalityMultiplier, productivity, sulkKind, tierOf, triggerEvent, type MoraleReader, type ThoughtDef } from '@systems/morale';
import { TestWorld } from '../../scenarios/test-world';
import type { BuildingsSystem } from '@systems/buildings';

const registry = contentRegistry();
const thoughts = registry.table<ThoughtDef>('thoughts');

/** Independent event fixture for each content row; abbreviated families are expanded here. */
function fixture(def: ThoughtDef): GameEvent | null {
  const type = triggerEvent(def);
  if (type === null) return null;
  const e: Record<string, unknown> = { type, id: 1, a: 1, b: 2, crafterId: 1, finderId: 1, farmerId: 1,
    killerId: 1, ownerId: 1, roomTier: 3, ownBed: true, onFloor: false, restored: 20, kind: 'meal', mealType: 'easy_meal',
    stage: 0, atTable: true, outdoors: false, quality: 3, tier: 3, oldTier: 2, roomType: 'hearth_hall',
    weather: 'rain', level: 5, jobType: 'dig', batchSize: 50, child: true, hospitalTier: 0,
    severity: 'serious', outcome: 'repelled', tombTier: 'none', hostile: true, faction: 'fortress',
    partnerId: 2, targetTile: 100, itemId: 10, species: registry.table('creatures').index('dwarf') };
  const id = def.id;
  if (id === 'ate_fine_meal') e.mealType = 'fine_meal';
  if (id === 'ate_lavish_meal') e.mealType = 'lavish_meal';
  if (id === 'ate_raw_food') e.kind = 'raw';
  if (id === 'ate_stale_food') e.stage = 1;
  if (id.startsWith('ate_in_')) e.roomTier = { ate_in_decent_hall: 2, ate_in_fine_hall: 3, ate_in_grand_hall: 4, ate_in_royal_hall: 5 }[id];
  if (id === 'drank_ale' || id === 'drank_fine_drink') e.material = registry.table('materials').index(id === 'drank_ale' ? 'ale' : 'bellwine');
  if (id === 'drank_from_puddle' || id === 'slept_outdoors') e.outdoors = true;
  if (id.startsWith('slept_in_') && id !== 'slept_in_shared_bed_room') e.roomTier = { slept_in_modest_room: 1,
    slept_in_decent_room: 2, slept_in_fine_room: 3, slept_in_grand_room: 4, slept_in_royal_room: 5 }[id];
  if (id === 'slept_in_shared_bed_room') e.ownBed = false;
  if (id === 'slept_on_floor') e.onFloor = true;
  if (id === 'talked_with_friend') e.friends = true;
  if (id === 'talked_with_someone') e.friends = false;
  if (id === 'caught_in_storm') e.weather = 'storm';
  if (id === 'snowed_on') e.weather = 'snow';
  if (id === 'bitter_cold') e.weather = 'cold_snap';
  if (id === 'sweltering') e.weather = 'heatwave';
  if (id === 'masterwork_lost') e.quality = 5;
  if (id === 'argued') e.kind = 'argue';
  if (id === 'wept') e.kind = 'weep';
  if (id === 'hoarded') e.kind = 'hoard';
  if (id === 'attuned') e.mishap = '';
  if (id === 'singed') e.kind = 'singed';
  return e as GameEvent;
}

describe('T-M4-13 morale thoughts and mood', () => {
  it('matches every authored thought row to its event fixture or standing condition', () => {
    for (const id of thoughts.ids()) {
      const def = thoughts.byId(id)!;
      const event = fixture(def);
      if (event === null) {
        expect(def.decay === 'standing' || def.value === 0, id).toBe(true);
        continue;
      }
      expect(eventPredicate(def, event, registry), id).toBe(true);
      expect(eventPredicate(def, { ...event, type: 'HourPassed' }, registry), id).toBe(false);
    }
    expect(thoughts.ids().length).toBeGreaterThan(70);
  });

  it('decays linear and halflife thoughts, refreshing capped rows', () => {
    const linear = thoughts.byId('made_masterwork')!;
    const half = thoughts.byId('friend_died')!;
    expect(currentValue({ thought: 0, startTick: 0, baseValue: 15 }, linear, 84 * TICKS_PER_HOUR)).toBe(7.5);
    expect(currentValue({ thought: 0, startTick: 0, baseValue: -16 }, half, 112 * TICKS_PER_HOUR)).toBe(-8);
    expect(currentValue({ thought: 0, startTick: 0, baseValue: 15 }, linear, 168 * TICKS_PER_HOUR)).toBe(0);
    const w = new TestWorld({ seed: 'morale-caps', world: 'flat-test', embark: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    w.step(1);
    for (let i = 0; i < 6; i += 1) w.game.world.emit({ type: 'SawMasterwork', id: dwarf, itemId: i + 1 });
    w.step(1);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).filter((t) => t.id === 'saw_masterwork')).toHaveLength(3);
  });

  it('scales stoic negatives and reads mood productivity through 10 and 11', () => {
    const stoic = registry.table('personality').index('stoic');
    const sad = thoughts.byId('dwarf_died')!;
    expect(personalityMultiplier(registry, [stoic], sad, -5)).toBe(0.5);
    expect(tierOf(19)).toBe(0);
    expect(productivity(0)).toBe(80);
    expect(productivity(4)).toBe(115);
    const w = new TestWorld({ seed: 'morale-work', world: 'flat-test', embark: 'none' });
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const victim = w.spawnDwarf({ at: w.index(11, 10, 32) });
    const traits = w.game.world.entities.get(dwarf, C.Personality)!;
    w.game.world.entities.add(dwarf, C.Personality, { traits: [stoic, traits.traits[1], traits.traits[2]] });
    w.step(1);
    const hp = w.game.world.entities.get(victim, C.Body)!.parts[1]!.maxHp;
    w.game.world.emit({ type: 'DamageDealt', defenderId: victim, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
    w.until(() => w.events('CreatureDied').some((e) => e['id'] === victim), 5);
    expect(w.readers.of<MoraleReader>('15').thoughts(dwarf).some((t) => t.id === 'dwarf_died' && t.value < 0)).toBe(true);
    const reader = w.readers.of<{ productivity(id: number): number }>('10');
    expect(reader.productivity(dwarf)).toBe(w.readers.of<MoraleReader>('15').productivity(dwarf));
  });

  it('F-02: caps, need pressure and the needs-met floor', () => {
    expect(moodValue([{ value: 100 }], 0, 0)).toBe(95);
    expect(moodValue([{ value: -100 }], 0, 0)).toBe(20);
    expect(moodValue([{ value: -100 }], 0, -6)).toBe(20);                                   // the floor (was 14, C-006)
    expect(moodValue([{ value: -10, need: true }], 0, 0)).toBe(35);                        // counted twice
    expect(moodValue([{ value: -10, need: true }, { value: -10, need: true }, { value: -100 }], 0, 0)).toBe(0);
    expect(moodValue([{ value: -3.6, need: true }, { value: -100 }], 0, -6)).toBe(17);     // max(11, 20 − 3)
    expect(moodValue([{ value: -0.4, need: true }, { value: -100 }], 0, -6)).toBe(20);     // floor(0.4) = 0
    expect(moodValue([], 2, 0)).toBe(59);
  });

  it('F-02: only hungry, thirsty, tired and lonely are need pressure', () => {
    expect(Array.from(NEED_PRESSURE_THOUGHTS).sort()).toEqual(['hungry', 'lonely', 'thirsty', 'tired']);
    for (const id of NEED_PRESSURE_THOUGHTS) {
      const def = thoughts.byId(id);
      expect(def).toBeDefined();
      expect(def?.decay).toBe('standing');
    }
  });

  it('uses the documented first-match sulk trait order', () => {
    const p = registry.table('personality');
    expect(sulkKind(registry, [p.index('restless'), p.index('gregarious'), p.index('greedy')])).toBe('day_off');
    expect(sulkKind(registry, [p.index('gregarious'), p.index('sensitive')])).toBe('argue');
    expect(sulkKind(registry, [p.index('sensitive')])).toBe('weep');
    expect(sulkKind(registry, [p.index('greedy')])).toBe('hoard');
    expect(sulkKind(registry, [])).toBe('break');
    let days = 0;
    let happened = 0;
    for (let day = 1; day <= 15; day += 1) {
      const result = advanceSulkCounter(days, true);
      days = result.days;
      if (result.sulk) happened += 1;
      if (day < 7) expect(happened).toBe(0);
      if (day < 14) expect(happened).toBeLessThanOrEqual(1);
    }
    expect(happened).toBe(2);
    expect(advanceSulkCounter(2, false)).toEqual({ days: 1, sulk: false });
  });

  it('adds both argument grudges and removes broken common furniture in 14’s tick', () => {
    const w = new TestWorld({ seed: 'morale-sulk-effects', world: 'flat-test', embark: 'none' });
    const a = w.spawnDwarf({ at: w.index(10, 10, 32) });
    const b = w.spawnDwarf({ at: w.index(11, 10, 32) });
    const chair = w.build('chair', w.index(12, 10, 32));
    const item = w.readers.of<{ get(id: number): { itemId: number } | undefined }>('14').get(chair)?.itemId ?? 0;
    w.step(1);
    w.game.world.emit({ type: 'SulkHappened', id: a, kind: 'argue', partnerId: b });
    w.game.world.emit({ type: 'SulkHappened', id: a, kind: 'break', buildingId: chair });
    w.step(1);
    expect(w.game.world.entities.get(a, C.Relationships)?.grudges.some((g) => g.id === b)).toBe(true);
    expect(w.game.world.entities.get(b, C.Relationships)?.grudges.some((g) => g.id === a)).toBe(true);
    expect(w.readers.of<MoraleReader>('15').thoughts(a).some((t) => t.id === 'argued')).toBe(true);
    expect((w.game.world.scheduler.byId('14') as BuildingsSystem).serialize().brokenFurniture).toContain(chair);
    expect(w.game.world.entities.alive(chair)).toBe(true);
    w.step(11);
    expect(w.game.world.entities.alive(chair)).toBe(false);
    expect(w.game.world.entities.alive(item)).toBe(false);
  });
});
