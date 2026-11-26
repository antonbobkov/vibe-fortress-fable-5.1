# T-NEW — A tomb keeps its own coffins ready: find why the measured rule cost deaths, then adopt it

**Source:** T-789 ([work file](T-789-tomb-keeps-coffins.md)); playtest 7 ([report](../../reports/data/2026-11-26-playtest-7.md), finding 5) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-789 built a tomb setting, "Coffins ready" (default 2), with which 14 places coffins from stock in a tomb, farthest from its way in and never sealing it, and 12 keeps one standing coffin order "for Tomb #1" while stock is short. It works in tests (a death is buried with no player action; a full setting stops before it seals the tomb). Measured on `ef4daff2`, the twenty-seed sweep pooled living 1147.75 and deaths 121.5, 11.5 over master's ~110 (by shift 127, 104, 102, 153; the p4 seeds at shift 150 lost 30 and 34). The bounds held (deaths ≤ 132.5) and `defence_seeds` passed, but the deaths were over what T-789 allowed, so the rule was taken out. The code is in `ef4daff2` (`src/systems/buildings/tombs.ts`, `src/systems/workshops/tomb-orders.ts`, the tomb inspector in `src/ui/panels/zones.ts`, `test/unit/buildings/t789-tomb-coffins.test.ts`).

A player still buries every death by hand: order coffins, place each one, make a new tomb.

## What to do

Decisions taken here:

- First trace the two p4 seeds at shift 150 on `ef4daff2` against master: whether the deaths come from the mason's time (coffin orders ahead of the military's or the defence's work), from the stone the coffins take, from haulers carrying coffins during a raid, or are noise of one sweep (a second sweep of `ef4daff2` with other shifts answers that).
- Then adopt the rule with the fix the trace points at (for example the standing order at a lower priority than the player's orders, or no placement while the alert is above Calm), and measure again: deaths within about 8 of master and `defence_seeds` passing.
- The three-year script's `keepTheDead` keeps its own upkeep; with the rule in, it may rely on the tomb's setting instead.

## Done

- [ ] The trace's finding, with figures.
- [ ] The rule adopted (from `ef4daff2`) with its fix; its tests; 14 § Burial, 12 § Work orders, `panels.md` § Zones and § Orders.
- [ ] The sweep and `defence_seeds` figures in the commit.
