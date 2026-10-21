# Balance Model

**Owner:** content · **Depends on:** every system document, [`../01-architecture/constants.md`](../01-architecture/constants.md)

This document is the cross-system arithmetic behind the tuning constants. It states the intended pace of a fortress and shows that the numbers in the system documents and content tables produce it. Where a constant in a system document was changed by this pass, the system document has been updated to match; this file is the explanation.

## Time and pace

- One game day = 1,200 ticks = 60 real seconds at 1×. A season is 28 minutes, a year just under two hours.
- A dwarf walks 0.15 tiles per tick, 180 tiles in a day: 7 seconds real time to cross 20 tiles, 32 seconds to cross the map. Every creature's speed is in [creatures.md](creatures.md); they keep the same ratios to the dwarf's.
- A 3×3 room in granite (hardness 150) takes a novice miner 9 × 90 = 810 ticks (41 s) of digging; a Proficient miner (level 10) 9 × 50 = 450 ticks. A ten-tile corridor is 900 ticks (45 s) at skill 0 and 500 at skill 10. Measured: the game's dig jobs take exactly these ticks, 92 and 51 a tile on average. A lone miner needs 3,411 ticks (skill 0) and 2,239 ticks (skill 10) from the designation to the ninth floor, because sleep, drink, food and talk take 40% of its time and the walk back to the face after each of them another 40% ([work pace](../../reports/audits/2026-10-18-work-pace.md)).
- A year-1 fortress digs about 400 tiles, builds 6 workshops, 10 bedrooms and a dining hall, and reaches 13 dwarves. The economy fixture's first year does more: 541 tiles dug and 11 stairs, 368 tiles smoothed, 8 workshops, 15 bedrooms, a dining hall, a hearth hall and a hospital, 352 workshop jobs, and 23 dwarves at day 112 ([work pace](../../reports/audits/2026-10-18-work-pace.md)). Workers there are at skill 5 to 9 (mining 9) and mood leaves them 88% to 105% of base productivity.

## Needs and consumption

Need rates per hour (10 Dwarves, as revised by this pass):

| Need | Rise per hour | Want at | Result |
|---|---|---|---|
| hunger | 1 | 50 | a meal about every 50 hours: 0.48 food units per dwarf per day |
| thirst | 1.6 | 50 | a drink about every 31 hours: 0.77 drinks per dwarf per day |
| rest | 5 awake, −15 asleep | 60 | 6 hours asleep per 24 by the rates, each sleep ending when rest reaches 0; measured, 2 in bed (below) |
| social | 2 | 50 | a chat a day |
| comfort | 1 | 55 | a sit about every 40 hours in a decent room (20 in the hearth hall) |
| purpose | +2 idle, −10 working | 60 | dwarves dislike idling for more than a day (*unmeasured*) |
| joy | 0.75 | 60 | a hearth visit about every 40 hours, fewer with fine meals |

Per dwarf per day: 0.48 food units + 0.77 drink units. Twenty dwarves: 9.6 food, 15.4 drink. Seven dwarves over a 28-day season: 94 food, 150 drink, which is the season `embark-catalog.md` § Rules of thumb describes.

The intervals above count the need itself, not the walk to serve it. A dwarf at default priorities starts about three and a half need errands a day: 1.2 for sleep, 0.6 for a drink, 0.4 for a meal, and 1.2 in all for a talk, a sit and a hearth visit. It takes those last three when it has no work, or, once one of them reaches `LEISURE_MARK`, as one sit in the hearth hall before its work; the rest of them is relieved in passing, at the table and in the hall. Measured over the first year of a fortress of 7 to 14 dwarves, with no job more urgent than a need, the errands take three fifths of a dwarf's time, and most of it is travel:

| Share of a dwarf's time | In use | In travel |
|---|---|---|
| Sleep | 9% | 17% |
| Food and drink | 4% | 18% |
| Talk, sit, hearth visit | 7% | 6% |
| **All needs** | **20%** | **41%** |

