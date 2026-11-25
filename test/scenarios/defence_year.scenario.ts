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
  run: () => {
    const soldiers = new Set<number>();
    // T-715: the squad's members who died, as the last look saw the squad.
    const fallenSoldiers = new Set<number>();
    const soldierKills: { killer: number; victim: string }[] = [];
    // The tick of each creature's last blow and of its death (events carry no tick).
    const lastBlow = new Map<number, number>();
    const diedAt = new Map<number, number>();
    // T-522: dwarves burned by a lightning strike (a burn within a tick of a strike), a death of the weather.
    let strikeTick = -1;
    const struck = new Set<number>();
    const hearthEpisodes: { locked: boolean }[] = [];
    let wasHearth = false;
    // T-733: a soldier at drill seen holding a role the economy chooses, at a look (an immigrant: the
    // founders' own trades, the smith's and the mason's metal chain among them, are the fixture's).
    const drillingSpecialists = new Set<string>();
    const { w, state } = playDefenceYear({
      observe: (tw) => {
        tw.game.world.onEvents((batch) => {
          for (const e of batch) {
            if (e.type === 'LightningStrike') strikeTick = tw.tick;
            else if (e.type === 'WoundInflicted' && e['woundType'] === 'burn' && strikeTick >= 0 && tw.tick - strikeTick <= 1) struck.add(e['id'] as number);
            if (e.type === 'DamageDealt') lastBlow.set(e['defenderId'] as number, tw.tick);
            else if (e.type === 'CreatureDied') {
              diedAt.set(e['id'] as number, tw.tick);
              if (soldiers.has(e['id'] as number)) fallenSoldiers.add(e['id'] as number);
            }
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
        if (squad?.mode === 'train') {
          const founders = tw.game.arrival?.dwarves ?? [];
          const { economy } = st.fortress;
          for (const [role, id] of [...Object.entries(economy.specialists), ['brewer', economy.brewer ?? 0] as const]) {
            if (squad.members.includes(id) && !founders.includes(id)) drillingSpecialists.add(`${id} (${role})`);
          }
        }
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
    // Which dwarf a raider reaches, and whether it dies, turns on the job timeline, and the noise of
    // that count over two years is not measured (testing-strategy.md § What may be a gate): a death
    // in a fight (killed, or bled out within a day of its last blow) is printed. Any other death is
    // the fortress failing and is asserted: hunger, thirst, a fall, a late bleed or an infection; but a
    // dwarf burned by lightning outdoors in a storm is the weather's (T-522: it moved onto one by the timeline).
    const dwarfDeaths = w.events('CreatureDied').filter((e) => e['species'] === dwarf).map((e) => {
      const id = e['id'] as number;
      return { id, name: String(e['name']), cause: String(e['cause']), killer: Number(e['killerId'] ?? 0),
        afterBlow: (diedAt.get(id) ?? 0) - (lastBlow.get(id) ?? -Infinity), lightning: struck.has(id) };
    });
    const inFight = (d: (typeof dwarfDeaths)[number]): boolean => d.killer !== 0 &&
      (d.cause === 'killed' || (d.cause === 'bled_out' && d.afterBlow <= TICKS_PER_DAY));
    const deaths = dwarfDeaths.map((d) => `${d.name}: ${d.cause}${inFight(d) ? ' (fight)' : d.lightning ? ' (lightning)' : ''}`);
    const outcomes = w.events('RaidEnded').map((e) => String(e['outcome']));
    const jobsDone = (type: string): number => w.events('JobCompleted').filter((e) => e['jobType'] === type).length;
    console.log(`defence_year: ${JSON.stringify({ day, deaths, outcomes, soldierKills, hearthEpisodes: hearthEpisodes.length,
      trapTriggers: w.events('TrapTriggered').length, caged: w.events('CreatureCaged').length, jammed: w.events('TrapJammed').length,
      rearmed: jobsDone('rearm_trap'), cleaned: jobsDone('clean_trap'), training: w.events('TrainingSession').length, notes: state.notes })}`);

    // The works, all built by command.
    expect(built(state.fortress.placedIds['mechanic'] ?? 0), 'the mechanic\'s workshop').toBe(true);
    expect(state.wallIds.length === state.wallTiles.length && state.wallIds.every(built), 'the corridor walls').toBe(true);
    expect(state.fortIds.length === state.fortTiles.length && state.fortIds.every(built), 'the corridor fortifications').toBe(true);
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
    // T-580: a run that ends under an ambush's alert has its soldiers stood down from the squad
    // (T-575), to be put back once the alert is down: they count as the squad's.
    // T-715: a soldier who fell in a fight counts too: a death in a fight is printed, not asserted, and
    // on one timeline an ambush killed two of the three and the fortress had no adult free to replace them.
    // T-724: the script now refills the squad from the specialists, but only once the alert is down and
    // only from those it may take, so a fight in the run's last days still leaves it short: the fallen count.
    const fallen = dwarfDeaths.filter((d) => inFight(d) && fallenSoldiers.has(d.id)).map((d) => d.id);
    const standing = [...(squad?.members ?? []), ...(state.fortress.stoodDown ?? [])];
    expect(new Set([...standing, ...fallen]).size).toBeGreaterThanOrEqual(3);
    if ((squad?.members.length ?? 0) > 0) expect(squad?.members).toContain(squad?.leaderId);
    expect(buildings.zone(state.barracksZoneId)?.settings['squad']).toBe(squad?.id);
    // T-733: no soldier at drill is the economy's specialist (a full-time soldier does no civilian work).
    expect([...drillingSpecialists], 'a specialist at drill').toEqual([]);
    expect(w.events('TrainingSession').length).toBeGreaterThan(0);
    const skills = w.game.registry.table('skills');
    const weaponSkills = ['sword', 'spear', 'axe', 'mace', 'hammer'].map((s) => skills.index(s)).filter((k) => k > 0);
    expect(standing.some((m) => weaponSkills.some((k) => (w.game.world.entities.get(m, C.Skills)?.xp[k] ?? 0) > 0 ||
      (w.game.world.entities.get(m, C.Skills)?.level[k] ?? 0) > 0))).toBe(true);

    // The defence at work.
    expect(w.events('TrapTriggered').length, 'a trap triggered').toBeGreaterThan(0);
    const trapKills = w.events('TrapTriggered').filter((e) => e['outcome'] === 'killed').length;
    expect(w.events('CreatureCaged').length + trapKills, 'a creature caged or killed by a trap').toBeGreaterThan(0);
    // Whether this seed's raid is turned back, and whether a soldier kills a hostile, are printed, not
    // asserted: they are rules over eight seeds, test/perf/defence_year_seeds.test.ts
    // (reports/audits/2026-11-05-t466-defence-repels-a-raid.md). T-512: one or two kills on this seed,
    // and a timeline change in the economy script alone left it none.
    expect(hearthEpisodes.length).toBeGreaterThan(0);
    expect(hearthEpisodes.every((e) => e.locked), 'the gate locked under every hearth alert').toBe(true);
    // T-732: the north door is the defence script's alone: it locks on the alert again only after a sally opened it.
    let opened = false;
    for (const n of state.notes) {
      if (n.includes('north door opened to the squad')) opened = true;
      else if (n.includes('north door locks on the alert again')) {
        expect(opened, `${n}: no sally before it`).toBe(true);
        opened = false;
      }
    }
    expect(jobsDone('rearm_trap'), 'a trap rearmed').toBeGreaterThan(0);
    // A trap jams on a roll (19: TRAP_JAM_PERMILLE times the corpses on it); a jammed trap is cleaned.
    if (w.events('TrapJammed').length > 0) expect(jobsDone('clean_trap'), 'a jammed trap cleaned').toBeGreaterThan(0);

    // No command of the script was refused, and no dwarf died but in a fight.
    expect([...scriptRecord(w).rejected]).toEqual([]);
    // T-522: a dwarf a lightning strike burns outdoors in a storm is the weather's, printed like a fight's.
    expect(dwarfDeaths.filter((d) => !inFight(d) && !d.lightning), 'no dwarf died but in a fight or by lightning').toEqual([]);
  },
};

export default scenario;
