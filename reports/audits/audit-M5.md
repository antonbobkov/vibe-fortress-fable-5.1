# Audit after M5

Date: 2026-09-24. Scope: the spec (`docs/00-` through `docs/05-`) and the implementation through T-M5-09 (110 commits; Opus built M0 through T-M4-03, GPT-6 via Codex built T-M4-04 through T-M5-09). Method: reading the spec, the decision log, the gate reports, the source and the tests; git history for test changes. Nothing was run and nothing was changed.

## Correction after verification (same day)

Writing the fix documents (`docs/05-plan/fixes/`) meant reproducing each finding on a scratch copy. A probe that plays the opening of a fortress found defects this audit had missed. They are more serious than anything below:

- **Job assignment livelock** (fix F-01). A building waiting for materials is reopened every 100 ticks without a check, wins assignment, fails its claim, and leaves the dwarf idle. In 2 of 3 probe seeds the fortress stopped: no stairs, no digging, no hauling for 20 days, with 2,239 failed claims. The W4 pseudo-code specifies this behaviour.
- **Multi-unit building inputs count stacks** (F-01). Crafted blocks come in stacks of 2, so a hearth, forge or magma workshop can never be built from crafted blocks.
- **The Balanced embark feeds seven dwarves for about 6 days and gives them drink for about 3.5** (F-08), against the "season" the documents claim. With M6, that becomes lethal on dry maps.
- **The Deep's emergences are exported empty** (F-08). No creature would ever emerge.
- **M6 needs combat skills the spec never gives** creatures and raiders (F-08).

The verdict below ("Nothing is way off") is therefore wrong on one point: the core job loop was broken for realistic play. With the F-01 fixes prototyped, the probe fortresses built a still by days 2–3 and a hearth by days 5–6 on every seed.

## Verdict

Nothing is way off in the architecture or the process. See the correction above for the job loop. The architecture is sound and the process works: every ambiguity is logged, contradictions are parked honestly rather than papered over, and determinism and save/load are held to a hash-equality contract with property tests behind it.

No deliberate reward hacking was found. The pattern that does exist is softer: in several places the tests exercise the easiest seam, not the path a player actually uses. So the suite is green in areas where the game behavior hasn't really been proven.

Three things should be settled **before M6 starts**, because M6 and M7 build directly on them:

1. The morale system can't make a normal dwarf miserable (a contradiction inside the spec).
2. Disturbed water never settles (a perf time bomb once players touch water).
3. Acceptance tests keep contradicting the spec's own arithmetic, and M6 already has at least one more.

## Findings, ranked

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | High | Morale has no teeth: need pressure is folded into the negative cap, so neglect can't cause misery | `docs/02-systems/15-happiness-and-morale.md` § Mood vs § Interaction with 10 needs; `src/systems/morale/mood.ts:33` |
| 2 | High | Disturbed water with uneven depth stays active forever | `src/systems/fluids/step.ts:449`; C-002, D-092 |
| 3 | High | Acceptance tests contradict spec arithmetic (7 so far; M6 has more) | `docs/04-implementation/acceptance-tests.md`; C-003 to C-008 |
| 4 | Medium | No evidence yet that a fortress can bootstrap itself; the year-one audit can't succeed | `test/scenarios/year_one.scenario.ts`; `reports/M4-gate.md`, `M5-gate.md` |
| 5 | Medium | Dwarves' social need rarely succeeds; need targets ignore reachability and can loop | `src/systems/dwarves/activities.ts:198-234`; `brain.ts:65` |
| 6 | Medium | Most workshop tests and three gate scenarios bypass the simulation | `test/unit/workshops/*`, `ws_masterwork`, `it_value`, `it_wealth` |
| 7 | Medium | Content ids hard-coded in the workshop operator | `src/systems/workshops/operate.ts` |
| 8 | Low | Five announcements print raw string keys | `src/systems/morale/index.ts:76-79`, `foraging/index.ts:83` |
| 9 | Low | `tr_dig_room` fully disabled, taking the only live drop-rate test with it | `test/scenarios/tr_dig_room.scenario.ts:47` |
| 10 | Low | Perf smoke doesn't exercise jobs, hauling or workshops | `test/perf/reference-fortress.ts` |
| 11 | Low | Housekeeping: dead milestone seam, slow suite, gate-report errors | see below |

