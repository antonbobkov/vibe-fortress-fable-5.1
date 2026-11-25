# T-713 — A hostile's view lacks the hostile sections the inspector list names

**Source:** T-710 (found while drawing the animal sections) · **Size:** S · **Needs:** — · **Status:** open

## Why

`fortress-screen.md` § Inspection panel lists a hostile's sections as party, role and state. None of them is drawn: a raider's or a goblin's view in Look (`creatureSections` in `src/ui/panels/look.ts`) shows its activity line (its behaviour state, T-706), its health and, when it holds something, `Equipment`, and says nothing of the raid party it came with or its role in it (18's raid parties, captains).

## What to do

- Draw 18's hostile sections in a hostile's view, as T-710 drew the animal's: rows of a dim label and a value (`Party`, `Role`, `State`), in the words the Threats panel and the raid lines already use; the texts go in the strings table (`strings:check` scans `look.ts`).
- Keep the view within the 36-column sidebar under the rule that a fact is never cut.
- Update `fortress-screen.md`'s section list to what is drawn.

Decided while doing it:

- The rows are `Party` (the Threats panel's words without `Active:`: `Gloam raid, 7 of 10, attacking`), `Morale` (the party's morale word while it has one and has not broken), `Role` (`thief`, `warrior`, `archer`, `captain`, `hexer`, `cavern monster`, `Hollow-born`, `restless dead`; `, leads the party` for the leader), `Leader` (a link to the leader, when it is another creature the map shows) and `State` (`hostile`, then `breaking a door`, `carrying loot`, `lost its nerve`), in `src/ui/panels/look-hostile.ts`. A hostile without a party has `Role` and `State` only.
- The values share the animal rows' column (the widest label of both sets, plus two).
- A hostile the map hides is not given away: its own view is the existing `Out of sight.` view, and the `Party` count leaves out members stealthed and not spotted (a thief pair with one spotted reads `thief, 1, coming`); the hidden leader is not named.
- The `Leader` link names a creature called by its species by its species's name (`gloam captain`), not by the id spawn stores as its name. The view's title still shows the id (follow-up).

## Done

- [x] Tests: a raider's view names its party, role and state; a dwarf's and an animal's views are unchanged (`test/unit/ui/t713-hostile-view-sections.test.ts`: a raider with its leader, a captain breaking a door with loot, a spotted thief, a siege's trollkin that lost its nerve, a sprung ambusher before and after its party turns to leave, a cavern monster, a stealthed thief out of sight, a spotted thief whose hidden partner leads; nothing cut at 36 columns; T-710's dwarf and animal tests unchanged).
- [x] UI only: no world hash moves.
