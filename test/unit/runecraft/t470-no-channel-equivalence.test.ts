/**
 * T-470: combat with no channel in play gives the same results and the same draws as before the
 * runeforge, the channels and `armorReduction` landed (`25-runecraft.md` § What no runecraft means).
 *
 * Five stepped arenas on the flat test map, through the real tick loop: a melee duel against two
 * goblins (mail, helm, shield: parry, block, edge against mail and plate), a warhammer against a
 * trollkin (blunt through natural armour), a crossbow against a shielded goblin in leather (the
 * ammunition branch, block on a missile), the magma wyrm's breath (`burn`, no layer row, natural
 * ranged) and a war-trained dog against a goblin (natural armour + 1). Each arena's combat events,
 * the state of every rng stream at its end and the bodies of the fighters are digested. The pinned
 * digests were recorded on master `2a4e5832`, before this task's code.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TileKind } from '@core/map3d';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { assignHostileSkills } from '@systems/threats/gear';
import { TestWorld } from '../../scenarios/test-world';

const Z = FLAT_TEST_SURFACE_Z;

interface Kit {
  weapon?: [string, string];
  shield?: [string, string];
  body?: [string, string];
  head?: [string, string];
  legs?: [string, string];
}

function arena(seed: string): TestWorld {
  return new TestWorld({ seed, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
}

function equip(w: TestWorld, id: EntityId, at: number, kit: Kit): void {
  const make = (k?: [string, string]): EntityId => (k ? w.spawnItem(k[0], k[1], at, 1, 1) : 0);
  const old = w.game.world.entities.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: make(kit.weapon), shield: make(kit.shield),
    armor: { head: make(kit.head), body: make(kit.body), arms: 0, legs: make(kit.legs), feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  };
  for (const item of [eq.weapon, eq.shield, eq.armor.head, eq.armor.body, eq.armor.legs]) {
    if (item !== 0) {
      w.game.world.services.items?.attachToCarrier(item, id);
      w.game.world.services.items?.setOwner(item, id);
    }
  }
  w.game.world.entities.add(id, C.Equipment, eq);
}

function soldier(w: TestWorld, x: number, y: number, kit: Kit, skills: Record<string, number>, ranged = false): EntityId {
  const id = w.spawnDwarf({ at: w.index(x, y, Z), skills });
  w.game.world.applyCommand({ type: 'CreateSquad', name: 'Guard' });
  const squads = w.readers.of<CombatReader>('16').squads();
  const s = squads[squads.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members: [id] });
  w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(x, y, Z) });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  w.step(1);
  equip(w, id, w.index(x, y, Z), kit);
  return id;
}

const COMBAT_EVENTS = new Set([
  'AttackResolved', 'DamageDealt', 'ProjectileFired', 'WoundInflicted', 'CreatureDied', 'CreatureUnconscious', 'CreatureFled', 'LimbLost',
]);

/** Step the arena, keep the foes on the dwarf, and digest what happened. */
interface Fight { digest: string; attacks: number; hits: number; shots: number; burns: number }

function fight(w: TestWorld, fighters: EntityId[], foes: EntityId[], dwarf: EntityId, ticks: number): Fight {
  const seen: string[] = [];
  w.game.world.onEvents((batch) => {
    // LimbLost's name and species (taken for the log line) came after the pins; they are left out of the digest.
    for (const e of batch) if (COMBAT_EVENTS.has(e.type)) seen.push(`${w.tick} ${JSON.stringify(e.type === 'LimbLost' ? { ...e, name: undefined, species: undefined } : e)}`);
  });
  const combat = w.game.world.services.combat;
  for (const f of foes) combat?.setTarget(f, dwarf);
  for (let t = 0; t < ticks; t += 1) {
    w.step(1);
    for (const f of foes) {
      if (w.game.world.entities.alive(f) && w.game.world.entities.alive(dwarf) && combat?.targetOf(f) === 0 && !w.game.world.entities.has(f, C.Brain)) combat?.setTarget(f, dwarf);
    }
  }
  const ent = w.game.world.entities;
  const bodies = fighters.map((id) => {
    const b = ent.get(id, C.Body);
    return b === undefined ? `${id}:gone` : `${id}:${b.blood}:${b.conscious}:${b.parts.map((p) => `${p.hp}${p.destroyed ? 'x' : ''}`).join(',')}`;
  });
  const text = [...seen, JSON.stringify(w.game.world.rngState()), ...bodies].join('\n');
  return {
    digest: createHash('sha256').update(text).digest('hex').slice(0, 16),
    attacks: seen.filter((s) => s.includes('"AttackResolved"')).length,
    hits: seen.filter((s) => s.includes('"AttackResolved"') && s.includes('"outcome":"hit"')).length,
    shots: seen.filter((s) => s.includes('"ProjectileFired"')).length,
    burns: seen.filter((s) => s.includes('"DamageDealt"') && s.includes('"damageType":"burn"')).length,
  };
}

