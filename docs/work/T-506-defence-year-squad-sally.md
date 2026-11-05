# T-506 — `defence_year`'s squad meets a raid without opening the halls to it

**Source:** T-504 ([report](../../reports/audits/2026-11-05-t504-raid-morale.md), § `defence_year` and a sally) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-504 asked that the scenario's squad fight a raid as well as trap it ("the script sallies its squad to the corridor when a raid arrives"). T-504 tried the plainest sally: while a raid that has not broken is on the map, the script opened the north door (the corridor's end) to an armed squad standing on the gate stair behind it. The raids were still turned back on 8 of 8 seeds, but on three seeds the raid came through the door and down the gate stair into the halls: 16 dwarves killed on day 134 of `defence-year-2`, 11 on `-5` (days 127 and 178) and 5 on `-3` (day 121), most of them civilians sheltering under the hearth alert. Soldiers on duty go after any hostile they can see, so the doorway was left open behind them, and the gate stair leads below. The north door is the fortress's way in, not only the corridor's end. T-504 withdrew the sally; the script holds the gate stair behind the locked door as before.

## What to do

1. Give the script a sally that cannot open the halls: for example, the squad goes out through the north door and the door is locked behind it (`lock_on_alert` is set back once the squad is in the corridor), or it holds the corridor from behind the fortifications with marksdwarves, or it sallies only on a raid that is already wavering (18 § Morale) and comes back in before the door is locked.
2. Measure it on `defence_year_seeds` (on GitHub): the set rule (at least 5 of 8 repelled or wiped) and the dwarves killed by raiders on each seed, against T-504's rows without a sally.

## Done

- `defence_year` shows a fought defence on most seeds without more dwarves lost to the raid than T-504's rows, or a report that says why it cannot.
