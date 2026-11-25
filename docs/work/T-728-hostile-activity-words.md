# T-728 — A raider's activity line reads its party's state id

**Source:** T-713 ([work file](../archive/tasks/T-713-hostile-view-sections.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

A party member with no target takes its party's state as its behaviour (`H.behaviorState = P?.state ?? 'approach'`, `src/systems/threats/ai.ts`): `engage`, `loiter` or `retreat`. The activity line of its view and its Units All fact read that through `stateWords` (`src/ui/panels/units-all.ts`), which has words for `approach`, `attack`, `flee` and the animal states but none for these three, so they print as themselves: `Activity: Loiter`, `Activity: Retreat`, `Hostile, engage`. `fortress-screen.md` § Inspection panel promises the Units All tab's words (`Attacking`, `Fleeing`).

## What to do

- Give `engage`, `loiter` and `retreat` words in `ui.units.state.*`, as the Threats panel words the party's state: `attacking`, `waiting`, `leaving`.
- Update `ui-screens/panels.md` § Units (the All tab's facts) and `fortress-screen.md` § Inspection panel's list of activity words.

## Done

- [x] Tests (`describe` with the task id): a loitering raider's activity reads `Waiting`, a retreating one's `Leaving`, an engaged one with no target `Attacking`; Units All agrees (`test/unit/ui/t726-species-name-not-id.test.ts`, done with T-726).
- [x] UI only: world hashes unchanged.
