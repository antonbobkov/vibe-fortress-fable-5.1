# T-NEW — An animal's view lacks the animal sections the inspector list names

**Source:** T-707 (found while adding the pasture action to a tame grazer's view) · **Size:** M · **Needs:** — · **Status:** open

## Why

`fortress-screen.md` § Inspection panel lists the sections of an animal's view: species, state, owner, pasture, condition, training. None of them is drawn. A tame cow's view in Look (seen in `test/unit/ui/t707-creature-view-pasture.test.ts`'s setup, 2026-11-24) reads, under its pinned lines, `Mood: Fine (55)` and its health; nothing says the species, whether it is hungry (08's condition, the Animals panel's fed bar), its owner or dwarf, its training, a slaughter mark or a pregnancy. Its activity line (T-706) and the foot's `[p] pasture: …` row (T-707) say its pasture, and only that.

## What to do

- Draw 08's animal sections in a creature's view, in the inspector list's order, in the words the Animals panel already uses (`tameDetail` in `src/ui/panels/animals.ts`: species or name, pasture, fed, pregnant, training, with whom, slaughter mark); a wild animal's: species, state (08's brain state), huntable.
- Decide whether an animal shows a mood line at all (15 gives moods to dwarves; a fortress animal shows `Mood: Fine (55)` today); if not, keep it to dwarves.
- Update `fortress-screen.md` with a wireframe of a tame animal's view.

## Done

- [ ] Tests: a tame cow's view names its species, hunger and training; a wild deer's its state and whether it is hunted.
- [ ] `fortress-screen.md` has the animal's wireframe, and its section list matches what is drawn.
