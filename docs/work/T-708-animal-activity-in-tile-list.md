# T-708 — An animal's row in the tile list and the status bar says what it is doing

**Source:** T-706 (the creature view's activity line) · **Size:** S · **Needs:** — · **Status:** open

## Why

T-706 gave every creature's view an activity line that is never empty (`creatureActivity` in `src/ui/panels/look-activity.ts`: "Asleep", "Grazing", "Following Ketil Ironvein", "Standing about"). Two other places still read 10's activity alone, which is empty for any creature that is not a dwarf: the crowded tile's list (`tileListRows` in `src/ui/panels/look.ts`, the row's `fact`), where a wolf's row has its name and nothing after it, and the status bar's creature summary (`creatureSummary`, "Ketil Ironvein, Digging"), which for a wolf is just "wolf".

## What to do

Decisions:

- `tileListRows` and `creatureSummary` take the activity from `creatureActivity`, so a wolf's row reads "wolf  Asleep" and its summary "wolf, Asleep".
- A dwarf's row and summary are unchanged.

Spec: `ui-screens/fortress-screen.md` § Inspection panel (the tile list) and 24 § Inspection, wherever they describe the row's fact and the summary.

## Done

- [x] Tests: a tile with a sleeping wolf lists it with "Asleep"; the status bar's summary of a grazing deer is "deer, Grazing"; a dwarf's row is unchanged.
- [x] UI and text only: no world hash moves.