Work takes 37% (28% at jobs, 10% hauling) and almost none of the rest is idle. In a fortress of 40 to 56 dwarves the walk to the food and the drink grows, and needs in travel take 48% by the third year. Social is over its want threshold about half the time, joy two fifths and comfort a fifth. Travel is the walk to the bed, the food, the seat or the hall, and for a meal the walk from the food to a table. A meal is 60 ticks of eating after about 300 ticks on the way; a drink is 40 ticks after about 145. The use shares follow from the need rates and do not change with walking speed. Sleep is short in use because the game lowers rest at the sleeping rate from the moment a dwarf sets off for its bed: it walks 4 hours a day to its bed and lies in it 2, the walk takes about 40 off a rest of 70, and a quarter of its sleep errands end the moment it lies down ([sleep](../../reports/audits/2026-10-21-sleep-hours.md)). [balance-status.md](../balance-status.md) holds the latest measurement.

## Food chain

| Source | Output | Notes |
|---|---|---|
| 1 raw ingredient at the kitchen | 2 meal units (easy: 2 in → 4 out) | so 9.6 meals need 4.8 raw units a day |
| 1 farm tile (dimcap) | 4 plants per 16 days = 0.25 per day | plus 1 seed per harvest. Measured ([farm yield](../../reports/audits/2026-10-18-farm-yield.md)): 0.247 a day at farming skill 0 to 4 and 0.32 from skill 5, cavewheat 0.21, a turnip tile 0.13 over a year. Seeds do not multiply, so a plot is never short of seed when it has as many seeds as tiles, and stays as small as its seeds when it has fewer |
| 1 deer | 3 meat (size 40 / 12) + hide + bones | a hunter with a crossbow takes one deer per 1–2 days (*unmeasured*) |
| 1 fishing tile on a river | about 0.4 fish per day at skill 5 (35% + 15% success per 200-tick attempt, regenerating pool) | a fisher feeds 4 dwarves (*unmeasured*) |
| 1 cow | milk every 4 days → 3 milk → 2 cheese | *unmeasured* |
| 4 chickens with a nest box | an egg every 3 days each: 1.3 per day | *unmeasured* |

Twenty dwarves eat 4.8 raw units a day: a 20-tile cave plot (4.9 per day, measured) or a 14-tile plot with a hunter and a fisher (*unmeasured*). Cooking multiplies value: a lavish meal from four cheap ingredients (value 4) is worth 60 marks; a cook is the first wealth engine. Meals rot in 14 days, in a barrel in a food stockpile in 56, so a season's stock is safe.

## Drink chain

4 plants → 20 drinks. Twenty dwarves need 15.4 drinks a day = 3.1 plants a day = a 13-tile dimcap plot dedicated to the still (3.2 plants a day, measured), and 0.8 brewing jobs a day (a Skilled brewer does one in 130 ticks: three minutes of their day), *unmeasured*. Barrels: a fortress cycles about 1 barrel a day; 7 barrels in circulation is enough (*unmeasured*); a carpenter makes one in 100 ticks. Water is the fallback and costs −2 mood per drink; a well makes it dependable. Measured over twelve generated years with no drink at all ([brook drinking](../../reports/audits/2026-10-18-brook-drinking-under-wildlife.md)): with the brook within 6 tiles of the wagon the fortress lives (79 dwarf-years in nine, against 93 with a brew); with the nearest bank 40 tiles away it loses 98 against 156 and four of twelve fortresses, to hunger or thirst and to wild animals on the walk; with no surface water in reach it dies of thirst on day 19. A brook freezes in a taiga winter, from day 85, and a fortress with no drink in stock, no brew and no well on unfrozen water loses its dwarves to thirst on days 101 to 103 at any distance from the bank ([diagnosis](../../reports/audits/2026-10-18-no-drink-deaths-diagnosis.md)). A fortress whose drink stockpile wants no barrels drinks at the brook for two drinks in three beside the wagon and four in ten 40 tiles away.

## Wood and fuel

