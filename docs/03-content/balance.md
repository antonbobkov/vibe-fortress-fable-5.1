# Balance Model

**Detail level:** W3 · **Owner:** content · **Depends on:** every system document, [`../01-architecture/constants.md`](../01-architecture/constants.md)

This document is the cross-system arithmetic behind the tuning constants. It states the intended pace of a fortress and shows that the numbers in the system documents and content tables produce it. Where a constant in a system document was changed by this pass, the system document has been updated to match; this file is the explanation.

## Time and pace

- One game day = 1,200 ticks = 60 real seconds at 1×. A season is 28 minutes, a year just under two hours.
- A dwarf walks 0.10 tiles per tick: 10 seconds real time to cross 20 tiles, 48 seconds to cross the map.
- A 3×3 room in granite (hardness 150) takes a novice miner 9 × 90 = 810 ticks (41 s); a Proficient miner (level 10) 9 × 50 = 450 ticks. A ten-tile corridor is a minute's work.
- A year-1 fortress digs about 400 tiles, builds 6 workshops, 10 bedrooms and a dining hall, and reaches 13 dwarves.

## Needs and consumption

Need rates per hour (10 Dwarves, as revised by this pass):

| Need | Rise per hour | Want at | Result |
|---|---|---|---|
| hunger | 1 | 50 | a meal about every 50 hours: 0.48 food units per dwarf per day |
| thirst | 1.6 | 50 | a drink about every 31 hours: 0.77 drinks per dwarf per day |
| rest | 5 awake, −15 asleep | 60 | 7 hours of sleep per 24 |
| social | 2 | 50 | a chat a day |
| comfort | 1 | 55 | a sit about every 40 hours in a decent room (20 in the hearth hall) |
| purpose | +2 idle, −10 working | 60 | dwarves dislike idling for more than a day |
| joy | 0.75 | 60 | a hearth visit about every 40 hours, fewer with fine meals |

Per dwarf per day: 0.48 food units + 0.77 drink units. Twenty dwarves: 9.6 food, 15.4 drink. Seven dwarves over a 28-day season: 94 food, 150 drink, which is the season `embark-catalog.md` § Rules of thumb describes.

## Food chain

| Source | Output | Notes |
|---|---|---|
| 1 raw ingredient at the kitchen | 2 meal units (easy: 2 in → 4 out) | so 9.6 meals need 4.8 raw units a day |
| 1 farm tile (dimcap) | 4 plants per 16 days = 0.25 per day | plus 1 seed per harvest, so seeds are never a bottleneck |
| 1 deer | 3 meat (size 40 / 12) + hide + bones | a hunter with a crossbow takes one deer per 1–2 days |
| 1 fishing tile on a river | about 0.4 fish per day at skill 5 (35% + 15% success per 200-tick attempt, regenerating pool) | a fisher feeds 4 dwarves |
| 1 cow | milk every 4 days → 3 milk → 2 cheese | |
| 4 chickens with a nest box | an egg every 3 days each: 1.3 per day | |

Twenty dwarves eat 4.8 raw units a day: a 20-tile cave plot (5 per day) or a 14-tile plot with a hunter and a fisher. Cooking multiplies value: a lavish meal from four cheap ingredients (value 4) is worth 60 marks; a cook is the first wealth engine. Meals rot in 14 days, in a barrel in a food stockpile in 56, so a season's stock is safe.

## Drink chain

4 plants → 20 drinks. Twenty dwarves need 15.4 drinks a day = 3.1 plants a day = a 13-tile dimcap plot dedicated to the still, and 0.8 brewing jobs a day (a Skilled brewer does one in 130 ticks: three minutes of their day). Barrels: a fortress cycles about 1 barrel a day; 7 barrels in circulation is enough; a carpenter makes one in 100 ticks. Water is the fallback and costs −2 mood per drink; a well makes it dependable.

## Wood and fuel