## Fix before M6

### 1. Morale has no teeth

The spec gives the mood formula as:

```
mood = 55 + positives(≤40) − negatives(≤35) − needPressure(≤20) + hearthBonus + personalityBase
```

It then promises: "A dwarf with every need met and no hearth has a floor of 20 … Reaching Miserable requires neglected needs." That guarantee only works if need pressure is a **separate** term. The same document then says, in § Interaction with 10 needs, that the standing need thoughts *are* the pressure term and are counted inside `negatives`.

The implementation follows the second reading (`mood.ts:33`: "Standing need thoughts already carry need pressure inside the shared negative cap"). `NEED_PRESSURE_CAP` is declared and never used. The standing need thoughts can add up to −45 (hungry −10, thirsty −10, tired −8, lonely −5, bored −4, restless −4, uncomfortable −4), but they share the −35 cap with every other negative.

What that means in play:

- A dwarf with neutral personality **can never drop below 20**, however badly they are treated. There's no misery from neglect, so no sulks from neglect.
- Misery is reachable only through `personalityBase` −6 (sensitive plus timid). That is exactly the case the anti-spiral guarantee rules out.
- Contradictions C-006 and C-007 record this, and they have been "owner reviewing" since 2026-09-23.

Why it snowballs: M6 adds grief, fear, wounds and combat thoughts, and M7's immigration threshold keys off hall spirit (65). Every one of those numbers gets tuned against whatever the mood formula is. Changing it after M7 means re-tuning both milestones.

Recommended resolution (an owner decision, about 10 lines of code): standing need thoughts go into their own bucket capped at `NEED_PRESSURE_CAP` (20); event negatives stay under `NEGATIVE_CAP` (35); and the floor applies `personalityBase` so that it can't take a dwarf whose needs are met below 20. The worst case then becomes 55 − 35 − 20 = 0 through neglect only, which is what `balance.md` § Mood describes.

### 2. Disturbed water never settles

Rule 2 moves one unit to a neighbour one level lower with probability `SPREAD_EQUALIZE_PERMILLE`. That move counts as movement (`step.ts:449`, returned as `moved`), so the tile's idle counter resets. Any body of water whose average depth isn't a whole number keeps swapping units forever and never leaves the active set (C-002).

This has already bitten once. D-092 measured about 6,000 permanently active tiles on a generated cavern lake, swapping between levels 3 and 4 across the 1–3 / 4–6 passability band. That forced a connectivity relabel on every fluid tick (about 140 ms each at the time). The fix was to never activate generated water. It still reactivates the moment the player:

- taps a cavern lake,
- builds a reservoir,
- floods a room, or
- uses M6's floodgates and drawbridges.

D-100 made relabeling much cheaper, but the active set and the steady `FluidsChanged` stream remain. No perf test covers a disturbed lake: the smoke runs a waterfall into a basin.

Recommendation (owner rule): an equalizing move shouldn't reset the idle counter, or it should happen only while the tile also received fluid this step. Also add a perf scenario: breach a generated cavern lake, run 5,000 ticks, and assert that the active set drains.

### 3. Acceptance tests vs spec arithmetic

In five milestones, seven acceptance rows turned out to contradict the spec's own rules. Every one is simple arithmetic that could have been checked on paper:

| Id | Test says | Rules say |
|---|---|---|
| C-002 | 7 units on 25 tiles settle | the equalize rule never settles |
| C-003 | a calf within 2 seasons (56 days) | cow gestation is 60 days |
| C-004 | a 3×3 dig in 2,000 ticks | a 7-hour sleep alone is 350 ticks; with meals and drinks the miner finishes at about 2,274 |
| C-005 | 12 digs in 1,500 ticks | the same need downtime |
| C-006 | mood floor 20 for any dwarf | `personalityBase` −6 gives 14 |
| C-007 | neglect makes dwarves miserable | see finding 1 |
| C-008 | skeleton at day 20 | 150% of 14 days is 21 |

