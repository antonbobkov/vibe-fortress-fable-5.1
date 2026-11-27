# T-810 — The trader waits at the depot while a session is open

**Source:** T-800 (playtest 8, [report](../../reports/data/2026-11-26-playtest-8.md), finding 6) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-800 built a hold: the `trade` job kept `working` (its producer's `canComplete` returning false) while the session was open, so the trader stood at the depot; a critical need took them away and back ("Bjarni Marblehammer, the Broker, left the depot to sleep; back after."), and `[x]` let the job complete. It was not adopted. The scripted fortresses (`three_years_economy.ts`'s `trade`, `year_one`) open a session and look again only a day or 600 ticks later, or leave it open for the whole visit when they find nothing to buy, so their trader stood idle at the depot. The twenty-seed sweep's deaths rose past the bound: 135.25 and 146 pooled against master's about 115 (runs 45888132672 and 45909859678; the figures are in T-800's work file). T-800 kept the session open instead, which is what the playtest's reopened trip needed.

## What to do

- First make the scripts play the screen as a player does: trade at the tick the session opens (the screen pauses the game), and `TradeCancel` ("done trading") when the visit has nothing left they want. `year_one` needs the same.
- Measure the scripts' change alone on the sweep, then build the hold again on top (T-800's branch `t798-caravan-glowcap`, commit `aecacfdd`, has it) and adopt it only if deaths stay within about 8 of that.

## Done

- [ ] The scripts close a session they are done with; the sweep measured.
- [ ] The trader held at the depot while a session is open; tests; measured.
- [ ] 20 § The session, `panels.md` § Depot updated.
