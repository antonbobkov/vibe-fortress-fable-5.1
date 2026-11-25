# T-730 — An animal's view and the Animals panel say nothing of its wounds

**Source:** T-723 · **Size:** S · **Needs:** — · **Status:** open

## Why

T-723 made a fortress animal bleeding with no bandage or cloth an alert (17 § Player-facing behavior). But the alert's `[v]` opens an animal view that has no wound or bleeding line at all, and the Animals panel's row for it says only its pasture, training and condition. A dwarf patient has a `Care:` line ("bleeding, and no bandage or cloth to bandage it"); an animal has nothing to show why it is dying.

## What to do

Decide what an animal's view (`ui/panels/look-animal.ts`) shows of its health: at least "Bleeding" while a wound bleeds unbandaged, and, while its `bandage_animal` is blocked for a missing input, the dwarf's Care line's words ("bleeding, and no bandage or cloth to bandage it"); perhaps a dim "wounded" in its Animals panel row.

Spec: 17 § Player-facing behavior; `ui-screens/panels.md` (Animals); `ui-screens/fortress-screen.md` § Inspection panel.

## Decision

- **The wound line says it bleeds**, for every creature: `serious cut (bleeding)` while the wound bleeds unbandaged, `bleeding` first among its flags, the line in the alert colour. A wound line now wraps under itself instead of being cut (`serious cut (bandaged, infected)` was cut to `infect»` at 36 columns), so the new flag never pushes a fact off the sidebar.
- **A tame animal has a `Care:` line** under its Health line while its `bandage_animal` job is open, the first that holds: blocked for a missing input, the dwarf's own words ("Care: bleeding, and no bandage or cloth to bandage it. …", alert); no living dwarf with the job's labor on ("Care: no one has Animal care enabled ([l] Labors).", alert); a dwarf has the job ("Care: bandaging by Sigrun Ashbrook."); otherwise "Care: waiting to be bandaged.". No job (unhurt, or bandaged), no line, so a healthy animal's view is unchanged.
- **The Animals panel**: wounds (bleeding, wounded, unhurt) are one more part of a group's key, so a hurt dog is a row of its own; a wounded row starts with `+`, the status bar's mark for the wounded, at the front where no cut reaches it; the row's words say `bleeding` or `wounded` right after how many and of what, and a bleeding row's words are drawn in the alert colour instead of dim. "Wounded" is any wound at all.
- UI only: no world hash moves; no sweep.

## Done

- [x] Tests (`test/unit/ui/t730-animal-wounds.test.ts`): a war dog with a serious cut and no cloth shows `serious cut (bleeding)` in the alert colour and the no-dressing Care line in its view, and `+dog` with "1 dog · bleeding · no pasture · trained for war" in the Animals panel; bandaged, no Care line and no bleeding, the panel says `wounded`; the labor and under-way Care lines; a healthy dog shows no Care line, no bleeding and no mark; a wounded dog leaves its group; nothing cut at 36 columns.
- [x] Spec: `ui-screens/fortress-screen.md` § Inspection panel (wound lines, the animal's Care line), `ui-screens/panels.md` § Animals (wireframe, grouping, mark, words), 17 § Registrations and § Player-facing behavior, 08 § Player-facing behavior.
