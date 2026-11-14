/**
 * T-544: the owner's rule (2026-11-13): "a steel-equipped well-trained squad of ~5 fighters, few
 * archers and a wizard should have no problem handling wildlife incursions (wolves/bears)".
 *
 * The set rule (balance.md § Combat pace): in the wild-squad arena (`test/scenarios/wild-squad-arena.ts`)
 * the owner's squad, five Proficient soldiers, three Proficient marksdwarves and a Proficient
 * runecaster, all in steel, wins every fight against a wolf pack of six, a bear, and `beastwood`'s
 * doubled groups (twelve wolves, two bears), and loses under one fighter in ten fights against the
 * pack and the bear, under one in five against `beastwood`'s groups, counted a day later with no
 * medic. The same squad at Novice in copper still loses a fighter in at least a third of its fights
 * against the pack and the bear.
 */
import { describe, expect, it } from 'vitest';
import { wildArenaTrial, type ArenaFoe, type ArenaResult, type ArenaSquad } from '../../scenarios/wild-squad-arena';

const STEEL_FIGHTS = 24;
const COPPER_FIGHTS = 8;

function fights(squad: ArenaSquad, foe: ArenaFoe, n: number): ArenaResult[] {
  return Array.from({ length: n }, (_, seed) => wildArenaTrial(squad, foe, seed));
}

const dead = (rows: readonly ArenaResult[]): number => rows.reduce((sum, r) => sum + r.dead, 0);

describe('T-544 the owner\'s squad against wolves and bears', () => {
  for (const [foe, perFight] of [['pack', 10], ['bear', 10], ['beast-pack', 5], ['beast-bears', 5]] as const) {
    it(`wins every fight against ${foe} and loses under one fighter in ${perFight} fights`, () => {
      const rows = fights('steel', foe, STEEL_FIGHTS);
      expect(rows.map((r) => r.outcome), 'every fight won').toEqual(new Array(STEEL_FIGHTS).fill('won'));
      for (const r of rows) expect(r.animalsKilled + r.animalsFled, `seed ${r.seed}: no animal left`).toBe(r.animals);
      expect(dead(rows) * perFight, `${dead(rows)} fighters dead in ${STEEL_FIGHTS} fights`).toBeLessThan(STEEL_FIGHTS);
    }, 120_000);
  }

  it('a copper squad of Novices still loses fighters to a pack and to a bear', () => {
    for (const foe of ['pack', 'bear'] as const) {
      const rows = fights('copper', foe, COPPER_FIGHTS);
      const costly = rows.filter((r) => r.dead > 0).length;
      expect(costly * 3, `${foe}: a fighter dies in ${costly} fights of ${COPPER_FIGHTS}`).toBeGreaterThanOrEqual(COPPER_FIGHTS);
    }
  }, 120_000);
});
