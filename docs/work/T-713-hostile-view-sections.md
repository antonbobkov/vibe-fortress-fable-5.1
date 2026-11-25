# T-713 — A hostile's view lacks the hostile sections the inspector list names

**Source:** T-710 (found while drawing the animal sections) · **Size:** S · **Needs:** — · **Status:** open

## Why

`fortress-screen.md` § Inspection panel lists a hostile's sections as party, role and state. None of them is drawn: a raider's or a goblin's view in Look (`creatureSections` in `src/ui/panels/look.ts`) shows its activity line (its behaviour state, T-706), its health and, when it holds something, `Equipment`, and says nothing of the raid party it came with or its role in it (18's raid parties, captains).

## What to do

- Draw 18's hostile sections in a hostile's view, as T-710 drew the animal's: rows of a dim label and a value (`Party`, `Role`, `State`), in the words the Threats panel and the raid lines already use; the texts go in the strings table (`strings:check` scans `look.ts`).
- Keep the view within the 36-column sidebar under the rule that a fact is never cut.
- Update `fortress-screen.md`'s section list to what is drawn.

## Done

- [ ] Tests: a raider's view names its party, role and state; a dwarf's and an animal's views are unchanged.
- [ ] UI only: no world hash moves.
