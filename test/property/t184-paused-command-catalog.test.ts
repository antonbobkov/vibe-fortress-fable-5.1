import { describe, expect, it } from 'vitest';
import { COMMAND_TYPES, COMMAND_OWNERS } from '@core/command-types';
import type { Command } from '@core/commands';
import { roundTrip } from '@app/game-save';
import {
  buildWorld,
  validTarget,
  pools,
  OWN,
  FIELDS,
  poolFor,
  pick,
  rnd,
  N,
} from './command-fuzz-fixture';

describe('T-184 paused command catalog continuation', () => {
  it('accepts every catalog command and preserves every one of its next 50 hashes', () => {
    const base = buildWorld().game;
    const accepted = new Set<string>();
    for (const type of COMMAND_TYPES) {
      let game = roundTrip(base).game;
      const target = validTarget(game, type);
      const p = pools(game);
      const fields = OWN[type] ?? FIELDS[COMMAND_OWNERS[type]] ?? [];
      const candidates: Command[] = target ? [target] : [{ type }];
      for (let b = 0; b < 6; b += 1) {
        const start: Record<string, unknown> = { type };
        for (const field of fields)
          start[field] =
            b === 0
              ? poolFor(field, p)[0]
              : pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6));
        for (const field of fields)
          for (const value of poolFor(field, p))
            candidates.push({ ...start, [field]: value } as Command);
      }
      for (let n = 0; n < N; n += 1) {
        const cmd: Record<string, unknown> = { type };
        for (const field of fields)
          if (rnd() < 0.92) cmd[field] = pick(poolFor(field, p).slice(0, p.goodCount[field] ?? 6));
        candidates.push(cmd as Command);
      }
      for (const cmd of candidates) {
        // Search the synthetic targets without recording deliberately malformed refusals.
        if (!game.world.applyCommand(cmd).ok) continue;
        game = roundTrip(base).game;
        game.world.submit(cmd);
        game.world.commandPhase(true);
        expect(game.world.commandLog.all().at(-1)!.result, `accepted paused ${type}`).toEqual({
          ok: true,
        });
        accepted.add(type);
        const loaded = roundTrip(game).game;
        expect(loaded.hash(), `T-184 ${type} at the save`).toBe(game.hash());
        for (let tick = 0; tick < 50; tick += 1) {
          game.step(1);
          loaded.step(1);
          expect(loaded.hash(), `T-184 ${type} resumed tick ${game.tick}`).toBe(game.hash());
        }
        break;
      }
    }
    console.log(
      `T-184 catalog: ${accepted.size} accepted; missing: ${COMMAND_TYPES.filter((type) => !accepted.has(type)).join(', ')}`,
    );
    expect(COMMAND_TYPES.filter((type) => !accepted.has(type))).toEqual([]);
  }, 600_000);
});