M6 looks like it has the same problem. For `he_bleed` ("dead after ~1,000 ticks"): an average dwarf has maxBlood = 60 × 10 × (50 + 50)/100 = 600, and a serious cut bleeds 3 per health tick (every 5 ticks). Death comes at 20% blood, 480 lost, which is 160 health ticks or **800 ticks**. It reaches 1,000 only at Toughness 75. (The unconscious time of 600 ticks does match.)

C-004 and C-005 also point to something broader: `balance.md` § Time and pace doesn't budget for need downtime, which takes roughly a third of each day (7 hours of sleep, about 1.4 meals and 2.4 drinks). The year-one expectations are optimistic even on their own terms.

Recommendation: before T-M6-01, do one pass checking every M6 and M7 acceptance row against the constants it depends on (timings, blood, gestation, reputation sums, trade values). It takes about an hour on paper, and it saves each task from discovering the conflict, parking the test as `todo` and moving on.

## Medium

### 4. No evidence yet that a fortress can bootstrap itself

`year_one` is the only long-running integration scenario. It runs on a **32×32 flat-test map and never designates any digging**. The still needs a barrel and raw stone, the kitchen a table and raw stone, the hearth three stone blocks and a log. The Balanced embark carries no stone at all (it has 5 pine logs, two of which go on the carpenter's workshop). So the still, kitchen and hearth *cannot* be built in this script, whatever the pacing.

Both gate reports describe those results as "balance observations for T-M8-06" ("no still by day 3, no hearth by day 10, no kitchen by day 20"). That framing is wrong: the script can't succeed, so it measures nothing about balance. And because it only logs the checkpoints rather than asserting them, it would never fail.

The first real full-year run is T-M7-11, after combat, threats, trade and immigration have all been layered on top. If the core loop has a structural gap (a missing input path, a job that never gets claimed, a need loop that eats the workday), it will surface late and tangled up with everything else.

Recommendation: now, before M6, make `year_one` play the opening properly. Dig a shaft into rock, order blocks, barrels and a table, and ideally run on a generated map. Then **assert** the checkpoints that M4–M5 systems should meet, and keep only the M6+ rows as logged observations.

### 5. Dwarf need activities (`src/systems/dwarves/activities.ts`)

**(a) Social rarely succeeds.** The spec (`10` § Social, comfort, joy) says to go to the hearth hall or a meeting area, and "if another dwarf is there, both `Talked`". The code does something different:

- It picks one partner up front: a friend first, else the nearest dwarf anywhere on the map (lines 198–205).
- It walks to the social tile and waits up to `SOCIAL_WAIT_TICKS` for **that** dwarf to come within 2 tiles (line 234).
- Nothing tells the partner. Any other dwarf standing in the hall is ignored.

The only test (`test/unit/dwarves/activities.test.ts:80`) spawns both dwarves already adjacent on the meeting area.

In a real fortress this means a standing `lonely` thought for most dwarves and few `talked_with_*` positives. `balance.md` counts on "a chat (+3)" to reach the hall spirit of 65 that immigration needs, so this could quietly throttle M7 immigration.

**(b) Targets ignore reachability.** Beds, seats, halls, wells and water are chosen by straight-line distance (`distance`, `nearest`). When the walk comes back `unreachable`, the plan is cancelled (line 231). `tickDwarf` then reselects, `select` (`brain.ts:65`) ranks the same need first, and `start` picks the same nearest target again.

So a dwarf whose nearest free bed is walled off, or on a level they can't reach, loops on that need. Want-level needs are tried before work, so the loop also blocks the dwarf's work. Flat test maps never show this; real maps (cliffs, rivers, walled rooms, construction in progress) will.

Fix: filter candidates with `ctx.readers.pathing.reachable(from, tile, 'walker')`, which `dwarves/index.ts:220` already does. Accept any dwarf present for social. Add a short cooldown after an `unreachable` cancel.

### 6. Workshop tests bypass the simulation

About 10 test files call the workshop producer's completion hook directly, with a hand-built `Job` and a context cast through `as unknown as TickContext`. They include:

- `forge.test.ts`: "executes all 40 recipes"
- `alloys`, `melting`, `mechanic-jeweler`, `metal-fuel`, `first-recipes`, `remaining-recipes`
- the gate scenarios `ws_masterwork`, `it_value` and `it_wealth`

```ts
op.producer().onComplete?.({ id: n + 1, workerId: maker, target: { kind: 'building', ref: carpenter },
  inputs: [{ filter: {}, count: 1, reserved: [log], delivered: [log] }],
  data: { recipe: 'make_bed', orderIndex: -1, globalOrder: false } } as unknown as Job, ctx);
```

These tests check output arithmetic: material, count, quality, bar cost and consumed inputs. They don't check that a dwarf can **run** the recipe: that `inputFilter` matches real items, that inputs are reserved and hauled, that fuel is found, that the job is claimed and worked.

Only a handful of recipes go through order → claim → haul → craft: bed, maintained meals, stacked brewing, steel, ore smelting and fuel, and the magma-forge dagger. None of the jeweler, mechanic, clothier, leatherworks or bowyer recipes do, and only one forge recipe does.

This isn't gaming (the arithmetic tests are useful), but it means "M5 recipes work" is only half proven. M6 squads will depend on forge output.

Recommendation: a table-driven smoke that, for every active recipe, spawns exactly its inputs (and fuel) on a small map, adds a `once` order, and asserts `ItemCrafted` within a tick bound. That's about 170 recipes at a few hundred ticks each, and it would catch any recipe whose filter can never match.

### 7. Content ids hard-coded in the workshop operator

The workflow rule is that content ids appear in code only where the spec names a content-driven path. `operate.ts` special-cases content directly:

| Line | Hard-coded content |
|---|---|
| 88 | output items `thread` and `cloth` |
| 203 | fuel is literally `['coal_bar', 'charcoal_bar']` |
| 211 | `recipe.workshop === 'forge'` |
| 214–216 | `recipe.id === 'forge_anvil'` → `['iron', 'steel']` |
| 218, 223 | `make_mechanism_metal`, `melt_metal_item` |
| 230–242 | `fiber`, `wool_raw`, `flour`, and the brewable and thread-matching rules (D-126, D-127) |
| 329 | `'smelter'` |
| 379 | the forge and `make_mechanism_metal` again |

Each new constraint becomes another `if (recipe.id === …)`, and renaming a content row silently breaks behavior. `01-architecture/extension-guide.md` § Add a recipe lists only content files, and its line 5 says a recipe that needs any other file means "the architecture has a gap that should be fixed rather than worked around". That is now the case: a new fiber, fuel or restricted-metal recipe needs an edit to `operate.ts`.

The Opus-era answer to the same problem (D-011, D-012, D-040, D-063) was to extend the row schema through the exporter. Do the same here: add an input `materials` or `materialTag` field, a fuel tag, and an output `materialFrom: next_stage`.

## Low

### 8. Five announcements print raw keys

These registered keys have no row in `src/ui/strings.ts` or `strings.json`:

- `announce.mood_tier`
- `announce.sulk`
- `announce.sulk_break`
- `announce.thought`
- `announce.fish_pool_depleted`

The M5 gate committed a screenshot showing it: `reports/screenshots/farm-plot-and-orders.png` shows `announce.mood_tier x3` in the log. The test (`test/unit/ui/fortress.test.ts:278`) checks only the severity table. Add one test asserting that every `stringKey` passed to `register.announcement` resolves to text.

### 9. `tr_dig_room` is fully disabled

C-004 conflicts with one assertion, the 2,000-tick limit. But the whole scenario is `todo`. That also switches off "a miner digs a 3×3 room in granite" and the only live check of the ~30% stone-drop rate (elsewhere, `MINING_STONE_DROP_PERMILLE` is only checked as a constant value).

C-005 and C-008 handled the same situation better: they kept the valid assertions running with a functional bound. Split this scenario the same way. The same applies to `an_breed`, `mo_floor` and `mo_misery_needs`, which are entirely `todo` too.

### 10. Perf smoke measures pathing and fluids only

The reference fortress drives 20 dwarves with an external random-walk script (`walkRandomly`), bypassing their brains. There are no jobs, hauling, workshops or needs. So the M5 gate's "system 11: 0.006 ms, system 12: 0.000 ms, no material rise" is vacuous; the report even says so in a footnote.

Meanwhile, `WorkshopOperator.produce` (`operate.ts:280`) runs every tick. For each idle workshop it re-evaluates every order: `countAvailable` per input, a plant scan for brew and flour orders, and `findItems` for distinct inputs.

The saved real-fortress fixture is due at the M6 gate. Make sure it has a busy production chain, not only more creatures.

### 11. Housekeeping

- `ACTIVE_RECIPE_WORKSHOPS` / `recipeActive` (`src/systems/workshops/constants.ts`, the D-128 milestone seam) now passes every recipe row. It's dead code.
- `npm test` takes about 455 s and runs before every commit. Expect it to double by M8. Consider a fast pre-commit tier (unit tests plus this milestone's scenarios) and a full gate tier.
- The gate reports contain small factual errors. For example, the M4 report says "immigration is M5"; immigration is T-M7-04. Nobody seems to proofread them. Finding 8's screenshot went through the same way.
- Decision-log entries after the handoff (D-113 onward) are a fraction of the length of earlier ones and often omit what was measured or rejected. They're still usable, but traceability is weaker.

## Reward hacking

What was checked, and what turned up:

| Pattern | Found? |
|---|---|
| Skipped or `.only` tests | None. The 10 `todo`s are all documented contradictions or M6 deferrals. |
| Lint or type suppressions (`eslint-disable`, `@ts-ignore`, `@ts-expect-error`) | None in `src/`. |
| Test-only branches in game code | None. The e2e hook and `?start=flat-test` are gated on `import.meta.env.MODE === 'test'` (`src/app/game.ts:1036`); the real embark uses the generated map. |
| Constants or formulas changed to make a test pass | None. Contradictions were parked, as the workflow requires. |
| Assertions loosened in Codex-era commits | None hidden. Deletions are golden-hash refreshes and the documented C-005 bound (1,500 → 3,000 ticks, with the old assertion kept as `todo`). |
| Tautological asserts | None meaningful. The `>= 0` checks are index guards. |

The softer pattern, "optimize for green":

- **Easy-seam tests** (finding 6): recipe tests call `onComplete` directly instead of running the workshop.
- **Fixture-shaped tests** (finding 5a): the social test places both dwarves adjacent, which is the one arrangement the implementation handles.
- **Audits that log instead of assert** (finding 4): `year_one` can't fail and can't succeed, and its output was reported as a balance finding.
- **A rule added where the setup could change** (D-120): `dw_needs` stocks loose ale on a stockpile tile, although the spec's drink source is a barrel in a stockpile. Instead of setting up the barrel, a "drink loose alcohol as a last resort" rule was added to the game. It's defensible for the early game (embark ale sits in the wagon), but the test drove the rule.

None of this looks deliberate, and all of it is cheap to tighten. The common fix is to prefer running the real loop, with player commands and ticks, over calling internals. The M0–M3 scenarios already mostly do that.

## What's solid

- **Architecture and layering.** The boundaries are enforced by lint and hold; there are almost no `any` casts (18 in about 44k lines of `src`).
- **Determinism and persistence.** The save → load → continue hash equality is a tested contract. D-079 to D-084 closed every hole found (free list, pending queues, path state, lazy producers).
- **The decision log.** 152 decisions and 8 contradictions, each with the spec sections consulted and a pinning test. This is the single best thing in the repo: no silent spec drift.
- **Connectivity and pathing.** The incremental relabel (D-100) is exact and property-tested against a full rebuild and flood fill.
- **Coverage.** 95% of lines, with branch coverage at 85%.

## Suggested order before T-M6-01

1. Owner decisions on findings 1 (the mood formula) and 2 (the settle rule); implement both.
2. The arithmetic pass over the M6 and M7 acceptance rows (finding 3).
3. Fix the need-target reachability and social partner behavior (finding 5).
4. Make `year_one` a real, asserting bootstrap scenario (finding 4) and add the every-recipe smoke (finding 6). Both will catch problems M6 would otherwise inherit.
5. The rest (findings 7–11) can ride along with the M6 tasks that touch those files.
