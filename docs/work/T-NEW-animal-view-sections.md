# T-NEW — An animal's view lacks the animal sections the inspector list names, and reads "Activity:" blank

**Source:** T-707 (found while adding the pasture action to a tame grazer's view) · **Size:** M · **Needs:** — · **Status:** open

## Why

`fortress-screen.md` § Inspection panel lists the sections of an animal's view: species, state, owner, pasture, condition, training. None of them is drawn. A tame cow's view in Look (seen in `test/unit/ui/t707-creature-view-pasture.test.ts`'s setup, 2026-11-24) reads:

```
cow
Activity:
At (20, 20, z32)
───────────
Mood: Fine (55)
Health: Blood 100%, Pain 0
  ...body parts...
```

The activity line is empty (`activityLabel` has no words for an animal's state), a mood line shows for an animal of the fortress faction, and nothing says the species, whether it is hungry (08's condition, the Animals panel's fed bar), its pasture, its owner or dwarf, its training, a slaughter mark or a pregnancy. T-707 added only the pasture, on the foot's `[p] pasture: …` row.

## What to do

- Draw 08's animal sections in a creature's view, in the inspector list's order, in the words the Animals panel already uses (`tameDetail` in `src/ui/panels/animals.ts`: species or name, pasture, fed, pregnant, training, with whom, slaughter mark); a wild animal's: species, state (08's brain state), huntable.
- Give the activity line an animal's state in words ("Grazing", "Wandering", "Fleeing"), or leave the line out for a creature that has none.
- Decide whether an animal shows a mood line at all (15 gives moods to dwarves); if not, keep it to dwarves.
- Update `fortress-screen.md` with a wireframe of a tame animal's view, and 24 § Inspection if the pinned lines change.

## Done

- [ ] Tests: a tame cow's view names its species, hunger, pasture and training; a wild deer's its state; no blank "Activity:".
- [ ] `fortress-screen.md` has the animal's wireframe.
