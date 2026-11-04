# Flavour left out: fun mechanics cut or about to be cut

**Date:** 2026-11-03 · **Asked by:** the owner, after T-485 ("not all the enchantments have to be a strict improvement") · **Kind:** review, no code changed

## The question

The owner asked: during this stretch of work, did we drop or soften a mechanic that was fun, funny, goofy, interesting or gave the game character?

## Short answer (runecraft stretch)

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

## Before runecraft (added the same day, at the owner's request)

### Are the logs good enough to look back?

Yes. The record goes back to the first day (2026-09-17):
- 288 archived tasks in `docs/archive/tasks/`, each with its decisions;
- 17 fix files and the build-plan milestones in `docs/archive/`;
- the resolved decision rows in `docs/archive/decisions-archive.md`;
- 102 audits in `reports/audits/`;
- the git history.

**Method and its limit:** I searched all of these for removed, replaced or softened rules, and read the ones that touched play. I did not read all 288 tasks in full.

**What the logs show:** the game was built spec-first. Most design choices, including what to leave out, were made before any code, in `00-vision/vision.md` and `scope.md`. After that, almost all work was making the code match the spec, fixing bugs and tuning balance. So most of the character cuts are early, deliberate exclusions with a pillar behind each one. Few cuts were made along the way.

### Cut along the way, before runecraft

| # | Mechanic | Where | Reason | Flavour lost? |
|---|---|---|---|---|
| 18 | **A dwarf holding a doorway.** A creature standing in a door stopped every walker, so one soldier could hold a door | T-457, the owner's call (2026-10-31) | Jobs stuck behind a pet in a doorway. The owner wanted shared tiles with crowding instead | Some. The "hold the door" moment is now only a slowdown. Doors still keep out wild and large animals, and hostiles without `opensDoors`. A small way back: a soldier *on duty and stationed* on a door tile still stops hostile walkers, while everyone else passes |
| 19 | **Obsidian and bone blades** | T-460 | No recipe made them | Yes; this is item 11 above |
| 20 | **Swells on flat (relief 0) maps** | T-436 | They moved the instrument | No: no generated region is relief 0 since the rescale |
| 21 | **Floods that generation caused** | T-449 | Dwarves drowned at the bank on day 1 | No: it was a bug. A flood the player makes still works |
| 22 | **Long bleeding from light cuts** | T-404 | Combat ran far slower than the model; a light cut now clots in 150 ticks | Little: serious wounds still bleed and need a medic |
| 23 | **Dwarves burned where they stood in a wildfire** | T-397 | They now flee a burning tile | No: it read as a bug, not a story |
| 24 | **A dwarf sheet, intro chapter cards and zooms** | T-438, T-434 | The owner's calls | Not mine to weigh |

**Kept or added along the way, with character:**
- a restless dead that collapses at dawn drops its sword (T-351);
- a fed wolf pack lets its quarry go (T-220);
- frostmarrow maps bring wild yaks and more snow leopards (T-445);
- personality-driven sulks: a day off, an argument, weeping at the hearth, hoarding, a broken chair.

### Excluded on purpose at the start (vision and scope)

These are the big ones. Each was cut for a pillar ("legible depth", "a forgiving fortress"), not for cost alone, and most left a hook in place. They are genre staples, so any that comes back must be *our own* design, not a copy of another game's.

| # | Excluded | Reason in `scope.md` | Hook left | A version that fits the pillars |
|---|---|---|---|---|
| 25 | **Tantrum spirals** | "Failure is a setback with a story, never a spiral" | **Sulks**, already in, with personality | Already done well. Possible extra sulk kinds: a sulker who paints the wall, or sings badly all night (a mild `kept_awake` thought for neighbours) |
| 26 | **Nobles, mandates, justice** | "Source of unforgiving spirals" | Positions exist (Thane, Warden, Broker, Chief Medic) | A Thane with *whims*: an occasional wish ("a silver goblet in the hall by autumn") that gives everyone a pride thought when met, and nothing worse than a grumble when missed. All character, no spiral. Medium |
| 27 | **Cave-ins of natural rock** | "Punishing and opaque" | Constructions need support | A legible version: an over-wide unsupported span *creaks* (an announcement and a mark on the map) for a day before it falls, and the fall only drops rock. Medium to high |
| 28 | **Aquifers** | "Frustrating for new players" | A layer-feature slot in generation | A *damp layer* as a region trait, named in the embark summary: tiles in it seep one water level now and then. It is a puzzle and a free well. Medium |
| 29 | **Flying creatures** | Pathfinding cost | A `fly` bit reserved | Cave bats as harmless ambience, flying only inside a cavern's open air, with a little guano for farms. Medium |
| 30 | **Diseases beyond infection** | Scope | Health's `condition` list | One readable illness, such as "cave cough" from living beside refuse, cured by a clean hall. Medium |
| 31 | **Siege engines, ladders, digging enemies** | "Defence would need rework" | A `breach` behaviour slot in raider AI | Digging enemies are the most exciting of these, but also the costliest. They undo the meaning of walls. High; only with a design of its own |
| 32 | **World history and legends** | Cost far over value | Civilisations have fixed personalities | The fortress's own Legend screen already tells its story. Low priority |
| 33 | **Swimming** | Complexity | Deep water is impassable, with drowning damage | Little flavour to gain |

### Related, still open

**T-466: a raid is never repelled in measured play.** Only small unannounced parties are ever driven off. Announced raids always loot, even against a built kill corridor. A decisive defence is one of the most satisfying stories a fortress game tells, and today it does not happen. The owner was asked on 2026-11-01 whether a well-armed squad should be able to beat a raid. That answer decides whether T-466 becomes a balance task.

## Suggested order, if the owner wants any of it

1. **Before the in-flight tasks resume:** settle items 1 and 2.
2. **One small "flavour pass" task:** items 3, 4, 5, 6, 9 and 10. They are all small, each touches only runecraft code, and none moves the instruments without runecraft in play. Item 3 only moves the caster arena.
3. **A "remains and venom" task:** items 7 and 8, and maybe 11. These are content plus one effect kind.
4. **Later, if wanted:** items 12, 13, 14 and 17, each as its own task with a measurement.

Every number above is a suggestion, not measured.