- A tree gives 1 to 4 logs by species (oak 2–4, birch 1–3, yew 1–2, the rest 2–3): 2.5 on average in a temperate forest. A temperate forest map has about 2,000 trees; regrowth tries 40 tiles a day at 4.4% in a forest (*unmeasured*), at most two saplings a day, so the stock of trees and not their regrowth keeps wood from being scarce on forested maps, and it is scarce on steppe, desert and glasslands maps (caravans and cavern fungus trees cover the gap).
- Charcoal: 1 log → 1 fuel. An iron bar costs 0.5 fuel (1 ore → 2 bars per fuel); an iron axe (2 bars + forge fuel) costs 2 logs. A full suit of iron (helm 1, mail 3, greaves 2, gauntlets 1, boots 1 = 8 bars + 5 forge jobs) costs 4 ore, 4 smelter fuel and 5 forge fuel: 9 logs.
- Coal: a bituminous seam of ~22 tiles yields 44 fuel. Magma forges remove fuel entirely; that is the reward for digging to cavern two or finding a volcano.

## Mining and metal

| Step | Time (Adequate skill, level 4: factor 132%; measured to the tick, [work pace](../../reports/audits/2026-10-18-work-pace.md)) |
|---|---|
| Dig an ore tile (hardness 150) | 68 ticks (69 measured) |
| Smelt 1 ore → 2 iron bars | 114 ticks (114 measured) |
| Forge an axe (2 bars) | 167 ticks (167 measured) |
| Forge a mail shirt (3 bars) | 265 ticks (266 measured) |

From a hematite vein of 25 tiles: 25 ore → 50 iron bars → enough for six full iron suits and six axes, at about 9,000 ticks of a single smith's work at level 4 (25 smelts 2,850, six suits of five pieces 5,180, six axes 1,000): 7.5 days, 7.5 minutes of play at 1×. The inputs reach the workshop about 100 ticks after the order. Steel needs flux (limestone or marble, common) and one extra fuel per bar; deepsilver needs the Sea of Fire.

## Wealth curve

Wealth is item value plus building value. Typical trajectory in a wealth-2, peril-2 region with a competent player:

| End of | Wealth (marks) | Drivers |
|---|---|---|
| Year 1 | 8,000–25,000 | embark goods (about 1,350), stone blocks and furniture, first crafts and the squad's iron: 4,000–7,000; a season's food in stock as lavish meals and drink: 5,000–19,000 |
| Year 2 | 15,000–25,000 | iron goods, cut gems, a caravan's worth of purchases, prepared meals and drink |
| Year 3 | 35,000–60,000 | steel, masterworks, a hundred barrels, lavish meals |
| Year 5 | 100,000–200,000 | deepsilver items (250 each × multipliers), statues, a royal hearth hall; *unmeasured* |

The food stock is the largest term from the first year: a lavish meal is worth 60 marks, one cook's job of 250 ticks makes eight from four cheap ingredients, and a fortress that keeps a season's food as lavish meals holds 5,000 to 19,000 marks of it at the end of year 1. Measured in the economy fixture ([year-1 wealth](../../reports/audits/2026-10-21-year-one-wealth.md)): 9,000 to 25,000 marks at day 112, of which 4,300 to 6,700 is everything but meals and drink. The kitchen carries years 2 and 3 as well: there the fixture's wealth less meals and drink is 7,400 to 10,400 and 11,000 to 16,400, well under the iron, gem, steel and masterwork drivers above, while its totals reach the bands.

Smoothing and engraving raise room tiers (mood and immigration), not wealth.

Renown follows wealth and population: measured at peril 2, 12.8 → 24.4 → 41.7 at the ends of years 1 to 3 (13 → 29 → 36 at peril 0), and it follows the food stock: meals and drink are two thirds to four fifths of the wealth in each year, and without them renown would be about 5 → 10 → 15; 75 in year 5 is *unmeasured*. A raid at peril 2 never comes in winter and is first possible in the spring of year 2, so each year's raid is sized by the renown of its spring and summer: year 2 → 6 + 0.3 × 11–16 = 9–11 (measured 8–11, median 10); year 3 → 6 + 0.3 × 19–38 = 12–16 (measured 12–16, median 14); year 5 → 16 (cap, *unmeasured*). The fortress meets each raid behind its gate, and the raid loots and leaves ([raid sizes and renown](../../reports/audits/2026-10-21-raid-sizes-and-renown.md)). Immigration wave at year 3: 2 + 13 (wealth) + 2 (Content) = 12 (cap). Both curves saturate on purpose: the game does not escalate without bound; it plateaus at "large fortress" and the Deep provides the endgame.

