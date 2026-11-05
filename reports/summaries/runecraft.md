# Runecraft: magic as a material

**Short answer.** Magic in Deepholm is a **production chain with a combat use**, not a spell book. A glowing mushroom is grown in the dark under a lamp, distilled into vials of rune, and spent: on a stick with a gem in it (a staff), on a gem set in an axe, or in a potion (a draught). The player never casts. They choose which gem goes on which staff, who sits in the magic room, and what a squad carries; the dwarves cast by rules the player can read. Magic **trails steel**: the best staff hits for less than a good steel axe. Its worth is reach (a bolt flies 12 tiles) and support (armour for the squad, wounds closed, foes sent running). A fortress that never touches it plays as it did before it existed. The rules are [25 Runecraft](../../docs/02-systems/25-runecraft.md); this page was written from it and from the measurements linked below, on master (2026-11-05).

Terms. **Rune** is the game's mana: a number each runecaster holds, from 0 to a maximum, that comes back slowly by the hour. A **runecaster** is a dwarf with the `runecraft` skill at 1 or more. A **tick** is the smallest time step; a day is 1,200 ticks. A **squad** is up to six soldier dwarves. **Peril** is the danger rating of a map.

## The loop, step by step

| Step | What the player does | What it takes |
|---|---|---|
| 1. Light | A jeweler makes a **glowstone lamp** (a rough glowstone and a stone block) and it is placed on a dark floor underground | Glowstone is found in caverns or bought from the Mountainhome caravan |
| 2. Grow | A farm plot under the lamp's 3×3, sown with **glowcap** | Glowcap seeds from that caravan; 24 days to a harvest of 2 to 3 a tile, one lamp feeding 8 tiles |
| 3. Distil | A **laboratory** turns 2 glowcap into 1 **rune vial** | One lamp gives about 0.4 vials a day |
| 4. Attune | A **sanctum** (a room around a rune circle) where up to four apprentices sit, two sessions a day, one glowcap a session | Dabbling (level 1) in 2 days, Proficient (level 10) in 73 days and 145 glowcap, measured |
| 5. Forge | A **runeforge** (an anvil, blocks and a cut gem) makes a **wand** (a log and a cut gem) or a **staff** (a log, a cut gem and a metal bar) | No fuel; the gem decides the spell |
| 6. Set | The same runeforge sets a gem in a weapon, an armour piece or 25 bolts, for 4 to 12 vials | The enchantment is permanent and rides with the item |
| 7. Brew | The laboratory brews two **draughts** from a vial and two plants (or a rare stone) | A novice alchemist spoils about one batch in ten |
| 8. Fight | A runecaster in a squad takes the best staff by itself; the squad carries a list of draughts | Soldiers drink when a raid arrives, or when hit below half blood |

The scenario `pp_runecraft` plays exactly this from a Miner's Guild embark, by commands only, on two seeds: two lamps grow 16 harvests of glowcap, the laboratory distils 13 vials, an apprentice reaches level 1 after 4 or 5 sessions, the runeforge makes an iron staff of embers and sets a garnet in an iron axe, and on day 36 the apprentice throws emberbolts at a raid while both soldiers drink a draught of stoutness.

## Rune of one's own

| Figure | Rule | Example |
|---|---|---|
| Maximum | 5 rune a level, +10 with a circlet | 50 at level 10 |
| Recovery | 0.1 a level each hour; a runed robe ×1.5; each metal mail or plate piece worn −20% (to at least 20%) | Level 10 fills from 0 in 50 hours in a tunic, 34 in a robe, 84 in an iron helm and mail (measured) |
| Vials | A caster carries 3 and drinks one when it cannot pay for its spell; 5 rune each; 3 a day. A fourth, in a desperate moment with a foe beside it, gives half and makes the dwarf sick ("Too much rune. My teeth hum.") | A Proficient caster has 65 rune for a day's fighting |

**Mishaps.** Each sanctum session can go wrong: 6% at level 0, less with skill and a finer room, never below 1%. Over 1,000 beginner sessions, 62 went wrong (measured): a singed arm, a blackout, a scorched circle, a small fire, a surge that singes everyone near, or a loose wisp. None kills or maims. "Build the sanctum in stone", since a fire needs something to burn.

## The spells

The gem set in the channel decides the spell. A wand has power 0.7; an iron staff 1.2; the metal and quality of the staff raise it (silver ×1.3, deepsilver ×1.6, masterwork ×1.5). Power scales damage and duration, never cost.

| Gem | Spell | Cost | What it does | Iron staff |
|---|---|---|---|---|
| Garnet | Emberbolt | 1 | A fire bolt that flies like an arrow and can hit whoever stands in the way | 22 raw, 18 through a leather jerkin, 4 through a steel breastplate |
| Amethyst | Frostbind | 1 | A frost bolt that slows what it wounds by half | 10 raw, slows for 360 ticks |
| Quartz | Ward | 2 | Armour on every body part of every friend within 3 | 5 armour for 720 ticks |
| Emerald | Mend | 2 | Bandages a friend's bleeding wounds and closes the light ones, within 4 | |
| Sapphire | Dread | 2 | Sends up to four foes within 4 running for a while; they come back | 480 ticks |
| Ruby | Firebloom | 3 | A fire burst on the 3×3 around a target, 20 ticks after the cast; never thrown onto friends, but friends can walk in | 17 raw |
| Diamond | Daze | 3 | Stuns a captain or a big creature | 180 ticks |
| Glowstone | Call | 3 | A summon beside the caster for a day: a wisp, a stone warden (steel or silver staff) or a deep shade (deepsilver, which 1 time in 20 comes through hostile and hidden) | |

