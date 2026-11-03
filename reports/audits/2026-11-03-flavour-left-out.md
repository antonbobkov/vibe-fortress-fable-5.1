# Flavour left out: fun mechanics cut or about to be cut

**Date:** 2026-11-03 · **Asked by:** the owner, after T-485 ("not all the enchantments have to be a strict improvement") · **Kind:** review, no code changed

## The question

The owner asked: during this stretch of work, did we drop or soften a mechanic that was fun, funny, goofy, interesting or gave the game character?

## Short answer

Yes, about a dozen. Most were cut in T-467's low-level design, for cost: "this needs a new mechanism for a small effect". Three things have changed since then.

- **The owner's view on trade-offs.** We now know the owner values character over tidiness, and that an option that is sometimes worse is welcome.
- **Seams that now exist.** Later tasks built seams that make several cuts cheap:
  - T-469's fire mishap lights a tile through a `Mishap` event with a tile;
  - T-474 added timed effects, such as `pain_half`, on the `Spellbound` list;
  - T-476 added a `remains` column that `strip_corpse` carries out.
- **Two cuts are still in flight.** They can be redirected before they land: T-482 (the dog pile) and T-483 (archers holding fire).

Each item below names where it was decided, the reason given at the time, what would be lost or gained, and a small way to keep it.

## In flight: decide before these land

| # | Mechanic | Where | Reason given | What we would lose | A way to keep it |
|---|---|---|---|---|---|
| 1 | **Goblin archers shoot their own goblins** | T-483, my decision on 2026-11-02 | One rule for every shooter: hold while an ally is on the line | Raiders peppering their own front line. It is funny, readable in the combat log, and a gift to the defender | Give the hold rule to the fortress only, or make it a faction temperament: the Gloam are careless, while the fortress and the Hillfolk hold. The agent was cut off by the weekly limit and nothing is committed, so this is cheap to change now |
| 2 | **Three dogs and a cat pile up on one hall tile** | T-482, filed as a fault (animals keep a walk that has arrived) | It slowed dwarves under the crowding rule, and T-463 was meant to spread animals out | A cute, characterful sight: pets heaped by the hearth | Fix the stale walk, then let idle pets choose a *favourite spot* off the main path, such as a tile beside the hearth or a bed, and allow a pile there. The pile stays without blocking traffic |

## Worth bringing back (high flavour, now cheap)

| # | Mechanic | Cut in | Reason given | Why it is worth it | Cost now |
|---|---|---|---|---|---|
| 3 | **Apprentices singe their own line.** The design's first "story" was a firebloom catching your own axedwarves | T-470 (cast-when rule), softened by design #12 (the 20-tick bloom delay) | The arena showed casters burning allies one fight in two | Today friendly fire happens only when an ally steps into a bolt or a bloom. It almost never happens, so the story is mostly gone | **Skill-based carelessness.** A caster below Proficient sometimes fires anyway when an ally is on the line, on one draw on stream 25 that happens only in that case. Apprentices are a hazard and veterans are careful, which gives the skill a story arc. Small |
| 4 | **`rune_sick`: "Too much rune. My teeth hum."** | Design #16 | The daily limit of three means a fourth vial never happens | A memorable line, and a visible cost of over-relying on vials | Allow a fourth vial only in a desperate moment (rune at 0 and a hostile adjacent). It gives half the rune and the thought. Small |
| 5 | **`dosed_again`: "Another draught. I am tired of draughts."** | T-474, my decision | The medic waits 7 days, so it could never happen | A gentle trade-off for the player and the medic | Let the medic wait only the 3-day rest. A second calming draught in a week then helps less and grumbles. Or put a "calm again early" toggle on the hospital. Tiny |
| 6 | **`blaze` sets the target's tile alight (2%)** | Design #24 | Needed fire on a weapon hit, for a rare effect | Fire chaos from your own weapon, which can burn your own wooden floor: pillar 3 stories | Reuse T-469's path: emit an event with a tile, and 05 ignites it if it can burn. One draw, only for blaze. Small |
| 7 | **`venomed` axes from giant cave spider venom** | Design #25 | Needed a timed pain source in 17 | "The fight leaves the material for the next fight", the design's pattern | T-474's timed effects already carry `pain_half`. A `pain` effect rides the same list, and the venom can come from the `remains` column. Small to medium |
| 8 | **Ember gland from the ember newt** | Design #25 | "A newt that is not butcherable" | The newt lives beside magma and is only ever sold. This gives it a reason to exist in play | The `remains` column (T-476) now handles it: a dead newt leaves a gland, and `strip_corpse` recovers it. Small |
| 9 | **`saw_wisp`: "Saw a light that was not a lamp."** | Design #34 | Needed a scan in 15 for one light | A soft, eerie moment when a wisp drifts out of the sanctum | Event-based, with no scan: on `wisp_loose` or `SummonCalled` of a wisp, dwarves within 8 tiles who can see it get the thought. Small |
| 10 | **The firebloom's one-frame orange flash** | Design #36 | Presentation for a small effect | The spell is otherwise invisible on an ASCII map; the flash is the payoff | Render only, with no state. Tiny |
| 11 | **Obsidian and bone daggers and short swords** | T-460 (rows removed) | No recipe made them | A rock-only embark (your first question in play) and a hunter's camp would have a primitive weapon tier with character | Add a knapping recipe at the craftsdwarf's or mason's workshop from obsidian or `bone_pile`, instead of deleting the rows. Small, plus a balance check |

