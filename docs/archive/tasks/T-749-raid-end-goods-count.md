# T-749 — A raid's end line and its escape line count the goods differently (27 and 51)

**Closed:** 2026-11-25, in d591e42d,3fcb49e3.

**Source:** playtest 2026-11-25 (peril 4) ([report](../../../reports/data/2026-11-25-playtest-4.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

At the end of the Gloam siege of Autumn, Year 2 (the save [`deepholm-p4-y2-siege.bin`](../../../reports/data/2026-11-25-playtest-4/deepholm-p4-y2-siege.bin), played on for about 7,800 ticks under the Hearth alert; `12-siege-log.png`), the log printed two lines in the same minute:

- "! The Gloam siege is over: 27 raiders fled with 27 goods."
- "! Raiders have escaped with 51 goods: iron arrows ×9, maple logs ×4, ash logs ×2 and 8 more!"

The two lines give different numbers for one theft. `src/systems/threats/ai.ts` adds 1 to `Party.escapedLootCount` for each loot item that leaves the map, so it counts stacks: 27 raiders, one stack each. The escape line (18 § Player-facing behavior, "What was taken") adds up the stacks' counts. 18's own example gives both lines the same figure: "6 raiders fled with 14 goods" beside "escaped with 14 goods: iron bars ×6, oak logs ×7 and an iron short sword".

## What to do

Decisions:

- **`escapedLootCount` counts units**: each loot item that leaves adds its stack count, as the escape line does. Both lines then say 51.
- `outcome` is unchanged (`looted` while the count is above 0). Older saves keep the number they hold, which is only shown.

Spec: 18 § The Party (`escapedLootCount`: the units of loot that left the map), § Player-facing behavior if the example needs it.

## Done

- [ ] Tests (`describe` with the task id): a party whose members leave with a stack of 9 iron arrows, a stack of 4 logs and a sword reads "fled with 14 goods", and its escape line says "14 goods". One member with one item reads "fled with a stolen item", as now.
- [ ] `escapedLootCount` is saved party state, so the world hash of a run with a looted raid moves. Regenerate any golden that moves with `npm run golden:update` and name it in the commit. No sweep: nothing in the simulation reads the count beyond `> 0`.
