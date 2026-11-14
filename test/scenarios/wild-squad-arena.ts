/**
 * T-544: the owner's squad against wolves and bears ("a steel-equipped well-trained squad of ~5
 * fighters, few archers and a wizard should have no problem handling wildlife incursions").
 *
 * A stepped `flat-test` arena through the real tick loop. The squad stands at its station; the wild
 * group arrives together (one pack: the same species and the same arrival tick, 08) `FOE_DISTANCE`
 * tiles north of it, wolves hungry; the squad is sent after every animal of the group, the nearest
 * first, as the three-year script sends it. The fight ends when no animal of the group is on the map
 * (dead, or fled off its edge) or no fighter of the squad stands, or after `FIGHT_TICKS`; then a day
 * passes with no medic, and the dead are counted.
 *
 * Squads (`steel` is the owner's; `copper` the weak one that should still find them dangerous):
 *  - five soldiers, axe, shield, helm, mail shirt and greaves of the squad's metal;
 *  - three marksdwarves in a ranged squad of their own at the same station, helm, mail shirt and
 *    greaves of the squad's metal, an oak crossbow and 25 bolts of the squad's metal;
 *  - one runecaster in the soldiers' squad, in a tunic, rune 50, an iron staff of embers.
 * `steel` is Proficient (10) in every skill it uses; `copper` Novice (2).
 *
 * Foes: `pack`, the largest wolf group a spawn draws (the row's group maximum, 6); `bear`, one bear;
 * `beast-pack` and `beast-bears`, the groups `beastwood` doubles (12 wolves, 2 bears; 08 § Wild
 * spawning), the worst group the spawning rules allow.
 */
import { FLAT_TEST_SURFACE_Z } from '@app/headless';
import { C, type Equipment } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import { TestWorld } from './test-world';

export type ArenaSquad = 'steel' | 'steel-tunic' | 'copper' | 'iron3' | 'iron3-full';

interface SquadSpec {
  readonly level: number;
  readonly metal: string;
  readonly soldiers: number;
  readonly weapon: string;
  readonly weaponSkill: string;
  /** Helm, mail shirt and greaves; else a mail shirt alone. */
  readonly fullKit: boolean;
  readonly marks: number;
  readonly caster: 'armoured' | 'tunic' | 'none';
}

/**
 * `steel`: the owner's squad, everyone in steel, the caster too. `steel-tunic`: the same with the
 * caster in its tunic, as the caster arenas field one (T-470). `copper`: the same squad at Novice in
 * copper. `iron3`: the three-year script's squad, three Novices with iron short swords, shields and
 * mail shirts (`three_years_economy.ts` SQUAD_KIT).
 */
export const SQUADS: Record<ArenaSquad, SquadSpec> = {
  'steel': { level: 10, metal: 'steel', soldiers: 5, weapon: 'axe', weaponSkill: 'axe', fullKit: true, marks: 3, caster: 'armoured' },
  'steel-tunic': { level: 10, metal: 'steel', soldiers: 5, weapon: 'axe', weaponSkill: 'axe', fullKit: true, marks: 3, caster: 'tunic' },
  'copper': { level: 2, metal: 'copper', soldiers: 5, weapon: 'axe', weaponSkill: 'axe', fullKit: true, marks: 3, caster: 'armoured' },
  'iron3': { level: 2, metal: 'iron', soldiers: 3, weapon: 'short_sword', weaponSkill: 'sword', fullKit: false, marks: 0, caster: 'none' },
  'iron3-full': { level: 2, metal: 'iron', soldiers: 3, weapon: 'short_sword', weaponSkill: 'sword', fullKit: true, marks: 0, caster: 'none' },
};
export type ArenaFoe = 'pack' | 'bear' | 'beast-pack' | 'beast-bears';

/** How far north of the squad's station the group arrives. */
export const FOE_DISTANCE = 18;
/** The longest a fight runs before it is called. */
export const FIGHT_TICKS = 2 * TICKS_PER_DAY;

const Z = FLAT_TEST_SURFACE_Z;
const SX = 46;
const SY = 60;

export interface ArenaResult {
  readonly squad: ArenaSquad;
  readonly foe: ArenaFoe;
  readonly seed: number;
  /** `won`: no animal of the group is left on the map and a fighter stands; `lost`: no fighter stands; `timeout`. */
  readonly outcome: 'won' | 'lost' | 'timeout';
  readonly fightTicks: number;
  readonly animals: number;
  readonly animalsKilled: number;
  readonly animalsFled: number;
  /** Fighters dead a day after the fight, with no medic, by role. */
  readonly soldiersDead: number;
  readonly marksDead: number;
  readonly casterDead: number;
  readonly dead: number;
  /** Blows that landed on the squad, and blood the squad lost by the fight's end. */
  readonly hitsTaken: number;
  readonly damageTaken: number;
  readonly hitsGiven: number;
  readonly shots: number;
  readonly casts: number;
  /** Each fighter's death: its role, the cause, and who struck the blows it took (animal or fortress). */
  readonly deaths: readonly { role: string; cause: string; killer: string; byAnimal: number; byFortress: number }[];
}