- A tree gives 2–4 logs (average 3). A temperate forest map has about 2,000 trees; regrowth adds around 40 saplings a day in a forest, so wood is not scarce on forested maps and is scarce on steppe, desert and glasslands maps (caravans and cavern fungus trees cover the gap).
- Charcoal: 1 log → 1 fuel. An iron bar costs 0.5 fuel (1 ore → 2 bars per fuel); an iron axe (2 bars + forge fuel) costs 2 logs. A full suit of iron (helm 1, mail 3, greaves 2, gauntlets 1, boots 1 = 8 bars + 5 forge jobs) costs 4 ore, 4 smelter fuel and 5 forge fuel: 9 logs.
- Coal: a bituminous seam of ~22 tiles yields 44 fuel. Magma forges remove fuel entirely; that is the reward for digging to cavern two or finding a volcano.

## Mining and metal

| Step | Time (Adequate skill, level 4: factor 132%) |
|---|---|
| Dig an ore tile (hardness 150) | 68 ticks |
| Smelt 1 ore → 2 iron bars | 114 ticks |
| Forge an axe (2 bars) | 167 ticks |
| Forge a mail shirt (3 bars) | 265 ticks |

From a hematite vein of 25 tiles: 25 ore → 50 iron bars → enough for six full iron suits and six axes, at about 100 minutes of a single smith's work. Steel needs flux (limestone or marble, common) and one extra fuel per bar; deepsilver needs the Sea of Fire.

## Wealth curve

Wealth is item value plus building value. Typical trajectory in a wealth-2, peril-2 region with a competent player:

| End of | Wealth (marks) | Drivers |
|---|---|---|
| Year 1 | 4,000–8,000 | embark goods (about 1,500), stone blocks and furniture, first crafts, first meals |
| Year 2 | 15,000–25,000 | iron goods, smoothed rooms, cut gems, a caravan's worth of purchases |
| Year 3 | 35,000–60,000 | steel, masterworks, engraved halls, a hundred barrels |
| Year 5 | 100,000–200,000 | deepsilver items (250 each × multipliers), statues, a royal hearth hall |

Renown follows: 5 → 15 → 30 → 75. Raid size at peril 2: year 2 → 6 + 4 = 10; year 3 → 6 + 9 = 15; year 5 → 16 (cap). Immigration wave at year 3: 2 + 13 (wealth) + 2 (Content) = 12 (cap). Both curves saturate on purpose: the game does not escalate without bound; it plateaus at "large fortress" and the Deep provides the endgame.

## Combat pace

- Two unarmored goblins (copper short swords) versus one dwarf in iron mail with an iron axe and shield, both Novice: the dwarf takes light cuts (7 damage through the mail) about 40% of the time an attack lands (hit 50%, block 14%); each goblin takes serious cuts (22 damage) at 50% per swing. Expected: the dwarf kills the first goblin in about 5 swings (100 ticks), the second in another 5, having taken 2–3 light cuts (bleed 1 each: 100 blood over the fight; unconscious at 240 lost). A squad of three with mail handles a raid of ten at peril 2 with a few wounds and a hospital visit.
- Trollkin (size 150, slam 28 blunt) versus the same dwarf: 28 − (mail 12 × 0.5 = 6 blunt) = 22 bruise to the torso (ratio 0.37, serious), fractures on limbs (22 ≥ 36 × 0.3 = 10.8). Three hits floor a dwarf. Trollkin are the reason for bridges, spikes and crossbow galleries; a steel warhammer (33 damage) fractures a trollkin limb in two hits.
- Magma wyrm (torso 220, armor 12): iron axes do 22 − 12 × 1.1 = 9 per hit; steel 27.5 − 13.2 = 14; deepsilver 35 − 13 = 22. Ten deepsilver hits or twenty-five iron hits, while it breathes 40 burn at range 6 every 40 ticks. Cage traps do not hold it (size 220 > 150). Drowning does not work (it stands in water to level 6). Magma does not work. A pit of three levels (fall damage 6 × 9 = 54 to a leg, fracture) and a corridor of ten weapon traps loaded with steel spears (18 × 1.25 × 3 = 67 per trigger, minus armor 12 × 1.2 = 14) is the intended answer, or a squad in deepsilver.

