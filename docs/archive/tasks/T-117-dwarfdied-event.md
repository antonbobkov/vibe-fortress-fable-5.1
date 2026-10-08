# T-117 — `DwarfDied`: the specification says 10 emits it, the code never does

Closed by `T-117: use CreatureDied throughout dwarf death consumers`.

**Source:** T-102 (found while replacing the interface note of [`../02-systems/10-dwarves.md`](../../02-systems/10-dwarves.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

The interface note that T-102 replaced said that `DwarfDied` is an older name for the `CreatureDied` event that 17 emits and that 10 and 18 consume. The code agrees with the note: nothing in `src/` emits `DwarfDied`. The Interfaces section of `10-dwarves.md` now says so. Other parts of the specification, and one subscription in the code, still treat `DwarfDied` as a live event:

- `02-systems/10-dwarves.md` § Death: "… updates population, and emits `DwarfDied { id, cause }`".
- `02-systems/README.md`, the summary of 10: "**Emits.** … `DwarfDied` …".
- `02-systems/18-threats-monsters-and-raids.md` § Events consumed: "`ImmigrantsArrived` and `DwarfDied` (population for renown)".
- `04-implementation/event-catalog.md`: the row `DwarfDied | id, cause | 10 | 15, 16, 18, 21, ui`.
- `03-content/personality-and-thoughts.md`: the `dwarf_died` thought's trigger is `DwarfDied (everyone)`.
- `src/core/event-types.ts` lists the type; `src/systems/threats/index.ts` subscribes to it and recomputes renown on it, which therefore never happens on a death through that path.

## Decision

The code's behaviour is the rule: a dwarf's death is 17's `CreatureDied`, and there is no second event.

## What to do

1. Check that every consumer the catalog names for `DwarfDied` (15, 16, 18, 21, the UI) does on `CreatureDied` what the specification says it does on a dwarf's death. Renown in 18 is the one to look at first: it is recomputed on `WealthChanged`, `ImmigrantsArrived` and `DwarfDied`, so a death alone may leave it stale until the next of the other two. If a consumer misses a death, that is a behaviour fix: make it react to `CreatureDied` for a dwarf, with a test.
2. Remove `DwarfDied` from the specification sections above (the trigger of `dwarf_died` becomes `CreatureDied` of a dwarf), from `src/core/event-types.ts`, and from 18's subscription list.
3. Remove the parenthesis about `DwarfDied` from `10-dwarves.md` § Events emitted.

## Done

- `grep -rn DwarfDied docs/0[0-4]* src` finds nothing.
- The verification commands of [`../process/agent-workflow.md`](../../process/agent-workflow.md) are green. If step 1 changed behaviour, the commit says which golden files moved and why.
