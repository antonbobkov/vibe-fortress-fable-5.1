# T-635 — A player's years two and three

**Source:** the owner's playtest of 2026-11-17 and the T-605/T-618 audits ([first hour](../../reports/audits/2026-11-18-t605-first-hour-ux.md), [first year](../../reports/audits/2026-11-18-t618-first-year-ux.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-605 and T-618 audited a new player's first hour and first year through the real UI; their follow-ups are fixed. Nobody has yet played the mid-game a player reaches in years two and three: raids and sieges, the caverns and the Deep, later caravans and trade requests, nobles and the Thane's whims at scale, the Making Do content, health over time, mood at 30+ dwarves, panels with many items and units, saving and loading a big fortress, and performance at that size.

## What to do

1. Put a real fortress at year 2 in front of the real UI (Playwright against the Vite dev server, keys and mouse as the e2e tests drive them): saves of the three-year economy fixture at peril 2 and peril 4, and the 80-dwarf reference fortress for scale.
2. Cover the areas above; at each step note what is confusing, missing, misleading, inconsistent or slow, or needs knowledge the UI does not give, against the UI spec documents. Note frame rate and input lag.
3. Write `reports/audits/2026-11-19-t635-midgame-ux.md`: numbered findings with where, what a player sees, why it confuses, severity (blocks, confuses, polish), a suggested fix and a screenshot reference.
4. Fix the small clear ones with tests; file the rest as at most six `T-NEW` work files, most severe first.

Decisions: the Balanced loadout's spear and food (D-252) are open owner decisions and are not changed here.

## Done

The report; the small fixes with their tests and spec edits; the work files; the six static checks and `ci.yml` green.
