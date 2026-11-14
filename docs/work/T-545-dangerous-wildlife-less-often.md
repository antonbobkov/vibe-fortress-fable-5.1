# T-545 — Wolves and bears come less often

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
