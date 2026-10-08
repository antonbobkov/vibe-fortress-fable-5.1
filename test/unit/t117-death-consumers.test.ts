import { describe, expect, it } from 'vitest';
import { buildFlatTestMap } from '@app/headless';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { EVENT_TYPES } from '@core/event-types';
import type { DwarvesReader } from '@systems/dwarves';
import type { CombatReader } from '@systems/combat';
import type { MoraleReader } from '@systems/morale';
import type { ImmigrationReader } from '@systems/immigration';
import type { ItemsReader } from '@systems/items';
import type { ThreatsReader } from '@systems/threats';
import { RENOWN_POP_WEIGHT, RENOWN_WEALTH_DIVISOR } from '@systems/threats/constants';
import { AnnouncementLog } from '@ui/announcements';
import { Strings } from '@ui/strings';
import { TestWorld } from '../scenarios/test-world';

function world(seed: string): TestWorld {
  return new TestWorld({ seed, map: buildFlatTestMap(contentRegistry(), 48, 48) });
}

function kill(w: TestWorld, id: number): void {
  const hp = w.game.world.entities.get(id, C.Body)!.parts[1]!.maxHp;
  w.game.world.emit({ type: 'DamageDealt', defenderId: id, attackerId: 0, part: 'torso', damageType: 'blunt', amount: hp * 2 });
  w.until(() => w.events('CreatureDied').some((e) => e['id'] === id), 5);
  w.step(1);
}

describe('T-117 dwarf death uses CreatureDied for every consumer', () => {
  it('a single adult death clears titles and squad membership, grants grief, refreshes renown and frees population cap room', () => {
    const w = world('t117-death-consumers');
    const ids = Array.from({ length: 20 }, (_, i) => w.spawnDwarf({ at: w.index(10 + i, 10, 32), ageYears: 25 }));
    const victim = ids[0]!;
    const friend = ids[1]!;
    const entities = w.game.world.entities;
    const relations = entities.get(friend, C.Relationships)!;
    entities.add(friend, C.Relationships, { ...relations, friends: [victim] });
    w.step(2);
    const apply = w.game.world.applyCommand.bind(w.game.world);
    expect(apply({ type: 'AssignTitle', dwarfId: victim, title: 'warden' })).toEqual({ ok: true });
    expect(apply({ type: 'CreateSquad', name: 'Death guard', leaderId: victim })).toEqual({ ok: true });
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squads()[0]!.id;
    expect(apply({ type: 'SetSquadMembers', squadId: squad, members: [victim, friend] })).toEqual({ ok: true });
    expect(apply({ type: 'SetPopulationCap', n: 20 })).toEqual({ ok: true });
    const immigration = w.readers.of<ImmigrationReader>('21');
    expect(immigration.eligibility().reasons).toContain('cap');
    const dwarves = w.readers.of<DwarvesReader>('10');
    expect(dwarves.population()).toBe(20);
    kill(w, victim);
    expect(w.events('CreatureDied').filter((e) => e['id'] === victim)).toHaveLength(1);
    expect((EVENT_TYPES as readonly string[])).not.toContain('DwarfDied');
    expect(dwarves.population()).toBe(19);
    expect(dwarves.holder('warden')).toBe(0);
    expect(combat.squad(squad)?.members).toEqual([friend]);
    expect(combat.squad(squad)?.leaderId).toBe(0);
    const morale = w.readers.of<MoraleReader>('15');
    expect(morale.thoughts(friend).map((t) => t.id)).toEqual(expect.arrayContaining(['dwarf_died', 'friend_died']));
    expect(morale.thoughts(friend).some((t) => t.id === 'child_died')).toBe(false);
    expect(immigration.eligibility().reasons).not.toContain('cap');
    expect(w.readers.of<ThreatsReader>('18').renown()).toBeCloseTo(w.readers.of<ItemsReader>('13').wealth() / RENOWN_WEALTH_DIVISOR + 19 * RENOWN_POP_WEIGHT, 6);
  });

  it('a real child death grants child grief and remains a named danger announcement after the entity is removed', () => {
    const w = world('t117-child-death');
    const adult = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 25 });
    const child = w.spawnDwarf({ at: w.index(11, 10, 32), ageYears: 5, name: 'Little Granite' });
    w.step(2);
    kill(w, child);
    expect(w.game.world.entities.alive(child)).toBe(false);
    expect(w.readers.of<MoraleReader>('15').thoughts(adult).map((t) => t.id)).toEqual(expect.arrayContaining(['dwarf_died', 'child_died']));
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const event = w.events('CreatureDied').find((e) => e['id'] === child)!;
    const announced = log.announce(event, w.readers, w.tick);
    expect(announced?.severity).toBe('danger');
    expect(announced?.line.text).toContain('Little Granite');
    expect(announced?.focus).toBe(event['tile']);
  });

  it('an animal death grants neither dwarf nor child grief, and keeps its ordinary creature announcement', () => {
    const w = world('t117-animal-death');
    const adult = w.spawnDwarf({ at: w.index(10, 10, 32), ageYears: 25 });
    const cow = w.spawnTame('cow', w.index(11, 10, 32));
    w.step(2);
    kill(w, cow);
    expect(w.readers.of<MoraleReader>('15').thoughts(adult).map((t) => t.id)).not.toEqual(expect.arrayContaining(['dwarf_died']));
    expect(w.readers.of<MoraleReader>('15').thoughts(adult).some((t) => t.id === 'child_died')).toBe(false);
    const log = new AnnouncementLog(new Strings(w.game.registry), w.game.registry);
    log.register(w.game.world.registrations.announcements);
    const announced = log.announce(w.events('CreatureDied').find((e) => e['id'] === cow)!, w.readers, w.tick);
    expect(announced?.severity).toBe('note');
  });
});
