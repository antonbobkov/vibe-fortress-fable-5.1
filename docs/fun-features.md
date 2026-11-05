# Fun features

Mechanics kept or added for character: they make a story, a laugh or an odd moment, not a stronger fortress. The owner asked for them (2026-11-04): "Incorporate some of those fun magic-related features back ... log these features as fun features, subject for removal if they mess up game logic too much. Generally, keep an eye out for such fun mechanics in the future."

**The rule for this list.** Each entry is a real rule in the spec and is tested like any other. Each is also marked removable: if one breaks game logic (a stuck job, a broken invariant, a set survival rule that no longer holds, an unreadable outcome), the fix may be to remove it instead of patching around it. Removing one is a spec edit plus its code; the entry says where it lives. A trade-off that only makes things worse sometimes is not a reason to remove it (see T-485).

**Keep an eye out.** When a task finds a goofy, funny or characterful behaviour, report it as such. Do not file it as a fault to tune away unless it breaks something above. When a task would cut such a behaviour for cost, say so, so it can be weighed.

Sources: the [flavour report](../reports/audits/2026-11-03-flavour-left-out.md) (items numbered there), and the owner's own examples.

## In the game

| Feature | What happens | Spec | Remove by |
|---|---|---|---|
| Fearsome is a trade-off | A frightened foe runs, soldiers chase it and swing less; a squad with fearsome axes can do worse in the open | [25](02-systems/25-runecraft.md) § Enchantments | Not removable by this rule: the owner's call (T-485) |
| Stoutness against bleeding | A draught of stoutness halves pain and does nothing for a soldier who is bleeding out | 25 § Draughts | Owner's view on trade-offs; keep |
| Daze on a captain | A runecaster can stun a raid's captain again each time it wakes | 25 § Spells | T-477's balance pass may limit it |

## Planned

| Feature | Task | Report item |
|---|---|---|
| Careless shooters: a shooter below Proficient sometimes fires through an ally on the line; goblin archers pepper their own front, apprentices singe their own squad, veterans are careful | [T-483](work/T-483-marksdwarf-friendly-fire.md) | 1, 3 and the owner's example |
| Pets pile on a favourite spot by the hearth, off the main path | [T-482](work/T-482-tame-animal-stale-walk.md) | 2 |
| Runecraft flavour pass: `rune_sick` from a desperate fourth vial; `dosed_again` from an early second calming draught; `blaze` sets the target's tile alight; `saw_wisp`; the firebloom's flash; a turned shade that hides; `lab_stink` after a spoiled batch; the Wildwood offended by staffs | [T-491](work/T-491-runecraft-flavour-pass.md) | 4, 5, 6, 9, 10, 14, 15, 16 |
| Remains and venom: `venomed` blades from giant cave spider venom; the ember newt's gland as an `ember` stone; knapped obsidian and bone blades | [T-492](work/T-492-remains-venom-and-knapped-blades.md) | 7, 8, 11 |
| Hexers cast Dread on dwarves, and `calm` armour answers it (drop if too complex) | [T-493](work/T-493-hexer-dread-and-calm-armour.md) | 12 |
| `glowing` armour lights the wearer's 3×3, and glowcap grows under a glowing dwarf standing still (drop if too complex) | [T-494](work/T-494-glowing-armour-lights-the-wearer.md) | 13 |
| A dead runecaster's wand among an old battlefield's arms (drop if too complex) | [T-495](work/T-495-wand-on-an-old-battlefield.md) | 17 |

## Candidates, not yet planned

Worth doing, at more cost. Each would be its own task with a measurement.

| Feature | Report item | Why not yet |
|---|---|---|
| Thane's whims, a creaking span before a fall, a damp layer, cave bats, cave cough | 26 to 30 | Each needs a design of its own |

## Declined

| Feature | Report item | Why |
|---|---|---|
| A soldier stationed on a door tile holds it against hostile walkers | 18 | The owner said no (2026-11-04); doors stay as T-457 left them |