For comparison a masterwork deepsilver great axe does 68 to a bare part; the best staff's emberbolt does 49. A caster below Proficient is sometimes **careless**: with a friend on its line of fire it casts through them anyway (half the time at skill 0, never from level 10), so an apprentice singes its own squad now and then.

## Enchantments and draughts

**Settings** (22 kinds, *unmeasured* unless noted). On a weapon: keen (+10% damage), of embers (+8 fire on each hit), of rime (slows), sure (+10 to hit), fearsome (a quarter of hits send the foe running), of blaze (+14 fire, and 2% of hits set the ground alight, your own wooden floor too), sundering (half the target's armour ignored), of the deep and hollowbane (against the Hollow), venomed (a hit pains the target by 20 for 300 ticks). On armour: stout and adamant (+2 and +4 armour), fire and frost warding, glowing (lights the wearer's 3×3 for glowcap, as a lamp does), wyrmhide (no fire through), hollow sight (spots hidden things farther), calm (never put to flight). On bolts: embers, rime, seeking.

Measured against a peril-2 raid of ten in the open ([enchant arena](../audits/2026-11-02-t472-enchant-arena.md)): six soldiers in plain iron hold in 20 of 24 fights; with axes of embers 21, sundering 22, stout armour 24, **fearsome 16**. Fearsome is a deliberate trade-off: a fleeing foe is hard to catch.

**Draughts.** Mending (bandages and doubles healing; drunk when hit below half blood), stoutness (pain halved; at a raid), quickness (25% faster; at a raid), calming (for a miserable dwarf, given by a medic), hollow sight, wyrmblood (proof against fire). One draught, then three days' rest. Measured ([draught arena](../audits/2026-11-02-t474-draught-arena.md)): mending turns that raid back in 24 of 24 fights against 20; quickness 21; stoutness 18, since those soldiers bleed out rather than faint from pain.

## In a fight, measured

| Setting | Without | With | Source |
|---|---|---|---|
| Three Novice soldiers against an ambush of four, soldiers dead a day later | 1.08 a fight | 0.58 with a Proficient caster's iron staff of embers; the caster never touched | [caster arena](../audits/2026-11-02-t470-caster-arena.md) |
| Five soldiers against a peril-2 raid of ten, and a sixth or seventh beside them | repelled 3 of 24 alone; 11 of 24 with one more axedwarf; 36 of 48 with two | 36 of 48 with a ward caster (5 armour); 44 of 48 with a Daze caster ordered to kill the captain | [ward and Daze](../audits/2026-11-05-t477-ward-and-daze.md) |
| The same five against an ambush of four, soldiers dead a day later | 0.62 alone, 0.50 with two more | 0.04 with a ward | ward and Daze |

The ward was stronger still: at 7 armour one caster did better than two extra soldiers (44 of 48), so it was lowered to 5, where a caster is worth about two soldiers. The Daze caster wins by one stun: the soldiers kill the stunned captain, and a raid that loses its captain early loses heart (raid morale). It is kept as a strong choice that costs a diamond, a Proficient caster and the player's order.

## Magic against the fortress

**Hexers** come with gloam raids at peril 3 from year 3 and peril 4 from year 2: one in a raid, two in a siege. Each carries an oak wand and 20 rune that never comes back, then clubs. Most throw frost; one in three (by its id, no dice) carries **Dread** and sends up to four dwarves running for 280 ticks, soldiers or not ("Fear took my legs, and I ran."). A **calm** helm keeps a soldier in place: with every soldier in one, the dread hexer never casts ([dread hexers](../audits/2026-11-05-t493-dread-hexers.md)). In five three-year fortresses at peril 4, 29 hexers cast 50 bolts and killed one dwarf ([hexers](../audits/2026-11-04-t479-hexers.md)): most raids loot outside a locked gate before a hexer sees anyone.

**Deepsilver** wakes the Hollow when it is mined, and also when it is worked at the runeforge or the laboratory (a deepsilver staff, a quench into 12 vials). The hardest monsters leave the rarest stones: a magma wyrm 4 wyrmscales, a hollow stalker an ichor, a giant cave spider its venom, an ember newt a gland.

## Odd things it does on purpose

These are kept for character, and listed in [the fun features](../../docs/fun-features.md): fearsome axes that make a squad worse in the open; a desperate fourth vial; a blaze blow that lights your own floor; dwarves who see a wisp ("Saw a light that was not a lamp."); a deep shade that turns and hides; a laboratory that stinks after a spoiled batch; the Wildwood's offence at a staff, which they count as wood; a dead runecaster's wand on an old battlefield; glowing armour as a walking lamp; careless shooters; dread hexers and calm armour.

## What no runecraft means

No existing number moves and no existing dice roll is drawn unless a channel, an enchanted item, a draught or a hexer is in play: every runecraft roll uses its own random stream. The defence scenario `pp_defence`, the six no-channel combat arenas and the annual wildlife instrument give the same results, draw for draw, with and without the runecraft code. Three things do change a fortress that never uses it, by design: hexers in late raids, some cave shrubs that are glowcap patches instead, and the rare stones on a dead monster.

## What is not there

- No player-cast spells, no spell book, no mana bar for the fortress as a whole.
- No necromancy, curses, undead or mind control. A summon is a light, a stone or a shadow, and it fades in a day.
- No magic armour that mends, no "this exact item" order: a setting takes the nearest item of the chosen type and material.
- A limit on Daze: it may stun the same captain again each time it wakes, though in the arena no captain lived to wake.
