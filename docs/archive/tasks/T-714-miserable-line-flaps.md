# T-714 — "X is miserable." repeats several times a day and buries the alerts

**Closed:** 2026-11-25, in fa8f907a,82f9b1ff,4fced7eb,6b655369.

**Source:** playtest 2026-11-24 (second) ([report](../../../reports/data/2026-11-24-playtest-2.md), finding 1) · **Size:** M · **Needs:** — · **Status:** open

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

- [x] Tests: a dwarf whose mood moves 19, 21, 19, 22 through a day is announced once; the line names its three strongest negatives; a second fall the same day is not announced.
- [x] A run of the reproduction above: at most one miserable line per dwarf per day in the log. (A headless probe: `deep-2346-1` region (11,30), Warband, no orders, 40 days: 59 falls to Miserable under the plain bands, up to 3 a dwarf a day; the day's line names each dwarf once.)
- [x] World hashes: unchanged (the simulation is master's; see the decision below).
- [x] Added by the orchestrator: the restless dead's dawn line says they fall to dust ("A restless dead has fallen to dust."), logged as kept in `docs/fun-features.md`.

**Decision after the sweep: no margin in the simulation.** The tier margin (`MOOD_TIER_HYSTERESIS` = 5) was built and measured: sweep 45580317774 pooled 1097 living / 122.75 deaths, and on the branch merged with master sweep 45594520147 pooled 1060 / 120.25 ("worth tracing: 66.63 under best"), against master's recent 1124 to 1170. A dwarf held in the lower tier works slower, sulks, is dosed and holds hall spirit down longer, and that cost lives. So the decisions on the margin and on hall spirit's margin above are withdrawn: the tier is the plain band at each hourly recomputation, as before, and the damping is the announcer's alone (the day's line names a dwarf once). The world is byte-identical to master.

Choices made while working (now in the spec): the reasons are the thoughts' own texts quoted ('… is miserable: "I am hungry. Slept on the floor. …"'), since lower-cased texts read "i am hungry" and the thought rows have no short name; a day's miserable lines are one line naming each dwarf once, as the starving line is, so many miserable dwarves cannot bury a death or a departure.
