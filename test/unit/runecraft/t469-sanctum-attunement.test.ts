/** T-469: the rune of one's own, the sanctum, attunement and mishaps (`25-runecraft.md`). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TileFlag } from '@core/map3d';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '@core/constants';
import type { TickContext } from '@core/system';
import type { EntityId, TileIndex } from '@core/types';
import type { GameEvent } from '@core/events';
import { RngStream } from '@core/rng';
import { loadGame, roundTrip } from '@app/game-save';
import { contentRegistry } from '@content/loader';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import { cumulativeXp } from '@systems/dwarves/rules/skills';
import {
  ATTUNE_SESSIONS_PER_DAY,
  MagicSystem,
  mishapPermille,
  rollMishap,
  runeMaxMilli,
  sessionXp,
  type MagicReader,
} from '@systems/magic';
import * as magicConstants from '@systems/magic/constants';
import type { MoraleReader } from '@systems/morale';
import { killCreature } from '@systems/health/tick';
import type { JobsReader } from '@systems/jobs';
import { runeLine } from '@ui/panels/look';
import { sanctumLines } from '@ui/panels/zones';
import { Strings } from '@ui/strings';
import { TestWorld } from '../../scenarios/test-world';
import { rect } from '../../scenarios/m1-helpers';
import { tuningConstants } from '../system-constants';

const registry = contentRegistry();
/** Granite, deep under the flat-test surface: a bare stone sanctum where nothing can burn. */
const Z = 25;
const X = 30;
const Y = 30;

interface Sanctum {
  readonly w: TestWorld;
  readonly zone: EntityId;
  readonly dwarf: EntityId;
  circle: EntityId;
  readonly circleTile: TileIndex;
}

function setWits(w: TestWorld, id: EntityId, wit: number): void {
  const attrs = w.game.world.entities.get(id, C.Attributes);
  if (attrs !== undefined) w.game.world.entities.add(id, C.Attributes, { ...attrs, wit });
}

/** Every labor off but `attunement`, so the dwarf only attunes. */
function onlyAttunement(w: TestWorld, id: EntityId): void {
  for (const labor of registry.table<{ id: string }>('labors').ids()) w.setLabor(id, labor, labor === 'attunement' || labor === 'hauling');
}

function sanctum(seed: string, opts: { glowcap?: number; apprentice?: boolean } = {}): Sanctum {
  const w = new TestWorld({ seed, embark: 'none', surfaceWildlife: 'none' });
  w.digRoom(X, Y, Z, 6, 5);
  for (let y = Y - 1; y <= Y + 5; y += 1) for (let x = X - 1; x <= X + 6; x += 1) w.discover(w.index(x, y, Z));
  // Nine stone tiles, open to the rest of the dug room: score 18, a bare sanctum (tier 0).
  const tiles = rect(w, X, Y, Z, 3, 3);
  const zone = w.zone('sanctum', tiles);
  const circleTile = w.index(X + 1, Y + 1, Z);
  const circle = w.build('rune_circle', circleTile, 'granite');
  const dwarf = w.spawnDwarf({ at: w.index(X, Y, Z) });
  setWits(w, dwarf, 50);
  let left = opts.glowcap ?? 40;
  let k = 0;
  while (left > 0) {
    const n = Math.min(20, left);
    w.spawnItem('glowcap', 'glowcap', w.index(X + 5, Y + (k % 5), Z), n);
    left -= n;
    k += 1;
  }
  if (opts.apprentice !== false) {
    onlyAttunement(w, dwarf);
    expect(w.game.world.applyCommand({ type: 'SetSanctumApprentices', zoneId: zone, dwarfIds: [dwarf] }).ok).toBe(true);
  }
  w.step(1);
  return { w, zone, dwarf, circle, circleTile };
}

function magic(w: TestWorld): MagicReader {
  return w.readers.of<MagicReader>('25');
}

function level(w: TestWorld, id: EntityId, skill = 'runecraft'): number {
  return (w.game.world.entities.get(id, C.Skills)?.level[registry.table('skills').index(skill)] ?? 0) as number;
}

function system(w: TestWorld): MagicSystem {
  return w.game.world.scheduler.byId('25') as MagicSystem;
}

