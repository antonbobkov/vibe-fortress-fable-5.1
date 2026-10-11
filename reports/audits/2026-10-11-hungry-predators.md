# Hungry predators and caught civilians

**Date:** 2026-10-11 · **Task:** T-212 · **Follows:** [`2026-10-10-wild-animals-after-the-fixes.md`](2026-10-10-wild-animals-after-the-fixes.md) · **Code measured:** "before" is `cloud/main` at `b409eed` (an exported copy of that commit); "after" is branch `cloud/T-212`, `cf8b8b5` (`T-212: a hungry predator prefers animal prey; a civilian caught as it flees fights back`) · **By:** Claude (Opus)

## The answer

The two rules the T-212 decision chose are in the game: a hungry predator hunts the nearest animal prey in perception before any dwarf, a pack shares one quarry and the kill feeds the pack; a civilian hit in melee while fleeing, by an attacker at least as fast as itself, turns and fights with what it carries and runs again only by a route the attacker cannot follow.

- **The hunted civilian fights back, and the wolf now dies too, but the civilian it hunts still usually dies.** T-196's chain probe with a hungry wolf, ten seeds: seven haulers lose **14 of 70** (17 of 70 before), and the wolf is killed in 9 of 10 runs (0 before). A lone hauler still dies in 10 of 10 runs. When every hauler holds a pick: **9 of 70** (27 of 70 before) and the wolf dies in 10 of 10 runs.
- **Over a year, wolves kill fewer dwarves but the target is not met.** The three-year fortress script played for one year on three temperate-forest and three taiga seeds at peril 0, with only the game's own wolf arrivals left on the map: a fortress that ignores wolves loses **12 dwarves to wolves in 6 fortress-years** (17 before), none in four seeds and 7 and 5 in the other two, and no fortress dies out (two did before). A fortress that raises the alert and sends its squad loses **7** (8 before), none in four seeds and 3 and 4 in the other two; one of those fortresses later dies out of starvation. Livestock lost to wolves: 0 and 1 dog (2 and 2 dogs before). The decision's target, "a few a year at most" for a careless fortress and none for one that reacts, holds in four seeds of six and fails in two (T-220).
- **With every wild species, boars and bears still decide whether the compact fortress survives (T-214).** Ignoring wildlife: 22 dwarves lost to wild animals in 6 fortress-years, one fortress extinct (47 and four extinct before). Reacting: 21, one extinct (26, two extinct before).
- **Wolves take very little livestock, because a wolf's prey does not include grazers.** 08's size rule (prey is smaller than 0.8 × the predator) gives a wolf dogs, cats, chickens, rabbits and badgers, and no sheep, goat, pig or cow. The Balanced embark brings two dogs and a cat, which spend most of their time below ground; the wolves' quarry in the year runs was a dwarf in every observed hunt but one. Whether a pack should take grazers is filed as T-218.
- **The caught rule costs something against defending animals.** A badger, a boar and a wolf are all at least as fast as a dwarf. A caught civilian no longer runs out of a defending animal's ground, so with a medic the chain probe lost more: boar 7 → 9 of 70, fed wolf 0 → 3; with a squad, boar 2 → 4. Without a medic it lost fewer: boar 18 → 16, fed wolf 16 → 10. Against Hillfolk bandits on the reference fortress, caught civilians fought back and twice as many bled out (2 → 4 in 2,200 ticks). Filed as T-219.
- **System 10 costs about 0.18 ms more per tick on the reference fortress** (0.64 → 0.82 ms, under its test limit of 1.0), because fighting civilians run the escape search every tick.

## What was changed

| Rule | Where in the code |
|---|---|
| Prey is an animal (wild or tame) of a non-carnivore species with `size < own size × 0.8`; the quarry is the pack's, else the nearest prey (Chebyshev, then id), else the nearest dwarf | `src/systems/animals/brain.ts:189` (`isAnimalPrey`), `:200` (`packOf`), `:209` (`packQuarry`), `:225` (`findHuntTarget`) |
| A hunting predator that is no longer hungry returns to `idle` | `src/systems/animals/brain.ts:469` |
| The kill ends the hunger of the killer's pack | `src/systems/animals/index.ts:856` |
| A fleeing civilian hit in melee by an attacker with `Motion.speed` at least its own is caught | `src/systems/dwarves/index.ts:121` (`caughtFleeing`) |
| A threat scan from another hostile does not replace a caught civilian's attacker | `src/systems/dwarves/index.ts:424` |
| A caught civilian fights; it is released when its attacker no longer targets it | `src/systems/dwarves/brain.ts:204` (`stillHeld`), `:257`, `:545` |
| Its only escape is a tile reached through a tile the attacker cannot enter | `src/systems/dwarves/brain.ts:104` (`moverOf`), `:144` |
| A civilian with a combat target never paths toward it | `src/systems/combat/index.ts:341` |
| What it fights with: the wielded weapon, else the held tool when the weapons table has a melee row for it, else the natural attack (unchanged) | `src/systems/combat/melee.ts:215` (`weaponOf`) |

