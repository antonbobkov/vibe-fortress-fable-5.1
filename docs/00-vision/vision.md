# Vision

**Detail level:** W1 · **Owner:** vision · **Depends on:** none

## One paragraph

Deepholm is a colony simulation in colored ASCII. You choose a site on a generated world, arrive with seven dwarves and a wagon, and dig a hall into the mountain. You never control a dwarf directly. You designate what to dig and build, place workshops and farms, set priorities and labors, and the dwarves decide who does what. Water flows downhill and through your channels, magma glows at the bottom of the world, seasons turn, beasts roam the caverns, raiders come to the gate, traders come to the depot, and cousins arrive when word spreads that the hall is prosperous. The deeper you dig, the richer the veins and the worse the things you wake.

## The fantasy

Three fantasies, in priority order. When they conflict, the earlier one wins.

1. **Stewardship.** The player is the will of the hall, not a dwarf in it. Satisfaction comes from watching a plan become a working, humming place: ore going up, ale going down, the dining hall full at dusk.
2. **The descent.** Every layer down is a decision. Soil and sandstone near the surface; granite, marble and ore below; three cavern layers with their own ecologies; and at the bottom the Sea of Fire and the pale metal that lies beside it. Wealth is deep. Danger is deep. The arc of a fortress is vertical.
3. **Stories worth retelling.** Systems interact so that unplanned things happen. A waterfall meant for a mist garden floods the dining hall. The legendary cook turns out to be the best axedwarf. A raid is stopped by one drawbridge and a lever pulled at the right moment.

## Pillars

Every design decision in this specification can be traced to one of these four pillars. A feature that serves none of them is cut.

### 1. Legible depth

Every rule can be stated in one sentence, and the player can see every number that matters. Depth comes from rules combining, not from hidden complexity.

In practice: fluids have seven levels and four movement rules; combat is six body parts, three damage types and one hit roll; happiness is a single number whose contributing thoughts are listed in the dwarf's panel. Materials have a handful of visible properties and every recipe shows its inputs and outputs.

We say no to: opaque formulas, invisible modifiers, stats the player cannot read, and content that behaves specially for reasons the player cannot discover.

### 2. A forgiving fortress

Failure is a setback with a story, never a spiral. Unhappy dwarves work slower and sulk. They do not murder each other. A raid can kill, but a raid is announced a day before it arrives. Starvation is slow and loud. Nothing ends the game in a single tick without a warning the player could have acted on.

In practice: negative thoughts are capped and decay faster than positive ones; a miserable dwarf's worst act is a day off or a broken chair; immigration and caravans keep coming even after disaster; the game keeps seasonal snapshots so the player can roll back a catastrophe if they choose.

We say no to: tantrum spirals, instant death with no warning, cascading failure with no floor, and punishing the player for not knowing an undocumented rule.

### 3. Data over code

Everything that is a *thing* is a row in a table: a material, a creature, a plant, an item, a job, a building, a recipe, a thought, a region trait. Systems are rules that consume tables. Adding a metal, a monster or a workshop means adding rows and never adding a special case in code.

In practice: the `03-content/` folder is the game's content in full; the simulation refers to content only by ID and property; a new creature with a new body plan needs no new code as long as it is composed of existing part types.

We say no to: `if (species === 'magma_wyrm')` anywhere in a system.

### 4. ASCII with character

One glyph per thing. Color carries material and state. The screen shows exactly one z-level, and the levels below show through, dimmed, so that depth is readable without a legend. The map must be readable at a glance by a player who knows the vocabulary, and the vocabulary must be small.

In practice: dwarves are the smiling face; animals are lowercase letters; monsters are uppercase; walls are solid blocks in the color of their stone; water is a wave glyph in blues that deepen with level; magma is the same glyph in oranges; designations are drawn as overlays that never hide what is under them.

We say no to: sprites, tiles that need a legend to decode, and colors that mean two things.

## What Deepholm keeps from its inspiration, and what it leaves

Kept, in simplified form: the 3D map viewed by z-level; seven-level fluids with pressure; caverns and the magma sea; indirect control through designations and labors; job priorities; workshops and reactions; body-part combat with bleeding; hospitals; stockpiles and containers; rooms with quality; caravans; immigration; the sense that the world does not care about you.

Left out on purpose: adventure mode; world history and legends; nobles and mandates; vampires, werebeasts and necromancers; procedurally generated anatomy; blood-vessel-level combat; the seven-hundred-item stockpile filter tree; a keyboard-only interface.