interface Kit { weapon?: [string, string]; shield?: [string, string]; body?: [string, string]; head?: [string, string]; legs?: [string, string] }

function equip(w: TestWorld, id: EntityId, at: number, kit: Kit): void {
  const make = (k?: [string, string]): EntityId => (k ? w.spawnItem(k[0], k[1], at, 1, 1) : 0);
  const old = w.game.world.entities.get(id, C.Equipment);
  const eq: Equipment = {
    weapon: make(kit.weapon), shield: make(kit.shield),
    armor: { head: make(kit.head), body: make(kit.body), arms: 0, legs: make(kit.legs), feet: 0 },
    clothing: old?.clothing ?? { body: 0, legs: 0, feet: 0, over: 0 }, quiver: 0,
  };
  for (const item of [eq.weapon, eq.shield, eq.armor.head, eq.armor.body, eq.armor.legs]) {
    if (item === 0) continue;
    w.items.attachToCarrier(item, id);
    w.items.setOwner(item, id);
  }
  w.game.world.entities.add(id, C.Equipment, eq);
}

function makeSquad(w: TestWorld, name: string, members: EntityId[], ranged: boolean): number {
  w.game.world.applyCommand({ type: 'CreateSquad', name });
  const all = w.readers.of<CombatReader>('16').squads();
  const s = all[all.length - 1] as SquadWithId;
  w.game.world.applyCommand({ type: 'SetSquadMembers', squadId: s.id, members });
  if (ranged) w.game.world.applyCommand({ type: 'SetSquadEquipment', squadId: s.id, equipment: { weaponClass: 'any', armor: 'any', ranged: true } });
  w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.id, tile: w.index(SX, SY, Z) });
  w.game.world.applyCommand({ type: 'SetSquadMode', squadId: s.id, mode: 'active' });
  return s.id;
}

function standing(w: TestWorld, id: EntityId): boolean {
  const ent = w.game.world.entities;
  if (!ent.alive(id) || !ent.get(id, C.Position)) return false;
  return ent.get(id, C.Body)?.conscious !== false;
}

function onMap(w: TestWorld, id: EntityId): boolean {
  return w.game.world.entities.alive(id) && w.game.world.entities.get(id, C.Position) !== undefined;
}

