# T-676 — Dwarves haul the wagon's goods to stockpiles

**Closed:** 2026-11-21, in e59463e2,8c9680bd,27a2d468.

**Source:** the owner's feedback of 2026-11-21 · **Size:** M · **Needs:** — · **Status:** open

## Why

The owner saw dwarves leave the wagon's goods in the wagon though stockpiles stood ready.

## What to do

Reproduce in a new embark with a food and a goods stockpile placed: do haulers take items out of the wagon? If not, find why (the wagon's contents not offered to the haul search, a forbid flag, a priority) and fix it in 13/11 so goods leave the wagon for a stockpile that accepts them, as the spec says (check 13 and the embark docs). If they do haul and the owner's case is a setting (no matching stockpile, the wagon kept as storage), make the UI say why.

## Done

- [x] A scenario: an embark with stockpiles empties the wagon into them within the first days (`test/scenarios/t676-wagon-unloaded.test.ts`: Balanced embark, a Food and an Everything stockpile, the wagon empty within three days; it fails on master with the meals, turnips, meat, bars, cloth and bolts still in the wagon). Reproduced on Balanced and Testing: haulers took the wagon's furniture, logs, tools and barrels, but every food (its type wants a barrel) and every bin good (bars, cloth, thread, leather, bolts) went to `noHome`, because 13's slot search refused an item whose container class had no container with room and none wanted, and a Food stockpile from its preset wants no barrels. Not a setting the player could see: fixed in 13 (such goods lie loose; drink, goods inside an item container and hospital supplies still refuse), and a hospital now takes its supplies from the stockpiles (the wagon's cloth and thread used to reach the hospital chest only because no stockpile took them).
- [x] The sweep's verdict: `44966730312` on `8c9680bd`: Pooled 20 | 7 | 0 | 1116.25 | 112.5 | 0.5 | 0, **Verdict: pass**, all 80 seeds green (master `44851035279`: 1102.5 living, 113.5 deaths, 0 extinct). Deaths fell by one; peril-4 living rose from 904 to 1001 over the four shifts. Two peril-4 timelines (`p4-1` at shift 0, `p4-5` at shift 100) went extinct to raids (bled out and killed on raid days, no need deaths) where master's lived through the same number of raids: the timelines diverge from day 1, and peril-4 raid outcomes are where divergence shows.
- Follow-ups: [the wagon says why its goods stay](../../work/T-681-wagon-says-why.md), [an item judged full is not looked at again when a stack it could join arrives](../../work/T-682-nohome-stack-join.md).
