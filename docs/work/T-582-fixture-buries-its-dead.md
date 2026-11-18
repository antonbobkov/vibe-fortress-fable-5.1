# T-582 — The three-year fixture buries its dead

**Source:** [T-581's data](../../reports/data/2026-11-17-t581-defence-population.md) · **Size:** M · **Needs:** — · **Status:** open

The three-year fixture's script (`test/scenarios/three_years_fortress.ts`, `three_years_economy.ts`), and with it `defence_year`, never makes a coffin or a memorial slab. A dead dwarf's body lies where it fell to the end of the run, and every adult holds the standing thought `unburied_dead` (−4) from three days after the first death (15 § Grief, 14 § Burial). On `defence-year` at cadence 20 after T-578 one death before day 84 kept the hall spirit at 50 to 54 at the next two seasonal evaluations, under the 55 that immigration needs (21), and no wave came from day 57 to day 169. Over `defence_seeds`' 64 timelines after T-578, the rows with no dwarf death ended with 37.7 living and 0.06 spirit skips a row, those with three deaths or more with 24.4 and 1.22 (a death also costs its dwarf directly, so the gap is not all the thought's).

## Decided

- As a player does, the script keeps a coffin ahead of the dead: once a dwarf has died and no free coffin stands, it orders one at the mason's (`make_coffin_stone`) or the carpenter's (`make_coffin_wood`), places it in a tomb room or a quiet dug-out tile off the halls, and lets 14's `bury` job carry the body. A body with nothing left to bury (rotted, a skeleton counting as rotted, or lost) is answered with a named memorial slab (`make_memorial_slab` with `memorialDwarfId`, 14 § Burial).
- This changes the fixture of the sweep and of `three_years_main` too, so it is judged by the sweep's verdict and `defence_seeds`, with the instrument run as for any change to the three-year script.

## Done

The fixture buries its dead; the sweep's verdict and `defence_seeds` pass, and their before and after rows (living, waves, deaths) are in the commit.

## Also

T-581 saw the defence year still holding its first 3 beds on day 119 with 28 to 40 straw in stock (before T-578, 3 up to day 98). Check whether the fixture's bed orders (pallets, T-551/T-572) are filled once the squad is armed; fix in the script if not.

Needs T-580 because both change the three-year script; start from master once T-576 and T-580 have merged.