/** The tick context the system's own hooks see, for driving a session's completion directly. */
function context(w: TestWorld): TickContext {
  const world = w.game.world;
  return {
    world,
    registry: world.registry,
    rng: world.rngFor('25'),
    readers: world.readers,
    register: world.registrations,
    tick: world.calendar.tick,
    emit: (event: GameEvent) => world.emit(event),
    terrain: world.services.terrain,
    jobs: world.services.jobs,
    spawn: world.services.spawn,
  };
}

/** One session's completion through the producer, as 11 calls it. */
function completeSession(s: Sanctum): void {
  const producer = s.w.game.world.registrations.jobProducers.find((p) => p.id === 'magic');
  producer?.onComplete?.({ workerId: s.dwarf, target: { kind: 'building', ref: s.circle }, inputs: [], data: { zoneId: s.zone } }, context(s.w));
}

function rebuildCircle(s: Sanctum): void {
  if (s.w.game.world.entities.alive(s.circle) && s.w.readers.of<BuildingsReader>('14').get(s.circle)?.state === 'built') return;
  s.circle = s.w.build('rune_circle', s.circleTile, 'granite');
}

describe('T-469 constants and arithmetic', () => {
  it('the landed constants are the document\'s', () => {
    const doc = tuningConstants('02-systems/25-runecraft.md');
    const landed = magicConstants as unknown as Record<string, number>;
    const names = Object.keys(landed);
    expect(names.length).toBe(31);
    for (const name of names) expect(doc.find((row) => row.name === name)?.value, name).toBe(landed[name]);
  });

  it('a session\'s xp and mishap chance', () => {
    expect(sessionXp(0, 50)).toBe(25);
    expect(sessionXp(5, 50)).toBe(31);
    expect(mishapPermille(0, 0)).toBe(60);
    expect(mishapPermille(10, 3)).toBe(37);
    expect(mishapPermille(20, 5)).toBe(15);
    expect(mishapPermille(25, 5)).toBe(10);
    expect(runeMaxMilli(10)).toBe(50_000);
  });

  it('the attune row grants no xp of its own, and the skill and labor are hidden at embark', () => {
    const job = registry.table<{ id: string; xp: number; labor: string; skill: string; producer: string }>('jobTypes').byId('attune');
    expect(job).toMatchObject({ xp: 0, labor: 'attunement', skill: 'runecraft', producer: 'magic' });
    expect(registry.table<{ id: string; embark?: boolean }>('skills').byId('runecraft')?.embark).toBe(false);
    expect(registry.table<{ id: string; defaultOn: boolean; children: boolean }>('labors').byId('attunement')).toMatchObject({ defaultOn: true, children: false });
    expect(registry.table<{ id: string; tags: string[] }>('buildings').byId('rune_circle')?.tags).toEqual(['rune_circle']);
  });
});

