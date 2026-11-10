/**
 * Defence year scenario script (T-151, Milestone 8): traps, a gate, a trained squad, a raid repelled.
 *
 * The fortress is the economy fixture of the three-year runs at peril 2, played as those runs play
 * it (its opening, its economy, its airlock gate and its answer to threats: three_years_fortress.ts),
 * with a defence a player adds by command on top of it: a mechanic's workshop, a kill corridor
 * before the gate's north door with a cage, a weapon and a stone-fall trap, a drawbridge at its
 * mouth on a lever in the hearth hall, raised behind a raid that has come into the corridor and
 * lowered when the raid is gone, and the squad trained in a barracks and an archery range, which
 * sallies through the north door on a few other hostiles the corridor has brought to it. No item is
 * spawned and no terrain is edited.
 */

import { TICKS_PER_DAY } from '@core/constants';
import { C } from '@core/components';
import type { Command } from '@core/commands';
import { TileKind } from '@core/map3d';
import type { BuildingsReader, BuildingsSystem } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { ThreatsReader } from '@systems/threats/reader';
import type { TestWorld } from './test-world';
import {
  threeYearsWorld,
  setupThreeYearsFortress,
  checkFortressWorkOrders,
  checkFortressRooms,
  checkFortressCaveFarm,
  checkFortressDefense,
  innerLineBuilt,
  musteredAt,
  HALL_Z,
  Z,
  type FortressState,
} from './three_years_fortress';
import { placeEconomyBuilding } from './three_years_economy';
import { stepThreeYears } from './three_years_measurements';
import { command } from './script-commands';

/** Two years: the ambushes and thieves of year 1 and the first raid of year 2 (18 § Schedule at peril 2). */
export const DEFENCE_YEAR_TICKS = 2 * 112 * TICKS_PER_DAY;
/** Ticks between two looks at the defence: as the fixture's own watch. */
const WATCH_EVERY = 20;
/** Defence works go ahead of routine work (5) and behind the squad's kit (3). */
const DEFENCE = 4;

export interface DefenceYearState {
  readonly fortress: FortressState;
  /** The corridor's walls (west), fortifications (east), and the tile of each trap and the bridge. */
  readonly wallTiles: number[];
  readonly fortTiles: number[];
  readonly trapTiles: { cage: number; weapon: number; stone: number };
  readonly bridgeTile: number;
  readonly corridor: number[];
  wallIds: number[];
  fortIds: number[];
  cageTrapId: number;
  weaponTrapId: number;
  stoneFallTrapId: number;
  drawbridgeId: number;
  leverId: number;
  archeryTargetId: number;
  archeryRangeZoneId: number;
  barracksZoneId: number;
  /** The trees on the works' sites are designated for felling, and the shrub under the bridge for a channel. */
  cleared: boolean;
  linkOrdered: boolean;
  /** The trial pulls after the link: raised, then lowered again. */
  trial: 'none' | 'raising' | 'lowering' | 'done';
  /** The bridge state a pull has been ordered for and not yet reached ('' when none is pending). */
  pulledFor: '' | 'raised' | 'lowered';
  trapModeSet: boolean;
  /** T-506: the times the north door was opened to the squad on a raid. */
  raidSallies: number;
  /** T-506: the squad is out on a raid, or coming back from it, through the open north door. */
  sallying?: boolean;
  /** T-506: the squad has been called back to the gate stair since the corridor cleared. */
  recalled?: boolean;
  /** The north door is open to the squad on hostiles of another party (noted once an opening). */
  othersSally?: boolean;
  readonly notes: string[];
}

function note(state: DefenceYearState, w: TestWorld, text: string): void {
  state.notes.push(`day ${Math.floor(w.tick / TICKS_PER_DAY) + 1} (tick ${w.tick}): ${text}`);
}

