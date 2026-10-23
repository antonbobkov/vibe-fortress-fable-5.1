# T-421 — Boars maul a peril-0 fortress to extinction in year 3

**Closed:** 2026-10-22, in 0d8a616.

**Source:** T-113's gate of 2026-10-22b, [the p0-2 bisection](../../../reports/audits/2026-10-22-p0-2-three-years.md) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first)

## Why

`three-years-p0-2` at peril 0 ends year 3 with no dwarf at `e803b69`: thirteen dwarves bled out, every blow of the run from a boar. T-418 only moved one cleaning by most of a day on day 218; from there wild animals met the fortress elsewhere. The bisection shows what the fortress then cannot handle:

- The hearth alert is raised and lowered 35 to 50 times in each 28 days of year 3, about every half day, because boars keep coming near.
- One boar mauled the fortress for eight days before the soldiers killed it. Three soldiers on duty died to boars.
- Each victim took 4 to 8 tusk hits of 11 damage in a few minutes and bled out within 0.14 to 0.39 days.
- One fleeing dwarf was struck again in its hospital bed on the surface.

A peril-0 fortress of a dozen dwarves with a squad should not be wiped out by boars. The orchestrator does not exempt the seed's "grew past embark size" assertion: this is the first flip, and the journals show faults to look at.

## What to do

1. From the probe (`reports/data/2026-10-22-p0-2-three-years.probe.ts.txt`), measure at `e803b69`, days 240 to 270:
   - why a boar stays at the fortress for eight days: its aggression, wander and retreat rules (08), and whether the squad's kill orders reach it (16);
   - what a soldier's fight against a boar looks like: hits each way and time to kill, against the duel figures of T-404;
   - why a boar's 4 to 8 hits land in minutes on one victim;
   - why the hearth alert flaps every half day: the fixture's alert policy (T-410) or the game.
2. Name the cause, then make the smallest fix with a failing test first: a game rule in 08, 10 or 16; a content value (boar damage or aggression, with the annual instrument); or the fixture's alert policy.
3. Re-run p0-2 for three years, and all 20 seeds of `three_years_seeds` across three years. Run the annual instrument by the T-308 rule.

## Done

- p0-2 grows past its embark size at the end of year 3, or this file records why a fortress at peril 0 may die to boars and what the assertion should then say.
- The cause and the fix are in a dated report with before and after rows.

## As done

**Why a peril-0 fortress may die to boars.** By day 224, p0-2 has nine dwarves; two deaths take it back to its embark size of seven. On days 225 and 260, boars make their home chunk beside the gate, and three of them stay there for weeks. They sleep, idle and wander a median 18 to 20 tiles from the gate, and as close as 2. A territorial boar goes for any dwarf within `TERRITORY_RADIUS`. It is faster than a dwarf (0.18 against 0.15) and gores for 11. Every walk to the surface work and the brook passes it.

The squad is not armed until about day 246, its first kill order. Under the fixture's T-387 policy it gets no kill order before then, and the hearth alert for wild animals alone is lifted after half a day and not raised again for a day. That is the flapping, and it is the fixture's policy, unchanged. When the soldiers are armed, they kill the boars but lose three of their own.

Two faults in 10 make each meeting worse: a fleeing patient's trap, and a run past the boar to the hall. Corrected from day 238 on master's timeline, they do not save the fortress: the boars still kill every dwarf. Corrected from day 0, the fortress ends with 15 dwarves, because the corrections reroute its year from the first boar on day 21. So no fault in 08, 10 or 16 decides this year. It turns on where three boars settle and whom they meet.

**What the assertion says.** p0-2's "grew past embark size" is printed and not asserted (`GROWTH_FLIPS` in `three_years_seeds.test.ts`), under T-334's rule: it was 12 at `ab4d40e` and T-419, 0 at T-418, 15 and 0 under the measured rules. The other six peril-0 seeds keep the assertion. The two faults, the burnt gate walls the variant exposed, and boars that never finish leaving are new rows. See [the report](../../../reports/audits/2026-10-22-boars-maul-p0-2.md).