## Combat pace

The figures below are measured in stepped arenas ([combat pace](../../reports/audits/2026-10-21-combat-pace.md), [combat pace tune](../../reports/audits/2026-10-21-combat-pace-tune.md)), except the magma wyrm's, which are *unmeasured*. A soldier's kit is a helm, a mail shirt and greaves: a mail shirt alone leaves the head and legs bare. A squad of three meets an ambush; a raid of ten is met at a gate.

- Two unarmoured goblins (copper short swords, skill 2) versus one Novice dwarf in an iron mail shirt with an iron axe and shield. A hit lands where the body plan's weights send it: torso 35, arms 24, legs 31, head 10. A mail shirt covers the torso and 60% of the arms, so a copper sword does nothing to the torso, a light cut to an arm, and a serious cut (bleed 3 until bandaged) to the bare head or a leg. The goblins hit 46% of their swings and the shield blocks one in eight of the rest; the dwarf hits 57% for about 21, but its hits are spread over six parts and a goblin dies bleeding, at the dwarf's 8th and 13th swing. Over a fight of about 280 ticks the dwarf takes 2.6 light, 3.8 serious and 0.6 grievous cuts, loses 364 blood (unconscious at 360 lost, below 40% of the 600 a dwarf holds) and is down in four fights of five. With a helm and greaves every wound is light: the dwarf takes about eight light cuts over a fight of 400 ticks, each bleeding 1 a health tick until it clots after `CLOT_TICKS`, loses about 210 blood and wins 55 fights of 60, with a hospital visit. Every serious cut needs a medic in time. Three soldiers in full kit drive off an ambush of four at peril 2 in every trial. A squad of three in the open loses to a raid of ten at peril 2 (skill 6, a captain at 10) in nearly every trial, in full kit or at Competent skill alike; a locked gate turns the same raid away without a blow.
- Trollkin (size 150, slam 28 blunt) versus the same dwarf: 28 − (mail 12 × 0.5 = 6 blunt) = 22 bruise to the torso (ratio 0.37, serious), fractures on limbs (22 ≥ 36 × 0.3 = 10.8). Three hits floor a dwarf (measured: a median of 3, from 1 to 6). Trollkin are the reason for bridges, spikes and crossbow galleries; a steel warhammer (33 damage) fractures a trollkin limb in one hit, sometimes two (52 and 24 of 85 fractures).
- Magma wyrm (torso 220, armor 12): iron axes do 22 − 12 × 1.1 = 9 per hit; steel 27.5 − 13.2 = 14; deepsilver 35 − 13 = 22. Ten deepsilver hits or twenty-five iron hits, while it breathes 40 burn at range 6 every 40 ticks. Cage traps do not hold it (size 220 > 150). Drowning does not work (it stands in water to level 6). Magma does not work. A pit of three levels (fall damage 6 × 9 = 54 to a leg, fracture) and a corridor of ten weapon traps loaded with steel spears (18 × 1.25 × 3 = 67 per trigger, minus armor 12 × 1.2 = 14) is the intended answer, or a squad in deepsilver (*unmeasured*).

## Wild animals

Wildlife on a peril-0 map without `serene_vale` is a hazard that a careless fortress pays for, not an extinction. The rules that make it so: a defending animal (08) lets go once its target is out of its provoke radius from where the attack began, or unconscious, and never takes a second target from the same attack; a light wound stops bleeding after `CLOT_TICKS` (17), so only serious and grievous wounds need a medic in time; a squad's kill order reaches the animal wherever it is (16).