The choices the decision left open (what a pack is, how it shares, what "caught" and "a route the attacker cannot close" mean) are written in 08 § Wild behavior and 10 § Behavior selection, with their reasons in the work file.

Tests: `test/unit/t212-hungry-predators.test.ts`, ten tests. Nine failed on `b409eed` and pass after; the tenth (a dwarf is the quarry only when no animal prey is in perception) pins a rule that already held.

## How it was measured

Probes run in Vitest against the headless game with [`2026-10-11-t212-probe-vitest.config.ts.txt`](../data/2026-10-11-t212-probe-vitest.config.ts.txt) (copy to `vitest.t212.config.ts`, the probe to `test/t212-probe/`).

- **Chain probe** ([source](../data/2026-10-11-t212-probe-chain.test.ts.txt)): T-196's chain probe v2 ([its source](../data/2026-10-10-t196-probe-chain-v2.test.ts.txt)) with the output path made a parameter and one mode added, `haulpick`: the seven haulers first each dig one channel tile, so each fetches and keeps a pick (all 70 did, by `ToolEquipped`). A 96 × 96 flat map, one animal at (48, 42), stone west of it and a stockpile east, 3,600 ticks, seeds `s1` … `s10`; other natural arrivals are removed as they appear. Run with `T196_HUNGRY=1 T196_SPECIES=wolf` for the hungry wolf, and with no switches for the fed badger, boar and wolf. Data: [`2026-10-11-t212-chain-runs.json`](../data/2026-10-11-t212-chain-runs.json).
- **Year probe** ([source](../data/2026-10-11-t212-probe-year.test.ts.txt), [batch script](../data/2026-10-11-t212-probe-runyears.sh.txt)): the shared three-year fortress script (`test/scenarios/three_years_fortress.ts`: setup, then work orders, rooms, cave farm and defence every 100 ticks) on its compact 48 × 48 map, generated from a region spec of wealth 2, mixed geology, a brook, **peril 0 and no trait** (the fixture itself uses `serene_vale`, which removes wolves), biome `temperate_forest` or `taiga`, seeds `t212-<biome>-1..3`, the Balanced embark (two dogs, one cat, no grazers), 112 days. Two fortresses:
  - `ignore`: the script as written; it raises the alert only for raids, and there are none at peril 0.
  - `react`: in addition, at a wild animal's attack on a dwarf or a tame animal the alert goes to `watchful`, the squad (three dwarves, formed by the script on day 10) to `active`, and the squad gets a kill order on each attacker; 600 ticks after the last wild attack, alert `calm` and squad `off`. The pasture part of the decision's "reacting fortress" does not apply: the Balanced embark brings no grazer, and its dogs and cat are not pastured.
  - Each was run with every natural arrival (as-is) and with **wolves only** (`T212_ONLY=wolf`: any other natural arrival is removed within ten ticks of arriving, at least 25 tiles from any dwarf). A run stops early when no dwarf is left. Data: [`2026-10-11-t212-year-runs.json`](../data/2026-10-11-t212-year-runs.json).

Measurement rounds: one before and one after, no constant changed, no tuning round.

## The chain probe: a hungry wolf

Seven civilians (one in `lone`) haul past one wolf that is hungry when it appears.

| Mode | Civilians dead / at risk, before | After | Runs with a death, before → after | Dwarf hits / attacks on the wolf, before → after | Wolf killed, before → after | Ticks first wound to death, after (median, range) |
|---|---|---|---|---|---|---|
| lone | 10/10 | 10/10 | 10 → 10 | 0 / 0 → 68 / 127 | 0 → 8 of 10 | 214 (184–839) |
| haul | **17/70** | **14/70** | 10 → 10 | 0 / 0 → 82 / 152 | 0 → 9 of 10 | 237 (172–670) |
| haulpick | 27/70 | **9/70** | 10 → 9 | 0 / 0 → 29 / 56 | 0 → 10 of 10 | 236 (177–523) |
| hospital | 12/70 | 11/70 | 10 → 9 | 0 / 0 → 71 / 139 | 0 → 7 of 10 | 207 (172–432) |
| react | 10/70 | 9/70 | 10 → 9 | 16 / 30 → 69 / 134 | 5 → 10 of 10 | 207 (172–432) |

