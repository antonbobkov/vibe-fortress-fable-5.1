# Runecraft — a magic system for Deepholm

**Status:** design proposal, not in the specification · **Would become:** `02-systems/25-runecraft.md` plus rows in `03-content/` · **Depends on:** 07 Plants, 12 Workshops, 13 Items, 14 Buildings, 15 Morale, 16 Combat, 17 Health, 18 Threats, 20 Trade

> *Everything in the Deep that shines has a little rune in it. Glowstone. The beetles. The pale metal most of all.*

## Why this fits a game that said no to magic

`scope.md` leaves magic out "for tone". The tone it protects is understatement: dwarves who dig, smelt and brew, and a world that does not care about them. Runecraft keeps that tone by treating magic exactly as the game treats metal. Rune is a substance. It grows in a fungus, is distilled at a workshop, is carried in vials, and is spent. A staff is a stone on a stick, and it does nothing in the hands of a dwarf who holds no rune of their own. An enchantment is a stone a smith sets into a blade. A runecaster is a dwarf who sat in a stone room with a sack of mushrooms for a year and came out able to hold a little rune, which comes back slowly and runs out in a fight. The dwarves do not say *wizard*. They say *runecaster*, the way they say *runesmith* or *brewer*.

Three design limits keep the tone:

- **The player never casts a spell.** They choose which stone goes on the staff, who sits in the sanctum, and which squad carries what. The dwarf decides when to cast, by rules the player can read. This is stewardship (pillar 1).
- **Nothing is necromancy.** No raising, no undead, no curses, no vampires. The summons are a light, a stone and a shadow, and they fade by morning. The restless dead of the Old Battlefield stay a trait, not a tool.
- **Magic trails steel.** A deepsilver axe out-damages the best staff. Runecraft's worth is reach and utility: a ward on the line, a wound closed at range, a raid that loses its nerve. It is the sixth squad member who makes the other five better, not a replacement for a gate.

And three things it is for (pillar 3, stories): a firebloom that singes your own axedwarves, an apprentice who sets the sanctum's oak lectern alight, and a shade called with a deepsilver staff that turns out to answer to something else.

## The vocabulary

| Term | Meaning |
|---|---|
| **Rune** | The game's mana. A substance, measured in units. Lives in glowcap, vials, glowstone, deepsilver, and trained dwarves. Only a dwarf's own rune is ever spent on a spell. |
| **Glowcap** | A cave fungus that grows only in the dark under a glowstone lamp. The crop of the magic economy. |
| **Rune vial** | The portable unit: a stackable item. Spent at the runeforge to set stones, at the laboratory to brew draughts, or drunk by a runecaster whose own rune is gone. |
| **Stone** | A cut gem set in a staff or an item. The stone fixes which spell the staff casts or which enchantment the item carries. The gem *is* the spell. |
| **Staff, wand** | Channels. A launcher whose projectile is a spell and whose only fuel is the caster's rune. A wand is one-handed and casts softly; a staff is two-handed, shod with metal, and casts hard. |
| **Runecaster** | A dwarf with the `runecraft` skill: the only dwarf who can cast. Holds rune of their own, which comes back slowly with time or at once from a vial. |
| **Sanctum** | The room where apprentices attune: a rune circle, a chest of glowcap, and a chance of a mishap. |
| **Runesmith** | Works the runeforge: makes staffs, robes and circlets, and sets stones in weapons, armor and ammunition. |
| **Alchemist** | Works the laboratory: distills vials and brews draughts. |
| **Draught** | A potion. Drunk by soldiers under rules per draught, or given by a medic, at most one every few days. Never found by a thirsty dwarf. |
| **Ward** | A temporary fifth armor layer laid on allies by a spell. |

## The loop in one paragraph

Find glowstone in a cavern wall. Cut it into a lamp, and under the lamp plant glowcap from seeds gathered in the deeper caverns or bought from the Mountainhome. Build an alchemist's laboratory and distill the harvest into vials. Draw a sanctum in stone, put a rune circle in it, and assign two apprentices; after a month of mushrooms and singed beards each holds a little rune of their own. Build a runeforge beside the forge and set a cut gem in a yew staff: garnet throws embers, quartz lays a ward, emerald closes wounds. Give the staff to an apprentice in a squad, and they cast until their rune is gone, drink a vial, cast a little more, and then swing the staff like a stick until they have slept two nights. A year on, the hall has a Proficient runecaster with enough rune for one hard fight. Meanwhile the runesmith sets stones in the squad's axes and mail, and the alchemist brews draughts the soldiers drink when the raid horn sounds, one each and no more for three days. When the player mines deepsilver, the richest rune of all is theirs to quench into vials or shoe a staff with, and the Hollow notices that too.

## Where it sits in the fortress arc

| Years | What opens | Why then |
|---|---|---|
| 1–2 | Glowstone in cavern 1; the first lamp; a glowcap patch; the laboratory; a sanctum and its first apprentices | Glowstone is a cavern-1 gem; a lamp is a jeweler's job; seeds come from caravans and wild patches; a rune circle costs one vial |
| 2–3 | The runeforge; a wand of embers for the first apprentice in the squad; the first stones set in the squad's iron | Needs an anvil, cut gems and a steady vial supply; an apprentice at level 2 holds ten rune |
| 3–4 | A runecaster at Proficient with a shod staff; wards and mending in raids; draughts in the squad's kit; the first summoning | A year of attunement; rare gems from deeper rock |
| 5+ | Deepsilver-shod staffs; `deep` and `hollowbane` settings; wyrmscale; the deep shade | The Deep arc; every step raises the Deep gauge |

Runecraft opens at the same pace as metal and stays a step behind it. Nothing in it is required: a fortress that never cuts a glowstone plays the game as it is today.

---

## Rules

### 1. The rune economy

#### Glowcap (07 Plants; a new `light` value)

| id | name | kind | stageDays | light | minC | maxC | yield | yieldItem | value | edible | cookable | brew | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `glowcap` | glowcap | cave_crop | 6 (24) | `glow` | 2 | 40 | 2–3 | `plant_food` (glowcap) | 6 | no | no | — | `♠` | `rune_cyan` |

`light: glow` is a fourth light value: the tile has no crop light **and** lies in the coverage of at least one glowstone lamp (14 already keeps the lamp coverage count per tile). One lamp covers its 3×3; the lamp's own tile is a building, so a lamp opens eight glowcap tiles. The plot UI counts a plot with any `glow` tile as a cave plot and offers glowcap only when every tile of the plot is lamp-lit.

Wild: `glowcap_patch`, product `plant_food` (glowcap) 1–2, regrow 30 days, `wildSeedPermille` 400, seed of `glowcap`; cavern 1 (10), cavern 2 (20), cavern 3 (25). The Mountainhome caravan sells glowcap seeds from year 2.

