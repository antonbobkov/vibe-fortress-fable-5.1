# T-188 — A workshop job stalls for weeks and the fortress dies of thirst

## Progress (2026-10-09, codex-a)

Both original speed reproductions were re-run after T-132. At speed 175 the fortress reaches day 277 with 37 dwarves, 390 drink and 199 completed brews, without a death or the old fetching stall. At speed 100, seven badger/boar combat deaths leave five dwarves before an unclaimed brew is created on day 90.718; drink is zero from day 110, and the last five die on days 123-126. Two additional runs repeat this collapse. The assignment trace shows the brew eligible on all 39 observed requests, while the remaining brewers take farm/kitchen jobs or needs; candidate pools are below the limit. No new reservation fault was established, and the no-starvation Done criterion is not met.

Parked without game or fixture edits under the no-long-fixture-tuning rule. [Measurement and next step](../../../reports/audits/2026-10-09-t188-reproduction.md): an owner decision is needed on qualifying the older slow fixture after wild spawning and workforce loss. The priority/distance/skill formula was not changed.

**Source:** T-140 and its report, [`../../reports/audits/2026-10-09-walking-speed.md`](../../../reports/audits/2026-10-09-walking-speed.md) (§ A fortress dies of thirst beside its still) · **Size:** M · **Needs:** — · **Status:** open

## Why

Twice in the T-140 measurements the still's brew job stopped being done for weeks while brewers, plants and barrels were all there. Drink ran out and every dwarf died. Both runs are the rewritten three-year fixture (branch `f-17`, `ffbc723`), seed `three-years`, default priorities.

- **Dwarf speed 0.10** (the value before T-140): brew job 2206 is claimed on day 121.21 and reaches `working` on day 121.43 with 2 of its 4 plants and its barrel delivered. On day 121.55 it is `open` with no worker. It stays `open`, not blocked, with no worker until day 151. Five dwarves have `brewing` enabled; 66 to 129 plants are in stock. Drink is 0 from day 136. All 12 dwarves die on days 150–152.
- **Dwarf speed 0.175**: a thief arrives on day 236. Brew job 4323, created on day 244, is in `fetching` with a different worker at every four-day sample from day 246 to day 272. Meals are 0 from day 246 with 71 to 118 plants in stock. Drink is 0 from day 262. All 30 dwarves die on days 275–277.

At dwarf speed 0.15, the value T-140 set, the same seed has no death. The fault is not about speed: speed only decides whether this seed walks into it.

The cause is not established. The first trace looks like a job that keeps part of its inputs (T-143) and is then never offered again. The second looks like a job that is claimed and dropped without end.

## Decision

- **An open, unblocked workshop job with a free dwarf who has its labor is claimed.** If it is not, that is the fault to find and fix, in `11` (assignment) or `12` (operation), with the rule written into that document.
- **A job cannot stay in `fetching` without progress for longer than `RESERVE_KEEP_TICKS`.** After that it is blocked with a reason the player can read, and the workshop moves to its next runnable order (the T-182 rule).
- No constant changes. Need rates and walking speed stay.

## What to do

1. Reproduce. Copy [`the probe`](../../../reports/data/2026-10-09-walking-speed-probe.ts.txt) beside the `f-17` fixture files, scale the `speed` of every row of `src/content/creatures.json` by 2/3 (dwarf 100) or 7/6 (dwarf 175) as a scratch edit, and run with `T140_WATCH=brew T140_WATCH_FROM=120 T140_WATCH_TO=152` (or 236 to 277). The `watch` rows are the job's state changes.
2. Find why job 2206 is not claimed, and why job 4323 makes nothing. Say whether they are one fault. Say what the thief of day 236 has to do with the second, if anything.
3. Fix, amend the spec section that governs it, and pin each with a scenario under `describe('T-188 …')`.
4. Re-run both reproductions: no dwarf dies of thirst while plants, a barrel, a still and a brewer exist.

## Done

- Both reproductions end with drink in stock and no death by `starvation`.
- The scenarios pass.

## Note (2026-10-09, orchestrator)

T-132 (`3f9e424`) fixed a fault that looks like this one: a stockpile haul could take or fill a barrel reserved by a brew job, and the job then stalled one step from done for weeks while drink ran out. **Start here by re-running this task's two reproductions on master after T-132.** If both stalls are gone, close this task with the measurement and no code change. If one remains, it is a second fault, and the trace saved by T-132 ([`2026-10-09-t132-command-and-barrel-trace.json`](../../../reports/data/2026-10-09-t132-command-and-barrel-trace.json)) shows what to record.

## Closed (2026-10-09, orchestrator)

**The fault this task was filed for is gone.** After T-132, neither reproduction shows a brew job that sits unclaimed or half-delivered for weeks ([the re-measure](../../../reports/audits/2026-10-09-t188-reproduction.md)). At walking speed ×1.75 the fortress reaches day 277 with 37 dwarves, 390 drinks and no deaths.

The run at ×1.0 still dies, for different reasons, and ×1.0 is no longer the game's walking speed (T-140 made it ×1.5). What it shows goes to T-145, which owns that fixture:

- **Wild animals now kill dwarves at peril 0.** Seven dwarves died to badgers and boars. Wild animals have only spawned since T-192, so no fixture was written with them in mind.
- **With two brewers left, both chose farm and kitchen work over an eligible brew job.** That is the job-assignment rule of 11 (priority, distance, skill) doing what it says; whether a thirsty fortress should rank brewing higher is a fixture or a design question for T-145, not a stall.
