# T-715 — The caravan leaves untraded while the trader hauls goods to the depot

**Closed:** 2026-11-25, in 9e6aa9b7,feecd67c,e5d6d90e,b8efa9cd,87de20a6.

**Source:** playtest 2026-11-24 (second) ([report](../../../reports/data/2026-11-24-playtest-2.md), finding 2) · **Size:** M · **Needs:** — · **Status:** open

## Why

The first caravan of the second playtest (world `deep-2346-1`, Warband at "Sedgefen") came on Summer 5. The player built a depot, the caravan reached it on Summer 6, and `[c]` then `[t]` opened the trade screen at once: Vali Hawktongue (the only dwarf near) was at the depot, and the right-hand column "Our goods at the depot" was empty (`reports/data/2026-11-24-playtest-2/32-trade.png`). The player closed the screen, picked the 150 logs in Stocks (`Space`, `[t] move 150`) and waited.

From then on the depot panel said "A dwarf with the trading labor is on the way to the depot. No Broker: appoint one in Units [u]." for four days. Nobody was on the way: every free dwarf, Vali too, was carrying logs to the depot one by one, 150 `haul_to_depot` jobs at priority 3 (`DEPOT_HAUL_PRIORITY`, 20 § Moving goods to the depot), while the `trade` job, made at the default priority (5), waited behind them (`35-jobs-trade.png`: "111 open", the list all "Haul to depot"). On Summer 10 the caravan left (`TradeMissed { traderId: 0 }`, `CaravanDeparted { boughtValue: 0, soldValue: 0 }`). Its alert, "The Hillfolk caravan is leaving without trading. »", is cut before its reason in the sidebar (`42-alerts-borin.png`, bottom line), and the reason it would give is the same "on the way" line. The caravan had 60 easy meals, 160 cabbage, 60 pig meat, 80 strawberry wine; the fortress starved from Autumn 13.

After it left, all 150 logs stayed at the depot (`atDepot`): Stocks said "Usable 0 of 150: 150 at the depot", and the next orders read "Chest · waiting for log (0)" and "Bucket · waiting for log (0)" until the player found `[r]` in the depot panel two weeks later (`41-depot-after-caravan.png`).

Reproduce: any fortress with a depot and 50 or more goods; when a caravan is at the depot, `MoveToDepot` the goods, `TradeOpen`, and run five days: the session never opens.

## What to do

Decisions:

- **The `trade` job is priority 2**, above `haul_to_depot` (3), so the dwarf it is for drops hauling and walks to the depot; 20 § The session says so (`TradeOpen` makes it at 2, and a reissued job keeps it). A waiting `trade` job also calls the nearest free trading dwarf off interruptible work, as a priority 1 health job does (11 § Assignment), *only* while the caravan is at the depot.
- **The trade screen opens with what is at the depot so far**, and new goods arriving while it is open show up in the right column (a line "12 more on the way" under the column while `haul_to_depot` jobs for this depot remain). The player does not have to close the screen to wait for the haulers.
- **The depot's waiting line tells the truth**: "{who} is on the way to the depot" only when a dwarf has claimed the `trade` job; otherwise "No one has taken the trade yet: N goods are still being carried to the depot." The `TradeMissed` alert uses that line and is not cut (its reason wraps, T-703's rule).
- **Goods left at the depot when a caravan departs go back to ordinary stock** (`RemoveFromDepot` for each, by 20 at `CaravanDeparted`), with a note "150 goods taken back from the depot." The player can mark them again for the next caravan. Not taken: keeping them marked, which blocks every order that needs them.

Spec: 20 § Moving goods to the depot, § The session, § Movement step 4; `ui-screens/panels.md` § Depot (the waiting lines); 24 § Announcements (`TradeMissed`).

## Done

- [x] Tests (`describe` with the task id): with 60 goods being hauled and one trading dwarf, the session opens within a day of `TradeOpen`; the depot line names the hauling while no one holds the job; goods still at the depot when the caravan departs are usable again and the note says how many.
- [x] The trade screen shows goods that arrive while it is open.
- [x] The `TradeMissed` line in a 36-column sidebar shows its whole reason.
- [x] World hashes of scenarios with caravans move (trades now happen); the commit says which.
