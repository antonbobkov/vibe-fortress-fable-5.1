# T-710 — An animal's view lacks the animal sections the inspector list names

**Source:** T-707 (found while adding the pasture action to a tame grazer's view) · **Size:** M · **Needs:** — · **Status:** open

## Why

`fortress-screen.md` § Inspection panel lists the sections of an animal's view: species, state, owner, pasture, condition, training. None of them is drawn. A tame cow's view in Look (seen in `test/unit/ui/t707-creature-view-pasture.test.ts`'s setup, 2026-11-24) reads, under its pinned lines, `Mood: Fine (55)` and its health; nothing says the species, whether it is hungry (08's condition, the Animals panel's fed bar), its owner or dwarf, its training, a slaughter mark or a pregnancy. Its activity line (T-706) and the foot's `[p] pasture: …` row (T-707) say its pasture, and only that.

## What to do

- Draw 08's animal sections in a creature's view, in the inspector list's order, in the words the Animals panel already uses (`tameDetail` in `src/ui/panels/animals.ts`: species or name, pasture, fed, pregnant, training, with whom, slaughter mark); a wild animal's: species, state (08's brain state), huntable.
- Decide whether an animal shows a mood line at all (15 gives moods to dwarves; a fortress animal shows `Mood: Fine (55)` today); if not, keep it to dwarves.
- Update `fortress-screen.md` with a wireframe of a tame animal's view.

Decided while doing it:

- The sections are rows of a dim label and a value, as the item view's fields: `Species`, `State` (`tame`, `young`, `pregnant`, `marked for slaughter`), `Owner` (the dwarf whose pet it is, else `the fortress`), `With` (the assigned dwarf), a grazer's `Pasture` and `Hunger` (`70 (very hungry)`: 08's condition with the Animals panel's fed words, alert when very hungry, bad when starving), `Training` (`in training`, `trained for war`, `trained for hunting`, `untrained`, `cannot be trained`); a wild animal's `Species`, `State` (`wild`, `dangerous`, `hungry` for a predator's hunger) and `Hunted` (`yes`/`no`). Owner, With and Pasture are links.
- No mood line for any creature but a dwarf (fortress-screen.md already said the mood is a dwarf's line; the code drew it for every fortress creature).
- `look.ts`'s ten literals (mood, health, wound flags) moved to `ui.look.*` keys, so `LITERAL_FILES_SKIPPED` is empty (T-711's first bullet).
- The pinned activity line of a dog following a long-named dwarf ends in `»` (a name, allowed by T-703's rule); the `With` row gives the name whole.

## Done

- [x] Tests: a tame cow's view names its species, hunger and training; a wild deer's its state and whether it is hunted (`test/unit/ui/t710-animal-view-sections.test.ts`: also a starving calf pregnant and marked for slaughter, a war dog with its dwarf, a pet's owner, a hungry wolf, a dwarf's view unchanged, no Mood line on an animal, nothing cut at 36 columns).
- [x] `fortress-screen.md` has the animal's wireframe, and its section list matches what is drawn.
