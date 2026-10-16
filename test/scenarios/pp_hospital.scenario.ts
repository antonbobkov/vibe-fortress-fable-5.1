/**
 * Player path: hospital (T-330; `docs/process/player-paths.md`).
 *
 * From the Balanced embark on a compact generated forest region, by commands only: a roomy stockpile,
 * a carpenter's workshop with an order for a chest, a hospital zone beside the wagon with one of
 * the wagon's beds and the chest placed in it. The wagon's cloth, thread and splints are the
 * supplies; they must be hauled from the stockpile into the hospital chest.
 *
 * The wound is the one thing staged: once the chest holds supplies, a dwarf who is not the medic
 * takes a deep cut to the torso, as 16 would deal it (`DamageDealt`, the event `he_bandage`
 * uses). A wound is the hospital's input, not its product, and no command gives one; waiting
 * for a wild animal to deal it would make this the defence chain.
 *
 * Asserted, as a player sees it, within a season: supplies stood in the hospital chest, the
 * patient was admitted, diagnosed and treated with them, and survived. Wild animals stay on.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { DAYS_PER_SEASON, TICKS_PER_DAY } from '@core/constants';
import type { EntityId } from '@core/types';
import type { ItemsReader } from '@systems/items';
import type { DwarvesReader } from '@systems/dwarves';
import type { Scenario } from './runner';
import { built, cmd, day, expectNoInvariantFindings, fortressDwarves, pathWorld, placeAt, placeNear, playUntil, rect, surfaceZ, trace, wagon, zoneRect } from './player-path';
import { deathCounts } from './death-counts';

/** The supplies a medic draws for a bleeding cut. */
const SUPPLIES = ['cloth', 'thread'];

const scenario: Scenario = {
  id: 'pp_hospital',
  milestone: 8,
  seed: 'pp-hospital',
  world: 'flat-test',
  // The chest is built after the cloth was first found homeless, and nothing looks at it again.
  todo: 'T-336',
  timeoutMs: 300_000,
  run: () => {
    const w = pathWorld('pp-hospital');
    const { x: cx, y: cy } = wagon(w);
    const ent = w.game.world.entities;
    const items = w.readers.of<ItemsReader>('13');
    const itemTypes = w.game.registry.table('items');

    const stockpile = zoneRect(w, 'stockpile', cx - 12, cy + 3, surfaceZ(w, cx, cy), 14, 8);
    cmd(w, { type: 'SetStockpileFilter', zoneId: stockpile, filter: 'everything' });
    const avoid = new Set<number>(rect(w, cx + 4, cy + 3, surfaceZ(w, cx + 4, cy + 3), 5, 4));
    const carpenter = placeNear(w, 'carpenter', cx - 6, cy + 12, avoid);
    // The hospital: a 5 x 4 floor east of the stockpile, a bed and a chest in it.
    const hz = surfaceZ(w, cx + 4, cy + 3);
    const hospital = zoneRect(w, 'hospital', cx + 4, cy + 3, hz, 5, 4);
    const bed = placeAt(w, 'bed', w.index(cx + 5, cy + 4, hz));
    const chest = placeAt(w, 'chest', w.index(cx + 7, cy + 4, hz));

    // Supplies seen inside the hospital chest (the chest item the building installs), by item type.
    const chestItem = (): EntityId => ent.get(chest, C.Building)?.itemId ?? 0;
    const inChest = (): EntityId[] => (built(w, chest) ? items.inContainer(chestItem()) : []);
    const stocked = new Set<string>();
    const seen: string[] = [];
    let chestDay = -1;
    const look = (): void => {
      if (chestDay < 0 && built(w, chest)) chestDay = day(w);
      for (const id of inChest()) {
        const type = itemTypes.byIndex(ent.get(id, C.Item)?.type ?? -1)?.id ?? '?';
        if (!stocked.has(type)) seen.push(`${type} day ${day(w)}`);
        stocked.add(type);
      }
    };
    let ordered = false;
    playUntil(w, () => SUPPLIES.every((s) => stocked.has(s)), 20 * TICKS_PER_DAY, () => {
      if (!ordered && built(w, carpenter)) {
        ordered = true;
        cmd(w, { type: 'AddWorkOrder', workshopId: carpenter, order: { recipeId: 'make_chest_wood', mode: 'once', remaining: 1 } });
      }
      look();
    }, 50);
    const stockedDay = day(w);

    // The wound: a deep cut to the torso of the first adult who is not a medic.
    const dwarves = w.readers.of<DwarvesReader>('10');
    const patient = fortressDwarves(w).filter((id) => dwarves.skill(id, 'medicine') === 0)
      .sort((a, b) => a - b)[0] as EntityId;
    const chestBefore = inChest().reduce((n, id) => n + (ent.get(id, C.Item)?.count ?? 0), 0);
    if (SUPPLIES.every((s) => stocked.has(s))) {
      w.game.world.emit({ type: 'DamageDealt', defenderId: patient, part: 'torso', damageType: 'edge', amount: 20, attackerId: 0 });
    }
    const treatments = (): string[] => w.events('TreatmentDone').filter((e) => e['patientId'] === patient).map((e) => String(e['kind']));
    const done = (): boolean => w.events('PatientDischarged').some((e) => e['id'] === patient) || !ent.alive(patient);
    const finished = playUntil(w, done, DAYS_PER_SEASON * TICKS_PER_DAY - w.tick, look, 50);
    const chestAfter = inChest().reduce((n, id) => n + (ent.get(id, C.Item)?.count ?? 0), 0);

    const admitted = w.events('PatientAdmitted').some((e) => e['id'] === patient);
    const diagnosed = w.events('JobCompleted').some((e) => e['jobType'] === 'diagnose');
    const summary = `${trace(w, 'pp_hospital')}; hospital ${hospital}, bed ${built(w, bed)}, chest ${built(w, chest)}; ` +
      `chest built day ${chestDay}, stocked ${JSON.stringify(seen)}, wound day ${stockedDay}, units ${chestBefore} -> ${chestAfter}; patient ${patient} ` +
      `admitted ${admitted}, diagnosed ${diagnosed}, treated ${JSON.stringify(treatments())}, alive ${ent.alive(patient)}`;
    console.log(summary);
    expect(SUPPLIES.filter((s) => stocked.has(s)), `supplies hauled into the hospital chest; ${summary}`).toEqual(SUPPLIES);
    expect(admitted, `the patient was admitted; ${summary}`).toBe(true);
    expect(diagnosed, `the patient was diagnosed; ${summary}`).toBe(true);
    expect(treatments(), `the bleeding was stopped; ${summary}`).toContain('stop_bleeding');
    expect(chestAfter, `the treatment drew on the chest; ${summary}`).toBeLessThan(chestBefore);
    expect(finished && ent.alive(patient), `the patient survived and was discharged; ${summary}`).toBe(true);
    expect(deathCounts(w).dwarf, 'no dwarf died').toBe(0);
    expectNoInvariantFindings(w, `pp_hospital day ${day(w)}`);
  },
};

export default scenario;
