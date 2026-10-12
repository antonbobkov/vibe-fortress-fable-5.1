# T-213 — Two rules of 08 for attacking animals that the code does not do

Closed by `T-213: predators retain lost targets briefly and eat their kills`.

**Source:** T-196 and [`2026-10-10-wild-animals-and-civilians.md`](../../../reports/audits/2026-10-10-wild-animals-and-civilians.md) § Not established · **Size:** S · **Needs:** — · **Status:** open

## Why

Reading 08 against `src/systems/animals/brain.ts` for T-196 found two rules with no code:

1. **The 50-tick perception grace.** 08: the attack ends when the target "is out of perception for 50 ticks". The brain ends it at once when the target is beyond the species' perception (`thinkWild`, `attack`), and 16 drops any target beyond `PERCEPTION_RADIUS` at once.
2. **Eating the kill.** 08: predators "stop hunting after a kill (they eat the corpse over `EAT_CORPSE_TICKS`, which consumes the corpse item)". `EAT_CORPSE_TICKS` is defined and never used; nothing eats a corpse. Since T-196 the kill itself ends the hunger.

## Reproduction

Read: `grep -rn EAT_CORPSE_TICKS src` finds only the constant; the `attack` case of `thinkWild` has no timer.

## What the spec says

08 § Wild behavior, `hunt` and `attack`.

## What to do

Either implement both (a saved out-of-perception start tick; an `eat` step that walks to the corpse, waits `EAT_CORPSE_TICKS` and destroys the corpse item, and makes a dead dwarf's corpse unrecoverable for burial, which 17 and 15 must then allow for), or remove them from 08 if they are not wanted. Measure nothing; this is a rules task.

## Done

- 08 and the code agree on both rules, with tests that name T-213.
