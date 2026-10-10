/** T-176: the audit field sweep and 40 deterministic random trials per command. */
import { describe, expect, it } from 'vitest';
import { COMMAND_TYPES, COMMAND_OWNERS, REJECT_REASONS } from '@core/command-types';
import type { Command, CommandResult } from '@core/commands';
import { roundTrip } from '@app/game-save';
import { checkInvariants } from '../scenarios/invariants';
import {
  buildWorld,
  validTarget,
  pools,
  FIELDS,
  OWN,
  poolFor,
  rnd,
  pick,
  show,
  N,
  previouslyUnaccepted,
} from './command-fuzz-fixture';

describe('T-176 command fuzz', () => {
  it('sweeps every field and 40 random trials per command, then saves accepted states', () => {
    const base = buildWorld().game;
    expect(checkInvariants(base), 'the prepared fortress is valid').toEqual([]);
    const known = new Set<string>(REJECT_REASONS);
    const exercised = new Set<string>();
    let trials = 0,
      accepted = 0,
      saves = 0;
    for (const type of COMMAND_TYPES) {
      let game = roundTrip(base).game;
      expect(game.hash()).toBe(base.hash());
      const p = pools(game);
      const owner = COMMAND_OWNERS[type];
      const fields = FIELDS[owner] ?? [];
      const own = OWN[type] ?? fields;
      let acceptedSinceSave = 0;
      const save = (): void => {
        const copy = roundTrip(game).game;
        expect(copy.hash(), `save after ${type}`).toBe(game.hash());
        game = copy;
        acceptedSinceSave = 0;
        saves += 1;
      };
      const trial = (cmd: Record<string, unknown>): void => {
        trials += 1;
        let result: CommandResult = { ok: false, reason: 'not_found' };
        expect(() => {
          result = game.world.applyCommand(cmd as Command);
        }, show(cmd)).not.toThrow();
        if (!result.ok) expect(known.has(result.reason), show(cmd)).toBe(true);
        else {
          accepted += 1;
          acceptedSinceSave += 1;
          exercised.add(type);
          expect(() => game.step(2), show(cmd)).not.toThrow();
          expect(checkInvariants(game), show(cmd)).toEqual([]);
          if (acceptedSinceSave >= 15) save();
        }
      };
      const target = validTarget(game, type);
      if (target !== null) {
        expect(game.world.applyCommand(target), `valid target for ${type}`).toEqual({ ok: true });
        exercised.add(type);
        game.step(2);
        expect(checkInvariants(game), `accepted ${type}`).toEqual([]);
        // Restore its target before the field sweep (e.g. a just-released cage).
        game = roundTrip(base).game;
      }
      const baseCmd = (): Record<string, unknown> => {
        const cmd: Record<string, unknown> = { type };
        for (const field of own) cmd[field] = poolFor(field, p)[0];
        return target === null ? cmd : { ...cmd, ...target };
      };
      trial({ type });
      for (let b = 0; b < 6; b += 1) {
        const start = baseCmd();
        if (b > 0)
          for (const field of own)
            start[field] = pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6));
        for (const field of own)
          for (const value of poolFor(field, p)) trial({ ...start, [field]: value });
      }
      for (let k = 0; k < N; k += 1) {
        const cmd: Record<string, unknown> = { type };
        for (const field of own)
          if (rnd() < 0.92)
            cmd[field] =
              rnd() < 0.5
                ? pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6))
                : rnd() < 0.8
                  ? pick(poolFor(field, p))
                  : pick(p.garbage);
        if (rnd() < 0.15) {
          const extra = pick(fields);
          if (extra !== undefined) cmd[extra] = pick(poolFor(extra, p));
        }
        trial(cmd);
      }
      if (acceptedSinceSave > 0) save();
    }
    for (const type of previouslyUnaccepted)
      expect(exercised.has(type), `${type} was applied, not only rejected`).toBe(true);
    expect(saves).toBeGreaterThan(0);
    console.log(`T-176 fuzz: ${trials} trials, ${accepted} accepted, ${saves} save round trips`);
  }, 600_000);
});
