# T-253 — Re-measure the wild-animal figures after the caught-civilian rule changed

**Source:** T-219 (the closing commit measured only the scenario tests, not the chain probe or the year) · **Size:** M · **Needs:** — · **Status:** open

## Why

A fleeing civilian is caught, and turns to fight, only when the attacker that hit it is a wild animal hunting it (10 § Behavior selection). T-212's figures in `balance.md` § Wild animals and `balance-status.md` (the chain probe with one fed animal, the hungry wolf, the year with wolves only, the reference fortress) were measured when every attacker with the dwarf's speed or more caught a fleeing civilian, so a defending boar, badger or wolf and a raider now behave as they did before T-212 against a fleeing civilian.

## What the spec says

`balance.md` § Wild animals; `balance-status.md` (the row for wild animals); `10` § Behavior selection (the caught civilian); `08` § Wild behavior (defending and hunting attacks).

## What to do

1. Re-run the T-196 chain probe (all modes, three species, ten seeds) and the year probes of [`2026-10-11-hungry-predators.md`](../../reports/audits/2026-10-11-hungry-predators.md), and the 2,200 ticks of the reference fortress: dwarves dead to a bandit, strikes by caught civilians.
2. Write a dated report and update `balance.md` § Wild animals and `balance-status.md` with the new figures.
3. If the wolf figures no longer hold, say what holds instead, or file the cause.

## Done

- A dated report holds the figures, and `balance.md` and `balance-status.md` carry them.