Glowcap is not food and no cook or brewer touches it. Eaten raw in desperation it gives `ate_raw_food` and nothing else.

#### Rune vials (13 Items)

| id | name | category | material | mult | stack | container | glyph | fg |
|---|---|---|---|---|---|---|---|---|
| `rune_vial` | rune vial | `medical/vial` | `rune` (class liquid, value 15) | 1 | 20 | bag | `¡` | `rune_cyan` |

A vial is spent three ways: at the runeforge, where the smith pours it into an enchantment, a robe or a circlet; at the laboratory, where the alchemist brews it into a draught; and down a runecaster's throat, where it gives `VIAL_RUNE` units at once. A vial is never ammunition and never fired. It does not rot.

#### The alchemist's laboratory (12 Workshops; new workshop `alchemist`, labor `alchemy`, skill `alchemy`)

Build: 1 `table` + 2 `stone_block` + 1 `bucket`; construction; 250 ticks. Fully passable 3×3.

| id | name | inputs | outputs | ticks | Q | xp | notes |
|---|---|---|---|---|---|---|---|
| `distill_rune` | Distill rune | 2 plant_food (glowcap) | 1 rune_vial | 150 | no | 6 | the staple |
| `grind_glowstone` | Grind glowstone | 1 rough_gem (glowstone) | 4 rune_vial | 200 | no | 8 | a lamp forgone |
| `quench_deepsilver` | Quench deepsilver | 1 bar (deepsilver) | 12 rune_vial | 250 | no | 12 | emits `DeepsilverWorked`: Deep pressure +10 |
| `render_ichor` | Render ichor | 1 hollow_ichor | 6 rune_vial | 200 | no | 10 | violet; the same vial |
| draughts | § 5 | | | | yes | | |

#### Arithmetic

One lamp block of eight tiles yields `8 × 2.5 / 24 = 0.83` glowcap a day, which is `0.42` vials a day. Four lamps give `1.7` vials a day, about 47 a season and 190 a year. Against that: an enchantment costs 4 to 12 vials; a draught batch costs 1 or 2; a runecaster who runs dry in a raid drinks 2 or 3; each attunement session eats a glowcap (two sessions a day per apprentice), which is the largest sink. A fortress that wants two runecasters *and* an enchanted squad wants about five lamps. At wealth 2 a map holds about 27 rough glowstone in three clusters, so the limit is seeds and patience, not stone; at wealth 0 it is glowstone, and that is the wealth axis doing its job.

### 2. Staffs, wands and spells

#### The runeforge (12 Workshops; new workshop `runeforge`, labor `smithing`, skill `runesmithing`)

Build: 1 `anvil` + 3 `stone_block` + 1 `cut_gem` (any); masonry; 300 ticks. Four corners impassable like a forge. It burns no fuel: rune is its fire. Every recipe here but the staffs consumes vials instead.

| id | name | inputs | outputs | ticks | Q | xp |
|---|---|---|---|---|---|---|
| `make_wand` | Wand | 1 log + 1 cut_gem | 1 wand (wood; stone = the gem) | 200 | yes | 10 |
| `make_staff` | Staff | 1 log + 1 cut_gem + 1 bar | 1 staff (wood, shod; stone = the gem) | 300 | yes | 12 |
| `make_rune_robe` | Runed robe | 3 cloth (sporecloth) + 2 rune_vial | 1 rune_robe | 250 | yes | 12 |
| `make_circlet` | Circlet | 1 bar (silver, gold, electrum, platinum or deepsilver) + 1 cut_gem + 2 rune_vial | 1 circlet | 220 | yes | 10 |
| `set_weapon` | Set a stone in a weapon | 1 weapon (melee) + 1 stone + N rune_vial | the same weapon, enchanted | 300 | yes | 15 |
| `set_armor` | Set a stone in armor | 1 armor piece + 1 stone + N rune_vial | the same piece, enchanted | 300 | yes | 15 |
| `set_ammo` | Set a stone in ammunition | 1 stack of ≤ 25 bolts or arrows + 1 stone + N rune_vial | the same stack, enchanted | 200 | yes | 10 |

Setting is the one new recipe shape: the first input is *kept*, not consumed, and the output is that item changed (a `transform: true` flag on the recipe row). A work order for a setting takes a material filter on the weapon as today, and a new *item filter*: "the best unenchanted axe in stock" by default, or a specific item clicked in the stocks panel.

#### Channels (03-content/weapons-and-armor.md)

| id | name | class | skill | range | power | size | hands | materials | mult | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| `wand` | wand | staff | `runecraft` | 8 | 0.7 | 3 | 1 | wood haft, gem stone | 10 | may be used with a shield |
| `staff` | staff | staff | `runecraft` | 12 | 1.2 | 7 | 2 | wood haft, gem stone, metal shoe | 14 | power × the shoe's `runeMult` |

A staff or wand holds nothing. It is the shape the caster's rune takes on its way out: the wand quick and soft, the staff slow and hard. Used in melee it is a club at half damage with the `hammer` skill, as any launcher is. Yew gives +10% power as it does for bows.

`runeMult` is a new column of the metals table: silver 1.3 (silver finally has a fight in it), deepsilver 1.6, steel 1.1, iron 1.0, bronze 0.9, copper 0.8, every other metal 0.7. A wand has no shoe and no `runeMult`.

#### Who can cast

Only a dwarf with `runecraft` at 1 or more, and only from their own rune (§ 3). A squad member with `runecraft` claims the best staff or wand of the preferred class by `power × runeMult × qualityMultiplier`, as a swordsdwarf claims the best sword; a dwarf with no `runecraft` never claims one, because it would be a stick. The squad panel shows a staff beside a member's name only when they can use it.

#### Spells by stone

The gem on the staff is the whole spell list. There are eight gems in the game and eight spells. Their rarity is the gem's rarity, already set by geology and wealth.

