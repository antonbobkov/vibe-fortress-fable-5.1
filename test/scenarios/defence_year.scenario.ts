/**
 * `defence_year` scenario (Milestone 8, T-151): traps, a gate, a trained squad, a raid repelled.
 * The script is `defence_year_fortress.ts`: the three-year economy fixture at peril 2 with a defence
 * added by command. Everything the work file asks of the defence is a witness of the run.
 */

import { expect } from 'vitest';
import { C } from '@core/components';
import { TICKS_PER_DAY } from '@core/constants';
import type { BuildingsReader } from '@systems/buildings';
import type { CombatReader } from '@systems/combat/reader';
import type { DefenseReader } from '@systems/defense';
import type { Scenario } from './runner';
import { playDefenceYear } from './defence_year_fortress';
import { scriptRecord } from './script-commands';

const scenario: Scenario = {
  id: 'defence_year',
  milestone: 8,
  seed: 'defence-year',
  world: 'flat-test',
  timeoutMs: 1_200_000,
  // The year-2 raid (day 116) stands at the locked north door for the rest of the run, cycling
  // between approach and engage and never loitering or retreating (T-389's fault, here with a raid),
  // and the hearth alert it holds up starves the fortress from day 146.
  todo: 'T-389',
  run: () => {
    const soldiers = new Set<number>();
    const soldierKills: { killer: number; victim: string }[] = [];
    const hearthEpisodes: { locked: boolean }[] = [];
    let wasHearth = false;
    const { w, state } = playDefenceYear({
      observe: (tw) => {
        tw.game.world.onEvents((batch) => {
          for (const e of batch) {
            if (e.type === 'KillRecorded' && e['hostile'] === true && soldiers.has(e['killerId'] as number)) {
              soldierKills.push({ killer: e['killerId'] as number, victim: String(e['victimName']) });
            }
          }
        });
      },
      watch: (tw, st) => {
        const squad = tw.readers.of<CombatReader>('16').squads().find((s) => s.id === st.fortress.squadId);
        soldiers.clear();
        for (const id of squad?.members ?? []) soldiers.add(id);
        const hearth = tw.game.world.fortress.alert === 'hearth';
        if (hearth && !wasHearth) hearthEpisodes.push({ locked: false });
        wasHearth = hearth;
        const episode = hearthEpisodes[hearthEpisodes.length - 1];
        if (hearth && episode && st.fortress.gateDoorId !== 0 &&
            tw.readers.of<BuildingsReader>('14').mechanismState(st.fortress.gateDoorId) === 'locked') episode.locked = true;
      },
    });
    const buildings = w.readers.of<BuildingsReader>('14');
    const built = (id: number): boolean => id !== 0 && buildings.get(id)?.state === 'built';
    const day = Math.floor(w.tick / TICKS_PER_DAY) + 1;
    const dwarf = w.game.registry.table('creatures').index('dwarf');
    const deaths = w.events('CreatureDied').filter((e) => e['species'] === dwarf).map((e) => `${e['name']}: ${e['cause']}`);
    const outcomes = w.events('RaidEnded').map((e) => String(e['outcome']));
    const jobsDone = (type: string): number => w.events('JobCompleted').filter((e) => e['jobType'] === type).length;
    console.log(`defence_year: ${JSON.stringify({ day, deaths, outcomes, soldierKills, hearthEpisodes: hearthEpisodes.length,
      trapTriggers: w.events('TrapTriggered').length, caged: w.events('CreatureCaged').length, jammed: w.events('TrapJammed').length,
      rearmed: jobsDone('rearm_trap'), cleaned: jobsDone('clean_trap'), training: w.events('TrainingSession').length, notes: state.notes })}`);

    // The works, all built by command.
    expect(built(state.fortress.placedIds['mechanic'] ?? 0), 'the mechanic\'s workshop').toBe(true);
    expect(state.wallIds.every(built) && state.wallIds.length === 3, 'the corridor walls').toBe(true);
    expect(state.fortIds.every(built) && state.fortIds.length === 3, 'the corridor fortifications').toBe(true);
    for (const id of [state.cageTrapId, state.weaponTrapId, state.stoneFallTrapId, state.drawbridgeId, state.leverId, state.archeryTargetId]) {
      expect(built(id), `building ${buildings.get(id)?.typeId ?? id}`).toBe(true);
    }
    expect(state.barracksZoneId).toBeGreaterThan(0);
    expect(state.archeryRangeZoneId).toBeGreaterThan(0);
    expect(w.readers.of<DefenseReader>('19').trapMode(state.stoneFallTrapId)).toBe('enemies');
    // The lever, linked to the bridge, raised it and lowered it.
    expect(buildings.get(state.leverId)?.linkedIds).toContain(state.drawbridgeId);
    expect(state.trial).toBe('done');
    expect(w.events('MechanismTriggered').some((e) => e['sourceId'] === state.leverId)).toBe(true);
    expect(w.events('MechanismToggled').some((e) => e['id'] === state.drawbridgeId)).toBe(true);

    // The squad: a leader, its barracks, training in peace, and a weapon skill that rose.
    const combat = w.readers.of<CombatReader>('16');
    const squad = combat.squads().find((s) => s.id === state.fortress.squadId);
    expect(squad?.members.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(squad?.members).toContain(squad?.leaderId);
    expect(buildings.zone(state.barracksZoneId)?.settings['squad']).toBe(squad?.id);
    expect(w.events('TrainingSession').length).toBeGreaterThan(0);
    const skills = w.game.registry.table('skills');
    const weaponSkills = ['sword', 'spear', 'axe', 'mace', 'hammer'].map((s) => skills.index(s)).filter((k) => k > 0);
    expect((squad?.members ?? []).some((m) => weaponSkills.some((k) => (w.game.world.entities.get(m, C.Skills)?.xp[k] ?? 0) > 0 ||
      (w.game.world.entities.get(m, C.Skills)?.level[k] ?? 0) > 0))).toBe(true);

    // The defence at work.
    expect(w.events('TrapTriggered').length, 'a trap triggered').toBeGreaterThan(0);
    const trapKills = w.events('TrapTriggered').filter((e) => e['outcome'] === 'killed').length;
    expect(w.events('CreatureCaged').length + trapKills, 'a creature caged or killed by a trap').toBeGreaterThan(0);
    expect(outcomes.some((o) => o === 'repelled' || o === 'wiped'), 'a party repelled or wiped').toBe(true);
    expect(soldierKills.length, 'a hostile killed by a soldier').toBeGreaterThan(0);
    expect(hearthEpisodes.length).toBeGreaterThan(0);
    expect(hearthEpisodes.every((e) => e.locked), 'the gate locked under every hearth alert').toBe(true);
    expect(jobsDone('rearm_trap'), 'a trap rearmed').toBeGreaterThan(0);
    // A trap jams on a roll (19: TRAP_JAM_PERMILLE times the corpses on it); a jammed trap is cleaned.
    if (w.events('TrapJammed').length > 0) expect(jobsDone('clean_trap'), 'a jammed trap cleaned').toBeGreaterThan(0);

    // No command of the script was refused, and at most two dwarves died.
    expect([...scriptRecord(w).rejected]).toEqual([]);
    expect(deaths.length, deaths.join('; ')).toBeLessThanOrEqual(2);
  },
};

export default scenario;
