# T-702 — A new embark on the same world brings back the same seven dwarves under the same name

**Closed:** 2026-11-24, in 92f633ed,7b1e4e3b.

**Source:** playtest 2026-11-24 ([report](../../../reports/data/2026-11-24-playtest.md), finding 4) · **Size:** S · **Needs:** — · **Status:** open

## Why

I abandoned Wolfcrown (world `deep-522-1`, region 42,30, Farmstead) on day 21 and embarked again on its site. The region panel said "Ruins of Wolfcrown: Abandoned in Year 1 by 7 dwarves." The embark screen then offered the fortress name "Wolfcrown" again and the same seven dwarves, by name, age and attributes: Oddny Bearhammer, Saga Darkward, Embla Veinward and the rest (`reports/data/2026-11-24-playtest/54-reembark.png`, against `08-presets.png` of the first embark). Embarking anywhere else on the world gives them too. The new fortress began on Day 1 of Spring, Year 1, three weeks before the ruin it found was left.

`EmbarkSession` seeds its stream with the world seed alone (`partyStream(worldSeed)` in `src/systems/embark/index.ts`), so every embark on a world draws the same party and the same default name. The Legends then hold two Wolfcrowns founded by the same people, and the Load list holds a manual save of the first Wolfcrown next to the second's.

Also: the `c_abandon` confirmation says the hall "cannot be resumed", but a manual or quick save made before the abandon stays in Load and resumes it (`52-abandon-confirm.png`).

## What to do

Decisions:

- **Each embark on a world draws its own party and name.** The party stream is seeded by the world seed and the number of fortresses that have ended on that world (its Legends records for the world, or `WorldMap.ruins` count, whichever the session can read), so the first embark of a world is exactly what it is now (no golden or scenario moves) and each later one is a new seven and a new name. A default name already used by a fortress of the world is drawn again.
- **The date is not changed:** each fortress keeps its own calendar from Year 1 (the Legends say "Abandoned in Year 1" of that fortress); changing the world's clock is out of scope.
- **The confirmation tells the truth about saves:** `c_abandon` (and `c_retire` if it says the same) reads "…recorded in the Legends. Saves made before now can still be loaded." in place of "cannot be resumed".
- Kept as a candidate for the fun-features list instead, if the owner prefers it: the same seven walking back to their own ruin. Then the embark screen should say so ("The founders of Wolfcrown return.") and the name should still change.

Spec: 02 § Ruins or § State (the party stream's seed), `ui-screens/menus-and-world.md` § A new embark on the same world, `ui-keymap-and-screens.md` § Confirmations (`c_abandon`).

## Done

- [x] Tests: the first embark of a world has today's party and name; after one fortress has ended on it, the next embark's party and name differ, and its name is not one the world's Legends hold; the abandon confirmation's text (`test/unit/embark/t702-new-founders.test.ts`: it also abandons a fortress with a quick save, finds the save still listed, embarks again on the ruin with seven new dwarves and a new name, and loads the quick save back into a playable fortress). The world-hash goldens are unchanged.
- [x] e2e `retire-and-legend` or the T-672 spec still passes (`t672-sticky-preset.test.ts`, and the e2e suite on CI).
- Decisions taken: the count of ended fortresses is the world map's ruins or the Legends' records of the world's seed, whichever are more (so a world generated again from its seed, or a fortress played on from an older save, still gets new founders); the stream is `embark.party` for the first embark and `embark.party.<n>` after; a used name is drawn again, at most once per name the table can make. The headless preset embark (scenarios, tests) always draws as a first embark. The saves are not removed on abandon or retire: the text was made true (`c_retire` too), and 24 § Game menu says so. The playtest's "founders return" fun item is resolved as new founders, with a nod kept: the new fortress's log opens with "The ruins of {fortress} lie somewhere on this site." (logged in `docs/fun-features.md`).