| Stone | Spell | Kind | Cost | Range | Effect at power 1.0 | Cast when |
|---|---|---|---|---|---|---|
| quartz | **Ward** | aura on allies within 3 | 2 | self | a `ward` armor layer of 6 on every part for 600 ticks | a hostile is in perception and the caster's ward has lapsed |
| garnet | **Emberbolt** | bolt | 1 | 10 | 18 `burn` | the ordinary ranged attack |
| amethyst | **Frostbind** | bolt | 1 | 10 | 8 `frost`; on a hit that does damage, slowed 50% for 300 ticks | the ordinary ranged attack |
| emerald | **Mend** | touch within 4 | 2 | 4 | every bleeding wound `bandaged`; light wounds removed; `cleaned` | an ally within 4 is bleeding or unconscious from wounds; before attacking |
| sapphire | **Dread** | aura on hostiles within 4 | 2 | 4 | up to 4 hostiles flee from the caster for 400 ticks; Willpower resists | two or more hostiles within 4; once per 400 ticks |
| ruby | **Firebloom** | burst, 3×3 at the target | 3 | 8 | 14 `burn` to every creature in the square, allies included | the ordinary ranged attack, only if no fortress creature stands in the square |
| diamond | **Daze** | single target | 3 | 6 | the target does nothing for 150 ticks and is hit as if unconscious; Willpower resists | the target is the party's captain, a trollkin, or anything of size ≥ 100 |
| glowstone | **Call** | summon beside the caster | 3 | self | one summon by the staff's shoe (§ 6), for one day | a hostile is in perception and the caster has fewer than 2 summons alive |

**Power** is what the staff adds. `effective = base × launcher.power × runeMult(shoe) × qualityMultiplier(launcher)` applies to the damage of Emberbolt, Frostbind and Firebloom, to the ward's armor, and to the ticks of Frostbind's slow, Dread's flight and Daze. Mend's healing and Call's summon do not scale; Call's summon is chosen by the shoe instead. A wand casts every spell at 0.7; an iron-shod staff at 1.2; a silver-shod fine staff at `1.2 × 1.3 × 1.1 = 1.7`. The cost in rune is the same whatever the channel.

Rules shared by all spells:

- **Hit roll for bolts** is 16's ranged roll with `runecraft` as the launcher skill; a bolt is a projectile and can hit something in the way. Auras and touches do not roll. Mental spells (Dread, Daze) are resisted with `Willpower / 2` percent (creatures without attributes: 25%); creatures of size ≥ 180 and every `deep` creature ignore them.
- **Armor is subtracted** as for any hit, with the new rows of the damage-type table below. No Strength term.
- **Rune, then a vial, then a stick.** A cast spends the caster's own rune. With less than the cost, the dwarf drinks a vial if they carry one (§ 3); with none, the staff is a club until rune returns.
- **Cooldown** follows the weapon rule from the launcher's size: about 26 ticks for a staff, 14 for a wand. A wand throws more bolts in a fight; each is weaker.
- **Friendly fire is real.** Firebloom burns dwarves. A bolt can hit the axedwarf in the way. The dwarf follows the rule in the "cast when" column; the player who wants no risk gives no ruby staffs.
- **Fled by Dread** means the hostile runs from the caster, not for the map edge, and resumes when the time is up. It does not count toward a party's retreat losses.

New damage types `burn` and `frost` join `edge`, `blunt`, `pierce`. 17 already has `burn` and `frost` wound types (fire, lightning, heat stroke, frostbite). The damage-type-versus-layer table gains two rows and one column:

| Type \ Layer | padding | leather | mail | plate | **ward** |
|---|---|---|---|---|---|
| edge | 0.6 | 0.8 | 1.2 | 1.1 | 1.0 |
| pierce | 0.4 | 0.6 | 0.8 | 1.2 | 1.0 |
| blunt | 1.2 | 1.0 | 0.5 | 0.9 | 1.0 |
| **burn** | 0.3 | 0.6 | 0.4 | 0.8 | 2.0 |
| **frost** | 1.0 | 0.8 | 0.3 | 0.5 | 2.0 |

Read it like this: mail is a poor answer to embers and frost (it conducts), plate is a fair one, a cloak is a good one against cold, and a ward is best of all against rune. An emberbolt from an iron-shod staff (22) does 19 to a goblin in a leather jerkin, 17 through an iron mail shirt, and 4 against a steel breastplate; from a wand (13) it does 10, 8 and 0. Steel still matters.

#### Worked numbers

- **Emberbolt vs the peril-2 raid.** A Proficient runecaster with an iron-shod common staff at range 6 against a raider with dodge 6: hit `40 + 30 − 12 − 12 = 46%`; `18 × 1.2 = 22` burn against a warrior's leather jerkin (5 × 0.6 = 3) → 19 to the torso, ratio 0.35, a serious burn. Fifteen casts in a 400-tick fight, seven hits, three warriors in the hospital or dead, and 15 of the caster's 50 rune gone. That is a Proficient marksdwarf with iron bolts (21 a hit), with no quiver to fill and two days of sleep to pay afterwards. The spell's edge is that mail does not stop it. The same dwarf with a wand: 13 a bolt, a bolt every 14 ticks, 28 casts and the whole tank spent for about the same damage done.
- **Ward on the line.** Six soldiers warded for 600 ticks at a cost of 2. From an iron-shod staff the ward is `6 × 1.2 = 7`; a copper short sword (14 raw) against a warded bare leg does 7 instead of 14: a light cut instead of a serious one. A Proficient runecaster walks into a raid with 50 rune: five wards and a dozen bolts, and then a vial. This is the spell that changes measured outcomes most, and it is the common one.
- **Deepsilver masterwork staff of embers**: `18 × 1.2 × 1.6 × 1.5 = 52`. A deepsilver masterwork great axe does 72. Steel keeps the top of the table.

### 3. Runecasters: the skill, the rune, the sanctum

#### Skills and labors (03-content/skills-and-professions.md)

| id | name | labor | profession | military | attributes | used by |
|---|---|---|---|---|---|---|
| `runecraft` | Runecraft | `attunement` | Runecaster | Runecaster | Willpower, Wits | casting; attunement; rune maximum |
| `runesmithing` | Runesmithing | `smithing` | Runesmith | — | Agility, Wits | runeforge recipes |
| `alchemy` | Alchemy | `alchemy` | Alchemist | — | Wits, Agility | laboratory recipes |

