# T-NEW — "X is miserable." repeats several times a day and buries the alerts

**Source:** playtest 2026-11-24 (second) ([report](../../reports/data/2026-11-24-playtest-2.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

## Why

A Warband fortress (world seed `deep-2346-1`, region (11,30) "Sedgefen", a wetland with a river, peril 3) was unhappy from late spring: no beds, two chairs, "Nothing lifts my spirits". From Spring 5 to the end of the session the log's All tab was almost nothing but "Dagny Goldstone is miserable.", "Harek Darkhall is miserable. x3", one to five lines per dwarf per day (`reports/data/2026-11-24-playtest-2/37-log-miserable-spam.png`). In Summer the caravan's departure, a thief and a cavern monster were single lines between them; in Autumn the line "Borin Wolfcloak has bled to death" sat among five "is miserable" lines of the same day.

The tier does not stay at Miserable: it crosses the 20 bound back and forth. A recorder on `MoodTierChanged` over Spring 12 to 19 saw, for one dwarf, `1→0` at tick 16051, `0→1` at 16201, `1→0` at 16951, `0→1` at 17251, `1→0` at 17301, `0→1` at 17451, `1→0` at 17701: a change every one to fifteen hours (50 ticks to the hour), because `needPressure` (15 § Mood) rises and falls with thirst, hunger and rest through the day. Each `1→0` is announced (`announce.mood_tier`, `src/systems/morale/index.ts` registers `MoodTierChanged` with `oneOf to: [0]`). The Mood panel at the same moment showed the same dwarf as Fine (45) or Unhappy, so the line and the panel disagree most of the time (`38-mood.png`).

The line also says less than 15 promises: § Registrations gives the announcement as "Ketil Ironvein is miserable: hungry, slept on the floor, saw a friend die"; the game says "Dagny Goldstone is miserable." with no reason.

Reproduce: generate `deep-2346-1`, embark Warband on (11,30), dig a hall, make no beds, run 20 days with the hook's `step(1200)` and count `MoodTierChanged` with `to: 0` per dwarf.

## What to do

Decisions:

- **A dwarf enters Miserable below 20 and leaves it only at 25 or more** (`MOOD_TIER_HYSTERESIS` = 5, *unmeasured*), in 15 § Tiers and effects. The same margin applies to every tier bound, so Unhappy↔Fine at 40 does not flap either. `MoodTierChanged` fires only on a real change under this rule. Productivity and the sulk counter read the held tier.
- **The miserable line is said at most once a day per dwarf** and names the three strongest negative thoughts, as 15 already says ("… is miserable: hungry, slept on the floor, no room of my own"), from the thought texts in lower case.
- Hall spirit's tier (`HallSpiritChanged`) takes the same margin.

Spec: 15 § Tiers and effects (the margin), § Registrations (the line, once a day), § Tuning constants (new row), 24 § Announcements if it lists the line.

## Done

- [ ] Tests: a dwarf whose mood moves 19, 21, 19, 22 stays Miserable and is announced once; one that rises to 25 leaves it; the line names its three strongest negatives; a second fall the same day is not announced.
- [ ] A run of the reproduction above: at most one miserable line per dwarf per day in the log.
- [ ] World hashes: the tier now holds longer, so productivity and sulks move; the commit says which scenario hashes moved and why.
