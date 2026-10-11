# T-218 — A wolf takes no pastured grazer, so a pasture costs nothing against wolves

Closed by `T-218: measure pack prey on exposed and enclosed pastures`.

## Progress — 2026-10-11 (codex-a)

The accepted pack rule is implemented: living same-arrival members that perceive the
quarry contribute to its size limit, capped at three, and choosing, sharing and holding
an animal quarry recheck that limit. Fourteen regressions pin the decision; seven failed
on the previous code. The six static checks pass, `npm test` passes 2,321 tests in 259
files, and the whole `npm run test:e2e` passes 25 tests. Its full-year end state is
unchanged: nine survivors, hash `9321580b8c3227e1`; the survivor floor remains nine.
No golden changed. The code/spec/test commit is `57cace7` (`T-218: packs judge animal prey against
nearby living members`).

The re-measure is complete: 24 revision-3 forest/taiga year cases, both ignore/react
modes, exposed pasture versus a prebuilt enclosure, with one supplied male sheep,
goat and cow on the existing pasture. Wolves kill grazers in forest seed 2, whose
setup has already run to day 7 and has wolves inside at enclosure placement. The
other five enclosed seeds lose no grazer to wolves. A short control with its enclosure
present before the wolves loses none and admits none. The dated report and frozen
probe sources/data are in `reports/audits/2026-10-11-pack-prey-size.md` and
`reports/data/2026-10-11-t218-*`; `balance.md` and `balance-status.md` carry the losses
and fixture qualifications. No long fixture was changed, and the cap remains three.


**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../../reports/audits/2026-10-11-hungry-predators.md) · **Size:** S (a decision, then a rules change with a test and a re-measure) · **Needs:** — · **Status:** in progress (codex-a); decided 2026-10-11, see Decision

## Why

T-212 made a hungry predator prefer animal prey to dwarves. Its decision expected that "livestock, not haulers" would be the first thing a wolf pack costs a fortress, and that "a pasture near the forest edge then needs a fence, a door or a guard". 08's definition of prey did not change: a species with `size < own size × 0.8` that is not a carnivore. For a wolf (size 35) the limit is 28, so its prey is dogs (20), cats (6), chickens (4), rabbits (8) and badgers (15). Sheep (40), goats (35), pigs (55), cows (90), mules (90), deer (40) and every other grazer are not prey. A hungry wolf with a sheep and a dwarf in sight hunts the dwarf.

## What the spec says

`08` § Wild behavior, the quarry: prey is "an animal, wild or tame, of a species with `size < own size × 0.8` that is not a carnivore"; a pack shares one quarry.

## What to do

Decide whether pastured grazers should be prey for a wolf pack, for example by judging the size limit against the pack rather than the single animal, or by lifting the limit to a dwarf's size (a predator that hunts dwarves takes anything no larger). Then write the rule in 08, pin it with a test that names this task (a hungry wolf with a sheep and a dwarf in perception takes the sheep), and re-measure the year of the T-212 report (forest and taiga, peril 0, a fortress with grazers on a pasture, with and without a door).

## Done

- The decision is in 08 § Wild behavior, with a test.
- `balance.md` § Wild animals states the measured livestock and dwarf losses.

## Decision (2026-10-11, local orchestrator, under the owner's standing instruction to use judgement; the owner was told and may overrule)

**A pack judges its prey against the pack.** A lone predator keeps 08's rule: prey is smaller than 0.8 × its own size. For a pack (one species, one arrival), the limit is 0.8 × the predator's size × the number of living pack members within perception of the quarry, counted up to 3. Three wolves can then take a sheep, a goat or a pig and cannot take a cow; a lone wolf still takes only small animals.

- The pack size is counted when the quarry is chosen and again each time the pack re-targets; a pack that shrinks below what its quarry needs lets it go.
- This makes T-212's advice true: a pasture near the forest edge costs sheep unless it is behind a door, fenced by walls, or guarded.
- A dwarf is not judged by this size rule; T-212's order (animal prey first, a dwarf only when no animal prey is in perception) stands.

Then the test and the re-measure the task names. If the re-measure shows livestock wiped out everywhere, report the figure and propose the cap (2 instead of 3) instead of changing it silently.
