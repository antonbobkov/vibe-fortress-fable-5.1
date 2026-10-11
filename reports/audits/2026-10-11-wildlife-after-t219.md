# Wildlife after the hunted-civilian rule

**Date:** 2026-10-11 | **Task:** T-253 | **Code measured:** `9714b85` | **By:** Codex

This re-measures [T-212](2026-10-11-hungry-predators.md) after the rule that catches a fleeing civilian only when a wild animal is hunting it. The measured master also contains the pack-size rule, patient refresh, squad need handling and medics working under hearth alerts. These are current-state measurements, not an isolated estimate of any one fix.

## Measurements

The fed-animal cases recover the pre-T-212 losses exactly: no medic, badger 8/70, boar 18/70, wolf 16/70; a medic, 0/70, 7/70, 0/70; a medic and answering squad, 0/70, 2/70, 0/70. Against bandits the reference fortress again loses two dwarves rather than four, and caught civilians make no strikes. The hungry wolf still kills a lone hauler in every run. Picks still cut group losses to 9/70, but unarmed haulers now lose 17/70, not the old 14/70.

## Short encounters

The original chain probe runs a 96 by 96 flat map for 3,600 ticks, seeds s1 through s10. A lone civilian or seven civilians haul across one animal; hospital supplies a medic and cloth; react also sends a squad after the first attack. Other natural arrivals are removed. The animal starts fed in the following 120 cases.

| Mode | At risk | Badger deaths, T-212 / current | Boar deaths, T-212 / current | Wolf deaths, T-212 / current |
|---|---|---|---|---|
| lone | 10 | 6 / 5 | 7 / 7 | 6 / 4 |
| haul | 70 | 8 / 8 | 16 / 18 | 10 / 16 |
| hospital | 70 | 0 / 0 | 9 / 7 | 3 / 0 |
| react | 70 | 0 / 0 | 4 / 2 | 0 / 0 |

Civilians make zero attacks in lone, haul and hospital with fed animals. The react figures include soldiers attacking on command: badger 12 hits / 24 strikes, boar 37 / 66, wolf 14 / 18. A defender no longer catches civilians merely because its speed matches theirs.

The next 50 cases start one wolf hungry. The haulpick mode first has each hauler dig a channel and acquire a pick; all seven hold picks in each of its ten cases.

| Mode | Deaths / at risk, T-212 | Current | Runs with a death | Wolf killed / 10 | Dwarf hits / strikes | Median ticks first wound to death (range) |
|---|---|---|---|---|---|---|
| lone | 10/10 | 10/10 | 10 | 8 | 68 / 127 | 229.5 (184-839) |
| haul | 14/70 | 17/70 | 10 | 8 | 58 / 119 | 302 (172-1368) |
| haulpick | 9/70 | 9/70 | 9 | 10 | 29 / 56 | 236 (177-523) |
| hospital | 11/70 | 10/70 | 9 | 8 | 58 / 119 | 207.0 (172-685) |
| react | 9/70 | 9/70 | 9 | 10 | 70 / 135 | 207 (172-432) |

## Fortress years

The original three-year script plays one year on a generated 48 by 48 map, peril 0, wealth 2, mixed geology, a brook and no trait. The Balanced embark brings two dogs and a cat, no grazers. No supplied livestock, pasture enclosure, extra farms, altered production timing or new capacity is used here. Ignore runs the script unchanged. React raises watchful, activates its squad and gives kill orders after a wild attack; after 600 quiet ticks it stands down. The squad is formed on day 10. Wolves-only removes other natural arrivals after setup, within ten ticks; all-species keeps every natural arrival. A run stops early when no fortress dwarf remains.

Seed order in the table is taiga 1, 2, 3, temperate forest 1, 2, 3 (`t212-<biome>-<n>`). End day 113 means 112 days completed. Extinction counts every cause, not just wildlife.