## Mood floor and the no-spiral guarantee

`mood = max(55 + min(40, positives) − min(35, negatives) − need pressure + hearth bonus + personality, 20 − need pressure)`, need pressure = the four survival and company thoughts (hungry, thirsty, tired, lonely), capped at 20:

- Every need met, no thoughts: 55 (Fine). With a hearth hall (decent, +4): 59.
- Worst case with needs met: 55 − 35 + 0 = 20, and the floor keeps it at 20 for a sensitive, timid dwarf too (Unhappy, not Miserable). Misery requires need pressure, which requires the player to have failed to provide food, drink, beds or company.
- A dwarf can be Miserable only while `need pressure > 0`; the moment needs are met the floor returns to 20 and the sulk counter decays. Sulks are capped at one per week per dwarf and cost at most a chair.
- Positive thoughts cap at +40 so a fortress cannot become immune to bad news; grief always shows.
- Hall spirit for immigration (55) needs a well-kept fortress: a hearth hall (+4 to +10), decent bedrooms (+3), meals at a table (+2), ale (+3) and a chat (+3) give 55 + 11 + 4 = 70 to a fed and rested dwarf at their peak. Event thoughts fade over their duration and average about half their peak, so a fortress with all of them settles near 55–60 (measured in T-M8-06), and some standing need thoughts are always present. Immigration is the reward for exactly the things the hints tell the player to build.

## Immigration

Guaranteed: +2–4 in summer and +2–4 in autumn of year 1: 11–15 dwarves by winter. Then each season with spirit ≥ 55: 70% chance of `2 + wealth/3000 + spirit bonus`. Year 2: three waves of 4–8; year 3: waves of 8–12 until the cap (80). A player who wants a small fortress sets the cap; a player who neglects the hearth stays small without punishment.

## Trade

A year-2 fortress (renown 15, reputation 10) sees a Hillfolk caravan with `2500 + 2250 + 200 = 4,950` marks of goods. Selling 30 fine stone crafts (9 each → 270 at Hillfolk 100%) and 42 lavish meals (60 each at 80% = 48 → 2,016) gives 2,286 in valuation for goods priced 2,000 at the 12.5% margin (trading skill 4, reputation 10: 15 − 2 − 0.5), which asks for ceil(2,000 × 1.125) = 2,250; with 41 meals the offer is 12 short. The trade raises reputation by 2,000 / 500 = 4. Cooking pays for the caravan; that is the intended early economy. Metal goods pay later.

## Farming plots and light

A cave plot must be fully dark; a surface plot fully lit. Digging out a farm chamber two levels below the surface guarantees darkness; a courtyard open to the sky guarantees light. Mixed plots are refused at placement so that the player never discovers a dormant crop by surprise.

## Year-one expectation

| Day | Milestone |
|---|---|
| 1–3 | Entrance dug, stockpiles placed, still and carpenter built |
| 4–10 | First bedrooms; dining hall; hearth lit (+12 to everyone for a week) |
| 10–20 | Cave farm planted; kitchen; first hunt |
| 28 | Summer: Hillfolk caravan; first immigrants (2–4) |
| 30–56 | Ore found; smelter and forge; first iron picks and axe; more bedrooms |
| 56 | Autumn: Wildwood caravan; second guaranteed wave; at peril ≥ 2 the first ambush or raid warning |
| 84 | Winter: surface farm dormant; cave farm carries; river frozen at temper ≥ 1 |
| 112 | Year 2: Mountainhome caravan with an anvil if requested; the fortress is 11–15 dwarves with iron tools and a squad |

The pace is deliberate: the first hour of play (day 1 to about day 60) contains every basic system once, and the first raid arrives after the player has had time to build a gate.
