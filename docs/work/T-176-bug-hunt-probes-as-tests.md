# T-176 — The bug hunt's probes become permanent tests

**Source:** T-115 and its report, [`../../reports/audits/2026-10-08-bug-hunt.md`](../../reports/audits/2026-10-08-bug-hunt.md) ("The probes") · **Size:** M · **Needs:** T-160 … T-174 · **Status:** open

## Why

The hunt found fifteen bugs with scratch probes in one night. None of the probes is a test, so the next regression of the same kind will be found by accident again. Three instruments are cheap enough for `npm test`.

## Reproduction

The probe files are under `reports/data/2026-10-08-bug-hunt-*.txt`.

## What to do

1. **`test/scenarios/invariants.ts`**: the checker of `invariants.ts`, typed and linted, as a helper `checkInvariants(game): Finding[]`. `year_one` and `three_years` call it every 1,200 ticks and at the end, and fail on any finding. The peril-2 and peril-4 seeds of `three_years_seeds` call it too (T-156 owns what the sweep asserts; add this there if T-156 is still open).
2. **`test/property/command-fuzz.test.ts`**: the fuzz of `fuzz.probe.ts`, cut to the field sweep and 40 random trials per command. Asserts: no command throws; every rejection reason is in `REJECT_REASONS`; after every 15 accepted commands the game saves, loads and hashes equal; the checker finds nothing. Build its world so that the nine commands the hunt never got accepted have a valid target (a ripe crop, a grazer and a pasture, a caged creature, a hatch, a linked lever, a coffin, a trap).
3. **A played save round trip.** `three_years` saves and loads once in each year, at a tick with a caravan present, and continues on the loaded game. The existing assertions then cover the loaded game. This is the "No long run saves and reloads" gap of T-114.
4. **Determinism across processes** stays in the performance tier: `three_years_seeds` prints the final hash of each seed, and the gate report compares it with the previous gate's.

The fix tasks T-160 to T-174 each add the unit test of their own bug. This task adds only the general instruments and needs those fixes first, because the checker fails on today's code.

## Done

- `npm test` runs the checker in `year_one` and `three_years`, the command fuzz, and one played save round trip, and is green.
- `testing-strategy.md` § Property tests and § The long scenarios describe them.
