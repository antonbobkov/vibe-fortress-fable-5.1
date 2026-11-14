# T-545 — Wolves and bears come less often

**Closed:** 2026-11-13, in 5d355335,fd383eb0,189f3ee9.

**Source:** the owner, 2026-11-13 · **Size:** S · **Needs:** — · **Status:** open

## The owner's decision

"Generally, a steel-equipped well-trained squad of ~5 fighters, few archers and a wizard should have no problem handling wildlife incursions (wolves/bears). Don't make them come too often - it's a nuisance." This task is the second half: how often they come. [T-544](T-544-bear-mauls-unanswered.md) is the squad.

## Why

Wild spawning (08 § Wild spawning) rolls `SPAWN_PERMILLE` (150) per species per day while the species is under its biome cap. A pack that leaves after `WILD_LIFETIME_DAYS` (42) is soon replaced. T-539 counted 1,155 wild alerts in one sweep (80 timelines), up from 604 when the squad still hunted. Each arrival of a dangerous species raises an alert (08 § Announcements), so the fortress shelters again and again.

## What to do

1. Measure how often a dangerous species (08's definition: surface, not timid, carnivore, aggressive or territorial) arrives today, per biome and peril, over a year. Use the sweep's logs or a cheap generation-only count.
2. Make dangerous arrivals rarer. The plainest rule wins. For example: a lower spawn weight for dangerous species, or a quiet spell of some days after a dangerous group arrives or leaves, during which no other dangerous group spawns. Keep `beastwood` as the region where they come often, and `serene_vale` with none. Pick a target, for example a dangerous group about once a season in an ordinary biome, and write it in 08 as a constant marked *unmeasured*.
3. Draw nothing new for a species that does not spawn. If the rule needs a draw, use 08's own stream, and say in `golden:` which goldens move.

## Done

- 08 says how often dangerous wildlife comes, and the code does it, with a unit test.
- The arrival count before and after is in the work file. The sweep and instrument verdicts pass, with wild alerts and wild deaths reported before and after.

## Result (2026-11-13)

**The rule** (08 § Wild spawning): after a dangerous group arrives, no dangerous species spawns for `DANGEROUS_QUIET_DAYS` (28, a season; *unmeasured* in play), counted from that arrival. During the spell a dangerous species draws nothing; the other species roll as ever. `beastwood` has no spell. `serene_vale` still has no wolves or bears, and its boars, badgers and lynxes keep the spell. 08 saves the tick of the last dangerous arrival (`lastDangerousTick`, omitted when none). Unit test: `test/unit/animals/t545-dangerous-quiet.test.ts`.

**Arrivals**, dangerous groups a year by spawning alone (no kills, 10 seeds × 3 years): `temperate_forest` 11.1 before, 3.2 after; with `serene_vale` 7.4 and 3.0; with `beastwood` 10.8 and 10.8; taiga 8.2 and 3.0; dark forest 6.9 and 3.1. Every biome is in [the data file](../../../reports/data/2026-11-13-t545-wild-alerts-and-deaths.txt).

**The sweep** (pooled over shifts 0 to 150, T-543's method):

| | run | living / deaths | wild alerts (80 timelines) | deaths raid / wild / other | verdict |
|---|---|---|---|---|---|
| before, master `71484494` | 43561424594 | 886 / 147 | 1,202 | 105.5 / 39.5 / 1.25 | pass |
| after, `5d355335` | 43562051671 | 1014.75 / 135 | 540 | 116.75 / 12.25 / 5.75 | pass |

**The instrument**: before (run 43561445362) living 143.25, wildlife-free 6.38; after (run 43562053876) living 151.88, wildlife-free 9.38; both pass. The references are left as they were, since T-544 moves the same sweep at the same time; the rows the verdicts offer are in the data file.

**`pp_defence`** now plays seed `pp-defence-4`, chosen because fewer dangerous arrivals made the old seed starve before the next group came: its first two boars killed a soldier and fled, the wagon's food ran out by day 40, and the next dangerous group (a badger) came on day 43. On `pp-defence-4` a badger is met and killed on day 7, with or without the spell. Of six seeds, five passed before the change and three after.
