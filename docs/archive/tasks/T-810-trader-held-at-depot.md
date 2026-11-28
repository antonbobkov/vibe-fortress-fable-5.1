# T-810 — The trader waits at the depot while a session is open

**Closed:** 2026-11-28, in 82630b5c.

**Source:** T-800 (playtest 8, [report](../../../reports/data/2026-11-26-playtest-8.md), finding 6) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-800 built a hold: the `trade` job kept `working` (its producer's `canComplete` returning false) while the session was open, so the trader stood at the depot; a critical need took them away and back ("Bjarni Marblehammer, the Broker, left the depot to sleep; back after."), and `[x]` let the job complete. It was not adopted. The scripted fortresses (`three_years_economy.ts`'s `trade`, `year_one`) open a session and look again only a day or 600 ticks later, or leave it open for the whole visit when they find nothing to buy, so their trader stood idle at the depot. The twenty-seed sweep's deaths rose past the bound: 135.25 and 146 pooled against master's about 115 (runs 45888132672 and 45909859678; the figures are in T-800's work file). T-800 kept the session open instead, which is what the playtest's reopened trip needed.

## What to do

- First make the scripts play the screen as a player does: trade at the tick the session opens (the screen pauses the game), and `TradeCancel` ("done trading") when the visit has nothing left they want. `year_one` needs the same.
- Measure the scripts' change alone on the sweep, then build the hold again on top (T-800's branch `t798-caravan-glowcap`, commit `aecacfdd`, has it) and adopt it only if deaths stay within about 8 of that.

Decided in the work (ambiguity protocol):

- **How the scripts play the screen.** `stepTrading` (`three_years_economy.ts`) replaces the plain step in `playThreeYears` and `playDefenceYear`: while a trade request waits (the depot's `trade` job, no session) it steps one tick at a time, and calls `trade` on the tick the session opens. `trade` then offers, and sends `TradeCancel` in every case: after a trade made, when nothing at the depot has value to the caravan, when nothing wanted is affordable, and after a refused or failed offer. A visit's trade closed with nothing to do is asked for again only once the depot's goods are worth more than they were at the close (`tradeClosed`). A failed offer asks again at the next look. `year_one` does the same (one tick at a time while its request waits, close when nothing affordable, ask again when the cargo is worth more).
- **The hold is not adopted.** It was rebuilt as T-800 had it (`7cb68eb3`, `aecacfdd`: the job held `working` while the session is open, `[x]` completing it through `doneJob`, a critical need taking the trader away and back) and measured on top of the scripts' change. Twenty-seed sweep, pooled living / dwarf deaths, bounds ≥ 1046.63 / ≤ 132.5:
  - the scripts' change alone (run 46072469596, `e96bcab1`): 1107 / 117, pass;
  - with the hold (run 46072643182, `f0f9effe`): 1106 / 124, pass.
  - Paired difference: +7 deaths, −1 living, again just under the bound of about 8. `defence_seeds` with the hold (run 46072646347) passed: 7.25 raids turned back, 6.13 soldier kills.
  - Not adopted, pending T-814: master's deaths already drift upward from stacked changes near the bound (T-814 traces 108.5 → 121.75). The hold can be measured again once master is back near 108.5.
- **What is kept:** the scripts' change. The game's rules are master's: the session stays open, and the trader goes back to work when the job completes. The final code is `e96bcab1`'s, so run 46072469596 is its measurement.
- `three_years_main` fails on `alloy_steel completed through normal jobs` with the hold (46072704388), with the scripts' change alone (46099449775) and on `master` (46099451914). The failure is older than this task. Follow-up: `T-817-three-years-main-alloy-steel.md`.

## Done

- [x] The scripts close a session they are done with; the sweep measured.
- [x] The trader held at the depot while a session is open; tests; measured. (Measured and not adopted, as above.)
- [x] 20 § The session, `panels.md` § Depot updated. With no hold they stay as they are; `testing-strategy.md` now says how the scripts trade.
