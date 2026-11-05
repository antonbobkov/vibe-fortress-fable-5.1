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
| `rune_sick`: a desperate fourth vial | A caster with three vials drunk and its foe beside it drinks a fourth for half the rune: "Too much rune. My teeth hum." | 25 § Vials; thought in `personality-and-thoughts.md` | The fourth-vial branch of `drinkVial` (`magic/cast.ts`), `SICK_VIAL_PERCENT`, `VialDrunk.sick`, the `rune_sick` row and its case in `morale/thoughts.ts` |
| `dosed_again` | The medic waits only the 3-day draught rest; a second calming draught within 7 days eases half as much and grumbles: "Another draught. I am tired of draughts." | 25 § Draughts | `again` in `drinkDraught` (`magic/draughts.ts`), the half in `baseValue` (`morale/thoughts.ts`), the `dosed_again` row; put the calming rest back in the producer's `stillWanted` |
| `blaze` lights the tile | A blaze hit sets the struck creature's tile alight 2% of the time, if it can burn: your own wooden floor too | 25 § Enchantments in combat (`ignite`); 05 § Fire, Ignition | The `ignite` effect on the `blaze` row (`weapons-and-armor.md`) and `igniteOnHit` in `magic/cast.ts` |
| `saw_wisp` | Dwarves who see a wisp appear, called or loose, within 8 tiles: "Saw a light that was not a lamp.", once a day | 25 § Summons; 15 § Thoughts | `WispAppeared` in `magic/summon.ts`, the `saw_wisp` row and its cases in `morale/thoughts.ts` and `morale/index.ts` |
| The firebloom's flash | A bloom's 3×3 shows in ember orange for one animation frame | 25 § Player-facing behavior | `SpellBloomed` in `magic/index.ts` and `bloomOver` in `render/compositor.ts` |
| A turned shade hides | A deep shade that comes through turned arrives stealthed, like a hollow stalker, until spotted. Its caster beside it usually spots it at once | 25 § Summons, Turning; 18 § The Deep | The `hidden` argument of `spawnedHollowBorn` (`threats/deep.ts`, `threats/index.ts`) |
| `lab_stink` | After a spoiled batch, dwarves who pass within 3 tiles of that laboratory the rest of the day: "The laboratory stinks." | 25 § Draughts, Spoiled batch; 15 § State | `spoiledBatch` and `stinkThoughts` in `morale/index.ts`, `LAB_STINK_TILES`, `labStinks`, the `lab_stink` row |
| The Wildwood and staffs | A wand or staff offered to the Wildwood is a wooden item: −2 reputation each and a fifth of its value | 25 § Trade and value; 20 § The session | `tradeClass` in `trade/valuation.ts` |
| Glowing armour lights the wearer | A piece set with glowstone lights the 3×3 around its wearer for a glowcap, as a lamp does: a glowcap whose lamp is gone grows while a glowing dwarf stands beside it, and stops when they walk on. The view tints the 3×3 in dim cyan. It is no lamp for anything else (no `lit` flag, no glow plot) | [07](02-systems/07-plants-and-farming.md) § Growth `lightOk`; 25 § Enchantments in combat `light`, § Player-facing behavior | Removable: drop the `light` effect from the `glowing` row in weapons-and-armor.md, the `wornLightAt` call in `plants/index.ts` `grow`, and `indexGlow`/`glowOver` in `render/compositor.ts` |
| Careless shooters | A shooter with an ally on its line holds, unless it is careless this time: 50% at skill 0, 5% less a level, never from Proficient. Raid archers (skill 6) pepper their own front, apprentice casters singe their squad, Novice marksdwarves and hunters shoot past their own, veterans hold | [16](02-systems/16-combat.md) § Ranged resolution, Held shot; 25 § Casting | `carelessThisTime` in `combat/clear-shot.ts` and `CARELESS_*` in 16; with them gone every shooter always holds |

## Planned

| Feature | Task | Report item |
|---|---|---|
| Pets pile on a favourite spot by the hearth, off the main path | [T-482](work/T-482-tame-animal-stale-walk.md) | 2 |
| Remains and venom: `venomed` blades from giant cave spider venom; the ember newt's gland as an `ember` stone; knapped obsidian and bone blades | [T-492](work/T-492-remains-venom-and-knapped-blades.md) | 7, 8, 11 |
| Hexers cast Dread on dwarves, and `calm` armour answers it (drop if too complex) | [T-493](work/T-493-hexer-dread-and-calm-armour.md) | 12 |
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