describe('T-469 the sanctum', () => {
  it('is a room that needs a built rune circle', () => {
    const s = sanctum('t469-room', { apprentice: false });
    const b = s.w.readers.of<BuildingsReader>('14');
    s.w.step(10);
    expect(b.room(s.zone)?.requirementsMet).toBe(true);
    expect(b.room(s.zone)?.tier).toBe(0);
    expect(b.roomDiagnostics(s.zone)?.missing).toEqual([]);
    (s.w.game.world.scheduler.byId('14') as BuildingsSystem).buildings.remove(s.circle);
    s.w.step(10);
    expect(b.room(s.zone)?.requirementsMet).toBe(false);
    expect(b.roomDiagnostics(s.zone)?.missing).toEqual(['rune_circle']);
  });

  it('SetSanctumApprentices: adults of the fortress, at most four, turning attunement on', () => {
    const s = sanctum('t469-command', { apprentice: false });
    const world = s.w.game.world;
    s.w.setLabor(s.dwarf, 'attunement', false);
    const others = [1, 2, 3, 4].map((n) => s.w.spawnDwarf({ at: s.w.index(X + n, Y, Z) }));
    const second = others[1] as EntityId;
    const child = s.w.spawnDwarf({ at: s.w.index(X, Y + 1, Z), ageYears: 5 });
    const goblin = s.w.spawnCreature('gloam_warrior', s.w.index(X, Y + 2, Z), 'hostile:gloam');
    const set = (zoneId: EntityId, dwarfIds: unknown[]) => world.applyCommand({ type: 'SetSanctumApprentices', zoneId, dwarfIds });
    expect(set(s.dwarf, [s.dwarf])).toEqual({ ok: false, reason: 'not_found' });
    expect(set(s.zone, [goblin])).toEqual({ ok: false, reason: 'not_found' });
    expect(set(s.zone, [child])).toEqual({ ok: false, reason: 'not_adult' });
    expect(set(s.zone, [s.dwarf, s.dwarf])).toEqual({ ok: false, reason: 'member_limit' });
    expect(set(s.zone, [s.dwarf, ...others])).toEqual({ ok: false, reason: 'member_limit' });
    expect(set(s.zone, [second, s.dwarf]).ok).toBe(true);
    expect(world.entities.get(s.zone, C.Zone)?.settings['apprentices']).toEqual([s.dwarf, second].sort((a, b) => a - b));
    expect(magic(s.w).apprentices(s.zone)).toEqual([s.dwarf, second].sort((a, b) => a - b));
    const bit = (id: EntityId): number => {
      const labor = registry.table('labors').index('attunement');
      return ((world.entities.get(id, C.Labors)?.enabled[labor >> 3] ?? 0) >> (labor & 7)) & 1;
    };
    expect(bit(s.dwarf)).toBe(1);
    expect(set(s.zone, []).ok).toBe(true);
    expect(magic(s.w).apprentices(s.zone)).toEqual([]);
  });

  it('two sessions a day through the job: glowcap consumed, the rune at level 1, the thought, sessions reset', () => {
    const s = sanctum('t469-day');
    const w = s.w;
    const start = w.tick;
    w.until(() => magic(w).sessionsToday(s.dwarf) === ATTUNE_SESSIONS_PER_DAY, TICKS_PER_DAY);
    const sessions = w.events('AttuneSession');
    expect(sessions).toHaveLength(2);
    expect(w.events('JobCompleted').filter((e) => e['jobType'] === 'attune')).toHaveLength(2);
    // Nothing more until the day turns.
    w.step(Math.max(1, TICKS_PER_DAY - (w.tick % TICKS_PER_DAY) - 5));
    expect(w.events('AttuneSession')).toHaveLength(2);
    expect(w.readers.of<{ available(t: string): number }>('13').available('glowcap')).toBe(38);
    w.step(10);
    expect(magic(w).sessionsToday(s.dwarf)).toBe(0);
    w.until(() => level(w, s.dwarf) >= 1, TICKS_PER_DAY * 2);
    expect(w.game.world.entities.get(s.dwarf, C.Rune)).toEqual({ current: 0 });
    expect(w.tick - start).toBeLessThan(TICKS_PER_DAY * 2);
    if (sessions.some((e) => e['mishap'] === '')) {
      expect(w.readers.of<MoraleReader>('15').thoughts(s.dwarf).some((t) => t.text === 'Felt the rune answer.')).toBe(true);
    }
  });

  it('an apprentice who dies mid-session leaves no job behind', () => {
    const s = sanctum('t469-death');
    const w = s.w;
    const key = `attune:${s.dwarf}`;
    const jobs = w.readers.of<JobsReader>('11');
    w.until(() => jobs.stateByKey(key) === 'working', TICKS_PER_DAY);
    killCreature(context(w), s.dwarf, 'killed');
    w.step(2);
    expect(w.game.world.entities.alive(s.dwarf)).toBe(false);
    // The death and the next hour each start a sweep of the board's own attune keys.
    w.step(TICKS_PER_HOUR + 5);
    expect(jobs.stateByKey(key)).toBeNull();
    expect(w.events('JobCancelled').filter((e) => e['jobType'] === 'attune').length).toBeGreaterThanOrEqual(1);
    expect(w.events('AttuneSession')).toHaveLength(0);
  });

  it('a removed apprentice\'s job goes; a sanctum with no glowcap makes none', () => {
    const s = sanctum('t469-cancel', { glowcap: 0 });
    const jobs = (): number => s.w.events('JobCreated').filter((e) => e['jobType'] === 'attune').length;
    s.w.step(200);
    expect(jobs()).toBe(0);
    s.w.spawnItem('glowcap', 'glowcap', s.w.index(X + 5, Y, Z), 5);
    s.w.step(20);
    expect(jobs()).toBe(1);
    s.w.game.world.applyCommand({ type: 'SetSanctumApprentices', zoneId: s.zone, dwarfIds: [] });
    s.w.step(5);
    expect(s.w.events('JobCancelled').length).toBeGreaterThanOrEqual(1);
    expect(s.w.events('AttuneSession')).toHaveLength(0);
  });
});

