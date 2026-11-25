import { describe, expect, it } from 'vitest';
import { C, type Wild, type Wound } from '@core/components';
import type { EntityId } from '@core/types';
import type { HealthReader } from '@systems/health';
import { drawCreatureView } from '@ui/panels/look';
import { TestWorld } from '../../scenarios/test-world';
import { strings, surface } from './ui-fixture';

const Z = 32;

function wound(over: Partial<Wound> = {}): Wound {
  return {
    type: 'cut',
    severity: 'serious',
    bleed: 3,
    pain: 15,
    healRemaining: 100_000,
    damage: 10,
    bandaged: false,
    sutured: false,
    splinted: false,
    cleaned: false,
    dressed: false,
    infected: false,
    infectedSince: 0,
    createdTick: 0,
    ...over,
  };
}

function world(): TestWorld {
  return new TestWorld({ seed: 't706-parts', world: 'flat-test', embark: 'none' });
}

function wild(w: TestWorld, species: string, state = 'wander'): EntityId {
  const id = w.spawnCreature(species, w.index(10, 10, Z), 'wild');
  const row: Wild = { state, homeChunk: 0, stateUntil: 1_000_000, hungry: false, lastThinkTick: 0, arrivedTick: 0 };
  w.game.world.entities.add(id, C.Wild, row);
  return id;
}

function view(w: TestWorld, id: EntityId): string[] {
  const s = surface(60, 60);
  drawCreatureView(s, { col: 0, row: 0, cols: 60, rows: 60 }, w.readers, w.game.registry, strings, id, Z);
  return s.lines().map((l) => l.trimEnd());
}

function partRows(lines: readonly string[]): string[] {
  return lines.filter((l) => / hp$/.test(l)).map((l) => l.trim().replace(/ [▓░]+ .*$/, ''));
}

describe('T-706 the creature view and summaryText name the parts by the body plan', () => {
  it("a wolf's view lists its forelegs and hindlegs, no arms", () => {
    const w = world();
    const wolf = wild(w, 'wolf');
    const parts = partRows(view(w, wolf));
    expect(parts).toEqual(['head', 'torso', 'left foreleg', 'right foreleg', 'left hindleg', 'right hindleg']);
  });

  it("a chicken's view lists its wings", () => {
    const w = world();
    const chicken = w.spawnTame('chicken', w.index(10, 10, Z));
    expect(partRows(view(w, chicken))).toEqual(['head', 'torso', 'left wing', 'right wing', 'left leg', 'right leg']);
  });

  it('a fish has no arm rows; its tail is two slots, each with its own hp', () => {
    const w = world();
    const fish = wild(w, 'blind_fish');
    expect(partRows(view(w, fish))).toEqual(['head', 'torso', 'tail', 'tail']);
  });

  it('the Hollow Maw is a maw and a torso', () => {
    const w = world();
    const maw = w.spawnCreature('hollow_maw', w.index(10, 10, Z), 'deep');
    expect(partRows(view(w, maw))).toEqual(['maw', 'torso']);
  });

  it('a dwarf keeps its arms and legs', () => {
    const w = world();
    const dwarf = w.spawnDwarf({ at: w.index(10, 10, Z) });
    expect(partRows(view(w, dwarf))).toEqual(['head', 'torso', 'left arm', 'right arm', 'left leg', 'right leg']);
  });

  it('a cow wounded in a foreleg is "bleeding from the left foreleg"; a dwarf from the left arm', () => {
    const w = world();
    const cow = w.spawnTame('cow', w.index(10, 10, Z));
    const dwarf = w.spawnDwarf({ at: w.index(12, 10, Z) });
    w.game.world.entities.get(cow, C.Body)!.parts[2]!.wounds.push(wound());
    w.game.world.entities.get(dwarf, C.Body)!.parts[2]!.wounds.push(wound());
    const health = w.readers.of<HealthReader>('17');
    expect(health.summaryText(cow)).toBe('Bleeding from the left foreleg');
    expect(health.summaryText(dwarf)).toBe('Bleeding from the left arm');
    expect(health.partNames(cow)).toEqual(['head', 'torso', 'left foreleg', 'right foreleg', 'left hindleg', 'right hindleg']);
  });

  it("a permanent mark names the plan's part: a cow's lost foreleg", () => {
    const w = world();
    const cow = w.spawnTame('cow', w.index(10, 10, Z));
    w.game.world.entities.get(cow, C.Body)!.permanent.push('lost_left_arm');
    expect(view(w, cow).find((l) => l.includes('Permanent:'))?.trim()).toBe('Permanent: lost left foreleg');
  });
});

describe('T-706 an animal\'s Activity line is never empty', () => {
  const activity = (lines: readonly string[]): string => lines.find((l) => l.startsWith(' Activity:'))?.trim() ?? '';

  it('a wild animal says what it is doing', () => {
    const w = world();
    expect(activity(view(w, wild(w, 'wolf', 'sleep')))).toBe('Activity: Asleep');
    expect(activity(view(w, wild(w, 'deer', 'graze')))).toBe('Activity: Grazing');
    expect(activity(view(w, wild(w, 'wolf', 'hunt')))).toBe('Activity: Hunting');
  });

  it('a wild animal with no state yet stands or wanders', () => {
    const w = world();
    expect(activity(view(w, wild(w, 'wolf', '')))).toBe('Activity: Standing about');
  });

  it('a tame animal: standing about, following its dwarf, keeping to its pasture, curled in the heap', () => {
    const w = world();
    const dog = w.spawnTame('dog', w.index(10, 10, Z));
    expect(activity(view(w, dog))).toBe('Activity: Standing about');
    const dwarf = w.spawnDwarf({ at: w.index(12, 10, Z), name: 'Ketil Ironvein' });
    w.game.world.entities.get(dog, C.Tame)!.assignedTo = dwarf;
    expect(activity(view(w, dog))).toBe('Activity: Following Ketil Ironvein');
    w.game.world.entities.get(dog, C.Tame)!.curled = true;
    expect(activity(view(w, dog))).toBe("Activity: Curled up in the pets' heap");

    const cow = w.spawnTame('cow', w.index(14, 10, Z));
    const pasture = w.zone('pasture', [w.index(14, 10, Z), w.index(15, 10, Z)]);
    w.game.world.entities.get(cow, C.Tame)!.pastureId = pasture;
    expect(activity(view(w, cow))).toBe('Activity: Keeping to Pasture #1');
    w.game.world.entities.get(cow, C.Tame)!.condition = 100;
    expect(activity(view(w, cow))).toBe('Activity: Starving');
  });
});