/** One fight of `squad` against `foe` on seed `t544-arena-<seed>`. */
export function wildArenaTrial(squad: ArenaSquad, foe: ArenaFoe, seed: number): ArenaResult {
  const w = new TestWorld({ seed: `t544-arena-${seed}`, world: 'flat-test', embark: 'none', surfaceWildlife: 'none' });
  const ent = w.game.world.entities;
  const spec = SQUADS[squad];
  const level = spec.level;
  const metal = spec.metal;

  const soldiers: EntityId[] = [];
  for (let k = 0; k < spec.soldiers; k += 1) {
    soldiers.push(w.spawnDwarf({ at: w.index(SX - 2 + k, SY, Z), skills: { [spec.weaponSkill]: level, shield: level, dodge: level, armor_use: level, hammer: 2 } }));
  }
  const casters: EntityId[] = [];
  if (spec.caster !== 'none') {
    const id = w.spawnDwarf({ at: w.index(SX, SY + 2, Z), skills: { runecraft: level, dodge: level, armor_use: level, hammer: 2 } });
    ent.add(id, C.Rune, { current: 50_000 });
    casters.push(id);
  }
  const marks: EntityId[] = [];
  for (let k = 0; k < spec.marks; k += 1) {
    marks.push(w.spawnDwarf({ at: w.index(SX - 1 + k, SY + 3, Z), skills: { crossbow: level, dodge: level, armor_use: level, hammer: 2 } }));
  }
  const guard = makeSquad(w, 'Guard', [...soldiers, ...casters], false);
  const bolts = marks.length > 0 ? makeSquad(w, 'Bolts', marks, true) : 0;
  w.step(1);

  const armour = spec.fullKit ? { head: ['helm', metal], body: ['mail_shirt', metal], legs: ['greaves', metal] } as Kit : { body: ['mail_shirt', metal] } as Kit;
  soldiers.forEach((id, k) => equip(w, id, w.index(SX - 2 + k, SY, Z), { weapon: [spec.weapon, metal], shield: ['shield', metal], ...armour }));
  marks.forEach((id, k) => {
    const at = w.index(SX - 1 + k, SY + 3, Z);
    equip(w, id, at, { weapon: ['crossbow', 'oak'], ...armour });
    const quiver = w.spawnItem('bolt', metal, at, 25, 1);
    w.items.attachToCarrier(quiver, id);
    w.items.setOwner(quiver, id);
    ent.add(id, C.Equipment, { ...ent.get(id, C.Equipment)!, quiver });
  });
  for (const id of casters) {
    const at = w.index(SX, SY + 2, Z);
    equip(w, id, at, spec.caster === 'armoured' ? armour : {});
    const staff = w.spawnItem('staff', 'iron', at, 1, 1);
    ent.add(staff, C.Item, { ...ent.get(staff, C.Item)!, stone: w.game.registry.table('materials').index('garnet') });
    w.items.attachToCarrier(staff, id);
    w.items.setOwner(staff, id);
    ent.add(id, C.Equipment, { ...ent.get(id, C.Equipment)!, weapon: staff });
  }

  // The group, in one tick (one pack), around a point FOE_DISTANCE north of the station.
  const species = foe === 'pack' || foe === 'beast-pack' ? 'wolf' : 'bear';
  const count = foe === 'pack' ? 6 : foe === 'beast-pack' ? 12 : foe === 'bear' ? 1 : 2;
  const animals: EntityId[] = [];
  for (let k = 0; k < count; k += 1) {
    const at = w.index(SX - 3 + (k % 6), SY - FOE_DISTANCE - Math.floor(k / 6), Z);
    const id = w.spawnCreature(species, at, 'wild');
    if (species === 'wolf') ent.add(id, C.Wild, { ...ent.get(id, C.Wild)!, hungry: true });
    animals.push(id);
  }

  const fighters = [...soldiers, ...casters, ...marks];
  const fortress = new Set(fighters);
  const group = new Set(animals);
  const tally = { hitsTaken: 0, damageTaken: 0, hitsGiven: 0, shots: 0, casts: 0, killed: 0 };
  const role = (id: EntityId): string => (soldiers.includes(id) ? 'soldier' : marks.includes(id) ? 'marks' : 'caster');
  const struck = new Map<EntityId, { byAnimal: number; byFortress: number }>();
  const deaths: { role: string; cause: string; killer: string; byAnimal: number; byFortress: number }[] = [];
  const unsub = w.game.world.onEvents((events) => {
    for (const e of events) {
      if (e.type === 'DamageDealt' && fortress.has(Number(e['defenderId']))) {
        const d = Number(e['defenderId']);
        const s0 = struck.get(d) ?? { byAnimal: 0, byFortress: 0 };
        if (group.has(Number(e['attackerId']))) s0.byAnimal += Number(e['amount'] ?? 0);
        else if (fortress.has(Number(e['attackerId']))) s0.byFortress += Number(e['amount'] ?? 0);
        struck.set(d, s0);
      }
      if (e.type === 'CreatureDied' && fortress.has(Number(e['id']))) {
        const d = Number(e['id']);
        const k = Number(e['killerId'] ?? 0);
        deaths.push({ role: role(d), cause: String(e['cause']), killer: group.has(k) ? 'animal' : fortress.has(k) ? role(k) : String(k),
          ...(struck.get(d) ?? { byAnimal: 0, byFortress: 0 }) });
      }
      if (e.type === 'AttackResolved' && e['outcome'] === 'hit') {
        if (group.has(Number(e['attackerId'])) && fortress.has(Number(e['defenderId']))) {
          tally.hitsTaken += 1;
          tally.damageTaken += Number(e['amount'] ?? 0);
        } else if (fortress.has(Number(e['attackerId'])) && group.has(Number(e['defenderId']))) tally.hitsGiven += 1;
      } else if (e.type === 'ProjectileFired' && marks.includes(Number(e['shooterId']))) tally.shots += 1;
      else if (e.type === 'SpellCast' && casters.includes(Number(e['casterId']))) tally.casts += 1;
      else if (e.type === 'CreatureDied' && group.has(Number(e['id']))) tally.killed += 1;
    }
  });

  // The squads are sent after every animal of the group, the nearest first.
  const station = { x: SX, y: SY };
  const byDistance = [...animals].sort((a, b) => {
    const pa = ent.get(a, C.Position)!, pb = ent.get(b, C.Position)!;
    const da = Math.max(Math.abs(pa.x - station.x), Math.abs(pa.y - station.y));
    const db = Math.max(Math.abs(pb.x - station.x), Math.abs(pb.y - station.y));
    return da - db || a - b;
  });
  for (const squadId of [guard, bolts].filter((id) => id !== 0)) {
    for (const targetId of byDistance) w.game.world.applyCommand({ type: 'SquadOrder', squadId, order: { kind: 'kill', targetId } });
  }

  let outcome: ArenaResult['outcome'] = 'timeout';
  let fightTicks = FIGHT_TICKS;
  for (let t = 1; t <= FIGHT_TICKS; t += 1) {
    w.step(1);
    if (fighters.every((d) => !standing(w, d))) { outcome = 'lost'; fightTicks = t; break; }
    if (animals.every((a) => !onMap(w, a))) { outcome = 'won'; fightTicks = t; break; }
  }
  w.step(TICKS_PER_DAY);
  unsub();

  const dead = (ids: EntityId[]): number => ids.filter((d) => !ent.alive(d)).length;
  return {
    squad, foe, seed, outcome, fightTicks, animals: count,
    animalsKilled: tally.killed, animalsFled: count - tally.killed - animals.filter((a) => onMap(w, a)).length,
    soldiersDead: dead(soldiers), marksDead: dead(marks), casterDead: dead(casters), dead: dead(fighters),
    hitsTaken: tally.hitsTaken, damageTaken: tally.damageTaken, hitsGiven: tally.hitsGiven, shots: tally.shots, casts: tally.casts, deaths,
  };
}
