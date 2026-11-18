# T-600: the owner's squad against a sprung peril-4 ambush

**Task:** T-600 · **Date:** 2026-11-18 · **Branch:** `t600-ambush-arena`, run on master `8d022dd9` (T-593's merge since adds no code) · **Kind:** an arena; no game rule, content row or script changed · **Source:** [the T-600 work file](../../docs/work/T-600-peril4-ambush-arena.md), [T-593's measurement](../data/2026-11-18-t593-peril4-ambushes.md), [T-544's wild-squad arena](2026-11-13-t544-wild-squad-arena.md)

## The answer

- **The owner's squad beats a sprung peril-4 ambush every time.** Five Proficient soldiers, three Proficient marksdwarves and a Proficient runecaster, all in steel, break an ambush of 6, 8 or 10 Gloam (60% warriors, 40% archers, iron, skill 8) in **144 of 144** fights, by the gate and in a hall. The ambush breaks when about half of it is down (3.1 to 4.8 members felled), a median 166 to 219 ticks after it springs (three to four and a half hours), and its rest runs off the map.
- **It is not free, and the medic decides the cost.** With two medics and cloth in the hall, the squad loses **0.21, 0.42 and 0.50** fighters a fight against 6, 8 and 10 by the gate and **0.38, 0.63 and 0.75** in a hall: a soldier every two to five fights by the gate, every one and a half to three in a hall. With no medic, as T-544's arena counts, it loses 0.75 to 1.50 a fight. Nearly every death is a soldier bleeding out after the fight from a serious cut: of the 175 dead without a medic only 25 were dead when the ambush broke. Steel stops a wolf's bite, not an iron axe or an iron arrow.
- **Fewer archers would not help the squad.** At 80% warriors and 20% archers the same squad loses 61 fighters in 144 fights with medics, against 69 at the rule's 60/40, and 171 against 175 without: within the noise. Warriors kill most of the soldiers in melee (39 of 69 with medics; archers 27). T-593's lever (60/40 to 80/20) is for civilians caught fleeing outdoors, which this arena does not measure; for the squad it is no lever.
- **The script's squad cannot do it.** Three Novice swordsdwarves in iron helm, mail and greaves (the three-year script's squad, armed in metal) win 3 of 24 fights against an ambush of five and none against eight, and lose all three soldiers in nearly every fight. Its rule, standing down for an ambush larger than its armed soldiers (T-575), is right for that squad. Five Novices in iron win 17 of 24 against five but lose 3.9 of 5 a fight; five Skilled in iron with two marksdwarves win every fight and lose 1.1 to 2.6 a fight, more than the 0.9 dwarves a peril-4 ambush kills when the fortress hides from it (T-593).

## The arena

`test/scenarios/ambush-arena.ts`, run by `test/perf/t600_ambush_arena.test.ts` (only with `T600_ARENA=1`), on `flat-test` through the real tick loop, seeds `t600-arena-<i>`, 24 fights a row. It fields its squads with T-544's `fieldSquad` (`test/scenarios/wild-squad-arena.ts`).

- **The map.** A hall of 29 by 7 dug one level below the surface, with a stair at its west end up to the surface: the gate.
- **The ambush** is built as 18 builds one (`calculatePartyComposition`, `calculateGearTier`, `spawnHostileMember`) at peril 4: archers `round(size × 0.4)`, so 2, 3 and 4 of 6, 8 and 10, the rest warriors; gear tier 3 (iron: axe, mace or spear, helm and mail half the time, shield 60%; archers a bow and 30 iron arrows), skill 8. It is created sprung, as `springAmbush` leaves it: every member revealed, the party in `engage`, morale 75. Its members stand in a seeded order.
- **By the gate:** the squad's station is on the surface three tiles from the stair head; the ambush is strung out north of it in the open, as one springs on the leader's path, its first member 8 tiles away and one every 2 tiles behind it (to 18 for six, 26 for ten), each up to 3 tiles to a side.
- **In a hall:** the ambush has come down the stair and springs in the hall, its members by the stair at the west end, the squad's station at the east end, 10 to 19 tiles away.
- **The fight.** Both squads are sent after every member, the nearest first, as the three-year script sends its squad. It ends when the party breaks (`retreat`: half its members down, or its morale gone, 18 § Morale) or is wiped, or when no fighter stands, or after two days. Then a day passes, the squads still under their orders, and the dead are counted.
- **Medics.** Two Proficient medics, with the medicine labor alone and their needs met, wait in the hall with 20 cloth: at the stair foot when the squad fights by the gate, at the east end behind the squad in the hall. They bandage the wounded once no hostile is near (17 § Patients and hospitals). Without medics, nobody does, as in T-544's arena.
- **Squads.** `steel`, the owner's, as T-544 fields it. The weaker ones show where the line is: `steel5`, its five soldiers alone; `iron5-skilled`, five Skilled axedwarves in iron helm, mail shirt and greaves with two Skilled marksdwarves; `iron5`, five Novice axedwarves in the same iron; `iron3-full`, the three-year script's three Novice swordsdwarves in iron helm, mail and greaves; `copper`, the owner's squad at Novice in copper.

