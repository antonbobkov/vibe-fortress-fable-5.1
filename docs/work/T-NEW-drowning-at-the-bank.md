# T-NEW — Dwarves drown at the bank on maps with relief

**Source:** T-448, [the sweep on relief 1](../../reports/audits/2026-10-30-instrument-relief.md) · **Size:** M · **Needs:** — · **Status:** open (diagnosis first; comes first of T-448's rows)

## Why

Run on relief 1, the twenty-seed file has 39 drownings, 33 of them in `three-years-p0-2`, against none on level maps. A journal of p0-2 has them bunched on days 276 to 299, all on floor or ramp tiles at (13–16, 29–32, 31), most of the victims on the thirst errand. Every generated map has relief since T-436, so players can meet this.

## What to do

Journal that bank: the water level on the tiles over time, the tile the drink search chose to stand on (10 § Drink search), and how the victims walked there. Find out whether the stand tile or the path lies in water of `FLUID_DEEP_LEVEL`, and why the bank is deep on relief. A fault gets a failing test and a fix.

## Done

- The cause is in a dated report. A fix, if it is a fault, passes the gates, and p0-2's drownings at relief 1 are reported.
