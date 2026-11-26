# T-796 — A threat a dwarf cannot reach, and that cannot reach it, does not drop its job

**Source:** playtest 8 ([report](../../reports/data/2026-11-26-playtest-8.md), finding 1; also finding 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

In playtest 8 the player designated an up/down stair column at (21,21), z23 to z4. Levels z23 to z21 were carved. The job for z20 (`carve_stairs:47109`, stand tile (21,21,z21)) then went unworked for more than 30 days. The Jobs panel showed it as claimed by one dwarf after another, with no reason.

A headless trace of the save found the cause: a cave crawler of cavern 1's sealed pocket at (18,29,z21). It is Chebyshev 8 from the stand tile, on the same level, behind solid rock (walker label 138 against the stand's 140).
- The threat scan (`src/systems/combat/threats.ts:56-74`) checks only z and radius `THREAT_RADIUS` 8. It has no path, label or line test. So `ThreatNearby` fired every time a miner stepped onto the stand tile.
- `src/systems/jobs/index.ts:208-220` interrupts on `ThreatNearby` even for a job that is not interruptible. `board.interrupt` (`board.ts:940-958`) reopens the job with no progress kept, and the dwarf flees (`dwarves/brain.ts:409-426`).
- The next free miner claims it and walks the long way down.
- The "avoid jobs near a remembered threat" filter (`board.ts:1226-1232`) compares the job's anchor (z20) with the threat's z21, so it never matched: scared dwarves claimed the job again.

In 8,000 ticks there were 13 interrupts, 10 of them from that one crawler. No line said a crawler was involved: the log had no entry naming one.

The same rule turned the Deep's first emergence into a stalemate (finding 2, T-797-emergence-opens-a-way). Three hollow crawlers stuck in pockets of the vein kept every miner from the tunnel beside it: "Nobody takes it yet … or a way clear of danger."

## What to do

Decisions taken here:

- **A threat must be able to come.** `threatScan` sends `ThreatNearby` only for a hostile whose walker label (22) is the label of the dwarf's tile, or of a tile next to it. For a flier or a ranged attacker, it also counts one with a clear line of fire (22's `lineOfFire`). A monster sealed in rock, behind a wall or across a cavern band it cannot climb is no threat to a dwarf at work. This changes no combat: 16's targeting already needs a path or a line.
- **The avoidance filter reads the stand tiles.** `eligible` compares a remembered threat with each of the job's stand tiles, not only its anchor. A job with every stand tile under a reachable threat blocks with reason `threatened` ("Threatened: a cave crawler at (18,29,z21)"). It no longer passes silently from dwarf to dwarf.
- **The Jobs panel names the threat.** "Nobody takes it yet … or a way clear of danger" names the creature and its tile when that is the reason. A job interrupted three times by threats in a day says so: "Interrupted: dwarves flee a cave crawler at (18,29,z21)".
- No change to `THREAT_RADIUS` and none to fleeing itself.

## Decisions taken while doing it

- **The label is the hostile's own class.** `hostileReaches` (`combat/threats.ts`) compares labels in the hostile's movement class, of the dwarf's tile or one of its eight neighbours on its level. A hostile standing on a tile its class has no label for (0) still counts, as before. There is no flier class in the game, so "a flier" is moot; "a ranged attacker" is a species with a natural ranged attack or a creature with a launcher or channel in hand.
- **A locked door cuts a threat off.** The labels treat a locked door as a wall, so raiders shut out by a locked gate frighten no one inside until it breaks. Kept as characterful (fun-features: "Work goes on behind a locked gate"). F-16's retreat test spawned its warrior behind the locked gate; it now stands on the dwarf's side.
- **When a job blocks.** A threat interrupt (11 § Job steps) blocks the job `threatened` at once when the hostile can come at every one of its stand tiles (its anchor when it has none), each on its level within `THREAT_RADIUS`; otherwise the job reopens as before. The retry reopens it when the hostile is dead or that no longer holds. The job's data keeps `threatHostile`, `threatTile`, `threatHits` and `threatSince`.
- **"Three times in a day" is a panel rule.** `JOB_THREAT_FLIGHTS` = 3 (24 § Tuning constants): an open job with three threat interrupts within a day of the first, whose hostile lives, reads "Interrupted: dwarves flee a cave crawler at (x,y,z)." A job blocked `threatened` reads "Threatened: a cave crawler at (x,y,z). Nobody works here until it is gone."
- **"Nobody takes it yet" names the threat** when every free dwarf with the labor is kept from the job by its remembered hostile: two new readers, `dwarves.avoidedThreat(id)` (10) and `jobs.keptByThreat(jobId, dwarfId)` (11).
- **The avoidance filter** skips a job whose anchor, or every stand tile, is near the remembered tile (the anchor test is kept).
- **The stair-pocket "scenario"** is a `TestWorld` test in `test/unit/combat/t796-threat-needs-a-path.test.ts` (a five-level column beside a sealed crawler, carved to the bottom; it fails without the fix), not a registered scenario.

## Done

- [x] `threatScan` filters by label or line; a test with a crawler behind a wall at Chebyshev 8 (no `ThreatNearby`) and one in the open (one).
- [x] `eligible` reads stand tiles; a test of a stair job one level below a remembered threat.
- [x] The `threatened` block reason and the Jobs panel lines; UI tests.
- [x] The save `frostwatch-y4-au5-stair-stuck` shape reproduced in a scenario: a stair column beside a sealed pocket is carved to the bottom.
- [x] 11 § Assignment, 16 § Targeting (threat scan) and `panels.md` § Jobs updated.
