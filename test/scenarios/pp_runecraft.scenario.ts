/**
 * Player path: runecraft, the whole loop (T-477; `docs/process/player-paths.md`,
 * `25-runecraft.md`).
 *
 * From a Miner's Guild embark bought up with a table, blocks, pale bell seeds and an iron axe, on
 * a compact generated forest region, by commands only: a stockpile; a stair down to the rock, a
 * dark farm room on the soil level and a three-by-three room in the stone for the sanctum; a
 * jeweler's workshop that cuts the garnets and makes two glowstone lamps; the lamps placed in the
 * farm room and a glow plot of glowcap under them, with a cave plot of pale bell beside it; a
 * laboratory that distils the glowcap into rune vials and brews draughts of stoutness from the
 * pale bells; a rune circle in the sanctum and one apprentice who attunes there until the rune
 * comes to them; a runeforge that makes an iron staff of embers and sets a garnet in the iron axe;
 * a squad of the apprentice and an axedwarf, told to carry the draught. Then a raid.
 *
 * The runecraft chain's inputs that no embark sells are what a Mountainhome caravan brings
 * (two bags of glowcap seeds and two glowstones, `caravan-goods.md`) and three garnets a miner
 * would dig: they are placed in the stockpile on the first day. Everything the chain makes is
 * made by the fortress. The raid is brought on the day the squad stands ready, as the threat
 * schedule brings one to a riskier region (a Serene Vale has none).
 *
 * Asserted, as a player sees it: the apprentice throws an emberbolt from the staff the runeforge
 * made, the axedwarf holds the axe of embers, and a soldier drinks a draught of stoutness when the
 * raid arrives, on each of the set seeds. Wild animals stay on.
 */

import { expect } from 'vitest';
import { contentRegistry } from '@content/loader';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { EntityId, TileIndex } from '@core/types';
import { EmbarkSession } from '@systems/embark';
import type { CombatReader, SquadWithId } from '@systems/combat/reader';
import type { BuildingsSystem } from '@systems/buildings';
import type { ItemsReader } from '@systems/items';
import { arriveParty, spawnHostileMember } from '@systems/threats/parties';
import type { Scenario } from './runner';
import { built, cmd, day, dug, expectNoInvariantFindings, fortressDwarves, pathWorld, placeNear, playUntil, rect, stairToRock, surfaceZ, trace, wagon, zoneRect } from './player-path';
import { snapshot, snapshotsOn } from './snapshot';
import type { TestWorld } from './test-world';

/** The seeds the loop is played on. */
export const RUNECRAFT_SEEDS = ['pp-runecraft', 'pp-runecraft-2'] as const;
/** Long enough for one glowcap harvest (24 days), the vials, an apprenticeship and a raid. */
const MAX_DAYS = 48;

/** The Miner's Guild (an anvil, iron bars, a mason and a smith), with what the loop's workshops are built of. */
function embarkSession(seed: string): EmbarkSession {
  const session = new EmbarkSession(contentRegistry(), seed, 0);
  const ok = (r: { ok: boolean; reason?: string | null }, what: string): void => { if (!r.ok) throw new Error(`${what}: ${r.reason}`); };
  ok(session.apply({ type: 'ApplyPreset', preset: 'miner_s_guild' }), 'preset');
  // Paid for by what the loop does not need.
  for (const entry of ['e_dog', 'e_cat', 'e_leather', 'e_cloth', 'e_mechanism', 'e_charcoal', 'e_splints']) ok(session.apply({ type: 'SetSupply', entry, count: 0 }), entry);
  ok(session.apply({ type: 'SetSupply', entry: 'e_pick_iron', count: 2 }), 'two picks');
  ok(session.apply({ type: 'SetSupply', entry: 'e_table', count: 1 }), 'table');          // the laboratory
  ok(session.apply({ type: 'SetSupply', entry: 'e_blocks', count: 3 }), 'blocks');        // jeweler, laboratory, runeforge, circle, lamps
  ok(session.apply({ type: 'SetSupply', entry: 'e_seed_pale_bell', count: 1 }), 'pale bell seeds');
  ok(session.apply({ type: 'SetSupply', entry: 'e_axe_iron', count: 1 }), 'iron axe');   // the axe the garnet goes in
  ok(session.canEmbark(), 'embark');
  ok(session.apply({ type: 'ConfirmEmbark' }), 'confirm');
  return session;
}