## Interesting, but at real cost

| # | Mechanic | Cut in | Reason given | Note |
|---|---|---|---|---|
| 12 | **Hexers who cast Dread on dwarves**, and the `calm` armour that answers it | Design #20 | Dwarves would need a new flight rule in 10 | This gives armour enchantments a reason to exist, and gives the Gloam a magic identity beyond frost bolts. It also makes T-485's "fleeing is a trade-off" lesson cut both ways. Medium: reuse `stepFled` from combat for dwarves |
| 13 | **`glowing` armour lights the wearer's 3×3** | Design #22 | A moving light is a new mechanism | Soldiers glowing in a dark cavern is a strong image. As a bonus, glowcap could grow briefly under a glowing dwarf standing still. Medium: lamp coverage is per building today |
| 14 | **A turned shade that hides (stealth)** | Design #37 | "A hidden turned shade adds nothing to the story" | I disagree with that reason. A shade that comes through wrong *and is not seen at once* is the scarier, better story. Small: one flag on the row |
| 15 | **The spoiled batch fills the lab with miasma** ("The hall learns that the alchemist is new") | Design #30 | Miasma is internal to 13's rot pass | A cheaper stand-in: a short `lab_stink` thought for dwarves who pass the laboratory that day. Small |
| 16 | **Wildwood take offence at staffs** (20% value, −2 reputation each) | Implicitly, by design #4: a staff's material is now its metal shoe, so the Wildwood rule for wooden items no longer sees it. A wand is still wood | A side effect, never decided | One check: count the haft as wood for the Wildwood's offence. Tiny. Worth confirming in play first |
| 17 | **A dead runecaster's staff on an old battlefield** | T-470 (`metal()` in `traits.ts` skips channel rows, to keep old maps identical) | Determinism: a new row in the pick list would change every old-battlefield map | A separate, small pick on its own stream (like T-468's rare patches) could leave one stoneless staff or a wand among the old arms on some battlefields. A first wand found in the dirt has character. Small |

## Fine as cut (little flavour lost)

These were cut for good reasons, and nothing I can see is lost to character:
- the yew +10% (#5);
- the robe's +5 to the cast roll (#14);
- `mend_wounds` (#15);
- drinking stopping movement (#17);
- the "train with staff" toggle (#19);
- armour `mending` (#21);
- `adamant`'s weight (#23);
- "this exact item" orders (#27);
- the ≤ 25 ammunition sets (#28);
- stoutness's Toughness (#29);
- the Hillfolk enchant value (#32);
- the hollowbane legend line (#36);
- the warden "standing in a doorway as well as a door". Since T-457 doors no longer block, this would mean little.

Mishaps made unable to kill through infection (T-469) is the design's own limit, not a loss.

## Kept on purpose (for the record)

- **Fearsome axes** make a squad worse in the open (T-485, the owner's call).
- **Stoutness** does nothing against bleeding (T-474).
- **Daze can re-stun a captain** every 180 ticks (T-473, noted for T-477's balance pass).
- **A summon can set the "deepest dug" milestone** (T-475 review).
- **Owner's calls, not cuts of mine:** the door rule removed (T-457), no chapter cards or zooms in the intro (T-434), and no dwarf sheet (T-438).

## Suggested order, if the owner wants any of it

1. **Before the in-flight tasks resume:** settle items 1 and 2.
2. **One small "flavour pass" task:** items 3, 4, 5, 6, 9 and 10. They are all small, each touches only runecraft code, and none moves the instruments without runecraft in play. Item 3 only moves the caster arena.
3. **A "remains and venom" task:** items 7 and 8, and maybe 11. These are content plus one effect kind.
4. **Later, if wanted:** items 12, 13, 14 and 17, each as its own task with a measurement.

Every number above is a suggestion, not measured.
