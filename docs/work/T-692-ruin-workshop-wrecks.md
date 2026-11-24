# T-692 — A ruin's workshops stand as wrecks

**Source:** T-690 follow-up · **Size:** M · **Needs:** T-690 · **Status:** open

## Why

T-690 stands a ruin's furniture again on the next embark (doors, hatches, beds, tables, chairs, cabinets, statues: 02 § Ruins), but a workshop, a hearth, a depot, a well and the pallets are gone without a trace. A forge's wreck in the old smithy, or the cold hearth of the old hall, would say more about who lived there than an empty room, and taking a wreck apart could return a little of what built it.

## What to do

Decide which multi-input buildings a ruin keeps (workshops, the hearth, the depot, the well, the pallets) and in what state: built and working as before, or a wreck (a new state or a `ruined` setting) that does nothing until it is repaired or deconstructed for part of its inputs. Record them compactly beside the furniture (`RuinRecord.buildings` with the consumed inputs, halved), place them at arrival through 14's `placeRuin` (a workshop's impassable tiles and a hearth that would light the hall on embark need thought: the hearth is a fortress's home, 14 § Special buildings), keep the record small and the placement deterministic, and draw nothing in fresh embarks. Spec it in 02 § Ruins and 14.

## Done

- [ ] Tests: a ruin's workshop stands as a wreck on the next embark and deconstructs for part of its inputs; a fresh embark is unchanged.