The "before" haul row reproduces the 17 of 70 of the earlier report exactly. In `react` the "before" hits are the squad's; after, civilians strike as well.

What it says: a caught civilian strikes back in every run, and a wolf that hunts a group now dies of it. The first civilian it catches still dies in nearly every run: a wolf's bite (edge 10) on a limb is a serious cut, which does not clot (17), and the median from the first wound to death stayed about 210–240 ticks. With a pick the group loses a third as many; with fists, a sixth fewer. Why the `haulpick` "before" figure (27) is higher than `haul` (17) was not established; the miners spend their first ticks on the channel jobs, so the wolf meets them at different times.

## The chain probe with fed animals

The T-196 modes with a fed badger, boar and wolf (a fed animal only defends its ground: 08), ten seeds. Civilians dead of 70 (of 10 in `lone`):

| Mode | Badger before → after | Boar before → after | Wolf before → after |
|---|---|---|---|
| lone | 5 → 6 | 7 → 7 | 4 → 6 |
| haul | 8 → 8 | 18 → 16 | 16 → 10 |
| hospital | 0 → 0 | 7 → **9** | 0 → **3** |
| react | 0 → 0 | 2 → **4** | 0 → 0 |

The full tables are in the data file. Before, no civilian ever struck a defending animal (0 attacks); after, civilians struck in every mode (for example 43 hits in 99 attacks on boars in `haul`). The median time from the first wound to death fell for the boar (256 → 206 ticks in `haul`) and the wolf (602 → 220): a caught civilian stays inside the defender's ground, where 08 lets the defender keep biting, instead of leaving it, where 08 makes it let go. With nobody to bandage, fighting back helps a little; with a medic, the wounds stack up faster than the medic arrives. The rule as decided covers every attacker; whether a defending animal's bite should catch is filed as T-219. A badger with a medic, or with a medic and a squad, still kills nobody.

## A year with wolves only

Dwarves killed by wolves per fortress, one year (seeds in the order taiga 1, 2, 3, forest 1, 2, 3):

| Fortress | Before: per seed (total) | After: per seed (total) | Fortresses with no wolf death, before → after | Extinct by day 112, before → after | Wolves killed by dwarves, before → after | Dogs lost to wolves, before → after |
|---|---|---|---|---|---|---|
| ignores wolves | 11, 0, 0, 0, 6, 0 (**17**) | 7, 0, 0, 0, 5, 0 (**12**) | 4 → 4 | 2 → 0 | 0 → 9 | 2 → 0 |
| reacts | 2, 0, 0, 0, 6, 0 (**8**) | 3, 0, 0, 0, 4, 0 (**7**) | 4 → 4 | 1 → 1 | 0 → 7 | 2 → 1 |

- In four seeds of six the wolves never killed a dwarf, before or after. In the other two, a pack that turned hungry near the fortress killed several in a few days: on `t212-temperate_forest-2` a pack of four arriving on day 4 killed 6 dwarves on days 7–12 (ignoring) and 7–13 (reacting, two of them soldiers) before, 5 on days 7–16 after (ignoring), 3 on days 7–12 and a soldier on day 20 after (reacting). On `t212-taiga-1` the third pack (day 86) killed 11 on days 86–93 before, 7 on days 87–100 after.
- After, the reacting fortress on `t212-temperate_forest-2` lost 9 more dwarves on days 19–86, to starvation (five), burns (two) and bleeding with no killer recorded (two), and died out on day 86. Before, the same fortress was already empty on day 19. Cause of the later deaths not established; the fixture is the economy fixture of T-145 and T-215, which also starves in other runs.
- The squad cannot answer the first pack on `t212-temperate_forest-2`: the script forms it on day 10 and the pack is hungry from day 7. The reacting fortress's kill orders were accepted every time (`react:kill-order`, no refusal).
- Every hunt observed after the change was of a dwarf, but one of a dog (sampled every 20 ticks: 27 distinct wolf-and-dwarf pairs ignoring, 21 and one dog reacting). In the wolves-only runs no wild prey was left on the map; the dogs and cat were rarely within a wolf's perception.

## A year with every wild species

Dwarves killed by wild animals per fortress (same seed order):