describe('T-469 the rune of one\'s own', () => {
  /** A level-10 runecaster at 0 rune; hours until it is full. */
  function fillHours(seed: string, armor: readonly [slot: 'head' | 'body', item: string][]): { hours: number; regen: number; line: string } {
    const s = sanctum(seed, { apprentice: false });
    const w = s.w;
    const entities = w.game.world.entities;
    w.setSkill(s.dwarf, 'runecraft', 10, cumulativeXp(10));
    entities.add(s.dwarf, C.Rune, { current: 0 });
    const equip = entities.get(s.dwarf, C.Equipment);
    if (equip === undefined) throw new Error('no equipment');
    const worn = { ...equip.armor };
    for (const [slot, item] of armor) {
      const id = w.spawnItem(item, 'iron', s.w.index(X, Y, Z), 1);
      worn[slot] = id;
    }
    entities.add(s.dwarf, C.Equipment, { ...equip, armor: worn });
    w.step(TICKS_PER_HOUR - (w.tick % TICKS_PER_HOUR));
    const view = magic(w).rune(s.dwarf);
    const line = runeLine(w.readers, registry, new Strings(registry), s.dwarf) ?? '';
    let hours = 0;
    while ((entities.get(s.dwarf, C.Rune)?.current ?? 0) < runeMaxMilli(10) && hours < 200) {
      w.step(TICKS_PER_HOUR);
      hours += 1;
    }
    return { hours, regen: view?.regen ?? 0, line };
  }

  it('fills from 0 in 50 hours in a tunic and 84 in an iron helm and mail', () => {
    const tunic = fillHours('t469-tunic', []);
    const iron = fillHours('t469-iron', [['head', 'helm'], ['body', 'mail_shirt']]);
    expect(tunic.regen).toBe(1000);
    expect(tunic.hours).toBe(50);
    expect(iron.regen).toBe(600);
    expect(iron.hours).toBe(84);
    expect(tunic.line).toMatch(/^Rune 0\/50, \+1 an hour; full (in \d+ days|tomorrow)$/);
    expect(iron.line).toMatch(/^Rune 0\/50, \+0\.6 an hour \(iron helm -20%, iron mail shirt -20%\); full in \d+ days$/);
  });

  it('a hostile creature never regenerates', () => {
    const s = sanctum('t469-hostile', { apprentice: false });
    const w = s.w;
    const goblin = w.spawnCreature('gloam_warrior', w.index(X + 1, Y + 1, Z), 'hostile:gloam');
    const entities = w.game.world.entities;
    entities.add(goblin, C.Hostile, { partyId: 0, role: 'hexer', behaviorState: 'attack', stealthed: false, spotted: true, breakingDoorId: 0, breakingSince: 0 });
    entities.add(goblin, C.Rune, { current: 3000 });
    w.setSkill(s.dwarf, 'runecraft', 5, cumulativeXp(5));
    entities.add(s.dwarf, C.Rune, { current: 0 });
    w.step(TICKS_PER_HOUR * 3);
    expect(entities.get(goblin, C.Rune)).toEqual({ current: 3000 });
    expect(entities.get(s.dwarf, C.Rune)?.current).toBe(1500);
  });
});