function count(w: TestWorld, itemId: string, material?: string): number {
  const ent = w.game.world.entities;
  const type = w.game.registry.table('items').index(itemId);
  const mat = material === undefined ? -1 : w.game.registry.table('materials').index(material);
  let n = 0;
  for (const id of ent.with(C.Item)) {
    const it = ent.get(id, C.Item)!;
    if (it.type === type && (mat < 0 || it.material === mat)) n += it.count;
  }
  return n;
}

function level(w: TestWorld, id: EntityId, skill: string): number {
  return (w.game.world.entities.get(id, C.Skills)?.level[w.game.registry.table('skills').index(skill)] ?? 0) as number;
}

interface Played {
  readonly summary: string;
  readonly staffId: EntityId;
  readonly axeId: EntityId;
  readonly apprentice: EntityId;
  readonly soldier: EntityId;
  readonly castsFromStaff: number;
  readonly soldierWeapon: EntityId;
  readonly drunk: readonly { id: EntityId; draughtId: string }[];
  readonly raidTick: number;
}

function play(seed: string): Played {
  const w = pathWorld(seed, { session: embarkSession(seed) });
  const ent = w.game.world.entities;
  const items = w.readers.of<ItemsReader>('13');
    const reg = w.game.registry;
  const { x: cx, y: cy } = wagon(w);
  const z = surfaceZ(w, cx, cy);

  const stockpile = zoneRect(w, 'stockpile', cx - 4, cy + 3, z, 8, 5);
  cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
  // The caravan's goods and the miners' garnets, laid in the stockpile.
  const pile = rect(w, cx - 4, cy + 3, z, 8, 5).filter((t) => items.stockpileAt(t) === stockpile);
  w.spawnItem('seed', 'glowcap', pile[0]!, 10);
  w.spawnItem('seed', 'glowcap', pile[1]!, 10);
  w.spawnItem('rough_gem', 'glowstone', pile[2]!, 1);
  w.spawnItem('rough_gem', 'glowstone', pile[3]!, 1);
  for (let k = 0; k < 3; k += 1) w.spawnItem('rough_gem', 'garnet', pile[4 + k]!, 1);

  // The stair to the rock; a 10 × 3 farm room on the soil level, a 3 × 3 sanctum in the stone.
  const { sx, sy, below, rockZ } = stairToRock(w, cx + 6, cy + 9);
  const farm = rect(w, sx + 1, sy - 1, below, 10, 3);
  const sanctumRoom = rect(w, sx - 3, sy - 1, rockZ, 3, 3);
  cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: farm });
  cmd(w, { type: 'Designate', kind: 'dig', priority: 4, tiles: sanctumRoom });
  const lampTiles: TileIndex[] = [w.index(sx + 2, sy, below), w.index(sx + 5, sy, below)];
  const circleTile = w.index(sx - 2, sy, rockZ);

  const avoid = new Set<number>();
  const jeweler = placeNear(w, 'jeweler', cx - 8, cy - 4, avoid);
  const lab = placeNear(w, 'alchemist', cx - 3, cy - 6, avoid);
  const runeforge = placeNear(w, 'runeforge', cx + 3, cy - 6, avoid);

  const dwarves = fortressDwarves(w).sort((a, b) => a - b);
  // A miner sits in the sanctum; another miner takes the axe.
  const apprentice = dwarves[1]!;
  const soldier = dwarves[2]!;

  const s = {
    lamps: [] as EntityId[], glowPlot: 0, belPlot: 0, labOrdered: false, forgeOrdered: false, circle: 0, sanctum: 0,
    jewelerOrdered: false, apprenticed: false, released: false, setOrdered: false, squad: 0, raidTick: 0, soldierWeapon: 0,
  };
  const crafted = (recipe: string): EntityId[] => w.events('ItemCrafted').filter((e) => e['recipeId'] === recipe).map((e) => Number(e['itemId']));
  const staffs = (): EntityId[] => crafted('make_staff_garnet').filter((id) => ent.alive(id));
  const emberAxes = (): EntityId[] => w.events('StoneSet').map((e) => Number(e['itemId'])).filter((id) => ent.alive(id));
  const stout = (): number => count(w, 'stout_draught');

  // The days of the glowcap's planting and harvests, and its yield: events carry no tick.
  const glow = { planted: -1, harvests: [] as number[], units: 0, sessions: [] as number[], firstCast: -1, vialDays: [] as number[] };
  // With SNAPSHOTS=1, pictures of the loop's moments (`tooling.md` § Screenshots): the glow plot at
  // its first harvest, the apprentice's first session at the circle, its first three emberbolts.
  let bolts = 0;
  w.game.world.onEvents((batch) => {
    const shots: string[] = [];
    for (const e of batch) {
      if (e.type === 'CropPlanted' && e['species'] === 'glowcap' && glow.planted < 0) glow.planted = day(w);
      if (e.type === 'CropHarvested' && e['species'] === 'glowcap') {
        if (glow.harvests.length === 0) shots.push('glowcap-farm');
        glow.harvests.push(day(w));
        glow.units += Number(e['count'] ?? 0);
      }
      if (e.type === 'AttuneSession' && Number(e['id']) === apprentice) {
        if (glow.sessions.length === 0) shots.push('attunement');
        glow.sessions.push(day(w));
      }
      if (e.type === 'ItemCrafted' && e['recipeId'] === 'distill_rune') glow.vialDays.push(day(w));
      if (e.type === 'SpellCast' && Number(e['casterId']) === apprentice && glow.firstCast < 0) glow.firstCast = day(w);
      if (e.type === 'SpellCast' && Number(e['casterId']) === apprentice && e['spellId'] === 'emberbolt' && bolts < 3) {
        bolts += 1;
        shots.push(`emberbolt-${bolts}`);
      }
    }
    if (!snapshotsOn()) return;
    for (const shot of shots) {
      const caster = ent.get(apprentice, C.Position);
      const at = shot === 'glowcap-farm' ? { x: sx + 5, y: sy, z: below }
        : shot === 'attunement' ? { x: sx - 2, y: sy, z: rockZ }
          : { x: caster?.x ?? cx, y: caster?.y ?? cy, z: caster?.z ?? z };
      snapshot(w.game, `pp_runecraft-${seed}-${shot}`, { ...at, cols: 40, rows: 20 });
    }
  });

  const casts = (): number => {
    const weapon = ent.get(apprentice, C.Equipment)?.weapon ?? 0;
    if (weapon === 0 || !staffs().includes(weapon)) return 0;
    return w.events('SpellCast').filter((e) => Number(e['casterId']) === apprentice && e['spellId'] === 'emberbolt').length;
  };
  const drinks = (): { id: EntityId; draughtId: string }[] =>
    w.events('DraughtDrunk').map((e) => ({ id: Number(e['id']), draughtId: String(e['draughtId']) }));
  const done = (): boolean => s.raidTick > 0 && casts() > 0 && drinks().some((d) => d.draughtId === 'stout_draught');

  playUntil(w, done, MAX_DAYS * TICKS_PER_DAY, () => {
    if (!s.jewelerOrdered && built(w, jeweler)) {
      s.jewelerOrdered = true;
      cmd(w, { type: 'AddWorkOrder', workshopId: jeweler, order: { recipeId: 'cut_gem', mode: 'once', remaining: 3, materialFilter: 'garnet' } });
      cmd(w, { type: 'AddWorkOrder', workshopId: jeweler, order: { recipeId: 'make_glowstone_lamp', mode: 'once', remaining: 2 } });
    }
    // The lamps, once the jeweler has made them and the farm room is dug.
    if (s.lamps.length === 0 && dug(w, farm) && count(w, 'statue', 'glowstone') >= 2) {
      for (const t of lampTiles) {
        cmd(w, { type: 'PlaceBuilding', buildingType: 'statue', origin: t, orientation: 0, materialChoice: 'glowstone' });
        s.lamps.push((w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding);
      }
    }
    // The glow plot under the lamps, and pale bell in the dark beyond their light.
    if (s.glowPlot === 0 && s.lamps.length === 2 && s.lamps.every((id) => built(w, id))) {
      s.glowPlot = zoneRect(w, 'farm_plot', sx + 1, sy - 1, below, 6, 3);
      for (const season of [0, 1, 2, 3]) cmd(w, { type: 'SetPlotCrop', zoneId: s.glowPlot, season, speciesId: 'glowcap' });
      s.belPlot = zoneRect(w, 'farm_plot', sx + 8, sy - 1, below, 3, 3);
      for (const season of [0, 1, 2, 3]) cmd(w, { type: 'SetPlotCrop', zoneId: s.belPlot, season, speciesId: 'pale_bell' });
    }
    // The rune circle and the sanctum around it, once the stone room is dug.
    if (s.circle === 0 && dug(w, sanctumRoom)) {
      cmd(w, { type: 'PlaceBuilding', buildingType: 'rune_circle', origin: circleTile, orientation: 0, materialChoice: 0 });
      s.circle = (w.game.world.scheduler.byId('14') as BuildingsSystem).lastPlacedBuilding;
      s.sanctum = zoneRect(w, 'sanctum', sx - 3, sy - 1, rockZ, 3, 3);
    }
    if (!s.apprenticed && s.circle !== 0 && built(w, s.circle)) {
      s.apprenticed = true;
      cmd(w, { type: 'SetSanctumApprentices', zoneId: s.sanctum, dwarfIds: [apprentice] });
    }
    // Dabbling is enough to hold a staff: the apprentice leaves the circle, and the glowcap goes to vials.
    if (s.apprenticed && !s.released && level(w, apprentice, 'runecraft') >= 1) {
      s.released = true;
      cmd(w, { type: 'SetSanctumApprentices', zoneId: s.sanctum, dwarfIds: [] });
    }
    // The laboratory distils as the glowcap comes in: a vial for the circle, six for the axe, two for draughts, three for the pouch.
    if (!s.labOrdered && built(w, lab)) {
      s.labOrdered = true;
      // Draughts of stoutness first and kept in stock, so the first pale bells go to the laboratory and not
      // to the table, and a spoiled batch is brewed again.
      cmd(w, { type: 'AddWorkOrder', workshopId: lab, order: { recipeId: 'brew_stout_draught', mode: 'maintain', threshold: 2 } });
      cmd(w, { type: 'AddWorkOrder', workshopId: lab, order: { recipeId: 'distill_rune', mode: 'once', remaining: 13 } });
    }
    // The runeforge: the staff first, then the garnet in the iron axe once six vials stand ready.
    if (!s.forgeOrdered && built(w, runeforge)) {
      s.forgeOrdered = true;
      cmd(w, { type: 'AddWorkOrder', workshopId: runeforge, order: { recipeId: 'make_staff_garnet', mode: 'once', remaining: 1, materialFilter: 'iron' } });
    }
    if (s.forgeOrdered && !s.setOrdered && count(w, 'rune_vial') >= 6) {
      s.setOrdered = true;
      cmd(w, { type: 'AddWorkOrder', workshopId: runeforge, order: { recipeId: 'set_weapon_ember', mode: 'once', remaining: 1, materialFilter: 'iron', targetType: 'axe' } });
    }
    // The squad, once its kit is made: the staff for the runecaster, the axe of embers, the draught.
    if (s.squad === 0 && s.released && staffs().length > 0 && emberAxes().length > 0 && stout() > 0) {
      // A civilian woodcutter has first claim on an axe (16 § Equipment), and this fortress fells no trees.
      // A child holds no labor to turn off.
      for (const dwarfId of fortressDwarves(w)) {
        const r = w.game.world.applyCommand({ type: 'SetLabor', dwarfId, labor: 'woodcutting', on: false });
        if (!r.ok && r.reason !== 'child_labor') throw new Error(`SetLabor refused: ${r.reason}`);
      }
      cmd(w, { type: 'CreateSquad', name: 'Rune Guard' });
      const all = w.readers.of<CombatReader>('16').squads();
      s.squad = (all[all.length - 1] as SquadWithId).id;
      cmd(w, { type: 'SetSquadMembers', squadId: s.squad, members: [apprentice, soldier] });
      cmd(w, { type: 'SetSquadEquipment', squadId: s.squad, equipment: { draughts: ['stout_draught'] } });
      // The station: the nearest open tile north of the wagon that the game accepts.
      const station = rect(w, cx - 3, cy - 3, z, 7, 3).find((t) => w.game.world.applyCommand({ type: 'SetSquadStation', squadId: s.squad, tile: t }).ok);
      if (station === undefined) throw new Error('pp_runecraft: no station north of the wagon');
      cmd(w, { type: 'SetSquadMode', squadId: s.squad, mode: 'active' });
    }
    // A raid of three, once the squad holds its kit.
    if (s.squad !== 0 && s.raidTick === 0) {
      const eq = ent.get(apprentice, C.Equipment);
      const kitted = eq !== undefined && staffs().includes(eq.weapon) && emberAxes().includes(ent.get(soldier, C.Equipment)?.weapon ?? 0);
      const carries = ent.with(C.Item).some((id) => ent.get(id, C.Item)!.carriedBy === soldier && ent.get(id, C.Item)!.type === reg.table('items').index('stout_draught'));
      if (kitted && carries) {
        const rng = w.game.world.rngFor('18');
        const { pendingSpawns } = arriveParty(w.game.world as never, reg, rng, 'raid', 'gloam', 3, 'n', w.tick, 0, 1, false);
        for (const p of pendingSpawns) spawnHostileMember(w.game.world as never, reg, rng, p.partyId, p.species, p.role, p.tile, p.gearTier, p.isCaptain);
        s.raidTick = w.tick;
        s.soldierWeapon = ent.get(soldier, C.Equipment)?.weapon ?? 0;
      }
    }
  }, 100);

  const carried = (id: EntityId): string[] => ent.with(C.Item).filter((i) => ent.get(i, C.Item)!.carriedBy === id)
    .map((i) => reg.table<{ id: string }>('items').byIndex(ent.get(i, C.Item)!.type)?.id ?? '?');
  const staffId = staffs()[0] ?? 0;
  const axeId = emberAxes()[0] ?? 0;
  const harvested = (species: string): number => w.events('CropHarvested').filter((e) => e['species'] === species).length;
  const summary = `${trace(w, seed)}; lamps ${s.lamps.map((id) => built(w, id)).join('/')}; ` +
    `glowcap planted day ${glow.planted}, ${glow.units} glowcap from ${harvested('glowcap')} harvests on days ${glow.harvests[0] ?? -1}-${glow.harvests[glow.harvests.length - 1] ?? -1}, in stock ${count(w, 'glowcap')}; ` +
    `attuned on days ${JSON.stringify(glow.sessions)}; vials on days ${glow.vialDays[0] ?? -1}-${glow.vialDays[glow.vialDays.length - 1] ?? -1}; first cast day ${glow.firstCast}; pale bell harvested ${harvested('pale_bell')}; ` +
    `vials made ${crafted('distill_rune').length}, in stock ${count(w, 'rune_vial')}; circle ${built(w, s.circle)}; ` +
    `runecraft ${level(w, apprentice, 'runecraft')} after ${w.events('AttuneSession').filter((e) => Number(e['id']) === apprentice).length} sessions; ` +
    `staff ${staffId}; axe of embers ${axeId}; draughts brewed ${crafted('brew_stout_draught').length}, in stock ${stout()}; ` +
    `squad ${s.squad}; raid on day ${Math.floor(s.raidTick / TICKS_PER_DAY)}; caster holds ${JSON.stringify(carried(apprentice))}, ` +
    `soldier ${JSON.stringify(carried(soldier))}; emberbolts ${casts()}; drunk ${JSON.stringify(drinks())}`;
  console.log(summary);
  expectNoInvariantFindings(w, `${seed} day ${day(w)}`);
  return {
    summary, staffId, axeId, apprentice, soldier, castsFromStaff: casts(), soldierWeapon: s.soldierWeapon,
    drunk: drinks(), raidTick: s.raidTick,
  };
}

const scenario: Scenario = {
  id: 'pp_runecraft',
  milestone: 8,
  seed: RUNECRAFT_SEEDS[0],
  world: 'flat-test',
  timeoutMs: 600_000,
  run: () => {
    for (const seed of RUNECRAFT_SEEDS) {
      const r = play(seed);
      expect(r.staffId, `the runeforge made a staff; ${r.summary}`).toBeGreaterThan(0);
      expect(r.axeId, `a garnet was set in the axe; ${r.summary}`).toBeGreaterThan(0);
      expect(r.raidTick, `the squad stood ready for a raid; ${r.summary}`).toBeGreaterThan(0);
      expect(r.soldierWeapon, `the axedwarf held the axe of embers when the raid came; ${r.summary}`).toBe(r.axeId);
      expect(r.castsFromStaff, `the apprentice threw an emberbolt from the staff it made; ${r.summary}`).toBeGreaterThan(0);
      expect(r.drunk.some((d) => d.draughtId === 'stout_draught' && (d.id === r.soldier || d.id === r.apprentice)),
        `a soldier drank a draught of stoutness at the raid; ${r.summary}`).toBe(true);
    }
  },
};

export default scenario;
