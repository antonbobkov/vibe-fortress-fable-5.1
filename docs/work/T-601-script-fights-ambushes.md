# T-601 — The three-year script fights a sprung ambush with a strong squad

**Source:** [T-600's ambush arena](../../reports/audits/2026-11-18-t600-ambush-arena.md) · **Size:** M · **Needs:** — · **Status:** open

## Decided

- No game rule changes: this is the script's (`test/scenarios/three_years_fortress.ts`).
- The script keeps standing down from an ambush larger than its armed soldiers (T-575) unless its squad clears one of the two bars below, set from the arena's rows by the gate with two medics:
  - **Full squad:** at least five soldiers armed in steel helm, mail shirt and greaves with a steel weapon and shield, at Proficient (10) in their weapon skill, and at least two marksdwarves at Proficient with crossbows and bolts: it fights a sprung ambush of up to 10 (arena: 144 of 144 won, 0.21 to 0.50 dead a fight against 6 to 10).
  - **Soldiers alone:** the same five soldiers without the marksdwarves: it fights a sprung ambush of up to 6 (arena: 24 of 24 won, 0.46 dead a fight; 0.96 against 8, more than the 0.9 an ambush kills when the fortress hides, T-593).
  - Both bars also need cloth in stock for bandages: the arena's figures are with two medics, and without one the full squad loses 0.75 to 1.46 a fight. Every dwarf of the script already has the medicine labor.
  - Anything weaker stands down as now: five Skilled in iron with two marksdwarves lose 1.1 to 2.6 a fight, Novices in iron lose most of the squad.
- Fighting means the squad is sent after every member of the ambush, the nearest first, from its muster at the gatehouse stair, as T-544's hunt sends it; the civilians shelter as they do now.
- If no fortress of the sweep ever reaches either bar (likely: the script's squad is Novice and in iron), the change is still made, since a later script that trains and forges steel will reach it, and the report says how far the fortresses come (best squad by day 336: soldiers armed in metal, their metal and skill).

## Why

T-593 found the three-year script hides from every peril-4 ambush, because each is larger than its armed soldiers, and so the sweep measures a player who never fights one. T-600's arena shows the owner's squad wins every such fight cheaply with a medic, while the script's squad of three Novices in iron loses nearly every one. A player with a strong squad fights; the script should, when it has one.

## What to do

Add the two bars to the script's ambush answer beside `armedSoldiers` (`three_years_fortress.ts`, T-575's `standingDown`), count the squad's soldiers by metal, skill and kit, and send the squad out when a bar is met and the ambush is within its size. Note each decision in the journal's ambush census (`three_years_ambush`: fought or stood down, and why). Run the sweep on GitHub (`measure.yml`, `suite=sweep`).

## Done

The bars in the script with a unit test of the decision (sizes 6, 8, 10 against each bar), the sweep's verdict (it should not move if no fortress reaches a bar), and a report with how many ambushes were fought and the squads the fortresses reached.