describe('T-469 mishaps', () => {
  it('the roll: a draw per session, a second for the kind only on a mishap', () => {
    const rng = new RngStream(46901);
    let mishaps = 0;
    const kinds: Record<string, number> = {};
    for (let k = 0; k < 20000; k += 1) {
      const kind = rollMishap(rng, 0, 0);
      if (kind === null) continue;
      mishaps += 1;
      kinds[kind] = (kinds[kind] ?? 0) + 1;
    }
    expect(mishaps / 20000).toBeGreaterThan(0.05);
    expect(mishaps / 20000).toBeLessThan(0.07);
    expect(Object.keys(kinds).sort()).toEqual(['blackout', 'fire', 'scorched_circle', 'singed', 'surge', 'wisp_loose']);
  });

  it('1,000 level-0 sessions in a bare sanctum: 60 ± 15 mishaps, none kills, takes a limb or destroys a stockpile item', () => {
    const s = sanctum('t469-thousand', { apprentice: false });
    const w = s.w;
    w.digRoom(X, Y + 5, Z, 2, 1);
    const stock = w.zone('stockpile', rect(w, X, Y + 5, Z, 2, 1));
    const crate = w.spawnItem('stone_block', 'granite', w.index(X, Y + 5, Z), 1);
    const watcher = w.spawnDwarf({ at: w.index(X + 1, Y + 1, Z) });
    const kinds: Record<string, number> = {};
    for (let k = 0; k < 1000; k += 1) {
      w.setSkill(s.dwarf, 'runecraft', 0, 0);
      rebuildCircle(s);
      const before = w.events('Mishap').length;
      completeSession(s);
      w.step(5);
      for (const e of w.events('Mishap').slice(before)) kinds[e['kind'] as string] = (kinds[e['kind'] as string] ?? 0) + 1;
    }
    w.step(TICKS_PER_DAY);
    const mishaps = w.events('Mishap').length;
    expect(mishaps).toBeGreaterThanOrEqual(45);
    expect(mishaps).toBeLessThanOrEqual(75);
    expect(w.events('AttuneSession')).toHaveLength(1000);
    // A loose wisp is no one's death: each fades, or dies as any creature does, and none is a dwarf (25 § Summons).
    const wisp = registry.table('creatures').index('wisp');
    expect(w.events('CreatureDied').filter((e) => e['species'] !== wisp)).toHaveLength(0);
    expect(w.events('CreatureDied')).toHaveLength(kinds['wisp_loose'] ?? 0);
    expect(w.events('CorpseCreated')).toHaveLength(0);
    expect(w.events('LimbLost')).toHaveLength(0);
    expect(w.events('ItemDestroyed')).toHaveLength(0);
    expect(w.events('FireStarted')).toHaveLength(0);
    expect(w.game.world.entities.alive(s.dwarf) && w.game.world.entities.alive(watcher)).toBe(true);
    expect(w.game.world.entities.alive(crate) && w.game.world.entities.alive(stock)).toBe(true);
    // No medic here: a mishap burn is made cleaned, so none takes infection. (A thousand sessions in a
    // few days stack enough burns to knock the dwarf down from pain; real sessions are two a day.)
    expect(w.events('InfectionStarted')).toHaveLength(0);
    // Each kind does what its row says.
    // A thousand sessions in a few days pile up burns no medic dresses; real sessions are two a day.
    expect(w.events('CreatureStunned')).toHaveLength(kinds['blackout'] ?? 0);
    expect(w.events('BuildingRemoved').length).toBe(kinds['scorched_circle'] ?? 0);
    expect(w.events('DamageDealt').every((e) => e['damageType'] === 'burn' && e['amount'] === 1 && e['attackerId'] === 0)).toBe(true);
    // A surge burns a loose wisp as it burns anyone; on so small a body the burn is no light wound.
    const wisps = new Set(w.events('CreatureDied').map((e) => e['id']));
    expect(w.events('WoundInflicted').filter((e) => e['woundType'] === 'burn' && !wisps.has(e['id'])).every((e) => (e['part'] === 'left_arm' || e['part'] === 'right_arm') && e['severity'] === 'light')).toBe(true);
  });

  it('a fire mishap lights a burnable tile beside the circle; a blackout knocks the dwarf down and admits no one', () => {
    const s = sanctum('t469-fire', { apprentice: false });
    const w = s.w;
    const world = w.game.world;
    // A wooden floor north of the circle can burn indoors.
    const north = w.index(X + 2, Y + 1, Z);
    world.services.terrain.setFlag(north, TileFlag.Constructed, true);
    world.services.terrain.setKind(north, world.map.kindAt(north), registry.table('materials').index('pine'));
    const producer = world.registrations.jobProducers.find((p) => p.id === 'magic');
    const fireCtx = context(w);
    (producer as unknown as { mishap(kind: string, d: EntityId, c: EntityId, z: EntityId, ctx: TickContext): void }).mishap('fire', s.dwarf, s.circle, s.zone, fireCtx);
    w.step(20);
    expect(w.events('Mishap').at(-1)).toMatchObject({ kind: 'fire', tile: north });
    expect(w.events('FireStarted').length + w.events('FireSpread').length).toBeGreaterThan(0);

    (producer as unknown as { mishap(kind: string, d: EntityId, c: EntityId, z: EntityId, ctx: TickContext): void }).mishap('blackout', s.dwarf, s.circle, s.zone, context(w));
    w.step(2);
    expect(world.entities.get(s.dwarf, C.Body)?.conscious).toBe(false);
    expect(world.entities.has(s.dwarf, C.Patient)).toBe(false);
    w.step(magicConstants.MISHAP_BLACKOUT_TICKS + 10);
    expect(world.entities.get(s.dwarf, C.Body)?.conscious).toBe(true);
    expect(w.events('PatientAdmitted').filter((e) => e['id'] === s.dwarf)).toHaveLength(0);
  });

  it('a singed apprentice with no medic heals on its own and takes no infection', () => {
    const s = sanctum('t469-singe-heals', { apprentice: false });
    const w = s.w;
    const world = w.game.world;
    // Nobody can treat: the apprentice is the only dwarf, and its labors are all off.
    for (const labor of registry.table<{ id: string }>('labors').ids()) w.setLabor(s.dwarf, labor, false);
    const producer = world.registrations.jobProducers.find((p) => p.id === 'magic');
    (producer as unknown as { mishap(kind: string, d: EntityId, c: EntityId, z: EntityId, ctx: TickContext): void }).mishap('singed', s.dwarf, s.circle, s.zone, context(w));
    w.step(5);
    const burns = (): { cleaned: boolean; infected: boolean }[] =>
      (world.entities.get(s.dwarf, C.Body)?.parts ?? []).flatMap((p) => p.wounds.filter((wd) => wd.type === 'burn'));
    expect(burns()).toHaveLength(1);
    expect(burns()[0]?.cleaned).toBe(true);
    for (let day = 0; day < 20 && burns().length > 0; day += 1) {
      w.step(TICKS_PER_DAY);
      w.setNeed(s.dwarf, 'hunger', 0);
      w.setNeed(s.dwarf, 'thirst', 0);
      expect(burns().some((b) => b.infected)).toBe(false);
    }
    expect(burns()).toHaveLength(0);
    expect(w.events('InfectionStarted')).toHaveLength(0);
    expect(w.events('CreatureDied')).toHaveLength(0);
    expect(w.events('TreatmentDone')).toHaveLength(0);
  });

  it('the same seed and command log give the same mishaps', () => {
    const run = (): string => {
      const s = sanctum('t469-replay', { apprentice: false });
      for (let k = 0; k < 200; k += 1) {
        s.w.setSkill(s.dwarf, 'runecraft', 0, 0);
        rebuildCircle(s);
        completeSession(s);
        s.w.step(2);
      }
      return JSON.stringify(s.w.events('Mishap').map((e) => [e['kind'], e['id']])) + s.w.hash();
    };
    expect(run()).toBe(run());
  });
});

