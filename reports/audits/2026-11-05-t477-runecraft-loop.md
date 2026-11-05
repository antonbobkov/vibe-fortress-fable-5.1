# The runecraft loop played, and 25 as plain specification

**Task:** T-477 · **Date:** 2026-11-05 · **Commit examined:** master `e85b2716` (T-492 merged) with the T-477 branch on it · **Kind:** a scenario, screen checks and a measurement; no constant, formula or content value of runecraft changed · **Source:** [the T-477 work file](../../docs/work/T-477-runecraft-whole-loop-scenario.md), [the runecraft design](../designs/2026-11-01-runecraft-magic-system.md)

## The answer

- **[25 Runecraft](../../docs/02-systems/25-runecraft.md) now governs runecraft alone.** It carries no task mark, no "how to read this document while it is being built", no planned interfaces and no list of where it differs from the design; every row it names is in a `03-content` table or a schema. Decision D-250, which brought magic into scope, is deleted from the decision log: its rule (the player never casts, nothing is necromancy, no vampires or werebeasts, magic trails steel) stands in 25's § Purpose. The design report is not edited; it is history.
- **A fortress plays the whole loop by commands, on both of its seeds.** `pp_runecraft` (a player path, `docs/process/player-paths.md`) embarks the Miner's Guild, lays the Mountainhome's glowcap seeds and glowstones and three garnets in its stockpile, and then only gives orders. Two lamps go up on day 3; 16 glowcap tiles give **40** and **45** glowcap on days 27 and 28; the laboratory distils 13 vials on days 28 to 33; one apprentice sits in the sanctum and is Dabbling after 4 and 5 sessions; the runeforge makes an iron staff of embers and sets a garnet in an iron axe; a squad of the apprentice and an axedwarf is told to carry a draught of stoutness. At a raid of three brought on day 36 the apprentice throws **3** and **2** emberbolts from the staff it made, and both soldiers drink the draught. It runs in the normal tier in about 24 seconds for both seeds.
- **Two screens could not be read to the end.** The look panel cut the line under a staff ("Emberbolt: 22 ember, range 1»"), and the squad's draught checklist cut every trigger ("draught of mending: hit whil»"), in the sidebar's 32 cells. The look panel's runecraft lines now wrap under their prefix; the squad's draught line wraps; the checklist names each draught on its row and the selected one's trigger in words under the list ("Drunk when a raid or an ambush arrives."). The e2e check `runecraft-screens` reads the sanctum panel, a staff's look line, the checklist and a warded dwarf's `ward_cyan` ground through the real keyboard and mouse.

## What was found on the way

- **An apprentice with other labors attunes at half the sanctum's rate.** The sanctum allows two sessions a day; in the fortress the apprentice, also a miner and a hauler, sat once a day (days 31, 32, 33, 34). [balance.md](../../docs/03-content/balance.md#runecraft) now says so beside the two-a-day figures.
- **The pale bells grown for a draught are eaten.** Pale bell is edible, and a hungry Miner's Guild ate all nine harvests on one seed before the laboratory took two. Ordering the brew (a "maintain 2" order) before the bells ripen, and ahead of the distilling, gets the first ones to the laboratory. This is ordinary play, not a fault: a player who wants draughts orders them early, as a brewer orders a still.
- **A civilian woodcutter's claim on the axe.** The iron axe for the stone was kept from the soldier while a dwarf with woodcutting on had no axe (16 § Equipment); the scenario turns woodcutting off, as `pp_defence` does.
- **One lamp grows what the model said.** 20 and 22.5 glowcap a lamp over its first harvest, 0.83 to 0.94 a day, against the model's 0.83 (balance.md § Runecraft).

## What was run

- `npx vitest run test/scenarios/m8.test.ts -t pp_runecraft`, both seeds, locally; the figures above are its printed trace.
- `npx playwright test test/e2e/runecraft-screens.spec.ts`, locally; the full e2e suite and `npm test` on GitHub (the commit body has the run).
- The six static checks and the unit suites under `test/unit/ui` and `test/unit/runecraft`.

## Not done here

The balance pass of the work file (the ward against a squad with one or two more soldiers instead of the caster, and Daze stunning a captain again each time it wakes) is measured once T-504's raid morale has landed, since it changes how a raid breaks; until then the ward and Daze rows of [balance-status.md](../../docs/balance-status.md) stand as T-473 left them. Its arenas are ready: `reports/data/2026-11-05-t477-balance-arena.probe.ts.txt` (copy it into `test/perf` and run it with `vitest.perf.config.ts`) sets five Novice soldiers against the peril-2 raid of ten and the ambush of four with, in place of a sixth, a ward caster, a Daze caster, nobody, one or two more axedwarves, a Proficient marksdwarf, or an axedwarf and the marksdwarf, and counts the captain's dazes and fate. A one-trial smoke run on this branch, before T-504, shows why the pass must wait: the raid's captain goes down at the same tick in every variant and the raid turns back by the captain rule, so the comparison measures the captain rule, not the ward.