function place(w: TestWorld, buildingType: string, origin: number, extra: Record<string, unknown> = {}): number {
  const buildings = w.readers.of<BuildingsReader>('14');
  if (buildings.at(origin) !== 0 || buildings.ghost(buildingType, origin, 0).reason !== null) return 0;
  const r = command(w, { type: 'PlaceBuilding', buildingType, origin, orientation: 0, materialChoice: 0, priority: DEFENCE, ...extra } as Command);
  return r.ok ? (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding : 0;
}

/** The drawbridge of one by two tiles from `origin` southward, hinged on its outer tile. */
function placeBridge(w: TestWorld, origin: number, orientation: number): number {
  const buildings = w.readers.of<BuildingsReader>('14');
  const ghost = buildings.ghost('drawbridge', origin, orientation, 1, 2);
  if (buildings.at(origin) !== 0 || ghost.reason !== null) return 0;
  const r = command(w, { type: 'PlaceBuilding', buildingType: 'drawbridge', origin, orientation, materialChoice: 0, priority: DEFENCE, width: 1, height: 2 } as Command);
  return r.ok ? (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding : 0;
}

/**
 * A tile of the hearth hall, nearest the foot of the gate stair, free for a lever: the hall is
 * where the civilians shelter under the alert, and 11 offers a sheltering civilian the pull of a
 * lever inside its shelter only (10 § Behavior selection), so the bridge can be raised in a raid.
 */
function leverSite(w: TestWorld, state: DefenceYearState): number {
  const buildings = w.readers.of<BuildingsReader>('14');
  const { cx, cy } = state.fortress;
  const d = (t: number): number => Math.max(Math.abs(w.map.xOf(t) - cx - 6), Math.abs(w.map.yOf(t) - cy - 6));
  const hall = state.fortress.hearthHallTiles.filter((t) => w.map.kindAt(t) === TileKind.Floor && buildings.at(t) === 0)
    .sort((a, b) => d(a) - d(b) || a - b);
  return hall.find((t) => buildings.ghost('lever', t, 0).reason === null) ?? -1;
}

/** Tiles on the halls' level, not in a zone, that a zone of this type may take, nearest the gate stair first. */
function zoneTiles(w: TestWorld, state: DefenceYearState, type: string, count: number): number[] {
  const buildings = w.readers.of<BuildingsReader>('14');
  const { cx, cy } = state.fortress;
  // T-518: the dining hall the fortress script has planned stays its own: a barracks, a target or a
  // range put there while the hall waits for its kitchen refuses the hall its zone and its chairs later.
  const planned = new Set(state.fortress.diningHallTiles);
  const found: { t: number; d: number }[] = [];
  for (let y = 1; y < w.map.h - 1; y += 1) {
    for (let x = 1; x < w.map.w - 1; x += 1) {
      const t = w.index(x, y, HALL_Z);
      if (planned.has(t) || w.map.kindAt(t) !== TileKind.Floor || buildings.zoneAt(t) !== 0 || buildings.at(t) !== 0) continue;
      if (!buildings.zoneTileQualifies(type, t)) continue;
      found.push({ t, d: Math.abs(x - cx - 6) + Math.abs(y - cy - 6) });
    }
  }
  return found.sort((a, b) => a.d - b.d || a.t - b.t).slice(0, count).map((f) => f.t);
}

export function createDefenceYear(w: TestWorld, fortress: FortressState): DefenceYearState {
  const { cx, cy } = fortress;
  // The kill corridor before the north door (cx + 6, cy + 5): one tile wide on cy + 2 .. cy + 4,
  // walls to the west, fortifications to the east, a trap on each tile, and a drawbridge of two
  // tiles at its mouth (cy, cy + 1) hinged on the outer one. The sites are read from the ground, as
  // a player picks them: a shrub (which no building takes) on the west side is walled round.
  const ys = [cy + 1, cy + 2, cy + 3, cy + 4];
  const wallTiles: number[] = [];
  for (const y of ys) {
    const t = w.index(cx + 5, y, Z);
    if (w.map.kindAt(t) === TileKind.Shrub) for (const dy of [-1, 0, 1]) wallTiles.push(w.index(cx + 4, y + dy, Z));
    else wallTiles.push(t);
  }
  return {
    fortress,
    wallTiles: [...new Set(wallTiles)].filter((t) => w.map.kindAt(t) !== TileKind.Shrub),
    fortTiles: ys.map((y) => w.index(cx + 7, y, Z)),
    trapTiles: { weapon: w.index(cx + 6, cy + 2, Z), cage: w.index(cx + 6, cy + 3, Z), stone: w.index(cx + 6, cy + 4, Z) },
    bridgeTile: w.index(cx + 6, cy, Z),
    corridor: [cy + 2, cy + 3, cy + 4].map((y) => w.index(cx + 6, y, Z)),
    wallIds: [], fortIds: [],
    cageTrapId: 0, weaponTrapId: 0, stoneFallTrapId: 0, drawbridgeId: 0, leverId: 0,
    archeryTargetId: 0, archeryRangeZoneId: 0, barracksZoneId: 0,
    cleared: false, linkOrdered: false, trial: 'none', pulledFor: '', trapModeSet: false,
    raidSallies: 0, notes: [],
  };
}

/** The living members, on the map, of the raids and sieges that are not gone. */
function raiders(w: TestWorld): number[] {
  const ent = w.game.world.entities;
  const out: number[] = [];
  for (const id of ent.with(C.Party)) {
    const p = ent.get(id, C.Party);
    if (p === undefined || p.state === 'gone' || (p.purpose !== 'raid' && p.purpose !== 'siege')) continue;
    out.push(...p.members.filter((m) => ent.alive(m) && ent.get(m, C.Position) !== undefined));
  }
  return out;
}

/** Whether a creature stands on one of the corridor's tiles. */
function inCorridorTile(w: TestWorld, state: DefenceYearState, id: number): boolean {
  const p = w.game.world.entities.get(id, C.Position);
  return p !== undefined && state.corridor.includes(w.index(p.x, p.y, p.z));
}

/** The defence works, placed and ordered as their inputs and sites allow. */
export function checkDefenceWorks(w: TestWorld, state: DefenceYearState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const items = w.readers.of<ItemsReader>('13');
  const fortress = state.fortress;
  const built = (id: number): boolean => id !== 0 && buildings.get(id)?.state === 'built';

  placeEconomyBuilding(w, fortress, 'mechanic', 4, 12, DEFENCE);
  const mechanic = fortress.placedIds['mechanic'] ?? 0;
  if (built(mechanic) && !fortress.orderedWorkshops.has('mechanic')) {
    fortress.orderedWorkshops.add('mechanic');
    command(w, { type: 'AddWorkOrder', workshopId: mechanic, order: { recipeId: 'make_mechanism', mode: 'maintain', threshold: 4, priority: DEFENCE } });
  }
  const carpenter = fortress.placedIds['carpenter'] ?? 0;
  if (built(carpenter) && !fortress.orderedWorkshops.has('carpenter_defence')) {
    fortress.orderedWorkshops.add('carpenter_defence');
    command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_cage_wood', mode: 'maintain', threshold: 2, priority: DEFENCE } });
    command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_archery_target', mode: 'once', remaining: 1, priority: DEFENCE } });
    // T-522: the weapon trap is built from a weapon no soldier holds; a club is the carpenter's.
    command(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_club', mode: 'maintain', threshold: 1, priority: DEFENCE } });
  }
  // T-522: the carpenter takes its orders in list order (12 § Work orders), and from the second season
  // its standing barrel order is never met (its threshold follows the drink), so an order behind it
  // waits for good: cages an ambush carried off from the stockpile were never made again and the cage
  // trap stayed planned. The cage and the club lead the list, as a player moves a defence order up; a
  // maintained order that is met is passed over, so they cost the routine work nothing.
  const carpenterOrders = (): readonly { recipe: number }[] => w.game.world.entities.get(carpenter, C.Workshop)?.orders ?? [];
  const recipes = w.game.registry.table('recipes');
  for (const [want, recipe] of [[0, 'make_cage_wood'], [1, 'make_club']] as const) {
    const at = carpenterOrders().findIndex((o) => o.recipe === recipes.index(recipe));
    if (at > want) command(w, { type: 'ReorderWorkOrder', workshopId: carpenter, from: at, to: want });
  }

  const span = w.map.offset(state.bridgeTile, 0, 1, 0);
  if (!state.cleared) {
    state.cleared = true;
    const trees = [...state.wallTiles, ...state.fortTiles, ...state.corridor, state.bridgeTile, span].filter((t) => w.map.kindAt(t) === TileKind.Tree);
    if (trees.length > 0) command(w, { type: 'Designate', kind: 'chop', priority: DEFENCE, tiles: trees });
    // The bridge spans a channel one tile wide: a shrub there is dug away with it (03 § channel).
    if (w.map.kindAt(span) === TileKind.Shrub || w.map.kindAt(span) === TileKind.Floor) command(w, { type: 'Designate', kind: 'channel', priority: DEFENCE, tiles: [span] });
  }
  const mason = fortress.placedIds['mason'] ?? 0;
  if (built(mason) && !fortress.orderedWorkshops.has('mason_defence')) {
    fortress.orderedWorkshops.add('mason_defence');
    command(w, { type: 'AddWorkOrder', workshopId: mason, order: { recipeId: 'make_stone_block', mode: 'maintain', threshold: 4, priority: DEFENCE } });
  }
  state.wallTiles.forEach((t, k) => { if (!state.wallIds[k]) state.wallIds[k] = place(w, 'wall', t); });
  state.fortTiles.forEach((t, k) => { if (!state.fortIds[k]) state.fortIds[k] = place(w, 'fortification', t); });
  // The traps and the bridge wait for the mechanisms they are built from.
  if (items.count('mechanism') > 0) {
    if (!state.stoneFallTrapId) state.stoneFallTrapId = place(w, 'stone_fall_trap', state.trapTiles.stone);
    if (!state.weaponTrapId) state.weaponTrapId = place(w, 'weapon_trap', state.trapTiles.weapon);
    if (!state.cageTrapId && items.count('cage') > 0) state.cageTrapId = place(w, 'cage_trap', state.trapTiles.cage);
    if (!state.drawbridgeId && w.map.kindAt(span) === TileKind.Open) {
      for (const orientation of [0, 1, 2, 3]) {
        state.drawbridgeId = placeBridge(w, state.bridgeTile, orientation);
        if (state.drawbridgeId) break;
      }
    }
    if (!state.leverId && fortress.hearthHallSetup) {
      const site = leverSite(w, state);
      if (site >= 0) state.leverId = place(w, 'lever', site);
    }
  }
  if (!state.trapModeSet && built(state.stoneFallTrapId)) {
    command(w, { type: 'SetTrapMode', trapId: state.stoneFallTrapId, mode: 'enemies' });
    state.trapModeSet = true;
  }

  // The lever is linked to the bridge, then pulled twice to see the bridge rise and fall.
  if (!state.linkOrdered && built(state.leverId) && built(state.drawbridgeId) && items.count('mechanism') > 0) {
    command(w, { type: 'LinkMechanism', sourceId: state.leverId, targetId: state.drawbridgeId });
    state.linkOrdered = true;
  }
  const linked = built(state.leverId) && (buildings.get(state.leverId)?.linkedIds ?? []).includes(state.drawbridgeId);
  const bridge = state.drawbridgeId ? buildings.mechanismState(state.drawbridgeId) : '';
  if (linked && w.game.world.fortress.alert === 'calm') {
    if (state.trial === 'none') { command(w, { type: 'PullLever', leverId: state.leverId }); state.trial = 'raising'; }
    else if (state.trial === 'raising' && bridge === 'raised') { command(w, { type: 'PullLever', leverId: state.leverId }); state.trial = 'lowering'; }
    else if (state.trial === 'lowering' && bridge === 'lowered') { state.trial = 'done'; note(state, w, 'bridge trial done'); }
  }
  // After the trial the bridge closes the kill corridor: once raiders have come into it (over the
  // traps, to the north door, which the alert locks) it is raised behind them, so that the rest
  // of the raid has no way in and those inside none out; it is lowered when the raid is gone.
  if (linked && state.trial === 'done') {
    const inside = raiders(w);
    const want = inside.length > 0 && (bridge === 'raised' || state.pulledFor === 'raised' || inside.some((id) => inCorridorTile(w, state, id))) ? 'raised' : 'lowered';
    if (bridge === want) state.pulledFor = '';
    else if (state.pulledFor !== want) {
      command(w, { type: 'PullLever', leverId: state.leverId });
      state.pulledFor = want;
      note(state, w, `lever pulled: the bridge to be ${want}`);
    }
  }
  // The link and the pulls go ahead of the mechanic's standing order, as a player raises a job that has waited.
  const jobs = w.readers.of<JobsReader>('11');
  for (const job of jobs.list('open')) {
    if (['link_mechanism', 'pull_lever'].includes(jobs.typeOf(job.id) ?? '') && job.priority !== 1) command(w, { type: 'SetJobPriority', jobId: job.id, priority: 1 });
  }

  // The barracks and the archery range below, for the squad.
  if (!state.barracksZoneId && fortress.hearthHallSetup) {
    const tiles = zoneTiles(w, state, 'barracks', 9);
    if (tiles.length >= 6 && command(w, { type: 'CreateZone', zoneType: 'barracks', tiles }).ok) {
      state.barracksZoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
    }
  }
  if (!state.archeryTargetId && state.barracksZoneId && items.count('archery_target') > 0) {
    // The target blocks its tile: it stands in the open, with floor all round it, so that it never
    // closes a corridor (a target in the corridor to the bedrooms walled its builder in, who starved).
    const open = (t: number): boolean => [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => {
      const n = w.map.offset(t, dx, dy, 0);
      return n >= 0 && w.map.kindAt(n) === TileKind.Floor && (n === t || buildings.at(n) === 0);
    }));
    for (const t of zoneTiles(w, state, 'archery_range', 200).filter(open)) {
      const id = place(w, 'archery_target', t);
      if (id) { state.archeryTargetId = id; break; }
    }
  }
  if (!state.archeryRangeZoneId && built(state.archeryTargetId)) {
    const origin = buildings.get(state.archeryTargetId)!.origin;
    // T-503: a zone the fortress made while the target was being set up may hold its tile, and the
    // range would be refused for the overlap. The target comes down and is set up again on a free site.
    if (buildings.zoneAt(origin) !== 0) {
      command(w, { type: 'DeconstructBuilding', buildingId: state.archeryTargetId });
      note(state, w, `the archery target's tile was zoned meanwhile: the target comes down to be set up elsewhere`);
      state.archeryTargetId = 0;
      return;
    }
    const tiles = [origin, ...[-1, 1, -2, 2].map((d) => w.map.offset(origin, d, 0, 0))]
      .filter((t) => t >= 0 && (t === origin || (buildings.zoneAt(t) === 0 && !state.fortress.diningHallTiles.includes(t) && buildings.zoneTileQualifies('archery_range', t))));
    if (command(w, { type: 'CreateZone', zoneType: 'archery_range', tiles }).ok) {
      state.archeryRangeZoneId = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastCreatedZone;
    }
  }
}

/**
 * The squad: a leader, the barracks and the range, and training while nothing threatens. Under an
 * alert it is active and the fixture's answer stations it at the gate (three_years_fortress.ts).
 */
export function checkDefenceSquad(w: TestWorld, state: DefenceYearState): void {
  const fortress = state.fortress;
  if (fortress.squadId === 0) return;
  const combat = w.readers.of<CombatReader>('16');
  const buildings = w.readers.of<BuildingsReader>('14');
  const squad = combat.squads().find((s) => s.id === fortress.squadId);
  if (!squad || squad.members.length === 0) return;
  // T-522: a soldier who has just died is still on the roll until 16 drops it; the leader is a living one.
  const living = squad.members.find((id) => w.game.world.entities.alive(id));
  if (!squad.members.includes(squad.leaderId) && living !== undefined) command(w, { type: 'SetSquadLeader', squadId: squad.id, leaderId: living });
  for (const zoneId of [state.barracksZoneId, state.archeryRangeZoneId]) {
    if (zoneId && buildings.zone(zoneId)?.settings['squad'] !== squad.id) command(w, { type: 'SetZoneSetting', zoneId, key: 'squad', value: squad.id });
  }
  const want = w.game.world.fortress.alert !== 'calm' ? 'active' : state.barracksZoneId ? 'train' : 'off';
  if (squad.mode !== want) command(w, { type: 'SetSquadMode', squadId: squad.id, mode: want });
}

/** Living hostiles of the parties that are on the map. */
function hostiles(w: TestWorld): number[] {
  const ent = w.game.world.entities;
  const out: number[] = [];
  for (const pId of ent.with(C.Party)) {
    const p = ent.get(pId, C.Party);
    if (!p || p.state === 'gone') continue;
    out.push(...p.members.filter((m) => ent.alive(m) && ent.get(m, C.Position) !== undefined));
  }
  return out;
}

/** How many of the squad hold a weapon. */
function armedCount(w: TestWorld, squadId: number): number {
  const combat = w.readers.of<CombatReader>('16');
  return (combat.squads().find((q) => q.id === squadId)?.members ?? []).filter((id) => combat.weaponOf(id) !== 0).length;
}

/** At least three of the squad hold a weapon. */
function squadArmed(w: TestWorld, squadId: number): boolean {
  const combat = w.readers.of<CombatReader>('16');
  const members = combat.squads().find((q) => q.id === squadId)?.members ?? [];
  return members.filter((id) => combat.weaponOf(id) !== 0).length >= 3;
}

/** Living members, on the map, of the parties of `purpose` that are not gone. */
function partyMembers(w: TestWorld, purpose: string): number[] {
  const ent = w.game.world.entities;
  const out: number[] = [];
  for (const id of ent.with(C.Party)) {
    const p = ent.get(id, C.Party);
    if (p === undefined || p.state === 'gone' || p.purpose !== purpose) continue;
    out.push(...p.members.filter((m) => ent.alive(m) && ent.get(m, C.Position) !== undefined));
  }
  return out;
}

/** The gate stair's head: the gatehouse between the north door and the south one. */
function gateStair(w: TestWorld, state: DefenceYearState): number {
  return w.index(state.fortress.cx + 6, state.fortress.cy + 6, Z);
}

/** The squad's living members out on the surface, beyond the gate (the corridor or the open). */
function soldiersOut(w: TestWorld, state: DefenceYearState): number[] {
  const ent = w.game.world.entities;
  const stair = gateStair(w, state);
  const members = w.readers.of<CombatReader>('16').squads().find((q) => q.id === state.fortress.squadId)?.members ?? [];
  return members.filter((id) => {
    const p = ent.get(id, C.Position);
    return ent.alive(id) && p !== undefined && p.z === Z && w.index(p.x, p.y, p.z) !== stair;
  });
}

/** T-506: tiles from the north door, on the surface, within which the squad runs down a broken raid. */
const PURSUIT_TILES = 10;

/**
 * T-506: the raiders a sally goes out for. A raid that is steady or shaken is left to the traps behind
 * the locked door. One that wavers or is breaking (18 § Morale: below 50) is fought in the corridor; one
 * that has broken (`retreat`) is run down within PURSUIT_TILES of the north door.
 */
function sallyTargets(w: TestWorld, state: DefenceYearState): number[] {
  const ent = w.game.world.entities;
  const threats = w.readers.of<ThreatsReader>('18');
  const doorX = state.fortress.cx + 6;
  const doorY = state.fortress.cy + 5;
  const out: number[] = [];
  for (const pId of ent.with(C.Party)) {
    const p = ent.get(pId, C.Party);
    if (p === undefined || p.purpose !== 'raid' || p.state === 'gone') continue;
    const broken = p.state === 'retreat';
    const word = threats.moraleWord(pId);
    if (!broken && word !== 'wavering' && word !== 'breaking') continue;
    for (const m of p.members) {
      const pos = ent.get(m, C.Position);
      if (!ent.alive(m) || pos === undefined || ent.get(m, C.Hostile)?.stealthed === true) continue;
      const near = broken ? pos.z === Z && Math.max(Math.abs(pos.x - doorX), Math.abs(pos.y - doorY)) <= PURSUIT_TILES
        : state.corridor.includes(w.index(pos.x, pos.y, pos.z));
      if (near) out.push(m);
    }
  }
  return out;
}

/**
 * Under the alert: hostiles that have come up the corridor stand at the locked north door, over the
 * traps.
 *
 * T-506: a raid that wavers or has broken is met there (sallyTargets). Once the second line stands
 * (T-518: the four doors at the gate stair's foot, locked under the alert) the north door is the
 * corridor's end and no longer the halls' way in. The squad first musters at the gate stair (T-539:
 * three armed members there); then the north door is opened to it and it is ordered to kill each
 * raider of a wavering raid in the corridor, or of a broken one near the gate. Whatever comes
 * through the door finds the squad on the stair and the locked line below it. T-504's sally, before
 * the line, let a raid down the stair into the halls, and none is made without it, nor on a siege,
 * whose trollkin break doors. A steady raid is not sallied on: with the traps spent, a squad that
 * met a whole raid in the corridor lost four soldiers and the raid looted all the same. The door
 * stays open while there is a raider to fight or a soldier is out beyond the gate; once there is
 * none, the squad is called back to the stair, the door locks on the alert again when the last
 * soldier is in, and the fortress script answers the alert afresh.
 *
 * Hostiles of an ambush, a band or a thief are sallied on as before: while they are fewer than the
 * squad's armed members the north door is opened to the squad, which waits behind it on the gate stair
 * and is ordered to kill each of them; the door goes back to locking on the alert once the corridor is
 * clear.
 */
export function checkDefenceRaid(w: TestWorld, state: DefenceYearState): void {
  const buildings = w.readers.of<BuildingsReader>('14');
  const ent = w.game.world.entities;
  const inCorridor = hostiles(w).filter((id) => {
    const p = ent.get(id, C.Position);
    return p !== undefined && ent.get(id, C.Hostile)?.stealthed !== true && state.corridor.includes(w.index(p.x, p.y, p.z));
  });
  const door = state.fortress.gateDoorId2;
  const squadId = state.fortress.squadId;
  if (door === 0 || buildings.get(door)?.state !== 'built') return;
  const raid = new Set(raiders(w));
  const hearth = w.game.world.fortress.alert === 'hearth';
  const order = (targets: number[]): void => {
    const orders = w.readers.of<CombatReader>('16').squads().find((q) => q.id === squadId)?.orders ?? [];
    for (const targetId of targets) {
      if (!orders.some((o) => o.kind === 'kill' && o.targetId === targetId)) command(w, { type: 'SquadOrder', squadId, order: { kind: 'kill', targetId } });
    }
  };
  // T-506: the sally on a raid that wavers or has broken.
  const targets = sallyTargets(w, state);
  const out = squadId === 0 ? [] : soldiersOut(w, state);
  const stair = gateStair(w, state);
  const begin = hearth && targets.length > 0 && squadId !== 0 && partyMembers(w, 'siege').length === 0 &&
    innerLineBuilt(w, state.fortress) && squadArmed(w, squadId);
  if (begin && state.sallying !== true && !musteredAt(w, state.fortress, stair)) {
    // The squad musters at the gate stair first (T-539), so that it goes out together.
    const orders = w.readers.of<CombatReader>('16').squads().find((q) => q.id === squadId)?.orders ?? [];
    const last = orders[orders.length - 1];
    if (last?.kind !== 'station' || last.tile !== stair) command(w, { type: 'SquadOrder', squadId, order: { kind: 'station', tile: stair } });
    return;
  }
  if (hearth && (begin || (state.sallying === true && (targets.length > 0 || out.length > 0)))) {
    if (state.sallying !== true) {
      state.sallying = true;
      state.raidSallies += 1;
      note(state, w, `north door opened to the squad on the raid: ${targets.length} to fight`);
    }
    // The fortress script sets the gate's doors back to lock on the alert at each look (checkFortressDefense).
    if (buildings.get(door)?.mode !== 'open') command(w, { type: 'SetDoorMode', buildingId: door, mode: 'open' });
    if (targets.length > 0) {
      state.recalled = false;
      order(targets);
    } else if (state.recalled !== true) {
      // Nothing left to fight: the squad comes back to the stair before the door locks.
      state.recalled = true;
      command(w, { type: 'SquadOrder', squadId, order: { kind: 'cancel' } });
      command(w, { type: 'SquadOrder', squadId, order: { kind: 'station', tile: stair } });
      note(state, w, `the squad called back to the gate stair, ${out.length} out`);
    }
    return;
  }
  if (state.sallying === true) {
    state.sallying = false;
    state.recalled = false;
    // The fortress script answers the alert afresh: its post for the squad, or none once it is calm.
    state.fortress.answered = '';
    note(state, w, 'the sally on the raid is over');
  }
  if (hearth && inCorridor.length > 0 && !inCorridor.some((id) => raid.has(id)) &&
      squadId !== 0 && squadArmed(w, squadId) && inCorridor.length < armedCount(w, squadId)) {
    // The fortress script sets the gate's doors back to lock on the alert at each look
    // (checkFortressDefense): the door is opened again, and the opening noted once.
    if (buildings.get(door)?.mode !== 'open') command(w, { type: 'SetDoorMode', buildingId: door, mode: 'open' });
    if (state.othersSally !== true) note(state, w, `north door opened to the squad on ${inCorridor.length} in the corridor`);
    state.othersSally = true;
    order(inCorridor);
  } else {
    state.othersSally = false;
    if (buildings.get(door)?.mode === 'open') {
      command(w, { type: 'SetDoorMode', buildingId: door, mode: 'lock_on_alert' });
      note(state, w, 'north door locks on the alert again');
    }
  }
}

export interface DefenceYearOptions {
  readonly ticks?: number;
  /** The world seed; the scenario's own is `defence-year`. */
  readonly seed?: string;
  /** Ticks between two looks at the defence (WATCH_EVERY); another value moves only the job timeline. */
  readonly watchEvery?: number;
  /** Called once, before the first tick, to attach observers. */
  readonly observe?: (w: TestWorld, state: DefenceYearState) => void;
  /** Looked at every 100 ticks; true ends the run early. */
  readonly until?: (w: TestWorld, state: DefenceYearState) => boolean;
  /** Looked at every WATCH_EVERY ticks. */
  readonly watch?: (w: TestWorld, state: DefenceYearState) => void;
}

export function playDefenceYear(options: DefenceYearOptions = {}): { w: TestWorld; state: DefenceYearState } {
  const { ticks = DEFENCE_YEAR_TICKS, seed = 'defence-year', watchEvery = WATCH_EVERY, observe, until, watch } = options;
  // The defences are tested against the parties that 18 sends. Natural surface arrivals are left
  // out, as in `hospital_run`: which dwarf a boar kills is not what the assertions are about.
  // T-451: level ground; its corridor and walls are laid out by hand at fixed tiles.
  const w = threeYearsWorld(seed, 2, 'none', 0);
  const fortress = setupThreeYearsFortress(w);
  const state = createDefenceYear(w, fortress);
  observe?.(w, state);
  checkDefenceWorks(w, state);
  let lastManaged = -Infinity;
  while (w.tick < ticks) {
    stepThreeYears(w, Math.min(watchEvery, ticks - w.tick));
    checkFortressDefense(w, fortress);
    checkDefenceSquad(w, state);
    checkDefenceRaid(w, state);
    watch?.(w, state);
    if (w.tick - lastManaged >= 100) {
      lastManaged = w.tick;
      checkFortressWorkOrders(w, fortress);
      checkFortressRooms(w, fortress);
      checkFortressCaveFarm(w, fortress);
      checkDefenceWorks(w, state);
      if (until?.(w, state) === true) break;
    }
  }
  return { w, state };
}
