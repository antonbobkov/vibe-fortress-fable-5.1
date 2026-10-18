# T-387 — Peril-2 fortresses of the economy fixture die out in year 2

**Closed:** 2026-10-18, in 062f3c8, dc3d7e1.

**Source:** the peril-2/4 sweep of 2026-10-17 at `3b75d98`, [data](../../../reports/data/2026-10-17-t381-peril-2-4-sweep.json) · **Size:** M · **Needs:** — · **Status:** open

## Why

The four peril-2 seeds that pass their invariant checks all die out: `p2-6` on day 104, `p2-4` on day 139, `p2-5` on day 157, `p2-3` on day 236. Their dwarf deaths are mostly bleeding and killing (fights with raiders, thieves and wild animals: 35 bled out, 12 killed), with 16 starvation deaths in `p2-3` and `p2-5` (starvation is not asserted at peril 2). At peril 4 three of the five seeds that pass are alive at the end (46, 37 and 10 dwarves). The peril-2 raids are smaller (7–9) than peril 4's (11–24), and both perils take the anvil in the wagon, so why the smaller threat ends more fortresses is the question.

T-381 (raid sizes at peril 2) needs living peril-2 fortresses, and `balance.md` expects a competent fortress to handle a raid of ten at peril 2 with a squad of three in mail.

## What to do

1. Diagnosis first, from the data and one probe run of `p2-4` (about 13 minutes): when each dwarf dies, of what and to whom; when the squad was armed and in mail; how many of each raid's members died; the food and drink stocks before the starvation deaths.
2. Decide whether the fixture plays the defence a player would (arming, the gate, the alert, the hospital) or the model is wrong for peril 2, and file the fixture change or the model change.

## Done

- The cause is named in this file, and the change that follows is filed or made.

## Cause, 2026-10-18

Probes of `p2-3`, `p2-4`, `p2-5`, `p2-6` and `p4-2` at `2803b22`, played exactly as the sweep plays them (`p2-4` reproduces the sweep's death list day for day), journalling every death with the victim's last place and activity and the killer, every hostile party, and once a day the squad's kit, the alert, the hospital, the room plans, the miners' work and the metal chain. The fixture does not play the defence a player would; no game fault was found, and the balance model cannot be judged from these runs.

1. **No shelter.** With the anvil in the wagon the script digs the squad's ore at the kit's priority (3) ahead of everything at the routine priority (5), and keeps that order until the whole kit (21 iron bars) is forged. On `p2-6` the reachable ore is galena and the kit stood at one mail shirt and one shield for 100 days; on `p2-5` the hematite ran out at two swords of three; on `p2-4` one of the two miners died on day 3. On those seeds the founders' bedrooms and the hospital were not dug by day 60 to 120 (`p2-4`: 2 of the hospital's 16 tiles on day 140; `p2-6`: one tile of the first bedroom on day 91): every dwarf slept, worked and lay wounded on the surface. On `p4-2`, which survives, the kit was forged by day 48, the miners were released and nine rooms and the hospital were dug by day 61. This, and not the peril, is why peril 4 did better.
2. **The autumn ambush (18: four Gloam with bronze gear, no warning) found them there.** `p2-4` day 63: 5 dwarves, every dog and the cat in 900 ticks; `p2-6` days 61–62: 9; `p2-5` day 58: 4. The victims were the soldiers, who leave the gate to fight what they see (16 § on duty), the wounded resting where they fell (17: no hospital bed), and civilians caught outdoors.
3. **The squad was refilled during the fight.** The script replaced a dead soldier at once with the next adult, unarmed, who walked out to the fight: two of `p2-4`'s day-63 deaths.
4. **Threat warnings were ignored.** The day-122 raids (`p2-4`: 9 and a captain; `p2-5`: 7) were announced a day ahead (`ThreatWarning`); the script raised the alert only when the party arrived, 220 ticks before the first death, and killed dwarves were idle on the surface.
5. **The thirst deaths are the script's alert.** On `p2-3` a boar by the gate raised the hearth alert on day 209 and kept it up to the end: a squad short of three weapons does not hunt, the gate stayed locked with all 14 dwarves inside, the brook was outside, and all 14 died of thirst on days 234–236 (17 names it `starvation`). The two `p2-5` starvation deaths are its last two dwarves, under alerts, on days 155–157.

Hospital supplies were not the limit: cloth stayed at 4–5 on every seed.

**Change (test fixture only, `three_years_fortress.ts`, `three_years_economy.ts`):** where the anvil comes in the wagon, the founders' bedrooms, the hospital and the corridor to them are dug at the kit's priority and the squad's ore is opened once they are dug; a `ThreatWarning` raises the alert until its party comes; the squad's dead are replaced only once the alert is down; an alert for wild animals alone that the squad does not hunt is lifted after half a day, and animals alone raise none for a day after. `testing-strategy.md` § The long scenarios describes it.

**Rerun, 2026-10-18 at `062f3c8`** (`-t "p2-"`, alone; [data](../../../reports/data/2026-10-18-t387-peril-2-sweep.json)): no peril-2 fortress dies out. Three seeds run the three years and end alive: `p2-2` 48 dwarves, `p2-5` 57 (extinct on day 157 before), `p2-7` 67; their dwarf deaths are 9, 6 and 3, none of hunger or thirst. Four stop on a T-176 finding, all later than the day the old run's fortress died or stopped: `p2-3` day 194 and `p2-4` day 264 on `job.unreachable-with-path` with `haul_to_stockpile` jobs (T-385's invariant on haul jobs; `p4-1` stops on it with a `haul_to_depot` job in T-156's run), `p2-6` day 179 and `p2-1` day 292 on `party.active-over-10d`, a Gloam ambush that never leaves (new row, `T-389-ambush-party-stays-past-ten-days.md`). The raids on the living fortresses are those of the model for T-381: year 2, 11 (`p2-2` day 124), 9 (`p2-5` day 122); year 3, 15 (`p2-2` day 244), 13 (`p2-5` day 238).

**Not changed:** the arming phase still never ends on a map without iron within reach (`p2-6`), and its deep ore digging at the kit's priority still holds the miners ahead of the immigrants' rooms. With the founders sheltered this is an economy question, not a defence one; it is left to the sweep's reports.
