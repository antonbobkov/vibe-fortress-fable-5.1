# T-188 — A workshop job stalls for weeks and the fortress dies of thirst

**Source:** T-140 and its report, [`../../reports/audits/2026-10-09-walking-speed.md`](../../reports/audits/2026-10-09-walking-speed.md) (§ A fortress dies of thirst beside its still) · **Size:** M · **Needs:** — · **Status:** open

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

1. Reproduce. Copy [`the probe`](../../reports/data/2026-10-09-walking-speed-probe.ts.txt) beside the `f-17` fixture files, scale the `speed` of every row of `src/content/creatures.json` by 2/3 (dwarf 100) or 7/6 (dwarf 175) as a scratch edit, and run with `T140_WATCH=brew T140_WATCH_FROM=120 T140_WATCH_TO=152` (or 236 to 277). The `watch` rows are the job's state changes.
2. Find why job 2206 is not claimed, and why job 4323 makes nothing. Say whether they are one fault. Say what the thief of day 236 has to do with the second, if anything.
3. Fix, amend the spec section that governs it, and pin each with a scenario under `describe('T-188 …')`.
4. Re-run both reproductions: no dwarf dies of thirst while plants, a barrel, a still and a brewer exist.

## Done

- Both reproductions end with drink in stock and no death by `starvation`.
- The scenarios pass.