describe('T-469 Proficient through the job', () => {
  it('level 10 in 74 ± 3 days at two sessions a day and Wits 50, with 148 ± 6 glowcap', () => {
    const s = sanctum('t469-proficient', { glowcap: 20 });
    const w = s.w;
    const start = w.tick;
    const items = w.readers.of<{ available(t: string): number }>('13');
    let spawned = 20;
    let day = -1;
    while (level(w, s.dwarf) < 10 && w.tick - start < TICKS_PER_DAY * 90) {
      // Glowcap rots in the open; the stock is kept topped up, and every session takes one.
      if (items.available('glowcap') < 5) { w.spawnItem('glowcap', 'glowcap', w.index(X + 5, Y, Z), 10); spawned += 10; }
      w.step(TICKS_PER_HOUR);
      w.setNeed(s.dwarf, 'hunger', 0);
      w.setNeed(s.dwarf, 'thirst', 0);
      w.setNeed(s.dwarf, 'rest', 0);
      rebuildCircle(s);
      if (level(w, s.dwarf) >= 10 && day < 0) day = Math.ceil((w.tick - start) / TICKS_PER_DAY);
    }
    // Each session consumes one glowcap (the one-day test counts the stock).
    const used = w.events('AttuneSession').length;
    expect(spawned).toBeGreaterThan(used);
    expect(day).toBeGreaterThanOrEqual(71);
    expect(day).toBeLessThanOrEqual(77);
    expect(used).toBeGreaterThanOrEqual(142);
    expect(used).toBeLessThanOrEqual(154);
    expect(w.events('FirstRunecaster')).toEqual([expect.objectContaining({ id: s.dwarf })]);
  }, 300_000);
});