The intended figures, for one territorial animal (badger, boar) or one fed wolf whose ground seven civilians keep crossing for three days:

| The fortress | Civilians lost |
|---|---|
| No medic, nobody answers | about one per animal (badger 0.9, boar 1.7, wolf 1.3 per encounter); never the whole group |
| A medic with cloth | badger none; boar under one; wolf almost none |
| A medic with cloth, and a squad sent to kill the animal | **none to a badger**; boar and wolf almost none |

An unarmoured soldier sent against a boar or a wolf can still be killed; armour is the answer.

A *hungry* predator (08 § `hunt`) prefers animal prey to dwarves, and its pack shares one quarry and one meal; it keeps its quarry while it remains eligible and in perception. A civilian it catches fleeing turns and fights with what it carries (10 § Behavior selection), so a wolf that hunts a group of haulers usually dies of it, though the first dwarf it catches usually dies too. The intended figures, for a forest or taiga map at peril 0 over a year: a fortress that ignores wolves loses livestock regularly and a dwarf now and then, a few a year at most; one that reacts (pasture behind a door, alert raised, squad sent) loses no dwarf to wildlife.

Measured annual survival on twelve standard generated maps (four seeds each in forest, taiga and grassland), Balanced embark, all wild species, and the browser opening: median 13 living, minimum 2, second-worst 8, eight years without a wildlife dwarf death, no extinction and no hunger/thirst-labelled death; § Many-seed annual survival has the table. The guard is off duty except under alerts, has no supplied armour, and this opening has no doors or hospital; alert response starts on day 20. These are regression bounds for that opening, not success against the intended target.

A separate player comparison issues its protective commands at the start: three wooden clubs, a mined hearth shelter and an alert-locking door, an immediate three-member squad, and proximity/alert response from the opening tick. It changes no farm area, crop supply or food quantity. Actual clubs become ready on days 6-12 and doors on days 6-13; ordering them in the first week is not counted as already having protection. Across the same twelve seeds it ends with median 13, minimum 11, eight years without a wildlife dwarf death, no extinction, three wolf dwarf deaths, one boar dwarf death and one hunger/thirst-labelled death. It supplies neither armour nor a hospital, and does not establish the zero-loss target. A pack's kill clears its newly fed members' hunting targets and pursuit paths, including an attack begun as a hunt; this rule fix leaves all twelve original instrument rows and hashes unchanged.

The [wildlife diagnosis and preparation measurement](../../reports/audits/2026-10-11-wildlife-deaths-and-preparation.md) records each original wolf-only death, readiness times and before/after rows. The original compact fortress forms its squad on day 10, and its late taiga response has unarmed members and no built door. Those runs are not evidence that an armed fortress with a protected pasture fails the intended target. No numeric tune is justified before the missing protection and medical-service qualifications are addressed.

A seven-hauler group crossing a hungry wolf's ground for three days loses 17 of 70 (9 of 70 when every hauler holds a pick), and the wolf dies in eight runs of ten (all ten with picks). A defending animal does not catch a fleeing civilian; with a medic, the fed-animal probe loses no dwarf to a badger or wolf, and 7 of 70 to a boar. With a medic and a squad it loses none to a badger or fed wolf, and 2 of 70 to a boar.

With all natural wild species left on the map, ignoring wildlife costs 42 dwarves in six fortress-years, with 3 fortresses extinct by the endpoint; reacting costs 18, with 2 extinct. The [current wildlife measurement](../../reports/audits/2026-10-11-wildlife-after-t219.md) holds the per-seed causes and endpoints. These figures do not meet the intended survival limit; [balance-status.md](../balance-status.md) holds the latest fixture qualifications.

With one sheep, goat and cow added to the existing pasture in each of six forest/taiga years, the measured losses to wolves are:

| Pasture and response | Grazers killed by wolves / 18 supplied | Dwarves killed by wolves / six fortress-years |
|---|---|---|
| Exposed, ignores wolves | 1 goat | 24 |
| Exposed, raises the alert and sends its squad | 1 goat | 14 |
| Wall enclosure and door, ignores wolves | 1 goat, 1 sheep | 26 |
| Wall enclosure and door, raises the alert and sends its squad | 1 goat, 1 sheep | 22 |