function duel(): Fight {
  const w = arena('t470-eq-duel');
  const dwarf = soldier(w, 40, 40, { weapon: ['axe', 'iron'], shield: ['shield', 'iron'], body: ['mail_shirt', 'iron'], head: ['helm', 'iron'] },
    { axe: 2, shield: 2, dodge: 2, armor_use: 2 });
  const foes: EntityId[] = [];
  for (const dx of [1, -1]) {
    const g = w.spawnCreature('gloam_warrior', w.index(40 + dx, 41, Z), 'hostile:gloam');
    assignHostileSkills(w.game.world.entities, w.game.registry, g, 0, false);
    equip(w, g, w.index(40 + dx, 41, Z), { weapon: ['short_sword', 'copper'], body: ['leather_jerkin', 'leather'] });
    foes.push(g);
  }
  return fight(w, [dwarf, ...foes], foes, dwarf, 700);
}

function troll(): Fight {
  const w = arena('t470-eq-troll');
  const dwarf = soldier(w, 40, 40, { weapon: ['warhammer', 'steel'], body: ['breastplate', 'steel'], legs: ['greaves', 'iron'] }, { hammer: 4, dodge: 2, armor_use: 2 });
  const foes = [w.spawnCreature('trollkin', w.index(41, 41, Z), 'hostile:gloam')];
  return fight(w, [dwarf, ...foes], foes, dwarf, 600);
}

function crossbow(walled = false): Fight {
  const w = arena(walled ? 't470-eq-walled' : 't470-eq-crossbow');
  const dwarf = soldier(w, 40, 40, { weapon: ['crossbow', 'oak'], body: ['mail_shirt', 'iron'] }, { crossbow: 6, dodge: 2 }, true);
  const quiver = w.spawnItem('quiver', 'leather', w.index(40, 40, Z), 1, 1);
  w.game.world.services.items?.attachToCarrier(quiver, dwarf);
  const bolts = w.spawnItem('bolt', 'iron', w.index(40, 40, Z), 25, 1);
  w.game.world.services.items?.attachToCarrier(bolts, dwarf);
  w.game.world.services.items?.setOwner(bolts, dwarf);
  const eq = w.game.world.entities.get(dwarf, C.Equipment) as Equipment;
  w.game.world.entities.add(dwarf, C.Equipment, { ...eq, quiver: bolts });
  if (walled) {
    // The goblin stands in a stone cell whose north side is a fortification: it cannot come out,
    // and the dwarf shoots in through the fortification beside it.
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        if (dx === 0 && dy === 0) continue;
        w.carve(w.index(40 + dx, 50 + dy, Z), dx === 0 && dy === -1 ? TileKind.Fortification : TileKind.Wall);
      }
    }
  }
  const g = w.spawnCreature('gloam_warrior', w.index(40, 50, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, w.game.registry, g, 1, false);
  equip(w, g, w.index(40, 50, Z), { weapon: ['short_sword', 'copper'], shield: ['shield', 'copper'], body: ['leather_jerkin', 'leather'], head: ['cap', 'leather'] });
  w.game.world.services.combat?.setTarget(dwarf, g);
  return fight(w, [dwarf, g], [g], dwarf, 600);
}

function wyrm(): Fight {
  const w = arena('t470-eq-wyrm');
  const dwarf = soldier(w, 40, 40, { weapon: ['axe', 'steel'], shield: ['shield', 'steel'], body: ['mail_shirt', 'steel'] }, { axe: 6, shield: 6, dodge: 4, armor_use: 4 });
  const foes = [w.spawnCreature('magma_wyrm', w.index(40, 45, Z), 'deep')];
  return fight(w, [dwarf, ...foes], foes, dwarf, 500);
}

function warDog(): Fight {
  const w = arena('t470-eq-dog');
  w.spawnDwarf({ at: w.index(30, 30, Z) });
  const dog = w.spawnCreature('dog', w.index(40, 40, Z), 'fortress');
  w.game.world.entities.add(dog, C.Tame, { trained: 'war', assignedTo: 0, condition: 100, pastureId: 0 } as never);
  const g = w.spawnCreature('gloam_warrior', w.index(41, 41, Z), 'hostile:gloam');
  assignHostileSkills(w.game.world.entities, w.game.registry, g, 0, false);
  equip(w, g, w.index(41, 41, Z), { weapon: ['dagger', 'bronze'] });
  w.game.world.services.combat?.setTarget(dog, g);
  return fight(w, [dog, g], [g], dog, 500);
}

/** Recorded on master `2a4e5832`, before this task: digest, attacks, hits, shots, breaths. */
const BEFORE: Record<string, readonly [string, number, number, number, number]> = {
  duel: ['2e94c497e8bbe24a', 41, 21, 0, 0],
  troll: ['20a4bbdecd25d7e0', 29, 19, 0, 0],
  crossbow: ['c3cec44ff5f33305', 32, 13, 3, 0],
  walled: ['7232968a30fb6baf', 14, 3, 14, 0],
  wyrm: ['1a7e77e72b87f694', 23, 11, 1, 1],
  warDog: ['66a5954cd59c9e72', 14, 6, 0, 0],
};

describe('T-470 combat with no channel in play is unchanged', () => {
  it.each([
    ['duel', duel],
    ['troll', troll],
    ['crossbow', () => crossbow()],
    ['walled', () => crossbow(true)],
    ['wyrm', wyrm],
    ['warDog', warDog],
  ] as const)('%s arena: the same events, draws and wounds as before', (name, run) => {
    const r = run();
    expect([r.digest, r.attacks, r.hits, r.shots, r.burns]).toEqual(BEFORE[name]);
  });
});
