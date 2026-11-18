# T-603 — The three-year script builds a squad that can fight an ambush

**Closed:** 2026-11-18, in 6da1fba8.

**Source:** [T-601's report](../../../reports/data/2026-11-18-t601-script-fights-ambushes.md) (the script fights a sprung ambush when its squad clears the arena's bars; no fortress of the sweep reached one) · **Size:** L · **Needs:** — · **Status:** open

## Why

T-601 gave the three-year script the owner's answer to a sprung ambush: five soldiers in steel at Proficient with two Proficient marksdwarves and cloth for the medics fight one of up to 10, the five alone one of up to 6 ([arena](../../../reports/audits/2026-11-18-t600-ambush-arena.md)). The script never fields that squad, so the sweep still measures a fortress that hides from every peril-4 ambush. Its squad is three (`SQUAD_SIZE`), armed in iron from the forge's `maintain` orders, never trains (it works its civilian labors and learns only in fights), and it sells the wagon's crossbow; its steel, from year 3, goes to crafts. A player at peril 4 who means to fight would raise that squad over the three years.

It was not done in T-601 because it is not cheap: every part takes dwarves from the economy (soldiers who train do no civilian work; `defence_year` takes the miners' and woodcutter's labors from its squad, T-567), steel for five kits is some 40 bars of a stock that reaches year 3 thin, and each moves the sweep's living and deaths.

## What to do

Decide, and measure on the sweep, a path a sensible player takes at peril 4 (perils 0 and 2 keep their squad of three):

- a squad of five from the second year, with a barracks where it trains in peace (16 § Training), as `defence_year`'s does, and what it gives up;
- a steel kit (weapon, shield, helm, mail shirt, greaves) for the five once steel is made, ahead of the steel crafts;
- two marksdwarves with crossbows and bolts, and an archery range;
- the fight's aftermath in a real fortress, which the arena did not have: the gate's doors lock behind a squad that went out (`lock_on_alert`), and the medics reach the wounded outside only once the alert is down, `ALL_CLEAR_TICKS` after the ambush breaks. Probe a fought ambush on a seed that reaches a bar before trusting the arena's costs.

## Done

The sweep's verdict (`suite=sweep`) with its squad lines: how many peril-4 fortresses reach a bar and when, how many ambushes they fought and what it cost against the 0.9 dwarves an ambush kills while the fortress hides (T-593), and what the economy gave up for it.