The enclosure is added after the fortress setup: one seed already has wolves inside on day 7; the other five have none at placement and lose no grazer to wolves. In a short control with the enclosure present before the wolves, the exposed pasture loses a sheep and the enclosure loses none. The cow is never eligible wolf prey. Forty-three grazers starve across the 24 year cases, 42 in winter; several runs stop with living grazers after the last dwarf dies. These modified fixtures do not establish a competent player's whole-fortress defence, and they are separate from the original no-grazer year figures above. The [pack-prey report](../../reports/audits/2026-10-11-pack-prey-size.md) states the starting conditions and measured causes; no farm capacity or production timing was added.


## Mood floor and the no-spiral guarantee

`mood = max(55 + min(40, positives) − min(35, negatives) − need pressure + hearth bonus + personality, 20 − need pressure)`, need pressure = the four survival and company thoughts (hungry, thirsty, tired, lonely), capped at 20:

- Every need met, no thoughts: 55 (Fine). With a hearth hall (decent, +4): 59.
- Worst case with needs met: 55 − 35 + 0 = 20, and the floor keeps it at 20 for a sensitive, timid dwarf too (Unhappy, not Miserable). Misery requires need pressure, which requires the player to have failed to provide food, drink, beds or company.
- A dwarf can be Miserable only while `need pressure > 0`; the moment needs are met the floor returns to 20 and the sulk counter decays. Sulks are capped at one per week per dwarf (*unmeasured*) and cost at most a chair.
- Positive thoughts cap at +40 so a fortress cannot become immune to bad news; grief always shows.
- Hall spirit for immigration (55) needs a well-kept fortress: a hearth hall (+4 to +10), decent bedrooms (+3), meals at a table (+2), ale (+3) and a chat (+3) give 55 + 11 + 4 = 70 to a fed and rested dwarf at their peak (*unmeasured*). Event thoughts fade over their duration and average about half their peak, so a fortress with all of them settles near 55–60 (measured in T-M8-06), and some standing need thoughts are always present. Immigration is the reward for exactly the things the hints tell the player to build.

## Immigration

Guaranteed: +2–4 in summer and +2–4 in autumn of year 1: 11–15 dwarves by winter. Then each season with spirit ≥ 55: 70% chance (*unmeasured*) of `2 + wealth/3000 + spirit bonus`. Year 2: three waves of 4–8; year 3: waves of 8–12 until the cap (80). A player who wants a small fortress sets the cap; a player who neglects the hearth stays small without punishment.

## Trade

A year-2 fortress (renown 15, reputation 10) sees a Hillfolk caravan with `2500 + 2250 + 200 = 4,950` marks of goods. Selling 30 fine stone crafts (9 each → 270 at Hillfolk 100%) and 42 lavish meals (60 each at 80% = 48 → 2,016) gives 2,286 in valuation for goods priced 2,000 at the 12.5% margin (trading skill 4, reputation 10: 15 − 2 − 0.5), which asks for ceil(2,000 × 1.125) = 2,250; with 41 meals the offer is 12 short. The trade raises reputation by 2,000 / 500 = 4. Cooking pays for the caravan; that is the intended early economy. Metal goods pay later. The caravan's value and the margin in this example are *unmeasured*.

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
| 56 | Autumn: Wildwood caravan; second guaranteed wave; at peril ≥ 2 the first ambush or raid warning (measured: at peril 2 an ambush of 4 or a band of 3 bandits on days 57 to 62; at peril 4 the first ambush on days 58 to 71 and the first raid, of 13, on days 59 to 76, [raid sizes and renown](../../reports/audits/2026-10-21-raid-sizes-and-renown.md)) |
| 84 | Winter: surface farm dormant; cave farm carries; river frozen at temper ≥ 1 (*unmeasured*) |
| 112 | Year 2: Mountainhome caravan with an anvil if requested; the fortress is 11–15 dwarves with iron tools and a squad |

