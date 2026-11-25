# T-750 — A raided fortress is told it is "not yet wealthy enough", with no figure

**Source:** playtest 2026-11-25 (peril 4) ([report](../../reports/data/2026-11-25-playtest-4.md), finding 6) · **Size:** S · **Needs:** — · **Status:** open

## Why

By Spring 21, Year 3, the peril-4 fortress `playtest-1125-p4` had fallen from 11 dwarves to 4, one of them a child, with another raid of 11 coming (`20-d244-units.png`). The Population panel read "Eligible: no · raid underway" and "Last skip: wealth" (`21-d244-population.png`). The skips of Summer and Autumn of Year 2 had said "the hall is not yet wealthy enough". 21 asks `wealth ≥ WEALTH_PER_WAVE × wavesSoFar` = 2,000 × 3 = 6,000 ☼ for the fourth wave. Stocks read about 4,100 ☼, because raids had looted most of what the fortress had made. Nothing told the player that figure, how far off it was, or that the loot leaving the map was what kept help away. A fortress near collapse is where a player most wants to know when help comes and what would bring it.

## What to do

Decisions:

- **The wealth skip names the bar**: "No migrants this season: the hall is not yet wealthy enough (4,100 of 6,000 ☼)." (`announce.immigration_skipped.reason.wealth`, with `{wealth}` and `{need}`.)
- **The Population panel shows the bar while it holds the fortress back**: a line "Next wave asks 6,000 ☼ (now 4,100 ☼)" under the eligibility line, whenever wealth is below `WEALTH_PER_WAVE × wavesSoFar`. "Last skip: wealth" becomes "Last skip: wealth (4,100 of 6,000 ☼)", with the figures as they were at the skip.
- The other skip reasons are unchanged. The spirit reason already names the tier it needs.

Spec: 21 § Player-facing behavior (the skip line), `ui-screens/panels.md` § Population, `03-content/ui-keymap-and-screens.md` (strings).

## Done

- [ ] Tests (`describe` with the task id): a fortress after 3 waves with 4,100 ☼ of wealth has its wealth skip line name "4,100 of 6,000 ☼", and the Population panel shows the bar line and the last skip with figures. With 7,000 ☼ the bar line is gone. A save and load keep the last skip's figures (or show it without figures for an older save).
- [ ] UI only, unless the skip's figures must be saved with 21's state; if they are, say so in the commit and run `test/golden/world-hashes.test.ts`. No sweep.
