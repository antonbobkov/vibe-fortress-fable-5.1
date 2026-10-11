# T-218 — A wolf takes no pastured grazer, so a pasture costs nothing against wolves

**Source:** T-212 and [`2026-10-11-hungry-predators.md`](../../reports/audits/2026-10-11-hungry-predators.md) · **Size:** S (a decision, then a rules change with a test and a re-measure) · **Needs:** — · **Status:** open (needs a decision)

## Why

T-212 made a hungry predator prefer animal prey to dwarves. Its decision expected that "livestock, not haulers" would be the first thing a wolf pack costs a fortress, and that "a pasture near the forest edge then needs a fence, a door or a guard". 08's definition of prey did not change: a species with `size < own size × 0.8` that is not a carnivore. For a wolf (size 35) the limit is 28, so its prey is dogs (20), cats (6), chickens (4), rabbits (8) and badgers (15). Sheep (40), goats (35), pigs (55), cows (90), mules (90), deer (40) and every other grazer are not prey. A hungry wolf with a sheep and a dwarf in sight hunts the dwarf.

## What the spec says

`08` § Wild behavior, the quarry: prey is "an animal, wild or tame, of a species with `size < own size × 0.8` that is not a carnivore"; a pack shares one quarry.

## What to do

Decide whether pastured grazers should be prey for a wolf pack, for example by judging the size limit against the pack rather than the single animal, or by lifting the limit to a dwarf's size (a predator that hunts dwarves takes anything no larger). Then write the rule in 08, pin it with a test that names this task (a hungry wolf with a sheep and a dwarf in perception takes the sheep), and re-measure the year of the T-212 report (forest and taiga, peril 0, a fortress with grazers on a pasture, with and without a door).

## Done

- The decision is in 08 § Wild behavior, with a test.
- `balance.md` § Wild animals states the measured livestock and dwarf losses.