The pace is deliberate: the first hour of play (day 1 to about day 60) contains every basic system once, and the first raid arrives after the player has had time to build a gate.

### Pasture feeding

The capacity allowance uses replenishing, accessible grass per grazer, with no competing animals; the rate is defined in 08. The [pasture measurement](../../reports/audits/2026-10-12-pasture-capacity-and-winter-feeding.md) keeps six separately allocated grazers below condition 100 for 60 growing-season days and 28 winter days on cave moss. Outdoor winter is excluded from that guarantee because grass neither regrows nor remains edible under snow. The capacity warning remains conservative as standing grass is consumed; starvation and grazing rates are unchanged.

### Many-seed annual survival

The standard-size, command-driven wildlife-year instrument uses twelve distinct seeds, four in each of temperate forest, taiga and temperate grassland, at peril 0. Balanced embark, the browser opening and work orders, its three-member squad and wildlife alert policy define the player. Actual immigration counts and qualifying farm areas are recorded rather than fixed to a nominal population or made uniform by extra supplies.

| Measure | Target | Latest accepted | Best measured | Regression bound |
|---|---|---:|---:|---|
| Median living dwarves | At least 11 of the nominal twelve | 13 | 13 | At least 12 |
| Minimum living dwarves | At least 8 | 2 | 9 | Reported; not guarded as a single sample |
| Second-worst living dwarves | At least 8 | 8 | 10 | Reported; not guarded as a single sample |
| Sum of the living over the twelve seeds | — | 140 | 148 | At least 136 |
| Years without a wildlife dwarf death | All | 8 of 12 | 8 of 12 | At least 6 of 12 |
| Extinct fortresses | None | 0 | 0 | At most 1 |
| Dwarf deaths from hunger or thirst | None | 0 | 0 | At most 1 across the cohort |

The latest accepted row is the [measurement with light cuts clotting in 150 ticks](../../reports/data/2026-10-21-t404-wildlife.json): forest median 12.5, taiga 9.5, grassland 14.5; the worst seed is taiga seed 3 with 2 (eleven wolf deaths), and the sum of the living is 140. The best measured figures, from which the bounds are computed, come from an earlier row ([rows](../../reports/data/2026-10-16-t354-wildlife.json)): minimum 9, second-worst 10, sum 148. [balance-status.md](../balance-status.md) holds the latest figures with their fixture qualification; the reports hold the history.

The guarded figures are the median, the sum of the living over the twelve years, wildlife-free years, extinctions and hunger/thirst deaths. Their bounds are computed from the best measured figures: median minus one dwarf, sum of the living minus twelve dwarves, wildlife-free minus two seeds, extinction count plus one fortress, and hunger/thirst deaths plus one. Always report the worst and the second-worst seed, but do not guard a single seed: one fortress's year turns on which dwarf an animal reaches first, and changes that only move the job timeline shift single seeds by five or more living in both directions while the sum moves by less than ten. Block a change when any bound fails or when three or more of the five guarded figures worsen together, even within their tolerances. Compare simultaneous worsening against the latest accepted before row, so an earlier tolerated drop is not counted again on a later change. Keep that latest actual row alongside the best figures used for the bounds; update the row and every improved measured figure in the same commit, retaining earlier better bounds when a tolerant figure falls. Always record the actual before and after rows. The survival targets remain unchanged.

When a seed changes outcome class (extinct or surviving), or changes by five or more living, under a change that only moves the job timeline, name it as unstable in the commit body and retain the seed in the living balance status. The cohort stays at twelve seeds, which is what a behaviour change can afford to run; the sum of the living is the guard that unstable seeds cannot flip alone. The seed records, the worst and the second-worst outcome remain in every measurement.

Re-measure the distribution before and after a change to wildlife, fleeing, alerts or treatment. The instrument records its target beside the measured bounds. The browser year's single sample asserts that the fortress survives and nobody dies of hunger or thirst, and prints its remaining end state.