The rows are in [2026-11-18-t600-ambush-arena.jsonl](../data/2026-11-18-t600-ambush-arena.jsonl) (984 fights), summarised by [2026-11-18-t600-arena-summary.cjs.txt](../data/2026-11-18-t600-arena-summary.cjs.txt). A run of all 984 takes about ten minutes locally.

## Results

"Dead" is fighters dead a day after the fight; "when it broke" those already dead as the ambush broke. "Wounded" is survivors a fight who took a wound from the ambush. Medics are not counted among the fighters.

**The owner's squad, the rule's ambush (40% archers):**

| Site | Ambush (archers) | Medics | Won | Dead | Fights with a death | Dead a fight | Dead when it broke | Wounded a fight | Killed by archers / warriors / own side | Members felled | Ticks to break, median (max) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| gate | 6 (2) | 2 | **24/24** | 5 | 5 | **0.21** | 0 | 1.2 | 3 / 2 / 0 | 3.2 | 166 (267) |
| gate | 8 (3) | 2 | **24/24** | 10 | 8 | **0.42** | 1 | 1.5 | 3 / 7 / 0 | 3.7 | 174 (297) |
| gate | 10 (4) | 2 | **24/24** | 12 | 11 | **0.50** | 6 | 2.1 | 5 / 6 / 1 | 4.7 | 219 (581) |
| hall | 6 (2) | 2 | **24/24** | 9 | 9 | **0.38** | 0 | 1.7 | 4 / 5 / 0 | 3.2 | 176 (307) |
| hall | 8 (3) | 2 | **24/24** | 15 | 12 | **0.63** | 4 | 2.0 | 5 / 9 / 1 | 4.1 | 202 (391) |
| hall | 10 (4) | 2 | **24/24** | 18 | 16 | **0.75** | 3 | 1.7 | 7 / 10 / 1 | 4.8 | 190 (352) |
| gate | 6 (2) | none | 24/24 | 18 | 17 | 0.75 | 0 | 0.8 | 4 / 13 / 1 | 3.3 | 166 (295) |
| gate | 8 (3) | none | 24/24 | 27 | 19 | 1.13 | 3 | 1.0 | 13 / 12 / 2 | 3.8 | 191 (427) |
| gate | 10 (4) | none | 24/24 | 35 | 21 | 1.46 | 6 | 1.1 | 14 / 20 / 1 | 4.7 | 200 (402) |
| hall | 6 (2) | none | 24/24 | 27 | 20 | 1.13 | 2 | 1.0 | 14 / 13 / 0 | 3.1 | 186 (481) |
| hall | 8 (3) | none | 24/24 | 32 | 19 | 1.33 | 6 | 1.4 | 13 / 18 / 1 | 4.1 | 192 (631) |
| hall | 10 (4) | none | 24/24 | 36 | 22 | 1.50 | 8 | 1.3 | 16 / 19 / 1 | 4.8 | 193 (581) |

The dead are soldiers: 5 marksdwarves and 3 casters among the 175 with no medic, none among the 69 with medics. 170 of the 175 and 67 of the 69 bled out. Both medics died, going out to the wounded while Gloam were still about, in 4 of the 144 fights (one by the gate, three in the hall).

**The lever T-593 named, 20% archers** (1, 2 and 2 archers in 6, 8 and 10):

| Site | Ambush (archers) | Medics | Won | Dead | Dead a fight | Killed by archers / warriors / own side |
|---|---|---|---|---|---|---|
| gate | 6 (1) | 2 | 24/24 | 3 | 0.13 | 0 / 3 / 0 |
| gate | 8 (2) | 2 | 24/24 | 11 | 0.46 | 3 / 8 / 0 |
| gate | 10 (2) | 2 | 24/24 | 6 | 0.25 | 2 / 3 / 1 |
| hall | 6 (1) | 2 | 24/24 | 7 | 0.29 | 2 / 5 / 0 |
| hall | 8 (2) | 2 | 24/24 | 12 | 0.50 | 3 / 9 / 0 |
| hall | 10 (2) | 2 | 24/24 | 22 | 0.92 | 3 / 19 / 0 |
| all six rows | | 2 | 144/144 | **61** (60/40: **69**) | 0.42 (0.48) | 13 / 47 / 1 (60/40: 27 / 39 / 3) |
| all six rows | | none | 144/144 | **171** (60/40: **175**) | 1.19 (1.22) | 41 / 123 / 7 (60/40: 74 / 95 / 6) |

