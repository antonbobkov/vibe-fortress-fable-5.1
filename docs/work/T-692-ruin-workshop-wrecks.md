# T-692 — A ruin's workshops stand as wrecks

**Source:** T-690 follow-up · **Size:** M · **Needs:** T-690 · **Status:** open

## Why

T-690 stands a ruin's furniture again on the next embark (doors, hatches, beds, tables, chairs, cabinets, statues: 02 § Ruins), but a workshop, a hearth, a depot, a well and the pallets are gone without a trace. A forge's wreck in the old smithy, or the cold hearth of the old hall, would say more about who lived there than an empty room, and taking a wreck apart could return a little of what built it.

## What to do

Decide which multi-input buildings a ruin keeps (workshops, the hearth, the depot, the well, the pallets) and in what state: built and working as before, or a wreck (a new state or a `ruined` setting) that does nothing until it is repaired or deconstructed for part of its inputs. Record them compactly beside the furniture (`RuinRecord.buildings` with the consumed inputs, halved), place them at arrival through 14's `placeRuin` (a workshop's impassable tiles and a hearth that would light the hall on embark need thought: the hearth is a fortress's home, 14 § Special buildings), keep the record small and the placement deterministic, and draw nothing in fresh embarks. Spec it in 02 § Ruins and 14.

## Decisions

- **Which.** Every built workshop (magma ones too), hearth, trade depot and well stands as a wreck: no stand chance, since they are heavy and fixed; at most `RUIN_WRECKS_MAX` (20, *unmeasured*), trimmed uniformly on the ruin's stream after the furniture. A wreck the fortress found and left standing is a wreck again. The pallets are gone: their cloth and straw rot, as loose cloth does, so a pallet wreck would hold nothing and do nothing. Mechanisms, traps, candle stands, drying racks and rune circles stay gone (follow-up below for traps and mechanisms).
- **A new state, `ruined`**, not a setting on a built building: every rule that asks for `built` passes a wreck by with no change, so a workshop's wreck takes no orders (12 makes a `Workshop` only on `BuildingCompleted`), a depot's draws no caravan, a well's gives no water, and none adds value to wealth or rooms. The places that read "not built" as "planned" were narrowed to planned or constructing (the build producer, its re-queue on `JobCancelled`, the renderer's plan colour, the orders picker's "not built yet", the still hint).
- **Passable.** A wreck blocks nothing: a forge's corners have fallen in. So arrival needs no creature moves and the wagon's dwarves are never trapped.
- **What it holds: every second unit** in the order consumed (the 2nd, the 4th …), half rounded down. Deterministic, no draw, and the first unit (an anvil, a kitchen's or clothier's table) went with the looters, which reads well and keeps the valuable part out of a re-embark. Grouped by item type and material in the record (`RuinRecord.wrecks`, a separate list beside `buildings`, so T-690's furniture records are untouched).
- **Deconstruct only, no repair.** Repairing would cost the same materials as taking the wreck apart and building anew (the missing half), so it adds a command, a job variant and UI for nothing a player could not already do. `DeconstructBuilding` accepts a wreck (half its row's build ticks); `CancelBuilding` refuses it (`not_cancellable`).
- **The old hearth stands cold.** A hearth's wreck never becomes `hearthId`: no `HearthLit`, no light or warmth, no hearth hall, no `hearth_exists` refusal of the expedition's own hearth, and it may be taken apart while dwarves live.
- **Drawn worn**: its built glyph in its colour dimmed one level; a hearth's wreck does not pulse. The building panel says "A wreck of the old fortress: it does nothing. Taken apart: …" with take apart.
- **Fresh embarks.** Nothing new is drawn or run without a ruin; the changed conditions are equivalent for planned, constructing and built buildings. The golden world hashes (`deepholm` and `emberhall` at 0, 1000 and 5000 ticks) are unchanged, so the three-year sweep was not run.

## Done

- [x] Tests: a ruin's workshop stands as a wreck on the next embark and deconstructs for part of its inputs; a fresh embark is unchanged (`test/unit/embark/t692-ruin-wrecks.test.ts`: a carpenter's, a forge's and a hearth's wrecks with every second unit, `ruined`, no `Workshop`, no value, passable, drawn dimmed, kept by a save; the old hearth not the fortress's, a new one placed beside it, the wreck taken apart while dwarves live and never cancelled; a dwarf takes the forge's wreck apart for its two blocks and no anvil; a wreck halved again; a testing fortress leaves none; another site's embark hash unchanged. `test/unit/ui/u05-building-panel.test.ts`: the wreck's panel line and take apart. `test/golden/world-hashes.test.ts` unchanged).
- [x] Spec: 02 § Ruins (the record, a Wrecks bullet, the pallets, the draw order, arrival, the balance, `RUIN_WRECKS_MAX`), 14 § Concepts, § Placement, § Special buildings (hearth), a new § Wrecks, § Player-facing behavior, 03 stage 10b (`LocalMapResult.ruinWrecks`), 23 § Compositor step 4, `glyphs-and-colors.md`, `schemas/components.md` (`Building.state`), `schemas/system-state.md` (`RuinRecord.wrecks`), `command-catalog.md` (`DeconstructBuilding`), `fun-features.md` (the looters took the anvil).
- Follow-up: `T-NEW-ruin-traps-armed.md` (a ruin's traps and levers still stand, some still armed).
