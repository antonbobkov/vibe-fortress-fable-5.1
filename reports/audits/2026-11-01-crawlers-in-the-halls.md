# Journal: one cave crawler in the halls of `three-years-p4-2`

**Task:** T-461 · **Date:** 2026-11-01 · **Commit examined:** `78c01f7` · **Kind:** journal, then the script's answer; corrects [the crowding measurement](2026-11-01-crowding.md)

## The answer

- **It was one crawler, not eighteen.** The 18 in the crowding report and in T-461's work file counted every hostile below the surface: 10 crawlers, 3 spiders, 3 stalkers and 2 trolls, most of them in caverns with no way to the halls. One crawler killed 43 dwarves and 15 tame animals.
- **Nothing in the fortress struck it.** In 217 attacks counted to day 236.4 every one was the crawler's. It stood at 100% blood when the journal stopped.
- **The game warned, so the fault was the script's.** The breach, the attacks, the limb, the first death: each was announced at alert or danger. T-461's decision 3 (a new announcement) is not needed, and 18 and 24 are unchanged.
- **The script now answers.** A hostile of no party that can walk to a dwarf within 14 tiles raises the hearth alert and draws the squad. `three-years-p4-2` alone goes from **47 deaths, 0 living, extinct on day 240** to **6 deaths, 59 living, not extinct**. That is one chaotic sample of one seed, not a measure of the rule.

## Journal

From the [probe](../data/2026-11-01-t461-journal.probe.ts.txt), read-only, replaying the seeds file's loop. It reproduces the crowding report's deaths: 4 by raiders on day 179, then the crawler's from day 234.

| Day | What happened | What the player was told |
|---:|---|---|
| 213.76 | A dig opens cavern 1 at (10, 39, z 22). | **Alert:** "A cavern has been breached." |
| 223.00 | The daily respawn puts one crawler at z 19, on the fortress's walker label. | Note: `MonsterSpawned` |
| 223 to 233.4 | It stands near (35, 12, 19) in state `seek` for 10.4 days. | Nothing further |
| 228.00 | A spider respawns at z 19. It never fights. | Note: `MonsterSpawned` |
| 229.02 to 231.52 | Hearth alert for a raid; the crawler is not near anybody. | The raid's own announcements |
| 233.47 | A soldier off duty, working at z 19, comes within reach and is bitten. | **Alert:** `AttackResolved`, 18 of them by day 233.69 |
| 234.3 | The crawler follows the soldier up to z 23. | |
| 234.36 | | **Alert:** limb lost, dwarf unconscious |
| 234.41 | The first dwarf bleeds out, at (32, 19, 24). | **Danger:** dwarf died, and again at each death after |
| 234.6 | The crawler is on the hall's level, z 26. | |
| 235 to 238.96 | The other deaths, nearly all in the row (34 to 39, 8) of the hearth hall. 42 of the 43 bled out. Alert still `calm`. | |
| 239.25 | Nobody is left. | |

**From the first bite to the first death the player had most of a day. From the first death to the last, four and a half days.** The alert and the squad are how 16 answers this, and 16 says plainly that nothing raises the alert by itself.

## Why nobody struck it

- **Soldiers.** The squad's mode is `off`, so members are civilians until an alert (16 § Squads). Each of the five sampled had no target for the whole fight. The script replaced fallen soldiers while the alert stayed calm, so the count kept reading 5.
- **Civilians.** They flee, and fight only when cornered or when caught by a wild animal hunting them (16 § Fleeing and morale in combat). A cavern monster is not a wild animal, so a bite does not catch anyone.
- **Dogs and cats.** 13 dogs and 2 cats were killed with no blow struck. Only war-trained animals attack hostiles (08), and hunting dogs attack only the hunter's target.

Each of these follows the spec. Whether a whole fortress should be able to die this way when the player does nothing is a question for [its own task](../../docs/archive/tasks/T-464-fortress-never-strikes-a-monster.md).

## A second finding: `seek` does not walk

18 says aggressive monsters "will follow a breach corridor into the fortress". In the code the monster takes a target anywhere on its label, and 16 drops any target more than `PERCEPTION_RADIUS` away or more than two levels off, on the same tick. So the monster stands still in `seek` until a dwarf walks near. That is why this crawler waited 10.4 days. It has [its own task](../../docs/archive/tasks/T-465-cavern-seek-stands-still.md); the fix would bring monsters to the halls sooner.

The nine crawlers at z 21 stayed there for the whole journal, in state `wander`, on a different label from the fortress.

## The script's answer

`hostilesIndoors` in `test/scenarios/three_years_fortress.ts`: a hostile with no party, awake and not stealthed, on the walker label of a dwarf within two levels and `WILD_NEAR` (14) tiles. It goes first in the targets. Any squad is sent, armed or not, since below is where the danger is; the half-day lift for wild animals does not apply to it. A raid at the same time still stations the squad at the gate, after its kill orders. It does not seal the breach, which a player might also do (19 § The cavern seal).

## Reproduce

Copy the probe to `test/perf/t461_probe.test.ts`, then:

```
npx vitest run -c vitest.perf.config.ts test/perf/t461_probe.test.ts --testTimeout=1800000
npx vitest run -c vitest.perf.config.ts test/perf/three_years_seeds.test.ts -t "p4-2" --testTimeout=1800000
```

The first takes about 4 minutes and the second about 9.
