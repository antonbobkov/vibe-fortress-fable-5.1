# T-461 — Cave crawlers kill a whole fortress under a calm alert

**Closed:** 2026-11-01, in ddba23c.

**Source:** T-457 ([measurement](../../../reports/audits/2026-11-01-crowding.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

In `three-years-p4-2`, 18 cave crawlers are indoors from before day 230. On days 235 to 239 they kill 43 dwarves at the hall's level, which ends the fortress. The alert stays `calm` the whole time, and the five soldiers die with the rest. The three-year script raises the hearth alert for raids, thieves and animals near the gate, not for hostiles already inside. Nothing yet says whether a player would have been told in time.

## Decisions

1. **Journal first.** Where the crawlers came in, how long they stayed before they attacked, and what the player was told.
2. **The script answers hostiles indoors** as a player would, with the alert and the squad, if the journal shows the game gave the warning.
3. If the game gave no warning, that is the fault to fix: a report on what it should say, in 18 and 24, before any change.

## Done

- **Report** with the journal.
- `three-years-p4-2` is re-run alone; its row and how it ends are reported.
- The six static checks, `npm test`, e2e, and the instrument by the T-308 rule pass.
