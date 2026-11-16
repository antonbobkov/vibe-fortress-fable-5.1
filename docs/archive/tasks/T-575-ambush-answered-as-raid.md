# T-575 — The three-year script answers a sprung ambush as a raid

**Closed:** 2026-11-16, in 0cff7a8f,034c90e6,e6bafa2d.

**Source:** [T-574's replay of three-years-p4-1](../../../reports/data/2026-11-16-t574-ambush-day-297.md) · **Size:** M · **Needs:** — · **Status:** open

## Why

The script raises the hearth alert for any hostile party but a thief and posts the squad on the gatehouse stair, the answer to a raid that comes to the gate (`checkFortressDefense` in `test/scenarios/three_years_fortress.ts`). An ambush does not come to the gate: it springs on the dwarves outdoors (18 § Party AI). On day 297 of `three-years-p4-1` at shift 0 (T-555's master) an ambush of nine sprang among 22 dwarves on the surface. Three soldiers went to the stair, the gate's two doors locked on them 400 ticks later, and they struck no blow while the ambush killed 37 dwarves outside (all nine Gloam lived; their morale stood at 100). T-574 fixed what kept the civilians outside (22 § Path cache); the squad's answer is unchanged.

## What to do

Decide from a probe of the peril-4 ambushes over the sweep's shifts whether a player's answer to a sprung ambush with dwarves outside is a different post (the outer doorway, or a kill order on the members attacking dwarves, as T-539 does for an animal attacking a dwarf), and what it costs the squad against steel-armed Gloam (T-504: a peril-4 raid of ten beats six Skilled soldiers in iron). Keep raids and ambushes as strong as they are.

## Done

The script's answer to a sprung ambush decided and written in the script's comments, with the census of peril-4 ambushes before and after, and the sweep's verdict.
