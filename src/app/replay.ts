/**
 * Replaying a command log.
 *
 * `simulation-core.md` § Commands: "The command log keeps every command of the current season
 * with its tick and result. The log is saved (it is small) and replayable in headless mode for
 * reproducing bugs." `tooling.md` § Debug and replay: "`node scripts/replay.mjs <save> <log>`
 * prints world hashes per 100 ticks for bisecting divergence". This module is what the script
 * runs; the tests call it directly.
 *
 * A log entry's `tick` is the tick whose step 1 applied it, so a command is submitted just before
 * that tick runs. Entries before the game's current tick happened before the save and are skipped
 * (DECISIONS.md D-084). A coalesced entry (consecutive designations differing only in their tiles)
 * is replayed as the one command it was merged into.
 */

import type { CommandLogEntry } from '@core/commands';
import type { HeadlessGame } from './headless';
import { loadGame, type LoadedGame } from './game-save';
import { readJsonSection, readSave } from './save-manager';

export const REPLAY_HASH_EVERY = 100;

export interface ReplayPoint {
  readonly tick: number;
  readonly hash: string;
}

export interface ReplayOptions {
  /** Run until this tick (exclusive of later ticks); default: the tick after the log's last entry. */
  readonly until?: number;
  /** Hash every this many ticks (`REPLAY_HASH_EVERY`). */
  readonly every?: number;
}

/**
 * Replay `log` on a running (loaded) game: submit each entry at its tick, step, and record the
 * world hash every `every` ticks and at the end.
 */
export function replay(game: HeadlessGame, log: readonly CommandLogEntry[], options: ReplayOptions = {}): ReplayPoint[] {
  const every = options.every ?? REPLAY_HASH_EVERY;
  const entries = log.filter((e) => e.tick >= game.tick).slice().sort((a, b) => a.tick - b.tick);
  const last = entries.length === 0 ? game.tick : (entries[entries.length - 1] as CommandLogEntry).tick + 1;
  const until = options.until ?? last;
  const out: ReplayPoint[] = [];
  let next = 0;
  while (game.tick < until) {
    while (next < entries.length && (entries[next] as CommandLogEntry).tick === game.tick) {
      game.world.submit((entries[next] as CommandLogEntry).command);
      next += 1;
    }
    game.step(1);
    if (game.tick % every === 0 || game.tick === until) out.push({ tick: game.tick, hash: game.hash() });
  }
  return out;
}

/** The log a file holds: a JSON array of entries, or the `commandLog` section of a save. */
export async function readLog(bytes: Uint8Array): Promise<CommandLogEntry[]> {
  const head = new TextDecoder().decode(bytes.subarray(0, 4));
  if (head === 'DHLM') {
    const save = await readSave(bytes);
    const section = save.section('commandLog');
    return section === undefined ? [] : (readJsonSection(section) as CommandLogEntry[]);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as CommandLogEntry[];
}

/** `replay.mjs <save> <log>`: load the save, replay the log, return the hashes. */
export async function replayFiles(save: Uint8Array, log: Uint8Array, options: ReplayOptions = {}): Promise<{ loaded: LoadedGame; start: number; points: ReplayPoint[] }> {
  const loaded = await loadGame(save);
  const entries = await readLog(log);
  const start = loaded.game.tick;
  return { loaded, start, points: replay(loaded.game, entries, options) };
}