| Fortress | Before: per seed (total), extinct | After: per seed (total), extinct | Killers after |
|---|---|---|---|
| ignores wildlife | 9, 0, 19, 11, 6, 2 (**47**), 4 extinct | 3, 0, 8, 8, 3, 0 (**22**), 1 extinct | wolf 12, boar 7, bear 3 |
| reacts | 5, 0, 3, 11, 6, 1 (**26**), 2 extinct | 4, 0, 2, 8, 7, 0 (**21**), 1 extinct | wolf 10, boar 8, bear 3 |

Before, the killers were bears (9 on `taiga-1`), a wolf pack (19 on `taiga-3`), boars (11 on `forest-1`) and wolves (6 on `forest-2`). After, `forest-1` keeps 6 dwarves alive at day 112 (it was empty on day 33 before), and the one fortress that dies out (`forest-2`, both modes) loses 3 to wolves and then the rest to starvation (8 ignoring, days 19–47), and in the reacting run 4 more to boars. Dwarves who were not soldiers on duty struck wild animals 471 times after (162 of them wounding), 116 at wolves and 117 at boars; before, 140 times (20 wounding), none at a wolf and 2 at a boar. Both counts include hunters at work (deer, elk) and cornered civilians (lynx). One dwarf on `forest-3` was killed by another dwarf after the change: a hunter's bolt (job `Hunt`) hit a crafting dwarf in its path on tick 73,079 (traced; 16 § Ranged resolution lets a projectile hit a creature in its path). That is not this task's rule.

## The reference fortress

The saved 80-dwarf reference fortress (`test/fixtures/reference-fortress.deepholm`), stepped the 2,200 ticks the per-system performance test steps, with a probe counting events and brain states ([source](../data/2026-10-11-t212-probe-ref.test.ts.txt)). Its attackers are Hillfolk bandits, not animals.

| | Before (`b409eed`) | After (`cf8b8b5`) |
|---|---|---|
| Bandit attacks on dwarves | 58 | 126 |
| Dwarf strikes at the bandits | 0 | 25 |
| Dwarf-ticks spent fighting / fleeing | 0 / 12,944 | 645 / 8,668 |
| Dwarves who bled out | 2 | 4 |

The caught rule covers every attacker, so civilians caught by bandits stand and fight them with fists and tools, and lose twice as many. This is filed with the defending animals as T-219.

## Performance

`npx vitest run --config vitest.perf.config.ts test/perf/per-system.test.ts` on the reference fortress, mean milliseconds per tick against `performance-budget.md` (the test allows twice the allocation). Indicative: one or two runs each on a shared four-core machine.

| System | Allocation | Before | After (three runs) |
|---|---|---|---|
| 08 animals | 0.40 | 0.842, 0.819 | 0.805, 0.788, 0.842 |
| 10 dwarves | 0.50 | 0.631, 0.643 | 0.822, 0.800, 0.829 |
| 11 jobs | 0.60 | 0.650, 0.652 | 0.673, 0.670, 0.696 |

System 08 is at or over twice its allocation before and after (the test fails in four of the five runs, the limit being 0.8); the pack and quarry choice did not move it measurably. System 10 rose by about 0.18 ms, and stays under its limit of 1.0. Cause, read in code and counted above: a fighting civilian runs the escape search every tick (`src/systems/dwarves/brain.ts:552`, as the cornered fight already did), and the caught rule produced 645 dwarf-ticks of fighting where there were none.

## Effects on related rows

- **T-214** (boars wipe out the economy fixture): the caught rule changes how civilians meet boars: in the year runs boars killed 11 on `forest-1` before and 7 (ignoring) or 4 (reacting) after; in the chain probe, 18 → 16 of 70 without a medic and 7 → 9 with one. The T-214 diagnosis should start from this code.
- **T-213** (corpse eating, the 50-tick grace): the pack's shared hunger ends at the kill, as the kill alone ended the killer's hunger before; still no corpse is eaten.
- **T-210** (pasture capacity) and **T-211** (wounded soldier on duty): not touched. The year runs' pasture held no animal.

## Not established

- Why two seeds of six meet a hungry pack that kills several dwarves within days while four never lose a dwarf to wolves. Packs arrive in every run; where their hunger falls relative to the surface work was not traced.
- Why the `haulpick` "before" figure exceeds `haul`.
- Why the reacting fortress on `t212-temperate_forest-2` starved after losing four dwarves, and what burned two of them.
- How often livestock would be lost with grazers on a pasture: under the current prey rule a wolf takes none of them (T-218), and the Balanced embark has none.
