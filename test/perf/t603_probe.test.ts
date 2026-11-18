import { describe, it } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { CombatReader } from '@systems/combat/reader';
import { weaponOf } from '@systems/combat/melee';
import type { ItemsReader } from '@systems/items';
import {
  checkFortressCaveFarm, checkFortressDefense, checkFortressRooms, checkFortressWorkOrders, playThreeYears, setupThreeYearsFortress, threeYearsWorld,
} from '../scenarios/three_years_fortress';

const SEED = process.env['T603_SEED'] ?? 'three-years-p2-1';
const PERIL = Number(process.env['T603_PERIL'] ?? '2');
const DAYS = Number(process.env['T603_DAYS'] ?? '130');

describe('T-603 probe', () => {
  it(`plays ${SEED} to day ${DAYS} and prints the strong squad`, () => {
    const w = threeYearsWorld(SEED, PERIL);
    const state = setupThreeYearsFortress(w);
    const ent = w.game.world.entities;
    const reg = w.game.registry;
    const combat = w.readers.of<CombatReader>('16');
    const items = w.readers.of<ItemsReader>('13');
    let seen = -1;
    while (w.tick < DAYS * TICKS_PER_DAY) {
      playThreeYears(w, state, 300);
      checkFortressWorkOrders(w, state);
      checkFortressRooms(w, state);
      checkFortressCaveFarm(w, state);
      checkFortressDefense(w, state);
      const day = Math.floor(w.tick / TICKS_PER_DAY);
      if (day === seen || day % 3 !== 0 || day < 110) continue;
      seen = day;
      const squads = combat.squads().map((sq) => ({ id: sq.id, name: sq.name, mode: sq.mode, station: sq.station, barracks: (sq as { barracksZoneId?: number }).barracksZoneId,
        members: sq.members.map((id) => {
          const wp = weaponOf(ent, reg, id);
          const p = ent.get(id, C.Position);
          return { id, weapon: wp?.weaponDef.id ?? null, duty: ent.get(id, C.Soldier)?.onDuty, behavior: ent.get(id, C.Brain)?.behavior, activity: ent.get(id, C.Brain)?.activity, at: p ? `${p.x},${p.y},${p.z}` : null,
            sword: ent.get(id, C.Skills)?.level[reg.table('skills').index('sword')] };
        }) }));
      console.log(`[t603] ${JSON.stringify({ day, swords: items.available('short_sword'), spears: items.available('spear'), barracks: state.strong?.barracks, squads })}`);
    }
  });
});