Added: region selection as the difficulty setting, with a wealth axis and a peril axis the player can read; a hearth at the heart of every fortress whose quality lifts every dwarf; the Deep as a late-game arc that the player opts into by mining deepsilver; mouse-first controls with full keyboard parity; a browser-native game that saves itself.

## Who it is for

Players who enjoy Dwarf Fortress, RimWorld, Oxygen Not Included or Songs of Syx and are comfortable reading an ASCII map. They want systems that interact, a fortress that is theirs, and a game they can leave running in a browser tab.

A session lasts 30 to 120 minutes. A game year at normal speed takes about two hours of real time. A typical fortress lasts five to ten game years, which is ten to twenty hours of play.

## The shape of a game

1. Generate a world (about two seconds).
2. Choose a region on the world map. Its biome, wealth, peril, temper and special traits are visible before choosing. This is the difficulty selection.
3. Spend an embark budget on seven dwarves' skills and on supplies and animals.
4. Arrive on the surface with a wagon. Dig in before winter.
5. Grow: farms, workshops, bedrooms, a dining hall around the hearth. Meet the first caravan. Receive the first immigrants.
6. Descend: ore, then the first cavern, then metal armor and a militia, then the second cavern, then magma forges.
7. Endure: raids scale with your wealth; the Deep answers when you mine deepsilver.
8. End: the hall falls, or you retire it. Either way a legend page summarizes what happened.

The full arc is described in [`player-experience.md`](player-experience.md).

## Tone and voice

All in-game text follows these rules:

- Short declarative sentences. Name the dwarf. State the fact.
- Understatement over exclamation. "Ketil Ironvein has found hematite." not "Struck ore!!!"
- Humor comes from juxtaposition and from the dwarves' point of view, never from breaking the fourth wall. "The cat has adopted Ketil Ironvein. Ketil was not consulted."
- Thoughts are written as one-line diary entries in first person. "Slept on the floor again." "Ate a fine meal in a grand hall." "Saw a waterfall and felt small in a good way."
- Announcements come in three severities: *note* (gray, no interruption), *alert* (yellow, flashes the log), *danger* (red, pauses the game). The severity is part of the content table, not chosen at runtime.
- No random adjectives in generated text. Variation comes from picking among written lines.

## Lore primer

The world is not deeply simulated, but it is consistent. These are the only proper nouns the game uses.

- **Deepholm** — "the deep hall". The name of the game and what dwarves call any hall dug into the mountain. Your fortress is *a* deepholm; the player names it at embark.
- **The Mountainhome** — the dwarven kingdom the settlers come from. It sends the spring caravan and the immigrants. It asks for nothing.
- **The Deep** — everything below the soil: the three cavern layers and, at the bottom, the **Sea of Fire** (the magma sea). Dwarves speak of it with respect.
- **Deepsilver** — a pale blue metal found only in the rock beside the Sea of Fire. It makes the best weapons and armor in the game. Mining it wakes the Hollow.
- **The Hollow** — a legend of a vast empty dark below the Sea of Fire. Its creatures, the *Hollow-born*, come up through the rock when deepsilver is taken. They are the game's endgame threat.
- **The Hillfolk** — human farmers and traders of the lowlands. They send the summer caravan. A few of them are bandits.
- **The Wildwood** — elves of the old forest. They send the autumn caravan, pay poorly for wooden goods, and grumble about felled trees. They never attack.
- **The Gloam** — goblins of the twilight passes. They raid: first thieves, then ambushes, then full raids with their **trollkin**. They are the game's recurring threat.
- **The Thane** — the hall's elected leader, a position the player assigns. **The Warden** is the militia captain. Both are ordinary dwarves with a title.
- **The Hearth** — a building placed once per fortress, at the center of the main hall. Dwarves gather at it. Its surroundings' quality lifts every dwarf's baseline mood. It is the emotional and literal center of the fortress.

## Naming

Dwarves have a given name and a hall-name, generated from syllable tables specified in Wave 3. The flavor is Norse and Old English: *Ketil Ironvein*, *Brynja Coldhammer*, *Orm Ashbrow*, *Solveig Deephand*. Hall-names are compounds of a material or mood word and a body or place word. Animals are unnamed until adopted or trained. Fortresses are named by the player, with a generated default of the same style (*Emberhall*, *Coldvein Hold*).

## Non-goals

Deepholm is not a world-history simulator, an adventure game, a multiplayer game, or a moddable platform in version 1. It is a fortress and the ground beneath it. The full in/out list is in [`scope.md`](scope.md).