Archers become warriors and the warriors kill what the archers did. One seed-set of 24 moves a row by several deaths (hall 10 goes from 18 to 22 with fewer archers), so the difference of 8 in 144 is noise.

**Weaker squads, by the gate, two medics:**

| Squad | Ambush (archers) | Won | Dead (of fighters) | Dead a fight | Dead when it broke | Ticks to break, median |
|---|---|---|---|---|---|---|
| owner's five soldiers alone, steel, Proficient | 6 (2) | 24/24 | 11 (of 5) | 0.46 | 9 | 307 |
| | 8 (3) | 24/24 | 23 | 0.96 | 13 | 347 |
| | 10 (4) | 24/24 | 32 | 1.33 | 22 | 382 |
| five Skilled in iron, two Skilled marksdwarves | 6 (2) | 24/24 | 26 (of 7) | 1.08 | 16 | 262 |
| | 8 (3) | 24/24 | 40 | 1.67 | 27 | 366 |
| | 10 (4) | 24/24 | 63 | 2.63 | 44 | 472 |
| five Novices in iron | 5 (2) | 17/24 | 94 (of 5) | 3.92 | 77 | 562 |
| | 6 (2) | 16/24 | 95 | 3.96 | 79 | 524 |
| | 8 (3) | 4/24 | 116 | 4.83 | 96 | 702 |
| the script's three Novices in iron | 5 (2) | 3/24 | 69 (of 3) | 2.88 | 46 | 432 |
| | 6 (2) | 1/24 | 71 | 2.96 | 48 | 432 |
| | 8 (3) | 0/24 | 72 | 3.00 | 49 | — |
| the same, no medic | 5 (2) | 2/24 | 72 | 3.00 | 49 | 531 |
| | 6 (2) | 2/24 | 71 | 2.96 | 48 | 432 |
| the owner's squad at Novice in copper | 6 (2) | 24/24 | 92 (of 9) | 3.83 | 75 | 497 |
| | 8 (3) | 21/24 | 136 | 5.67 | 119 | 692 |
| | 10 (4) | 14/24 | 178 | 7.42 | 158 | 907 |

What the marksdwarves and the caster add: the five steel soldiers alone lose twice to three times as many (0.46 to 1.33 a fight) and take half again as long. Below steel and Proficient the dead die in the fight, not after it: a medic cannot save them.

## Against the owner's bar and T-593

- The owner's bar for wildlife (no problem for the strong squad) was met against wolves and bears with under one fighter lost in ten fights. Against a peril-4 ambush the same squad never loses, and with a medic at hand loses one fighter in two to five fights by the gate and in one and a half to three in a hall: an ambush of Gloam in iron is a harder foe than a bear, and it costs. I judge it a clear win: the squad holds the field every time, the ambush is gone in four hours instead of the two days it stays when the fortress hides (T-593), and the toll is under the 0.9 dwarves a fortress loses to an ambush it hides from.
- T-593's open question is answered for the owner's squad: a player at peril 4 who builds that squad, with a medic, has an answer to an ambush that the script does not use. Its recommendation (c), to leave peril 4's ambushes as they are, stands, and the archer lever is not needed for the squad.
- Every number above is a stepped arena, not a fortress: there are no civilians to protect, nobody is caught outdoors before the squad comes, and the squad starts at its station with the ambush already in sight. In a fortress the civilians caught outdoors at the spring still die before the squad arrives; what fighting saves is the rest of the ambush's two days.

## Recommendation

1. **No game rule changes.** The rule's 60/40 stays; 80/20 does not lower the squad's losses. Peril 4's ambushes stay as T-593 left them.
2. **The three-year script should fight a sprung ambush only with a squad that wins it cheaply**, and stand down otherwise, as now: its present squad of three Novices in iron loses every fight. The follow-up `docs/work/T-NEW-script-fights-ambushes.md` sets the bar from this arena: the script fights a sprung ambush of up to 10 by the gate when it has five soldiers armed in steel helm, mail shirt and greaves at Proficient, two marksdwarves of the same skill and a medic with cloth; up to 6 with the five soldiers and a medic alone; and otherwise stands down. Its sweep measures how often the script's fortresses reach that squad (by the arena, perhaps never in three years: the script's squad is Novice and in iron), and the follow-up records that count.
3. The medic is the cheapest part of the answer: with two medics the owner's squad loses about two fifths of what it loses without (69 against 175). The three-year script already gives every dwarf the medicine labor, so its fortresses have medics.