| Species kept | Response | Dwarf wildlife deaths per seed (total) | Zero-loss seeds / 6 | Extinct / 6 | Living dwarves per seed | End day per seed | Livestock killed by wildlife |
|---|---|---|---|---|---|---|---|
| wolf | ignore | 8, 0, 0, 0, 5, 0 (13) | 4 | 0 | 4, 13, 18, 17, 7, 18 | 113, 113, 113, 113, 113, 113 | 0 |
| wolf | react | 5, 0, 0, 0, 5, 0 (10) | 4 | 0 | 6, 13, 18, 17, 7, 18 | 113, 113, 113, 113, 113, 113 | 0 |
| all | ignore | 9, 0, 13, 11, 9, 0 (42) | 2 | 3 | 0, 13, 7, 0, 0, 17 | 49, 113, 113, 33, 34, 113 | 0 |
| all | react | 1, 0, 2, 11, 4, 0 (18) | 2 | 2 | 11, 13, 18, 0, 0, 17 | 113, 113, 113, 49, 48, 113 | 0 |

**wolf, ignore:** wildlife killers wolf:wild: 13; other recorded causes starvation: 1.

**wolf, react:** wildlife killers wolf:wild: 10; other recorded causes starvation: 1.

**all species, ignore:** wildlife killers bear:wild: 9, boar:wild: 11, wolf:wild: 22; other recorded causes starvation: 2.

**all species, react:** wildlife killers bear:wild: 1, boar:wild: 10, wolf:wild: 7; other recorded causes starvation: 7.

These counts do not meet the intended limit of a few dwarf losses at most when ignored, and none with a response. T-220 owns the seed-by-seed cause and response diagnosis; T-214 owns the boar failures and T-215 the economy starvation. No constant or fixture capacity was tuned to change these results.

## Reference fortress

The saved 80-dwarf reference fortress is stepped exactly 2,200 ticks. Its SHA-256 is `e4cefc31bdb4b217747b22a7fe13f1b3802a2500f7638686d17dfb892f1ea41a`. Events identify both bandit killers as hillfolk_bandit, hostile:hillfolk.

| Measure | T-212 | Current |
|---|---|---|
| Bandit attacks on dwarves | 126 | 58 |
| Dwarf strikes at bandits | 25 | 0 |
| Dwarf ticks fighting / fleeing | 645 / 8,668 | 0 / 12,944 |
| Dwarves killed by bandits (bled out) | 4 | 2 |
| Strikes by caught civilians | Not separately counted | 0 |

The two dwarf deaths are at ticks 270452 and 270642. A tame goat also bleeds out to a bandit at tick 270967. No threat retains a caught civilian at the endpoint. Timing budgets were not measured; deterministic event counts here are not a performance test.

## Correction to the pack-prey report

The earlier [pack-prey report](2026-10-11-pack-prey-size.md) incorrectly labels its supplied sheep, goat and cow as male. Its frozen source sets sex: 0; system 08 treats sex 0 as female and sex 1 as male (`src/systems/animals/index.ts`, animal products and mate selection). Each pasture therefore received one female of each species, without a supplied same-species mate. The recorded losses and boundary trace remain valid; female animals remain eligible for ordinary products such as milk; the label must not be read as a control that disabled those products. This report corrects that label, and the living balance row now says female. The earlier report and its data remain frozen.

## Reproduction and data

Copy the source files below into .vite/task-resume/ with their t253- names, removing the date prefix and .txt suffix. Run from the repository root on the measured commit. The batch runner sets every seed, species, mode, filter and output path explicitly. Run python .vite/task-resume/t253-run-probes.py chain, then temperate_forest and taiga as separate arguments for the years. Measurements may run concurrently because none reports wall-clock simulation performance; each game has independent deterministic state.

- [Fed chain data](../data/2026-10-11-t253-chain-fed.json), [hungry chain data](../data/2026-10-11-t253-chain-hungry.json), [year data](../data/2026-10-11-t253-year-runs.json), [reference data](../data/2026-10-11-t253-reference.json), [metadata](../data/2026-10-11-t253-metadata.json).
- [Chain source](../data/2026-10-11-t253-probe-chain.test.ts.txt), [year source](../data/2026-10-11-t253-probe-year.test.ts.txt), [reference source](../data/2026-10-11-t253-probe-ref.test.ts.txt), [Vitest config](../data/2026-10-11-t253-probe.config.ts.txt), [batch runner](../data/2026-10-11-t253-run-probes.py.txt), [summarizer](../data/2026-10-11-t253-summarize.py.txt).

The sources differ from the original T-212 probes in import/output paths, removal of one unused local binding, and additional read-only reference event counters; the simulation-driving statements are unchanged. No runtime source, constant, accepted command, golden, survivor assertion or long-fixture timing changes in this task.
