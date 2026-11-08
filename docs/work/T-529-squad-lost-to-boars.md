# T-529 — A peril-0 squad sent after boars loses eleven dwarves on one map

**Source:** [T-456](../archive/tasks/T-456-three-years-main-on-relief.md) (its journal of seed `three-years` on relief 1, [the probe](../../reports/data/2026-11-07-t456-relief.probe.ts.txt)) · **Size:** M · **Needs:** — · **Status:** open

## Why

On master `303a109a`, the three-year fixture on seed `three-years`, peril 0, relief 1, loses 11 dwarves in three years, every one `bled_out` after a boar's hit on the surface (days 70 to 334), most of them on `duty`. The script sends an armed squad (three weapons or more) after a dangerous wild animal near the gate or a surface dwarf, and on this map it meets the boars again and again. Its two miners die first (days 70 and 71). The seven peril-0 seeds of the pooled master sweep lose 0 to 4. On relief 0 the same seed loses none.

With both miners dead, the first tile of the drift to the deep shaft (a dig job at z 23, beside the upper shaft) stays `open`, untaken, from day 120 to about day 340, though other dwarves have mining and could reach it.

## What to do

Journal the fights: the squad's size, weapons and armour, the boars' group size, the wounds and whether a wounded soldier reaches a bed and a bandage before bleeding out. Decide whether the squad should win these fights (a balance fault in 16 or 08) or the script should hunt fewer of them (it is a player's choice), and fix the one at fault. Find why the open drift tile is not taken for 220 days.

## Done

- The cause is named, and fixed or written into the spec as intended.
- Seed `three-years` on relief 1 loses no more dwarves to boars than the sweep's peril-0 seeds, or a dated report says why not.
