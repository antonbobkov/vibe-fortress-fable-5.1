# T-196 — Wild predators kill civilians outside the walls, and livestock starve on pasture

**Source:** T-151 (Gemini, 2026-10-10) and the T-188 re-measure ([`2026-10-09-t188-reproduction.md`](../../reports/audits/2026-10-09-t188-reproduction.md)) · **Size:** M · **Needs:** — · **Status:** open

**Who:** a measurement and a decision first, by a strong model. Not Gemini.

## Why

Wild animals have spawned only since T-192 (2026-10-09). Nothing in the game's balance was ever measured with them present. Two runs since then:

- **`defence_year`, temperate forest, peril 2:** five civilians bled to death to wolves and a bear between days 41 and 55, while working outside under a `calm` alert. A cow and two sheep starved on day 56.
- **The rewritten economy fortress at peril 0:** seven dwarves died to badgers and boars.

The full-year browser playthrough met 8 wolves and 4 lynx in its year and lost nobody, so it is not every map. All of these are single runs, reported by other tasks in passing.

## Questions to answer, by measurement

1. **How dangerous is the wild, by biome and savagery?** Over a year on several seeds: arrivals by species, attacks on dwarves, deaths, and what the dwarves were doing. Compare with what [`08-animals-and-domestication.md`](../02-systems/08-animals-and-domestication.md) (wild behavior, aggression) and [`balance.md`](../03-content/balance.md) intend. `balance.md` has no figure for deaths to wildlife; say what it should be for a peril-0 map without the `serene` trait, and with it.
2. **Do the rules work?** Does a predator attack only when the spec says (hunger, proximity, provocation)? Do civilians see it coming and flee (10, 16)? Does the alert rise? Does a hunter or the squad respond? A badger killing a dwarf suggests either very weak civilians or a rule that makes small animals fight to the death.
3. **Why did the livestock starve?** Wild grazers eating the pasture (allowed by 08: a zone is not a fence), too small a pasture in the fixture, or a fault.

## What to do

Write a dated report with the measurements, classify each finding as GAME, BALANCE or FIXTURE, and file a row for each one worth doing, with a proposed resolution. Change no code in this task.

## Done

- **Capture pass (2026-10-10):** measurements recorded across experiments A–E on three seeds in [`2026-10-10-wildlife-capture.md`](../../reports/data/2026-10-10-wildlife-capture.md) and [`2026-10-10-wildlife-capture.json`](../../reports/data/2026-10-10-wildlife-capture.json).
- The report exists; each finding carries its evidence and its class.
- The follow-up rows are in the backlog.
