/**
 * Player path: defence (T-330; `docs/process/player-paths.md`).
 *
 * From the Warband embark (two iron axes, two shields, two helms, two leather jerkins) on a
 * compact generated forest region with no trait, so that its wolves and bears arrive as they do
 * in any forest, by commands only: a stockpile beside the wagon; woodcutting turned off for
 * everyone, since a civilian woodcutter has first claim on an axe (16 § Equipment) and this
 * fortress fells no trees; a squad of the two dwarves best with the axe, formed once the wagon's
 * axes are in the stockpile; and a player's watch: an aggressive or territorial wild animal on
 * the map that can walk to the wagon raises the hearth alert and sends the squad to kill it; the alert stands down when
 * none has been seen for a while.
 *
 * Asserted, as a player sees it, within two seasons: each soldier took a weapon out of the
 * stockpile, the alert was raised, and a soldier killed a hostile wild animal. The hostile is the
 * region's own wildlife: nothing is spawned.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { AnimalsReader } from '@systems/animals';
import type { CombatReader } from '@systems/combat';
import type { ItemsReader } from '@systems/items';
import type { DwarvesReader } from '@systems/dwarves';
import type { Scenario } from './runner';
import { cmd, day, expectNoInvariantFindings, fortressDwarves, pathWorld, playUntil, surfaceZ, trace, wagon, zoneRect } from './player-path';
import type { TestWorld } from './test-world';

/** The alert stands down after this long with no dangerous animal seen. */
const ALL_CLEAR_TICKS = 300;
/** How long the player waits for the wagon's gear to reach the stockpile. */
const HAUL_DAYS = 3;
/** The squad: the dwarves best with the axe. */
const SQUAD_SIZE = 2;

/** The days the player waits for a dangerous animal and its death: arrivals follow the random stream, so the day moves with the job timeline. */
const WAIT_DAYS = 2 * DAYS_PER_SEASON;

/**
 * The aggressive or territorial wild animals on the map, as the player sees them listed, that can
 * walk to the wagon: one across the brook is no danger, and an alert held for it shuts the
 * civilians in for weeks.
 */
function dangerous(w: TestWorld, home: number): EntityId[] {
  const ent = w.game.world.entities;
  const animals = w.readers.of<AnimalsReader>('08');
  const label = w.readers.pathing.labelOf(home, 'walker');
  return animals.wildList().filter((id) => {
    const temper = animals.def(ent.get(id, C.Creature)?.species ?? -1)?.temper;
    const p = ent.get(id, C.Position);
    return p !== undefined && (temper === 'aggressive' || temper === 'territorial') && w.readers.pathing.labelOf(w.index(p.x, p.y, p.z), 'walker') === label;
  }).sort((a, b) => a - b);
}

const scenario: Scenario = {
  id: 'pp_defence',
  milestone: 8,
  seed: 'pp-defence',
  world: 'flat-test',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-defence', { preset: 'warband' }, { traits: [] });
    const { x: cx, y: cy } = wagon(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const combat = w.readers.of<CombatReader>('16');
    const animals = w.readers.of<AnimalsReader>('08');
    const itemTypes = w.game.registry.table('items');
    const species = (id: EntityId): string => w.game.registry.table<{ id: string }>('creatures').byIndex(ent.get(id, C.Creature)?.species ?? -1)?.id ?? '?';

    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    for (const dwarfId of fortressDwarves(w)) cmd(w, { type: 'SetLabor', dwarfId, labor: 'woodcutting', on: false });

    // The wagon's axes, and the ones seen lying in the stockpile.
    const axes = ent.with(C.Item).filter((id) => itemTypes.byIndex(ent.get(id, C.Item)!.type)?.id === 'axe');
    const stocked = new Set<EntityId>();
    const look = (): void => {
      for (const id of axes) if (ent.alive(id) && items.stockpileAt(items.tileOf(id)) === stockpile) stocked.add(id);
    };
    playUntil(w, () => stocked.size === axes.length, HAUL_DAYS * TICKS_PER_DAY, look);

    const dwarves = w.readers.of<DwarvesReader>('10');
    const members = fortressDwarves(w).sort((a, b) => dwarves.skill(b, 'axe') - dwarves.skill(a, 'axe') || a - b).slice(0, SQUAD_SIZE);
    cmd(w, { type: 'CreateSquad', name: 'Wagon Guard' });
    const squadId = combat.squads()[0]!.id;
    cmd(w, { type: 'SetSquadMembers', squadId, members });
    cmd(w, { type: 'SetSquadEquipment', squadId, equipment: { weaponClass: 'any', armor: 'any' } });

    let lastDanger = -ALL_CLEAR_TICKS;
    let answered = '';
    const ordered = new Map<EntityId, string>();
    const armed = new Map<EntityId, EntityId>();
    const kills = (): string[] => w.events('KillRecorded')
      .filter((e) => members.includes(Number(e['killerId'])) && ordered.has(Number(e['victimId'])))
      .map((e) => ordered.get(Number(e['victimId'])) as string);
    const watch = (): void => {
      look();
      for (const id of members) {
        const weapon = ent.get(id, C.Equipment)?.weapon ?? 0;
        if (!armed.has(id) && stocked.has(weapon)) armed.set(id, weapon);
      }
      const targets = dangerous(w, w.index(cx, cy, surfaceZ(w, cx, cy)));
      if (targets.length > 0) {
        lastDanger = w.tick;
        if (w.game.world.fortress.alert !== 'hearth') cmd(w, { type: 'SetAlert', level: 'hearth' });
        const key = targets.join(',');
        if (key !== answered) {
          answered = key;
          cmd(w, { type: 'SquadOrder', squadId, order: { kind: 'cancel' } });
          for (const targetId of targets) {
            ordered.set(targetId, species(targetId));
            cmd(w, { type: 'SquadOrder', squadId, order: { kind: 'kill', targetId } });
          }
        }
      } else if (w.game.world.fortress.alert === 'hearth' && w.tick - lastDanger >= ALL_CLEAR_TICKS) {
        cmd(w, { type: 'SetAlert', level: 'calm' });
        cmd(w, { type: 'SquadOrder', squadId, order: { kind: 'cancel' } });
        answered = '';
      }
    };
    const finished = playUntil(w, () => kills().length > 0, WAIT_DAYS * TICKS_PER_DAY - w.tick, watch);

    const hearth = w.events('AlertChanged').filter((e) => e['to'] === 'hearth').length;
    const summary = `${trace(w, 'pp_defence')}; axes ${axes.length}, stocked ${stocked.size}; squad ${members.length}, ` +
      `armed from the stockpile ${armed.size}; hearth alerts ${hearth}; ordered ${JSON.stringify([...ordered.values()])}; ` +
      `kills ${JSON.stringify(kills())}; wild now ${JSON.stringify(animals.wildList().map(species))}`;
    console.log(summary);
    expect(stocked.size, `the wagon's axes reached the stockpile; ${summary}`).toBe(axes.length);
    expect(armed.size, `each soldier took a weapon from the stockpile; ${summary}`).toBe(members.length);
    expect(hearth, `the alert was raised; ${summary}`).toBeGreaterThan(0);
    expect(finished, `a soldier killed a hostile wild animal by day ${WAIT_DAYS}; ${summary}`).toBe(true);
    expectNoInvariantFindings(w, `pp_defence day ${day(w)}`);
  },
};

export default scenario;
