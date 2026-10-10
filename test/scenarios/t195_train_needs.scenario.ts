/**
 * T-195: A squad left in `train` mode starves.
 * Small reproduction scenario: seven dwarves (4 in a train squad, 3 civilians),
 * food and drink in a stockpile a short walk from barracks, beds, table and chairs.
 * Surface wildlife is disabled: wild animals are not part of this test.
 */

import { expect } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, ItemFlag } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';
import type { Scenario } from './runner';
import type { TestWorld } from './test-world';

interface DwarfSample {
  hunger: number;
  thirst: number;
  rest: number;
  behavior: string;
  activity: string;
  onDuty: boolean;
}

interface ThresholdEvent {
  threshold: number;
  tick: number;
  dwarfId: number;
  hunger: number;
  behavior: string;
  activity: string;
  foodReachable: boolean;
  freeMealCount: number;
  next600Ticks: { tick: number; behavior: string; activity: string; hunger: number }[];
}

const scenario: Scenario = {
  id: 't195_train_needs',
  milestone: 8,
  seed: 't195-train-needs',
  world: 'flat-test',
  embark: 'none',
  // Wild animals are not part of this test; isolate from natural arrivals
  surfaceWildlife: 'none',
  timeoutMs: 120_000,
  run: (w: TestWorld) => {
    const Z = FLAT_TEST_SURFACE_Z;

    // 1. Barracks zone (4x4)
    const barracksTiles: number[] = [];
    for (let x = 20; x <= 23; x++) {
      for (let y = 20; y <= 23; y++) {
        barracksTiles.push(w.index(x, y, Z));
      }
    }
    const barracksZoneId = w.zone('barracks', barracksTiles);

    // 2. Stockpile a short walk from barracks (x: 26..28, y: 20..22)
    const stockpileTiles: number[] = [];
    for (let x = 26; x <= 28; x++) {
      for (let y = 20; y <= 22; y++) {
        stockpileTiles.push(w.index(x, y, Z));
      }
    }
    w.zone('stockpile', stockpileTiles);

    // Plenty of prepared meals and drink in stockpile
    const foodTile = stockpileTiles[0]!;
    const drinkTile = stockpileTiles[1]!;
    const weaponTile = stockpileTiles[2]!;

    // 100 prepared meals in barrels to prevent rotting over 30 days, plus loose meals
    for (let i = 0; i < 5; i++) {
      const barrel = w.spawnItem('barrel', 'pine', foodTile);
      w.spawnItem('easy_meal', 'dimcap', { containerId: barrel }, 20);
    }
    w.spawnItem('easy_meal', 'dimcap', foodTile, 50);

    // 5 barrels with 20 ale each = 100 ale
    for (let i = 0; i < 5; i++) {
      const barrel = w.spawnItem('barrel', 'pine', drinkTile);
      w.spawnItem('drink', 'ale', { containerId: barrel }, 20);
    }
    // Also loose drink
    w.spawnItem('drink', 'ale', drinkTile, 50);

    // Weapons from spawned stock (training swords of oak)
    for (let i = 0; i < 6; i++) {
      w.spawnItem('training_sword', 'oak', weaponTile);
    }

    // 3. Beds for dwarves (x: 20..26, y: 18)
    for (let i = 0; i < 7; i++) {
      w.build('bed', w.index(20 + i, 18, Z), 'oak');
    }

    // 4. A table and chairs
    w.build('table', w.index(22, 16, Z), 'oak');
    w.build('chair', w.index(21, 16, Z), 'oak');
    w.build('chair', w.index(23, 16, Z), 'oak');
    w.build('chair', w.index(22, 15, Z), 'oak');
    w.build('chair', w.index(22, 17, Z), 'oak');

    // 5. Seven dwarves
    const dwarves: number[] = [];
    for (let i = 0; i < 7; i++) {
      const atTile = w.index(20 + (i % 4), 20 + Math.floor(i / 4), Z);
      dwarves.push(w.spawnDwarf({ at: atTile, name: `Dwarf_${i}` }));
    }
    const soldiers = dwarves.slice(0, 4);
    const civilians = dwarves.slice(4);

    // Civilians with ordinary labors
    for (const c of civilians) {
      w.setLabor(c, 'hauling', true);
      w.setLabor(c, 'mining', true);
      w.setLabor(c, 'masonry', true);
    }

    // Soldiers: squad with leader, assigned barracks, mode train from day 1
    for (const s of soldiers) {
      w.setLabor(s, 'woodcutting', false);
      w.setLabor(s, 'mining', false);
    }

    w.game.world.applyCommand({ type: 'CreateSquad', name: 'Training Squad', leaderId: soldiers[0] });
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squads().find((sq) => sq.name === 'Training Squad');
    expect(squad).toBeDefined();
    const squadId = squad!.id;

    w.game.world.applyCommand({ type: 'SetSquadMembers', squadId, members: soldiers });
    w.game.world.applyCommand({ type: 'SetSquadLeader', squadId, leaderId: soldiers[0]! });
    w.game.world.applyCommand({
      type: 'SetZoneSetting',
      zoneId: barracksZoneId,
      key: 'squad',
      value: squadId,
    });
    w.game.world.applyCommand({
      type: 'SetSquadEquipment',
      squadId,
      equipment: { weaponClass: 'sword' },
    });
    w.game.world.applyCommand({
      type: 'SetSquadMode',
      squadId,
      mode: 'train',
    });

    const swordSkillIdx = w.game.registry.table('skills').index('sword');
    const initialSwordXp: Record<number, number> = {};
    for (const s of soldiers) {
      initialSwordXp[s] = w.game.world.entities.get(s, C.Skills)?.xp[swordSkillIdx] ?? 0;
    }

    // Recording data structures
    const deathInfo = new Map<number, { tick: number; cause: string }>();
    const maxSwordXp: Record<number, number> = {};
    for (const s of soldiers) maxSwordXp[s] = initialSwordXp[s] ?? 0;

    w.game.world.onEvents((events) => {
      for (const e of events) {
        if (e.type === 'CreatureDied') {
          deathInfo.set(e['id'] as number, { tick: w.tick, cause: e['cause'] as string });
        }
      }
    });

    const samples: Map<number, DwarfSample[]> = new Map();
    for (const id of dwarves) samples.set(id, []);

    // For first soldier that goes hungry: track 50, 75, 90
    let trackedSoldierId: number | null = null;
    const thresholdEvents: Map<number, ThresholdEvent> = new Map(); // key = 50, 75, 90
    const trackingNext600: { threshold: number; remaining: number }[] = [];

    const isFoodReachable = (dwarfId: number): boolean => {
      const pos = w.game.world.entities.get(dwarfId, C.Position);
      if (!pos) return false;
      const from = w.map.index(pos.x, pos.y, pos.z);
      const items = w.readers.of<ItemsReader>('13');
      const found =
        items.findItem({ edible: true, category: 'food/meal' }, from, 'walker', { reservable: true }) ||
        items.findItem({ edible: true }, from, 'walker', { reservable: true });
      return found !== 0;
    };

    const countFreeMeals = (): number => {
      let count = 0;
      const entities = w.game.world.entities;
      const itemsTable = w.game.registry.table<{ id: string; category?: string }>('items');
      for (const id of entities.with(C.Item)) {
        const item = entities.get(id, C.Item);
        if (!item) continue;
        const def = itemsTable.byIndex(item.type);
        if (def && (def.category === 'food/meal' || def.id === 'easy_meal')) {
          if ((item.flags & ItemFlag.Forbidden) === 0 && (item.flags & ItemFlag.Reserved) === 0 && item.reservedBy === 0) {
            count += item.count;
          }
        }
      }
      return count;
    };

    // Run 30 days = 30 * TICKS_PER_DAY = 36000 ticks
    const totalTicks = 30 * TICKS_PER_DAY;

    for (let t = 0; t < totalTicks; t++) {
      // Step 1 tick
      w.step(1);
      const currentTick = w.tick;

      // Track soldier hunger thresholds
      if (trackedSoldierId === null) {
        for (const s of soldiers) {
          const needs = w.game.world.entities.get(s, C.Needs);
          if (needs && needs.hunger > 50) {
            trackedSoldierId = s;
            break;
          }
        }
      }

      if (trackedSoldierId !== null) {
        const needs = w.game.world.entities.get(trackedSoldierId, C.Needs);
        const brain = w.game.world.entities.get(trackedSoldierId, C.Brain);
        const h = needs?.hunger ?? 0;

        for (const thresh of [50, 75, 90]) {
          if (h >= thresh && !thresholdEvents.has(thresh)) {
            const ev: ThresholdEvent = {
              threshold: thresh,
              tick: currentTick,
              dwarfId: trackedSoldierId,
              hunger: h,
              behavior: brain?.behavior ?? 'unknown',
              activity: brain?.activity ?? 'unknown',
              foodReachable: isFoodReachable(trackedSoldierId),
              freeMealCount: countFreeMeals(),
              next600Ticks: [],
            };
            thresholdEvents.set(thresh, ev);
            trackingNext600.push({ threshold: thresh, remaining: 600 });
          }
        }

        // Record next 600 ticks for active thresholds
        for (let i = trackingNext600.length - 1; i >= 0; i--) {
          const tracker = trackingNext600[i]!;
          const ev = thresholdEvents.get(tracker.threshold);
          if (ev) {
            ev.next600Ticks.push({
              tick: currentTick,
              behavior: brain?.behavior ?? 'unknown',
              activity: brain?.activity ?? 'unknown',
              hunger: h,
            });
          }
          tracker.remaining--;
          if (tracker.remaining <= 0) {
            trackingNext600.splice(i, 1);
          }
        }
      }

      // Every 100 ticks record samples
      if (currentTick % 100 === 0) {
        for (const id of dwarves) {
          const needs = w.game.world.entities.get(id, C.Needs);
          const brain = w.game.world.entities.get(id, C.Brain);
          const soldier = w.game.world.entities.get(id, C.Soldier);
          const sample: DwarfSample = {
            hunger: needs?.hunger ?? 0,
            thirst: needs?.thirst ?? 0,
            rest: needs?.rest ?? 0,
            behavior: brain?.behavior ?? 'unknown',
            activity: brain?.activity ?? 'unknown',
            onDuty: soldier?.onDuty ?? false,
          };
          samples.get(id)!.push(sample);

          if (soldiers.includes(id)) {
            const xp = w.game.world.entities.get(id, C.Skills)?.xp[swordSkillIdx] ?? 0;
            if (xp > (maxSwordXp[id] ?? 0)) maxSwordXp[id] = xp;
          }
        }
      }
    }

    console.log(`\n================ T-195 SUMMARY REPORT ================`);
    console.log(`TrainingSession events count: ${w.events('TrainingSession').length}`);
    const meals = w.events('MealEaten');
    const drinks = [...w.events('DrankAlcohol'), ...w.events('DrankWater')];

    for (let i = 0; i < dwarves.length; i++) {
      const id = dwarves[i]!;
      const isSoldier = soldiers.includes(id);
      const role = isSoldier ? `Soldier ${i}` : `Civilian ${i}`;
      const dSamples = samples.get(id)!;

      const maxH = Math.max(...dSamples.map((s) => s.hunger));
      const maxT = Math.max(...dSamples.map((s) => s.thirst));
      const maxR = Math.max(...dSamples.map((s) => s.rest));

      // Behavior shares
      const behaviorCounts: Record<string, number> = {};
      for (const s of dSamples) {
        behaviorCounts[s.behavior] = (behaviorCounts[s.behavior] ?? 0) + 1;
      }
      const behaviorShares = Object.entries(behaviorCounts)
        .map(([b, count]) => `${b}: ${((count / dSamples.length) * 100).toFixed(1)}%`)
        .join(', ');

      const mealsCount = meals.filter((e) => e['id'] === id).length;
      const drinksCount = drinks.filter((e) => e['id'] === id).length;

      const death = deathInfo.get(id);
      const deathStr = death
        ? `DIED (cause: ${death.cause}, tick: ${death.tick}, day: ${Math.floor(death.tick / TICKS_PER_DAY)})`
        : 'ALIVE';

      const combatXp = isSoldier
        ? `, MaxSwordXP: ${maxSwordXp[id] ?? 0} (initial: ${initialSwordXp[id] ?? 0})`
        : '';

      console.log(
        `[${role} (ID ${id})] MaxNeeds(H:${maxH}, T:${maxT}, R:${maxR}) | Behaviors(${behaviorShares}) | Meals:${mealsCount}, Drinks:${drinksCount}${combatXp} | Status:${deathStr}`,
      );
    }

    // Print threshold moments for tracked soldier
    if (trackedSoldierId !== null) {
      console.log(`\n--- First hungry soldier details (ID ${trackedSoldierId}) ---`);
      for (const thresh of [50, 75, 90]) {
        const ev = thresholdEvents.get(thresh);
        if (ev) {
          console.log(
            `Threshold ${thresh}: reached at tick ${ev.tick} (day ${Math.floor(ev.tick / TICKS_PER_DAY)}), behavior="${ev.behavior}", activity="${ev.activity}", foodReachable=${ev.foodReachable}, freeMealCount=${ev.freeMealCount}`,
          );
          // Summarize next 600 ticks
          const behaviorCounts600: Record<string, number> = {};
          const activities600: Set<string> = new Set();
          for (const step of ev.next600Ticks) {
            behaviorCounts600[step.behavior] = (behaviorCounts600[step.behavior] ?? 0) + 1;
            activities600.add(step.activity);
          }
          console.log(
            `  Next 600 ticks behaviors: ${JSON.stringify(behaviorCounts600)}, activities: ${Array.from(activities600).join(', ')}, final hunger: ${ev.next600Ticks[ev.next600Ticks.length - 1]?.hunger}`,
          );
        } else {
          console.log(`Threshold ${thresh}: NEVER REACHED`);
        }
      }
    }
    console.log('======================================================\n');

    // Assertions required by the brief:
    // 1. No dwarf dies
    for (const d of dwarves) {
      expect(w.game.world.entities.alive(d), `Dwarf ${d} should be alive`).toBe(true);
    }

    // 2. Every soldier ate and drank regularly (at least once every 2-3 days: >= 10 meals, >= 15 drinks in 30 days)
    for (const s of soldiers) {
      const sMeals = meals.filter((e) => e['id'] === s).length;
      const sDrinks = drinks.filter((e) => e['id'] === s).length;
      expect(sMeals, `Soldier ${s} should eat regularly`).toBeGreaterThanOrEqual(10);
      expect(sDrinks, `Soldier ${s} should drink at least once every two days`).toBeGreaterThanOrEqual(15);
    }

    // 3. Every soldier's weapon skill XP rose (training really happened)
    for (const s of soldiers) {
      const finalXp = w.game.world.entities.get(s, C.Skills)?.xp[swordSkillIdx] ?? 0;
      expect(finalXp, `Soldier ${s} weapon skill XP should increase`).toBeGreaterThan(initialSwordXp[s]!);
    }
  },
};

export default scenario;
