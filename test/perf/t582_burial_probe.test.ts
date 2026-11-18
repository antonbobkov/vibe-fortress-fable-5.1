/**
 * T-582's probe of the fixture's dead and beds: plays `defence_year` (or, with `T582_SEED` set to a
 * three-year seed, that seed at `THREE_YEARS_SHIFT` with the sweep's loop) to day `T582_DAYS`
 * (default 140), and prints every `T582_EVERY` days (default 7) the living, the unburied bodies,
 * whether an adult holds `unburied_dead`, the hall spirit, the tombs, coffins and slabs, the beds
 * (items, built, placed) with the straw and logs free, and the carpenter's and mason's orders and
 * current job; and each dwarf death and burial as it happens. Local diagnosis only (set
 * `T582_PROBE=1`); not part of `npm test`.
 */

import { describe, expect, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { DwarvesReader } from '@systems/dwarves';
import type { ItemsReader } from '@systems/items';
import type { JobsReader } from '@systems/jobs';
import type { MoraleReader } from '@systems/morale';
import type { TestWorld } from '../scenarios/test-world';
import {
  checkFortressCaveFarm,
  checkFortressDefense,
  checkFortressRooms,
  checkFortressWorkOrders,
  playThreeYears,
  setupThreeYearsFortress,
  threeYearsWorld,
  type FortressState,
} from '../scenarios/three_years_fortress';
import { playDefenceYear } from '../scenarios/defence_year_fortress';
import { owned } from '../scenarios/three_years_economy';

const SEED = process.env['T582_SEED'] ?? 'defence';
const SHIFT = Number(process.env['THREE_YEARS_SHIFT'] ?? '0');
const DAYS = Number(process.env['T582_DAYS'] ?? '140');
const EVERY = Number(process.env['T582_EVERY'] ?? '7');
const peril = (seed: string): number => Number(/-p(\d)-/.exec(seed)?.[1] ?? '4');

function journal(w: TestWorld, state: FortressState, out: string[]): void {
  const ent = w.game.world.entities;
  const buildings = w.readers.of<BuildingsReader>('14');
  const items = w.readers.of<ItemsReader>('13');
  const morale = w.readers.of<MoraleReader>('15');
  const jobs = w.readers.of<JobsReader>('11');
  const adults = w.readers.of<DwarvesReader>('10').adults().filter((id) => ent.get(id, C.Creature)?.faction === 'fortress');
  let bodies = 0;
  for (const id of ent.with(C.Corpse, C.Item)) {
    const c = ent.get(id, C.Corpse)!;
    if (c.dwarfName !== null && c.memorialized !== true) bodies += 1;
  }
  const holders = adults.filter((id) => morale.thoughts(id).some((t) => t.id === 'unburied_dead')).length;
  const states = (type: string): string => {
    const ids = buildings.byType(type);
    const built = ids.filter((id) => buildings.get(id)?.state === 'built');
    const occupied = built.filter((id) => ((buildings.get(id)?.settings['occupantId'] as number | undefined) ?? 0) !== 0).length;
    return `${built.length}b/${occupied}o/${ids.length - built.length}p`;
  };
  const recipes = w.game.registry.table<{ id: string }>('recipes');
  const shop = (key: string): string => {
    const id = state.placedIds[key] ?? 0;
    const ws = ent.get(id, C.Workshop);
    if (!ws) return `${key}:-`;
    const job = ws.currentJobId ? jobs.get(ws.currentJobId) : undefined;
    const orders = ws.orders.map((o) => `${recipes.byIndex(o.recipe)?.id}:${o.mode === 'once' ? o.remaining : `m${o.threshold}`}`).join(',');
    return `${key}[${buildings.get(id)?.state}] worker ${ws.assignedWorker} job ${job ? `${String(job.data['recipe'])}:${job.state}:p${job.priority}` : '-'} blocked ${ws.lastBlockedReason ?? '-'} orders ${orders}`;
  };
  const watch = new Set((state.watch ?? []).map((p) => p.dwarfId));
  const carpenters = adults.filter((id) => jobs.laborEnabled(id, 'carpentry')).map((id) => {
    const sq = ent.get(id, C.Soldier);
    const jid = ent.get(id, C.Worker)?.jobId ?? 0;
    return `${id}:${ent.get(id, C.Brain)?.activity ?? '?'}${jid ? `/${jobs.typeOf(jid)}` : ''}${sq && sq.squadId !== 0 ? `[sq${sq.squadId}${sq.onDuty ? ' duty' : ''}]` : ''}${watch.has(id) ? '[watch]' : ''}${state.economy.brewer === id ? '[brewer]' : ''}${Object.entries(state.economy.specialists).filter(([, v]) => v === id).map(([k]) => `[${k}]`).join('')}`;
  });
  const day = Math.floor(w.tick / TICKS_PER_DAY);
  out.push(`d${day} living ${adults.length} bodies ${bodies} unburiedHeld ${holders} spirit ${morale.hallSpirit()} tombs ${JSON.stringify((state.burial?.tombs ?? []).map((t) => t.zoneId))} ` +
    `coffins ${states('coffin')} loose ${items.available('coffin')} slabs ${states('memorial_slab')} memorials ${JSON.stringify(state.burial?.memorials ?? [])}`);
  const buries = [...jobs.list('open'), ...jobs.list('claimed'), ...jobs.list('blocked'), ...jobs.list('working'), ...jobs.list('fetching')]
    .filter((j) => jobs.typeOf(j.id) === 'bury').map((j) => `${j.state}:p${j.priority}:${j.blockedReason ?? ''}`);
  const corpses = [...ent.with(C.Corpse, C.Item)].filter((id) => ent.get(id, C.Corpse)!.dwarfName !== null).map((id) => {
    const t = items.tileOf(id);
    return `${id}@${t < 0 ? '-' : `${w.map.xOf(t) - state.cx - 6},${w.map.yOf(t) - state.cy - 6},${w.map.zOf(t) - state.z}`}${(ent.get(id, C.Item)!.flags & 1) ? 'F' : ''}`;
  });
  out.push(`   bury ${buries.join(' ')} corpses ${corpses.join(' ')}`);
  out.push(`   beds items ${owned(w, 'bed')} sleep ${states('bed')} pallets ${states('pallet')} freeBeds ${buildings.freeBeds().length} straw ${items.available('straw')} log ${items.available('log')} raw_stone ${items.available('raw_stone')}`);
  out.push(`   ${shop('carpenter')}`);
  out.push(`   ${shop('mason')}`);
  out.push(`   carpentry ${carpenters.join(' ')}`);
}

describe('T-582 probe: the dead and the beds', () => {
  it.runIf(process.env['T582_PROBE'] === '1')(SEED, () => {
    const out: string[] = [];
    const total = DAYS * TICKS_PER_DAY;
    let nextLook = 0;
    const events = (w: TestWorld): void => {
      const dwarf = w.game.registry.table('creatures').index('dwarf');
      w.game.world.onEvents((batch) => {
        for (const e of batch) {
          const d = `d${Math.floor(w.tick / TICKS_PER_DAY)}`;
          if (e.type === 'CreatureDied' && e['species'] === dwarf) out.push(`${d} DIED ${Number(e['id'])} ${String(e['cause'])}`);
          else if (e.type === 'Buried' || e.type === 'ImmigrationSkipped' || e.type === 'ImmigrantsArrived') out.push(`${d} ${e.type} ${JSON.stringify(e)}`);
        }
      });
    };
    let w: TestWorld;
    if (SEED === 'defence') {
      let st: FortressState | undefined;
      ({ w } = playDefenceYear({
        ticks: total,
        observe: (tw, s) => { st = s.fortress; events(tw); },
        watch: (tw) => {
          if (tw.tick >= nextLook) { nextLook += EVERY * TICKS_PER_DAY; journal(tw, st!, out); }
        },
      }));
    } else {
      w = threeYearsWorld(SEED, peril(SEED));
      if (SHIFT > 0) w.step(SHIFT);
      const state = setupThreeYearsFortress(w);
      events(w);
      const look = (): void => { if (w.tick >= nextLook) { nextLook += EVERY * TICKS_PER_DAY; journal(w, state, out); } };
      while (w.tick < total) {
        playThreeYears(w, state, Math.min(w.tick < 20 * TICKS_PER_DAY ? 100 : 300, total - w.tick), look);
        checkFortressWorkOrders(w, state);
        checkFortressRooms(w, state);
        checkFortressCaveFarm(w, state);
        checkFortressDefense(w, state);
      }
    }
    console.log(`[t582] ${SEED} shift ${SHIFT}\n${out.join('\n')}`);
    expect(w.tick).toBeGreaterThan(0);
  }, 7_200_000);
});
