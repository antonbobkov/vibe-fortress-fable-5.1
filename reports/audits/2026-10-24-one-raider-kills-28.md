# Diagnosis: one Gloam captain kills 28 dwarves in p4-6 (T-447)

**Task:** T-447 · **Date:** 2026-10-24 · **Commit examined:** `836bad7` (T-427 and T-446 in) · **Kind:** diagnosis; nothing changed · **Source:** [T-446's sweep](2026-10-24-territorial-animals-away.md)

## The answer

- **The captain is the leader of the year's first siege. It killed its 28 inside a hall where nobody fought it. No raider is unhittable.**
  - On day 186 (year 2, autumn, the earliest a peril-4 siege may come) a siege of 35 arrived from the north edge: 24 Gloam warriors, 11 archers, 5 trollkin and 2 captains. The size follows the schedule, 18 + 0.5 × renown.
  - It broke the north gate door on day 186.65; trollkin break doors.
  - It killed all five soldiers at the gate in 50 ticks (days 186.678 to 186.716). Four fell to warriors and one to the captain.
  - Then it went down into the hearth hall on level 26, where 46 civilians were sheltering under the hearth alert, and cut them down over 1.6 days. The last died on day 188.3.
- **Nobody attacked the captain.**
  - It made 91 attacks and landed 85: 61 on dwarves, 17 on dogs, 7 on cats.
  - 45 of its hits on dwarves landed on dwarves that were fleeing, 6 on patients in bed and 6 on sleepers. Its victims carried no weapon.
  - The only blows aimed at it were two from Gloam archers, both blocked. It ended the siege at 600 of 600 blood with no wound.
  - The dwarves made 13 attacks on the raiders in the whole siege, all on trollkin at the broken door.
- **How the victims died:** 38 killed outright, 30 bled out after blows, 2 of infection. This count includes the tame animals; 51 of the dead were dwarves.
- **The gate and the alert were used as the fixture plays them.** The hearth alert went up on day 185.02, a day before the siege after its warning. Both gate doors were locked on the alert. Civilians sheltered in the hall: 8 on the surface at day 185.5, none from 186.79.
- **The kit on each side:**
  - The captain: an axe, a shield, a helm, a mail shirt, gauntlets and greaves, at skill 12 in every skill and 600 blood. It was never wounded, so it neither healed nor regenerated.
  - The soldiers: four short swords and a spear, each with a shield and a mail shirt, no helm or greaves.

## The cause

**This is a balance cause, not a fault.** The dwarves' combat works: their blows on trollkin hit, miss and get parried. Three things together let one captain kill 28:

1. **The first peril-4 siege outmatches the fortress's squad.** Forty-two raiders against five half-kitted soldiers is what the schedule sends to a fortress of this renown at the earliest date. The fixture's squad does not grow with the threat.
2. **A sheltering fortress has no second line.** Once the gate falls, the hall is a dead end. Civilians attacked by a party hostile keep fleeing (10: a party hostile does not *catch* a civilian), and the hall always offers a farther tile. So none of them is ever cornered, and none fights back. They are struck while running: the captain hit 34 dwarves, a median of 2 blows each (1 to 4).
3. **The captain's strength.** At tier 4 (siege +1, captain +1, capped at peril 3) it has skill 12 in everything, iron armour on every part, and an axe. No civilian blow, and no Novice soldier's blow, gets through it in this fight.

## The decision it needs

Options, for the orchestrator:

- **(a) Schedule.** The first peril-4 siege is smaller, or later, or scales with the fortress's military (soldiers armed and armoured) as well as with renown. Today it is 18 + 0.5 × renown, up to 40, from year 2 autumn.
- **(b) Fortress behaviour.** A civilian in a shelter that a party has entered fights back when attacked and no exit leads out of the shelter, rather than fleeing in circles. This would change 10's caught and cornered rules for party hostiles.
- **(c) The fixture's player.** Answer a siege warning by raising every adult with a weapon, or by fighting at the gate before it breaks, instead of sheltering everyone. This changes the measurement, not the game.
- **(d) Accept it.** A peril-4 siege can wipe out an unprepared fortress, and p4-6 measures that.

## What was run

- `2026-10-24-t447-raid.probe.ts.txt`: three-years-p4-6 at peril 4 as three_years_seeds plays it, days 140 to 190. It journals every attack a raider makes or takes, with both sides' kit, skill, blood and behaviour; every 50 ticks each raider and each soldier; raids, alerts, squad orders, gate doors and deaths.
- The runner of three_years_seeds on `836bad7` reproduces the run: 51 dwarf deaths, extinct on day 189.
- The journal summary is in [`2026-10-24-t447-raid.json`](../data/2026-10-24-t447-raid.json).

## The rule taken (decision b) and what it measured (2026-10-29)

The orchestrator chose (b). 10 § Behavior selection now has a civilian sheltering under the `hearth` alert, attacked by a hostile party member inside its shelter, fight back as a cornered civilian. Both must stand inside the shelter area of step 2, which is the hearth hall when the dwarf shelters there.

| Measure (on `836bad7`'s simulation) | T-446 row | With the rule |
|---|---|---|
| Annual instrument | 13/6/7/142/8/0/0 | 13/6/7/142/8/0/0, all twelve hashes identical |
| pp_defence | 4 of 4 | 4 of 4 |
| `three_years_seeds` | 20 of 20; deaths 158, living 867 | 20 of 20; deaths **158**, living **867**, all twenty hashes identical |
| Deaths by cause | wildlife 6, parties 133, bled out unattributed 14, infection 3, another dwarf 2 | the same |
| p4-6 | 51 deaths, extinct on day 189 | 51 deaths, extinct on day 189 |

**The rule never fires in the sweep, and p4-6 is unchanged.** A journal of p4-6's attacks on day 186 and 187 shows why:

- p4-6's hearth hall is 30 tiles. The 46 sheltering dwarves do not fit in it, and the ones the captain strikes stand on the stair landing and the corridor next to it, at (29–30, 11–12, 26), or at the stair top on the surface, at (29, 11, 32).
- None of those tiles is in the shelter area as step 2 defines it, so these dwarves are not "inside the shelter" and still flee.

A wider area was tried and not taken: the indoor tiles around the retreat tile reached without passing a door, the hall included. With it p4-6 still loses 51 dwarves, extinct on day 190 instead of 189. Unarmed Novices who fight back do not hurt a skill-12 captain in iron.