describe('T-469 panels', () => {
  it('the sanctum panel and the inspector rune line show', () => {
    const s = sanctum('t469-panel');
    const w = s.w;
    w.until(() => w.events('AttuneSession').length >= 1, TICKS_PER_DAY);
    w.setSkill(s.dwarf, 'runecraft', 3, cumulativeXp(3));
    w.game.world.entities.add(s.dwarf, C.Rune, { current: 2500 });
    const strings = new Strings(registry);
    const zone = w.readers.of<BuildingsReader>('14').zone(s.zone);
    if (zone === undefined) throw new Error('no zone');
    const ctx = { readers: w.readers, registry, strings } as unknown as Parameters<typeof sanctumLines>[0];
    const lines = sanctumLines(ctx, zone).map((l) => l.text);
    const name = w.game.world.entities.get(s.dwarf, C.Creature)?.name ?? '';
    expect(lines[0]).toMatch(/^Glowcap in stock: \d+$/);
    expect(lines[1]).toBe('Mishaps, new apprentice: one session in 17');
    expect(lines[2]).toBe(`${name}: Runecraft 3, rune 2/15`);
    expect(lines[3]).toMatch(/^ {2}\d sessions left today; mishaps one session in 19$/);
    expect(lines.at(-1)).toMatch(/^(No mishap yet\.|Last mishap: .+)$/);
    expect(runeLine(w.readers, registry, strings, s.dwarf)).toMatch(/^Rune 2\/15, \+0\.3 an hour; full (in \d+ hours|tomorrow|in \d+ days)$/);
  });
});

describe('T-469 saves', () => {
  it('sessions, the stun, the last mishap and stream 25 survive a save; an older save loads with no Rune and no sanctum', async () => {
    const s = sanctum('t469-save');
    const w = s.w;
    w.until(() => magic(w).sessionsToday(s.dwarf) === 1, TICKS_PER_DAY);
    completeSession(s);
    w.step(1);
    w.game.world.emit({ type: 'CreatureStunned', id: s.dwarf, until: w.tick + 100 });
    w.step(1);
    const { game } = roundTrip(w.game);
    expect(game.world.rngFor('25').state()).toEqual(w.game.world.rngFor('25').state());
    expect((game.world.scheduler.byId('25') as MagicSystem).serialize()).toEqual(system(w).serialize());
    expect(game.world.scheduler.byId('17')?.serialize()).toEqual(w.game.world.scheduler.byId('17')?.serialize());
    for (let k = 0; k < 400; k += 1) { w.step(1); game.step(1); }
    expect(game.hash()).toBe(w.game.hash());

    const fixture = new Uint8Array(readFileSync(fileURLToPath(new URL('../../fixtures/played-fortress.deepholm', import.meta.url))));
    const old = await loadGame(fixture);
    expect(old.game.world.entities.with(C.Rune)).toEqual([]);
    expect(old.game.world.readers.of<MagicReader>('25').sanctums()).toEqual([]);
    old.game.step(TICKS_PER_HOUR * 2);
    expect(old.game.world.entities.with(C.Rune)).toEqual([]);
  });
});
