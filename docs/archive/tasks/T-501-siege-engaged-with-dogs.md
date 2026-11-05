# T-501 — A siege stays engaged for days with fortress dogs it cannot strike

**Closed:** 2026-11-05, in 0c873fe3,66611af9,31e2e2d6.

**Source:** [the careless-shooter arena](../../../reports/audits/2026-11-04-t483-careless-shooter-arena.md) § The twenty-seed file · **Size:** M · **Needs:** — · **Status:** open

The specification is [18 Threats](../../02-systems/18-threats-monsters-and-raids.md) § Party AI (engage, loiter, retreat) and [16 Combat](../../02-systems/16-combat.md) § Targeting.

## What was found

In the twenty-seed file with careless shooters, `three-years-p4-3` stopped at tick 235,200 (day 197) on the T-176 invariant `party.active-over-10d`: a siege of 35 that arrived on day 186 was still active. Its fortress was extinct on day 188, as in the held-shot run and the reference. From then on the siege's captain held a fortress dog (one of two untrained dogs, at 26–28,5,27) from 23,7,27, every other member held nothing, and the party stayed in `engage`, its `stateSince` set again about every 3,000 ticks (224,981, 227,981, 230,981, 233,981). So neither the 3-day engage invariant nor loiter's 5 days ever ran out. The same seed with every shooter always holding (`CARELESS_SHOT_PERCENT` 0, the same code otherwise) ends its fortress on day 188 too and passes: the siege's skill is 10, so it draws nothing, and the two runs part only because earlier raids' weighings moved 16's stream. Data: `reports/data/2026-11-05-t483-p4-3-siege.txt` (probe `…-p4-3-siege.probe.ts.txt`).

## What to do

Find why the captain neither reaches nor drops a dog it holds (16's `TARGET_LOSE_TICKS` should end an unreachable target) and why the party re-enters `engage` with it, and make a party with no target it can strike go on to loiter and retreat. Pin it with a test: a siege whose only fortress creatures are animals in a pen it can see but not enter leaves within `LOITER_DAYS_SIEGE`. Then re-run `three-years-p4-3`.