`runecraft` is the only skill that is both a labor skill (attunement sessions) and a combat skill (the staff's hit roll). It gains xp from sessions, from casts (+3 per cast, +1 per miss) and from drills at the barracks (half `TRAIN_XP`, no rune spent). Profession colors: runecraft and runesmithing join Metal (`prof_steel`); alchemy joins Hearth (`prof_orange`).

#### Rune of one's own

Every dwarf has a `Rune { current, max, regenPerHour }`:

```
max          = runecraft level × RUNE_PER_LEVEL + circlet bonus            // level 0: none; level 10: 50; level 20: 100
regenPerHour = runecraft level × RUNE_REGEN_PER_LEVEL × robe bonus × metal penalty   // level 10: 1 an hour, 24 a day
metal penalty = max(20%, 100% − 20% per worn mail or plate piece of metal)   // "iron drinks the rune"
```

Rune comes back on the hour and slowly: a runecaster of any level refills from empty in about two days, since the maximum and the rate both grow with the level. A raid lasts a few hundred ticks, a few hours, in which a runecaster regains a cast or two. What they walk in with is what they have. The inspector shows it as a bar with the breakdown in words: "Rune 31/50, +0.9 an hour (robe +50%, iron helm −20%, iron mail −20%); full tomorrow". A runecaster in full plate casts the same spells and refills at a crawl; the robe-or-mail choice is the whole build decision, and it is on the item.

#### Drinking vials

A runecaster carries `CASTER_VIALS` (3) rune vials, claimed at the re-equip check like a draught. When their rune falls below their staff's spell cost and a hostile is in sight, they drink one: `DRINK_TICKS`, during which they neither cast nor move, and `VIAL_RUNE` (5) units, capped at their maximum. A dwarf's body takes `VIALS_PER_DAY` (3) in a day; a fourth gives the thought `rune_sick` (−4, "Too much rune. My teeth hum.") and nothing else, and the dwarf stops drinking. So a Proficient runecaster has 50 rune and 15 more in the pouch for a day: enough for one hard fight, not for two. A dwarf with no `runecraft` has no maximum and never drinks.

#### The sanctum (14 Buildings; a new room type)

- Zone `sanctum` (room): requires a `rune_circle` inside and a `chest`. Settings: `apprentices: dwarfId[]` (at most `SANCTUM_APPRENTICES`), `wants { glowcap: n }` (the chest is stocked like a hospital's, 13 § Containers in play).
- Building `rune_circle`: 1×1 on floor; inputs 3 `stone_block` + 1 `rune_vial`; masonry; 200 ticks; tag `rune_circle`; value 20; impassable; glyph `◊` in `rune_cyan`.
- Room tier counts: the sanctum's furniture, smoothing and engraving raise its tier as any room's. Each tier above bare adds 5% session xp and takes 1% off the mishap chance. A fine sanctum is a safer one.

#### Attunement (the `attune` job)

Each day, each apprentice with runecraft below 20 may take `ATTUNE_SESSIONS_PER_DAY` sessions: labor `attunement`, skill `runecraft`, target the rune circle, input 1 glowcap from the sanctum chest or any stockpile, work `ATTUNE_TICKS` at the circle, xp `ATTUNE_XP` (Wits-scaled as any job). An apprentice is an ordinary dwarf between sessions: they haul, farm, fight. The player can make the apprentice a full-time student by turning off their other labors, as with any dwarf.

At `ATTUNE_XP` 50 and two sessions a day: Dabbling (level 1, 5 rune) after the first day; Novice (level 2, 10 rune) in three; Proficient (level 10, 3,700 xp) in about 37 days and 74 glowcap; Legendary in about 134 days and 268 glowcap. An apprentice can hold a wand in the squad after a week; a runecaster is a one-year project and a Legendary one a two-year one, which fits a fortress of five to ten years.

The thought `attuned` (+2, 12 hours) ends every session that goes well. The first dwarf to reach runecraft 10 gives everyone `first_runecaster` (+4, 72 hours, announced): "We have a runecaster in the hall."

#### Mishaps

Each session ends with one roll: `mishap = max(MISHAP_FLOOR, MISHAP_BASE − 2 × level − sanctum tier)` per mille. At level 0 in a bare stone room that is 6%; a Proficient apprentice in a fine sanctum rolls under 4%. A mishap is drawn from the table by weight. None kills, none takes a limb, none touches a stockpile; the worst is the price of a chair, which is pillar 2's ceiling.

| Mishap | Weight | What happens | Text |
|---|---|---|---|
| `singed` | 40 | a light `burn` on a random arm; thought `singed` (−3, 24 h) | "Singed my beard in the sanctum." |
| `blackout` | 25 | the apprentice passes out where they stand for 200 ticks (no patient admission) | "Ketil Ironvein has fallen over in the sanctum. The rune got away from them." |
| `scorched_circle` | 15 | the rune circle is destroyed and must be rebuilt (`BuildingRemoved`, no item returned) | "The rune circle is scorched black. It will have to be cut again." |
| `wisp_loose` | 10 | a wild, timid `wisp` appears beside the circle, wanders, and fades in a day; everyone who sees it gets `saw_wisp` (+2) | "A light that was not a lamp drifted out of the sanctum." |
| `fire` | 7 | if a wooden construction or wooden furniture is cardinal to the circle, it ignites through 05's ordinary ignition; else nothing | the fire's own alert |
| `surge` | 3 | every creature within 3 takes a light `burn`; the apprentice gains the session's xp twice | "The rune surged. Everyone near the circle felt it." |

The hint writes itself: "Build the sanctum in stone." Mishaps are notes except the fire and the scorched circle, which are alerts.

### 4. Enchantments

A stone set in an item fixes `Item.enchant = { id, tier }`. One enchantment per item, permanent; melting an enchanted item returns bars only. `tier` is the runesmith's quality roll (poor … masterwork), and its multiplier (0.8 … 1.5) scales the enchantment's number. The item's name grows a suffix the player reads at a glance: *iron battle axe of embers (fine)*. The value grows by `stone value × 3 + vials × 15`, so a diamond in a steel axe is worth selling and worth raiding for; wealth and renown follow as they do for any goods.

#### Weapons

| Stone | Enchant | Vials | Effect at common tier |
|---|---|---|---|
| quartz | `keen` | 4 | +10% damage |
| garnet | `ember` | 6 | on a hit: +8 `burn` to the same part, rolled against armor on its own |
| amethyst | `rime` | 6 | on a hit: slowed 30% for 200 ticks |
| emerald | `sure` | 6 | +10 to hit |
| sapphire | `fearsome` | 8 | on a hit: 25% the target flees for 200 ticks (Willpower resists; never `deep`) |
| ruby | `blaze` | 10 | on a hit: +14 `burn`; 2% the target's tile ignites if it can burn |
| diamond | `sunder` | 12 | the target's armor counts at half |
| spider venom | `venomed` | 4 | on a hit: pain +20 for 300 ticks (the giant cave spider's own bite) |
| deepsilver bar | `deep` | 12 | +25% damage, and +50% more against the `deep` faction; `DeepsilverWorked`: Deep pressure +5 |
| hollow ichor | `hollowbane` | 8 | ×2 damage against the `deep` faction |

#### Armor

| Stone | Enchant | Vials | Effect at common tier |
|---|---|---|---|
| quartz | `stout` | 4 | +2 armor on the piece |
| garnet | `emberward` | 6 | `burn` halved on covered parts |
| amethyst | `rimeward` | 6 | `frost` halved on covered parts; never slowed |
| sapphire | `calm` | 6 | immune to Dread and `fearsome`; Daze resisted at +40 |
| emerald | `mending` | 8 | wounds on covered parts heal ×1.5 |
| diamond | `adamant` | 12 | +4 armor, weight −4 |
| glowstone | `glowing` | 6 | lights the wearer's 3×3; spots stealthed creatures 2 tiles further |
| wyrmscale | `wyrmhide` | 8 | immune to `burn` on covered parts |
| hollow ichor | `hollowsight` (head only) | 8 | spots stealthed creatures within 10 |

#### Ammunition (a stack of up to 25)

| Stone | Enchant | Vials | Effect |
|---|---|---|---|
| garnet | `ember` | 4 | +6 `burn` on a hit |
| amethyst | `rime` | 4 | slowed 30% for 200 ticks |
| emerald | `seeking` | 4 | +10 to hit |

Enchanted ammunition that drops after a hit keeps its stone; a broken bolt is gone with it.

#### Mage armor

| id | name | slot | covers | layer | armor | weight | inputs | property |
|---|---|---|---|---|---|---|---|---|
| `rune_robe` | runed robe | body | torso 100, arms 60, legs 40 | padding | 3 | 2 | 3 sporecloth cloth + 2 vials | rune regen ×1.5; +5 to the cast roll |
| `circlet` | circlet | head | head 100 | plate | 2 | 1 | 1 bar (silver, gold, electrum, platinum, deepsilver) + 1 cut gem + 2 vials | rune max +10 (deepsilver +20) |

Both take an enchantment like any armor. A robe is a long gambeson that covers the legs and protects almost nothing; that is the trade.

#### How enchantments enter combat

In 16's melee and ranged resolution, after `damage` is known: apply the weapon's or ammunition's `on_hit` effects (a second `DamageDealt` for `ember` and `blaze`, a `Slowed` or `Fled` status for `rime` and `fearsome`, pain for `venomed`); before it, read `sure`, `keen`, `sunder` and `deep` as modifiers in the roll and the raw damage; and in `armorReduction`, read the defender's armor enchantments (`stout`, `adamant`, the wards) and the ward layer. Every enchantment is a row with a trigger (`passive`, `on_hit`) and an effect record; the resolution reads rows, never ids.

### 5. Draughts

Brewed at the laboratory with skill `alchemy`; quality-bearing: the quality multiplier scales the duration. Category `medical/draught`, stack 5, bag, glyph `!`, value 20 × quality. A thirsty dwarf never finds one: draughts are not `drink`.

**One draught, then rest.** A dwarf who drinks any draught drinks no other for `DRAUGHT_REST_DAYS` (3). The body will not take it: the trigger rules below simply do not fire, and a medic will not give one. The inspector says "Can take a draught again in 2 days". When two draughts are allowed and both triggers fire at once, the squad panel's order decides: the first allowed draught in the list is the one drunk. A calming draught adds its own longer rule.

| id | name | inputs (→ 2 draughts) | Effect for one day | Drunk when |
|---|---|---|---|---|
| `mending_draught` | draught of mending | 1 vial + 2 brightleaf | bleeding stops, light wounds close, wounds heal ×2 | a soldier's blood falls below 50%; or a medic gives it to a patient with a serious or grievous wound (`give_draught`, priority 2) |
| `stout_draught` | draught of stoutness | 1 vial + 2 pale bell | pain halved; Toughness +20 | a raid or siege arrives, or an ambush springs, for every soldier on duty |
| `quick_draught` | draught of quickness | 1 vial + 2 sweetroot | speed +25%; attack cooldown −25% | as stoutness |
| `calm_draught` | calming draught | 1 vial + 2 hops | thought `eased` (+8, 72 h) | a medic gives it to a Miserable dwarf (`give_draught`); a second within 7 days gives `dosed_again` (−4) instead |
| `hollowsight_draught` | draught of hollowsight | 1 vial + 1 hollow ichor | spots stealthed creatures within 10 | a soldier goes on duty while the Deep gauge is at level 2 or higher |
| `wyrmblood_draught` | draught of wyrmblood | 1 vial + 1 wyrmscale | immune to `burn` | a magma wyrm is in perception |

A runecaster refills rune from plain vials (§ 3), not from a draught; a vial is not a draught and does not start the rest.

Soldiers carry at most one of each draught the squad's equipment preferences allow (an ordered checklist in the squad panel, all off by default) and claim them at the re-equip check like ammunition. The trigger column and the rest rule are the whole AI: both are printed in the squad panel beside the list.

An alchemist below Skilled can spoil a batch: `max(0, ALCHEMY_MISHAP_PERMILLE − 10 × skill)` per job the output is `murky_draught` (value 1, no effect) and the laboratory's 3×3 fills with miasma for `MIASMA_DURATION`, exactly as rotting refuse does. The hall learns that the alchemist is new.

### 6. Summons

**Call** brings one creature beside the caster, faction `fortress`, with a `Summoned { summonerId, fadesAt }` component. It fights under 16's ordinary targeting, follows the caster at `FOLLOW_RADIUS` when idle, never flees, never loots, is never butchered, tamed or named, and fades after one day or at 0 hp with no corpse and no grief (`SummonFaded`, a note). The caster may have `MAX_SUMMONS_PER_CASTER` alive. Summons count toward `MAX_CREATURES`.

The staff's shoe chooses what answers:

| Shoe | Summon | plan | size | speed | class | attacks | armor | flags | glyph | fg |
|---|---|---|---|---|---|---|---|---|---|---|
| none (a wand) or copper, bronze, iron | `wisp` | crawler | 10 | 0.24 | small | touch `burn` 6 size 2 | 0 | lights its tile; N | `*` | `rune_cyan` |
| steel or silver | `stone_warden` | humanoid | 90 | 0.105 | walker | slam `blunt` 22 size 8 | 8 | stands in a doorway as well as a door does | `Φ` | `granite_gray` |
| deepsilver | `deep_shade` | humanoid | 60 | 0.21 | walker | claw `edge` 18 size 3 | 2 | S, N; **1 in 20 castings it arrives as faction `deep` instead** | `δ` | `hollow_violet` |

A shade that turns gives everyone `summon_turned` (−4, fear) and a danger line: "Something came through that was not called." It is a hollow stalker's lesser cousin and a squad can kill it; the risk is the price of deepsilver, like the gauge. The player who wants no risk shoes the staff with steel.

### 7. Rare materials

Every rare stone or ingredient already exists in the game or falls out of something that does. Nothing new is placed in the rock.

| Material | From | Used for |
|---|---|---|
| glowstone (cut) | cavern walls; the jeweler | the **Call** stone; `glowing` armor; ground into vials |
| deepsilver (bar) | beside the Sea of Fire; wakes the Hollow | staff shoes (`runeMult` 1.6); the `deep` setting; quenched into 12 vials; circlets. Every use at the runeforge or laboratory raises Deep pressure |
| `wyrmscale` | 3–6 drop when a magma wyrm dies (a new material, value 80) | `wyrmhide` armor; wyrmblood draughts |
| `hollow_ichor` | 1 from a hollow stalker's or maw's remains, recovered by `strip_corpse` (value 60) | `hollowbane` weapons; `hollowsight` helms and draughts; rendered into vials |
| `spider_venom` | butchering a giant cave spider (value 20) | `venomed` weapons |
| `ember_gland` | butchering an ember newt (value 25; the newt is currently only sold) | an alternative `ember` stone at 4 vials |

The pattern: the game's hardest fights leave behind the material for the next one. A wyrm dead by trap corridor arms the squad against the next wyrm's breath; the first Hollow-born slain gives the hall its first `hollowbane` blade.

### 8. Hostile runecraft

The Gloam have hexers. `gloam_hexer` (humanoid, size 50, speed 0.165): a runecaster of level 4 with 20 rune and no vials, a wand of frostbind or dread (wood, amethyst or sapphire), a dagger, cap and jerkin. One joins each raid at peril ≥ 3 from year 3, two join each siege, and at peril 4 they come from year 2. The hexer stands with the archers and casts under the same rules the fortress's casters follow, about twenty bolts or ten dreads, and then has a stick. Its wand is foreign loot: the first wand many fortresses own is a dead hexer's, and it needs a runecaster to hold it.

The Hollow-born get nothing new. They are already what rune looks like when it is not held.

### 9. Trade and wealth

- **Mountainhome** adds: glowcap seeds ×10 in a bag (2–4 bags, weight 6, from year 2); rough glowstone 1–2 (weight 5); rune vials ×5 (reputation ≥ 50, weight 4). It values `medical/vial`, draughts and any enchanted item at 150%.
- **Hillfolk** add nothing and value enchanted goods at 120%.
- **Wildwood** add a draught of mending 1–2 (reputation ≥ 50) and value enchanted goods at 70%; a staff is a wooden item to them (20%, and −2 reputation per one offered).
- Requests work as for any item.

An enchanted item's value is visible in the stocks panel like any other. A masterwork steel breastplate of adamant is `4,000 + 90 × 3 + 12 × 15 = 4,450` marks. Enchanting a squad raises renown by a point or two; it does not break the curve.

### 10. Morale

| id | text | value | hours | decay | group | trigger |
|---|---|---|---|---|---|---|
| `attuned` | "Felt the rune answer." | +2 | 12 | linear | pride | a session without a mishap |
| `singed` | "Singed my beard in the sanctum." | −3 | 24 | halflife | none | mishap `singed` |
| `saw_wisp` | "Saw a light that was not a lamp." | +2 | 24 | linear | comfort | a wisp within 8 and in sight, once a day |
| `warded` | "Felt the ward settle on me." | +1 | 12 | linear | comfort | `Warded` |
| `mended_by_rune` | "The rune closed my wound." | +3 | 48 | linear | none | `Mended` |
| `first_runecaster` | "We have a runecaster in the hall." | +4 | 72 | linear | pride | the first dwarf reaches runecraft 10 (everyone; announced) |
| `summon_turned` | "Something came through that was not called." | −4 | 48 | halflife | fear | `SummonTurned` (everyone) |
| `eased` | "The draught quieted me." | +8 | 72 | linear | none | a calming draught |
| `dosed_again` | "Another draught. I am tired of draughts." | −4 | 72 | halflife | none | a calming draught within 7 days of the last |
| `rune_sick` | "Too much rune. My teeth hum." | −4 | 24 | halflife | none | a fourth vial in a day |

Every value sits inside the caps. Nothing here can take a fed, rested dwarf below 20.

---

## State

A new system **25 Runecraft** (`magic`), cadence 1 (casting rides on 16's targeting tick), with hourly regeneration on `HourPassed`, placed in the tick order directly after 16 Combat so that wards, slows and dazes are fresh for 17 Health.

- `Rune` components on dwarves (current, max, last vial ticks for the daily count, last draught tick); `Ward`, `Slowed`, `Dazed`, `Fled` statuses with expiry ticks on any creature; `Draught` effects with expiry; `Summoned` components.
- `sanctums: zoneId[]`, per-apprentice sessions today, `firstRunecasterDone`.
- `Item.enchant` (owned by 13; written by 12's transform recipes).
- A staff's stone and shoe are material rows: a staff's material is its haft wood; `Item.stone` (a gem material index) and `Item.shoe` (a metal material index, none for a wand) are two small fields on launcher items of class `staff`.
- Rng stream `magic` (mishaps, resistance rolls, the shade).
- Save format version bumps once; older saves load with no rune, no enchantments and no sanctums.

## Interfaces

**Reader.** `magic.rune(id)` (current, max, regen with its breakdown, time to full, vials today, next draught allowed at), `magic.canCast(id)`, `magic.ward(id)`, `magic.statuses(id)`, `magic.summonsOf(id)`, `magic.spellOf(itemId)` (the spell and its effective numbers for that launcher), `magic.enchantOf(itemId)` (a text line and the effect record), `magic.sanctums()`, `magic.apprentices(zoneId)`, `magic.speedModifier(id)` (read by the movement helper with 17's).

**Commands.** `SetSanctumApprentices { zoneId, dwarfIds }`, `SetSanctumSupplies { zoneId, wants }`, `SetSquadDraughts { squadId, allowed: draughtId[] }` (ordered). Setting orders are 12's `AddWorkOrder` with an item filter.

**Consumes.** `AttackResolved` (enchant triggers), `DamageDealt` (nothing; 17 owns wounds), `HourPassed` (regen, expiries), `DayPassed` (sessions and vial counts reset, summons fade), `JobCompleted` (`attune`, `give_draught`), `RaidArrived`, `AmbushSprung`, `ThreatNearby` (draught and vial triggers), `ItemCrafted` (`DeepsilverWorked` for deepsilver inputs), `SkillLevelUp` (rune maximum), `CreatureDied` (summons, apprentices), `ZoneChanged`.

**Emits.** `SpellCast { casterId, spellId, targetId | tile }`, `RuneSpent { id }` (the caster's rune is below any spell's cost), `VialDrunk { id }`, `Warded { ids[] }`, `Mended { id, casterId }`, `Dazed { id }`, `Fled { id, until }`, `Slowed { id, until }`, `SummonCalled { id, casterId }`, `SummonTurned { id }`, `SummonFaded { id }`, `AttuneSession { id, xp }`, `Mishap { id, kind }`, `StoneSet { itemId, enchantId, tier, smithId }`, `DraughtDrunk { id, draughtId }`, `DeepsilverWorked { amount }` (18 adds pressure), `FirstRunecaster { id }`, and 16's `DamageDealt` for bolts, bursts and `on_hit` burns.

**Registrations.** Job producer `magic` (`attune`, `give_draught`, `mend_wounds`: an off-duty runecaster holding a staff of mending treats bleeding patients as a medic job with no input, spending their own rune); panel `sanctum`; inspector sections `creature › rune` (rune bar and breakdown, time to full, vials carried and drunk today, draught rest, staff with its stone and the spell's numbers in that staff, ward and statuses, summons), `item › stone` (spell or enchantment in one line with its number: "Emberbolt: 22 burn, range 12." or "Ember (fine): +9 burn on a hit"); squad panel additions (ordered draught checklist with trigger text; "train with staff" toggle; a staff shown only beside a member who can cast); stocks panel enchant suffixes; announcements: `Mishap` (note; alert for `fire` and `scorched_circle`), `SummonTurned` (danger), `FirstRunecaster` (note), `StoneSet` at masterwork tier (note, names the smith and the item), `RuneSpent` (note, once per caster per engagement: "Brynja Coldhammer is out of rune."), `SpellCast` of Firebloom that burns a fortress creature (alert, once per engagement: "Brynja Coldhammer's firebloom caught Orm Ashbrow.").

## Player-facing behavior

- **Glyphs.** Wand `'`, staff `¦`, vial `¡`, draught `!`, rune circle `◊`, all in `rune_cyan` save the draught, which takes the ingredient's color. A warded creature's glyph background is dimmed `ward_cyan`. A wisp is `*` in `rune_cyan`, a warden `Φ` in gray, a shade `δ` in `hollow_violet`. A hexer is `G` like any Gloam; its wand shows in the inspector. Spell projectiles use the four projectile glyphs in `rune_cyan`; a firebloom flashes its 3×3 `ember_orange` for one frame.
- **The sanctum panel.** Apprentices with level, rune and sessions left today; the chest's glowcap against its want; the sanctum's tier and its mishap chance in words ("one session in thirty"); the last mishap.
- **The look cursor** on a staff: "yew staff of embers, shod with steel (fine). Emberbolt: 29 burn, range 12. Needs a runecaster." On an enchanted axe: "steel battle axe of embers (fine). +9 burn on a hit." On a runecaster: "Rune 12/50, full in 2 days. 2 vials. Drank a draught of stoutness; can take another in 2 days."
- **Hints.** "Glowcap grows in the dark under a glowstone lamp." "A staff is a stone on a stick: the stone is the spell, the dwarf is the fuel." "A wand is quick and soft; a shod staff is slow and hard." "Build the sanctum in stone." "Iron drinks the rune: a runecaster in mail recovers slowly." "The runeforge burns vials, not coal." "One draught, then three days' rest."
- **Legend milestones.** First stone set, first runecaster, first summoning answered, a Hollow-born slain with a hollowbane blade.
- **The deepsilver confirmation** gains a sentence: "Working it at the runeforge or the laboratory wakes the Hollow too."

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `RUNE_PER_LEVEL` | 5 | Rune maximum per runecraft level |
| `RUNE_REGEN_PER_LEVEL` | 0.1 | Per hour per level: any level refills from empty in about two days |
| `METAL_RUNE_PENALTY_PERCENT` / `METAL_RUNE_FLOOR_PERCENT` | 20 / 20 | Per worn metal mail or plate piece; floor |
| `WAND_POWER` / `STAFF_POWER` | 0.7 / 1.2 | The channel's multiplier on a spell's numbers; the staff's is multiplied again by its shoe's `runeMult` |
| `CASTER_VIALS` / `VIAL_RUNE` / `VIALS_PER_DAY` | 3 / 5 / 3 | Vials carried; rune per vial drunk; the body's daily limit |
| `DRAUGHT_REST_DAYS` | 3 | Days between any two draughts for one dwarf |
| `WARD_ARMOR` / `WARD_TICKS` / `WARD_RADIUS` | 6 / 600 / 3 | At power 1.0 |
| `DREAD_TICKS` / `DREAD_RADIUS` / `DREAD_MAX_TARGETS` / `DREAD_COOLDOWN` | 400 / 4 / 4 / 400 | Ticks at power 1.0 |
| `DAZE_TICKS` | 150 | At power 1.0 |
| `FROSTBIND_SLOW_PERCENT` / `FROSTBIND_TICKS` | 50 / 300 | Ticks at power 1.0 |
| `RESIST_NO_ATTRIBUTES_PERCENT` | 25 | Mental spells against creatures without attributes |
| `MENTAL_IMMUNE_SIZE` | 180 | Size at which Dread and Daze fail |
| `SANCTUM_APPRENTICES` | 4 | |
| `ATTUNE_TICKS` / `ATTUNE_XP` / `ATTUNE_SESSIONS_PER_DAY` | 300 / 50 / 2 | |
| `MISHAP_BASE` / `MISHAP_FLOOR` | 60 / 10 | Per mille per session, less 2 per level and 1 per sanctum tier |
| `MISHAP_BLACKOUT_TICKS` / `MISHAP_SURGE_RADIUS` | 200 / 3 | |
| `ALCHEMY_MISHAP_PERMILLE` | 100 | Per job, less 10 per alchemy level |
| `SUMMON_TICKS` / `MAX_SUMMONS_PER_CASTER` / `SHADE_TURN_PERMILLE` | 1200 / 2 / 50 | |
| `DRAUGHT_TICKS` | 1200 | One day, times the quality multiplier |
| `DEEP_PRESSURE_PER_QUENCH` / `DEEP_PRESSURE_PER_DEEP_SETTING` | 10 / 5 | Added through 18 |
| `HEXER_LEVEL` / `HEXER_FROM_YEAR` | 4 / 3 (peril 3), 2 (peril 4) | |

All *unmeasured*. The spell, enchantment, draught, mishap and summon tables are content.

## What this deliberately does not do

- No spell menus, no targeting by the player, no "cast now" button. Pillar 1.
- No necromancy, no undead summons, no curses, no mind control of dwarves. Pillar tone.
- No rune stored in a staff, a wand or any item; the dwarf is the only vessel. No rune regeneration from buildings, shrines or sleeping on glowstone; only the skill, the robe, the circlet and a vial.
- No stacking of enchantments, no re-enchanting, no enchanting furniture, doors or walls.
- No magic in world generation: no mage towers, no ley lines, no magical biomes. The region traits stand as they are.
- No magical disease or madness from mishaps. A mishap is a burn, a nap, a broken circle, a light, a fire, or a surge.
- No magic for the Hollow-born beyond what they are, and no magic for the Hillfolk or the Wildwood. The Gloam alone get hexers.

## Build order

Each phase is playable on its own and leaves the game whole if the next never comes.

| Phase | Delivers | Code touched beyond rows |
|---|---|---|
| **1. Rune** | glowcap and the `glow` light rule; the laboratory and `distill_rune`; vials; `runecraft`, `alchemy`, `runesmithing`; the sanctum, the circle, apprentices, attunement and mishaps; the rune tank and its slow regeneration; the runeforge with wands and staffs of embers and frost; the `burn` and `frost` rows; `runeMult` and the channel powers | 07 `lightOk`; 12 workshop rows; 14 room type; 16 damage-type rows and a `staff` launcher that spends the holder's rune; 13 `stone` and `shoe` fields; the 25 system proper |
| **2. Stones in steel** | `set_*` transform recipes; the weapon, armor and ammunition tables; robe and circlet; item names, values and the trade preferences | 12 `transform` recipes and item filters; 16 enchant hooks in the resolution; 13 `enchant` and value; 20 goods rows |
| **3. The rest of the spells** | Ward, Mend, Dread, Daze, Firebloom; vial drinking and the daily limit; draughts, their triggers and the rest rule; the `give_draught` and `mend_wounds` jobs | 10 draught and vial behavior; 17 `Dazed` and `Slowed` reads; 16 ward layer |
| **4. What the Deep gives** | Call and the three summons; wyrmscale, ichor, venom, ember gland and their stones; `DeepsilverWorked`; hexers; legend milestones | 18 hexer role and pressure; 08 butcher yields; 13 `strip_corpse` yields |

Phase 1 alone gives the game a crop with a reason to light a cavern and a year-long project that ends in a dwarf who throws fire. Phase 3 is where the stories live.

## Acceptance criteria (the shape of the tests)

- A glowcap on a dark tile under a lamp grows; the same tile with the lamp removed does not; a lit tile under a lamp does not.
- Two glowcap at the laboratory make one vial; a dwarf with no `runecraft` never claims a staff and casts nothing holding one; a Dabbling apprentice with 5 rune and a wand of embers casts five emberbolts and then fights with the wand as a club.
- An emberbolt from a wand is 13 raw; from an iron-shod common staff 22; from a silver-shod fine staff 31. Against a common iron mail shirt the staff's bolt does 17 on the torso; against a steel breastplate 4; against a bare leg under a ward of 6, 10.
- A warded squad of six against the measured peril-2 raid at the gate loses fewer blood units than the unwarded one in the combat-pace arena, and the ward lapses at 420 ticks from a wand and at 720 from an iron-shod staff.
- A Proficient runecaster at 0 rune reaches 50 in 50 ± 2 hours in a tunic; a robe makes it 34; an iron helm and mail make it 84. In an eight-hour fight they regain 8.
- A runecaster below their spell's cost with a hostile in sight and a vial in the pouch drinks it and gains 5, capped at max; a fourth vial in a day gives `rune_sick` and no rune.
- Dread sends at most four raiders running and they return; the raid's retreat counter does not move.
- Firebloom is never cast while a fortress creature stands in the square.
- A soldier who drank a draught of stoutness drinks nothing else for 3 days whatever triggers; a medic gives no draught to such a dwarf; a calming draught given twice in seven days gives `dosed_again`; the mood floor of 20 holds.
- An apprentice at two sessions a day reaches level 10 in 37 ± 3 days with 74 ± 6 glowcap consumed; over 1,000 sessions at level 0 in a bare sanctum, mishaps number 60 ± 15 and none is a death, a lost limb or a destroyed stockpile item.
- An enchanted axe keeps its stone through drop, haul, claim and save; a staff keeps its stone and shoe through the same; melting either returns bars and nothing else.
- A deep shade turns 50 ± 15 times in 1,000 castings; a turned shade is `deep`, never flees, and a squad of three in iron kills it.
- A hexer casts about twenty bolts and then closes to melee; its wand is foreign until picked up, then counts in stock and is claimed only by a squad member with `runecraft`.
- Determinism: the same seed and command log give the same mishaps, resistances and shades.

## Decisions taken here, with the alternatives

1. **"Rune", not "mana"; "runecaster", not "wizard".** The game's lore primer allows only its own proper nouns and the dwarves speak in understatement. *Wizard* appears once, in the first hint, so a new player knows what they are looking at. The gems a smith sets are *stones*, so that *rune* means one thing.
2. **Glowcap under lamps (year 2), not glowcap in the heat of cavern 3 (year 4).** Lamp coverage is already tracked by 14, so the rule costs one branch in `lightOk`; it gives glowstone a purpose and ties magic capacity to the wealth axis. The heat rule (`minC 20`, satisfied only at z ≤ 8 or beside channeled magma) is a fine alternative if magic should be a late-game thing only; it is a one-row change.
3. **The stone is the spell.** Eight gems, eight spells, no spell list on the dwarf, no choice at cast time. The alternative, spells learned by the runecaster and chosen by the player, would add a panel, a targeting mode and a hidden choice function; it was cut on pillar 1 and pillar 4.
4. **A staff holds nothing; the dwarf is the only vessel.** Casting needs a runecaster, so the sanctum is the gate to all of it, and a staff is a tool choice like a pick: material and quality, nothing to refill. The wand is the cheap, quick, soft channel an apprentice gets in their first week; the shod staff is the hard one a runecaster earns. Two alternatives were drafted and dropped: vials carried as ammunition (a crossbow with a different glyph, and anyone could fire it) and charges stored on the staff and refilled at the forge (a logistics loop that made the smith, not the caster, the limit).
5. **A runecaster's rune is a tank, not a trickle.** Regeneration at a tenth of a unit per level per hour means two days to refill and a cast or two over a whole fight; a vial gives five at once and the body takes three a day. The alternative, regeneration fast enough to sustain casting through a raid, made a Legendary runecaster an endless crossbow; this version makes them a dwarf who must choose what the fifty units are for.
6. **One draught, then three days' rest.** Without the rule, stoutness and quickness and mending would stack on every soldier at every alarm and the alchemist would become the fortress's most important workshop. With it, a draught is a choice the squad panel's order makes visible.
7. **Friendly fire stays.** Firebloom burns dwarves and a bolt hits the dwarf in the way. The rule that keeps it fair is printed on the staff.
8. **Hostile hexers are in phase 4, not phase 1.** Magic as a threat makes `calm`, `rimeward` and wards matter; without it they are luxuries. It can be cut for a first release without touching anything else.
9. **One enchantment per item, forever.** Stacking and re-enchanting are the first things players would ask for and the first things that would make the inspector line unreadable.
10. **The deep shade's one-in-twenty.** It is the same bargain as deepsilver mining, at a smaller scale, and it is told to the player on the look cursor of the staff. Set `SHADE_TURN_PERMILLE` to 0 to remove it.
