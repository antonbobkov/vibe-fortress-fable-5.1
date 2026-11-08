# Measurement: why the defence fortress stopped turning raids back, and a verdict for it

**Task:** T-522 · **Date:** 2026-11-07 · **Commits examined:** the merges on master from T-504 (`d0794187`) to T-518 (`6f5763ad`); master `a7ba4629` (with the verdict job only, `676ae0e3`); the T-522 branch at `16fbba04` (master with T-503 and T-510, the door rule and the cage order) and `9932873e` (with the club and the living squad leader) · **Kind:** a regression found by bisection, a game rule fixed, a script fault fixed, and a verdict job · **Source:** [the T-522 work file](../../docs/work/T-522-defence-repel-rate-fell.md), [T-504](2026-11-05-t504-raid-morale.md), [T-466](2026-11-05-t466-defence-repels-a-raid.md), [T-503's rows](../data/2026-11-07-t503-defence-seeds.md)

## The answer

- **Cause.** T-518 gave the three-year fortress a second line: four doors on the stair's foot, locked under the alert. A raid whose goal (the hearth) has no path takes "the reachable tile nearest to the goal" (18), which 22's `nearestReachable` found by a search from the hearth over passable tiles only. Before T-518 that search climbed the open stair shaft and found the kill corridor outside the north door; behind the second line it never leaves the halls (354 tiles on levels 23 to 26, then nothing at any bound). The raid's goal fell back to its own arrival tile at the map's corner: it loitered there for two days while its members walked from item to item looting the surface, and went home `looted` without ever seeing the gate, the cage or the squad.
- **A second cause, on some timelines.** The carpenter takes its orders in list order, and the three-year script's barrel order is never met from the second season (its threshold follows the drink), so the defence's cage order behind it waited for good. On `defence-year-3` an ambush carried off both cages from the stockpile on day 66, none was made again, and the cage trap stood planned at the raid. This came with T-512's timeline (6 of 8 at cadence 20).
- **Fix.** The game rule: `nearestReachable` searches through doors (a locked door is the way in, not a wall) and never returns one, so a raid on a locked fortress comes to the outside of its gate (22 § Connectivity labels; 18 § Party AI, Goal selection). The script: `defence_year`'s cage order, and a club for the weapon trap, lead the carpenter's list, as a player moves a defence order up; a squad leader is chosen among the living (a seed failed on `SetSquadLeader` naming a soldier who had just died); and the scenario prints a dwarf killed by lightning instead of failing on it.
- **Result.** Seeds of eight that turn every raid back, mean over the cadences: **2.5** on master (six cadences: 3, 2, 4, 1, 2, 3) → **6.5** with the door rule and the cage order (four cadences: 6, 7, 6, 7 of 7) → **5.6** on the final commit (eight cadences: 4, 6, 6, 5, 6, 5, 6, 7); a soldier kills a hostile on a mean of 6.3 → 7.5 seeds. The twenty-seed sweep passes, and the peril-4 seeds do better, not worse: 226.75 → 254.25 living and 76 → 61 deaths a sweep.
- **The verdict.** `measure.yml` suite `defence_seeds` now plays the eight seeds at eight cadences, 20 to 55 by fives (input `watch`), and a `defence-verdict` job judges the pooled 64 rows: the mean over the cadences must keep both set rules (5 and 4 of 8). One cadence is no evidence: the count moved from 1 to 4 of 8 over six cadences of one commit, and from 4 to 7 on the final one; eight cadences put the mean's spread near a third of a seed.
- **What still loses.** Mostly one fault, filed: a carpenter's open job that no idle carpenter takes for two months blocks the workshop, so the cage that would rearm the trap is never made and the raid's captain stands on a spent cage trap.

## The bisection

`measure.yml` suite `defence_seeds` on a branch at each merge, at cadences 20 (the scenario's) and 25. "Turned" is seeds whose every announced raid ended `repelled` or `wiped`. At cadence 25 before T-503 the seed `defence-year-6` stopped on the archery range's overlap fault, so those rows have seven seeds. Rows: [bisect](../data/2026-11-07-t522-bisect.jsonl).

| Merge | Commit | Turned at 20 | Turned at 25 | Runs |
|---|---|---|---|---|
| T-504 | `d0794187` | 8 / 8 | 4 / 7 | 42377441088, 42377445839 |
| T-508 | `d2f68294` | 8 / 8 | 4 / 7 | 42377450814, 42377455394 |
| T-509 | `6c923f67` | 8 / 8 | 4 / 7 | 42377460356, 42377465069 |
| T-498 | `c23b76cc` | 8 / 8 | 4 / 7 | 42377469811, 42377475191 |
| T-512 | `d172b1ee` | 6 / 8 | 8 / 8 | 42377480471, 42377485490 |
| T-513 | `5312b44d` | 6 / 8 | 8 / 8 | 42377490559, 42377495232 |
| T-499 | `992b2a23` | 6 / 8 | 8 / 8 | 42377500263, 42377504946 |
| **T-518** | `6f5763ad` | **2 / 8** | **4 / 8** | 42377509765, 42377514579 |

Pooled over the two cadences: 12 of 15 to 14 of 16 before T-518, 6 of 16 at it. T-504's 8 of 8 was its cadence's draw: the same code turned back 4 of 7 at 25, where the raid looted with its captain caged (its members had already picked up loot outside the corridor before the party broke). After T-518 the losing seeds are `looted, captain left` with no trap sprung: the raid never came to the corridor.

## The journal

`defence-year-8` at cadence 20 on master after T-503 and T-510 ([journal](../data/2026-11-07-t522-journal-defence-year-8-master.txt), from the [probe](../data/2026-11-07-t522-journal.probe.ts.txt)). The cage, weapon and stone-fall traps stand built in the corridor, the north door is locked by the alert, and the raid of nine and its captain arrives at the north-west corner on day 121:

- Its leader's label covers the corridor (the corridor's three tiles and the bridge's mouth share it), but the hearth, on level 26 behind the second line, has no path. `nearestReachable` from the hearth to the raid's label returns nothing at bounds 3,000, 6,000, 12,000 and 50,000: its search visits 354 tiles on levels 23 to 26 and stops.
- The goal is the captain's own tile. The raid stands there, sees a creature outside and engages, takes heart (morale 90 → 100), then loiters, its members picking up 7 items from the surface within six tiles of each other, and leaves on day 123 with them: `looted`. No trap is touched.
- With the door rule, the same search on the same day finds the corridor tile before the north door (it goes through the second line's doors and up the stair), and on that seed the captain walks into the cage on tick 144,190; the raid breaks at once: `repelled`. On `defence-year` (which turned its raid back on master too) the old search had found the same tile by climbing the stair shaft beside an open stair foot.

## After the fix

Before, run 42377818856 at `676ae0e3`, master with the verdict job ([verdict](../data/2026-11-07-t522-defence-seeds-master.md)); the door rule and the cage order, run 42379967466 at `16fbba04` ([verdict](../data/2026-11-07-t522-defence-seeds-after.md)); the final commit, runs 42418503250 and 42419837272 at `9932873e` ([20 to 35](../data/2026-11-07-t522-defence-seeds-final-20-35.md), [40 to 55](../data/2026-11-07-t522-defence-seeds-final-40-55.md)).

| | Cadences | Turned back, by cadence | Mean | A soldier killed, mean |
|---|---|---|---|---|
| Master | 15, 20, 25, 30, 35, 40 | 3, 2, 4, 1, 2, 3 | **2.50** (blocked) | 6.33 |
| Door rule, cage order | 20, 25, 30, 35 | 6, 7, 6, 7 of 7 | **6.50** | 7.25 |
| Final | 20 to 55 by fives | 4, 6, 6, 5, 6, 5, 6, 7 | **5.63** (pass) | 7.50 |

`ci.yml` on `16fbba04`'s successor `a4f06a6a` failed `defence_year` (the scenario, seed `defence-year`): on the new timeline no weapon came free for the weapon trap, which the scenario asserts built. The carpenter now keeps one club (maintain 1) beside the cage order. That timeline also put a dwarf outdoors under a storm's lightning on day 14 (a grievous head and torso burn, dead in 460 ticks), which the scenario had counted as the fortress failing; it now prints a death by lightning as it prints a fight's. Whether the club costs the drop from 6.5 to 5.6 is not separable from the timeline's spread (one cadence ran 4 to 7 on one commit).

In that run `defence-year-7` at cadence 35 stopped on `SetSquadLeader rejected (not_found)`: the script named the roll's first soldier, who had died that tick. The script now names a living one (its fault, not the game's). The remaining losses:

- `defence-year-7` loots at 20, 25 and 30 at `16fbba04`, and `defence-year` at 20 on the final commit. Each cage trap caught a creature months before (a bandit on day 74, a raider of year 1 on day 75) and needs an empty cage to be rearmed; the carpenter's bed job stood open with no worker from day 57 to the raid, while the dwarves with the carpentry labor were idle, could reach its work tile and had it enabled, with 148 logs in stock. The workshop holds one job at a time, so no cage was made: the raid's captain stood two days on the spent cage trap, and its members looted the surface. Filed as T-NEW (below).
- `defence-year` at 30 loots with its captain killed (one raider dead): a fight, not a fault.
- `defence-year-8` at 20 `withdrew`: its corridor's bridge was never placed (the channel under it is never dug, on `-4` and `-8` at every cadence), and the raid stood at the corridor's mouth for its two days without stepping on the cage.

## Raids in general

The rule moves every party whose goal is locked away: raids and sieges now come to the outside of the gate, where traps, archers and a door-breaker's door are, instead of wherever a search over the halls happened to surface. Twenty-seed sweep, run 42379973093 at `16fbba04`, against T-510's run 42372046622 (`8dec2397`, the same game without the rule) ([verdict](../data/2026-11-07-t522-sweep-verdict.md)):

| | Living at year 3 | Deaths | Extinct | Verdict |
|---|---|---|---|---|
| Before, pooled | 936.75 | 144.25 | 0.5 | pass |
| T-522, pooled | **953.75** | **121.5** | 0.5 | **pass** |
| Peril 0, a sweep | 426.5 → 426.5 | 3 → 3 | 0 → 0 | |
| Peril 2, a sweep | 283.5 → 273 | 65.25 → 57.5 | 1 → 1 (`p2-4` at 100) | |
| Peril 4, a sweep | 226.75 → **254.25** | 76 → **61** | 1 (`p4-4` at 50) → 1 (`p4-5` at 0) | |

Raids are not weaker: they come to the defence instead of the surface, and at peril 4 a fortress behind its gate loses fewer dwarves to them. `p2-4` at shift 50 fails its job on its T-156 witness, as in T-513's reference and since (T-488).

## On today's master

Merged with T-488, T-523 and T-524 (`23d73d03`): `defence_seeds` gives the final commit's rows to the seed, mean **5.63** (pass; run 42421159823, [verdict](../data/2026-11-07-t522-defence-seeds-merged.md)); the sweep passes, pooled 943.5 living and 130.75 deaths, peril 4 243 living and 66.25 deaths a sweep (run 42421166022, [verdict](../data/2026-11-07-t522-sweep-verdict-merged.md)); `ci.yml` passes, 3,619 tests in four shards and e2e 39 (run 42421153861).

## Fun

- **Raiders who never found the door.** Before the fix a raid on a fortress behind two locked lines stood at the map's corner and walked from log to log across the surface, a scavenging party that never saw the gate, then went home pleased with itself (morale 100).
- **An ambush steals the cages.** On `defence-year-3` an ambush, beaten off, carried away both cages meant for the cage trap: the trap for the next raid was robbed by the one before.
- **The caged bandit holds the trap.** On `defence-year-7` the cage trap's catch, a bandit, sits in its cage on the trap all year; until a new cage comes the trap is loaded with a prisoner and catches nothing else.

## What this does not measure

- Sieges at the gate with door-breakers under the new rule beyond the sweep's peril-4 seeds; no arena was run.
- Why the carpenter's open job had no worker for two months (T-NEW).

## Reproduce

- Verdict: `gh workflow run measure.yml --ref <branch> -f suite=defence_seeds` (cadences 20 to 55; `-f watch=<list>` for others), read the `defence-verdict` job.
- Journal: copy the probe to `test/perf/`, `T522_SEED=defence-year-8 T522_TICKS=152000 npx vitest run -c vitest.perf.config.ts test/perf/<file>`; it writes `.vite/t522-<seed>-<cadence>.txt`.
