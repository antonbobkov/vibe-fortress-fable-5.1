# T-NEW — A door in steady use keeps a job blocked

**Source:** T-455, [perils on relief](../../reports/audits/2026-10-31-perils-on-relief.md) · **Size:** S · **Needs:** — · **Status:** fixed in the commit that closes it

## Why

A walk given up because creatures kept blocking its next tile records that tile, and the periodic retry skipped the job while any creature stood on it. On a gate with 54 dwarves there is someone in the door at almost every look, 100 ticks apart. In the `three_years` scenario a brew job at the still stayed blocked for 1,300 ticks with a path open, and T-176 stopped the run on day 283. Nobody was holding the door: the dwarf in it at the last look was just walking through to the hall, with seven more on the tile beyond.

## What was done

The retry now skips the job only while one creature holds the tile: it notes a creature standing there at its first look, and keeps skipping while that creature is still there. An empty tile, or a tile with only others on it, reopens the job. A creature that stays in a door still holds the job, as T-388 requires.

11 § Blocked jobs and `jobs-and-hauling.md` state the rule. Test: `test/unit/jobs/t-new-busy-doorway.test.ts`.
