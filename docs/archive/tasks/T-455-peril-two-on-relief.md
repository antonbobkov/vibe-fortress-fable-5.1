# T-455 — Perils 2 and 4 are far harder on relief

**Closed:** 2026-11-01, in 967bd25.

**Source:** T-451, [the script on relief](../../../reports/audits/2026-10-31-three-year-script-on-relief.md) · **Size:** M · **Needs:** — · **Status:** open (measurement first; not started)

## Why

With the three-year script playing properly at relief 1, peril 0 hardly moves, but peril 2 falls hard:

| Peril | Relief 0, deaths / living | Relief 1, deaths / living |
|---|---:|---:|
| 0 | 1 / 385 | 1 / 370 |
| 2 | 56 / 308 | 114 / 83 |
| 4 | 101 / 174 | 111 / 78 |

Eight seeds end with nobody alive, against two on level maps. The same parties come. Real maps have relief, so this is either what the owner's players meet or a weakness of the script's defence on slopes.

## The questions

1. **Does the gate-and-wall defence still seal the fortress on sloped ground, or do raids walk round it over ramps?** The script encloses its stair with six walls and two doors at one level. Find out whether a party's path to the halls goes through the gate, what the walkers' labels are with the doors locked, and where each raid first meets a dwarf on both reliefs.
2. **Why is arming later?** In `three-years-p4-3` the squad is armed on day 69 against 52. In a journal of that seed the opening keeps pace to about day 20; then the pantry comes on day 42 against 26, and the first short sword on day 56 against 36. No blocked job explained it. Measure the same steps over the peril-2 and peril-4 seeds on both reliefs.

## What to do

Measure first, with a journal and a dated report. Do not tune before the cause is named. A fault in the game gets a failing test and a fix; a fault in the script gets a fix in the fixture. If the answer is that relief is harder and the defence holds, say so, and say what a player should do differently.

## Done

- Both questions are answered in a dated report, with the fix or the decision each needs.
- Where this moves the sweep, the row (226 deaths, 531 living) is re-measured and what the set rule's allowance covers is re-stated in testing-strategy.md.

## As done

The gate leaked on relief because the script dug rooms out of the hillside; that is fixed in the fixture. Arming is not later on relief. Deaths outdoors, twice those on level maps, were not measured further, by the owner's decision. p2-3 stays extinct until the game gap on plants on a building site is dealt with. Reports: [the measurement](../../../reports/audits/2026-10-31-perils-on-relief.md), [the final row](../../../reports/audits/2026-11-01-perils-on-relief-final.md).
