# T-NEW — A neglected fortress has its small troubles: sulks that can happen after the first fortnight

**Source:** playtest 9 ([report](../../reports/data/2026-11-26-playtest-9.md), finding 6); playtest 7 · **Size:** S · **Needs:** — · **Status:** open

## Why

The game puts sulks in place of tantrums: no violence, no spiral, a broken chair or a day off (15 § Sulks; `vision.md`). Nobles, mandates, strange moods and artifacts are left out on purpose (`scope.md`). So the sulk is the game's whole stock of characterful trouble, and it almost never happens:

- **Playtest 7:** no sulk in six years, at up to 80 dwarves (its driver logged `Sulk`).
- **Playtest 9, fortress A:** one sulk in 364 days, on day 14 ("argue"). By Year 4, 78 dwarves lived in a fortress with 17 bedrooms. The census read "bored ×72, no_bedroom ×61, restless ×58, thirsty ×45", with 1 Miserable and 11 Unhappy, and hall spirit Fine (52). Nobody sulked.
- **The counter never runs.** `sulkCounterDays` counts days on which the dwarf is Miserable at `DayPassed`, and decays by one on any other day. It was 0 for every dwarf in fortress A's saves at days 224 and 336, and in playtest 7's Year 7 save. Miserable came and went 312 times in fortress A ("tier→0"), yet the counter stood at 0 at every save: the misery passed within hours (mood is recomputed hourly), and never held at the day's turn seven days running.

The fortress in these playtests is never neglected enough to need a sulk. Its moments of trouble are flat lines in the log.

## What to do

A decision for the owner. Two options:

- **(a) Count the day, not the instant.** A dwarf who was Miserable for `SULK_DAY_HOURS` (6) or more hours of a day counts that day, and the counter decays only on a day with no Miserable hour. `SULK_DAYS` stays at 7. A fortress that leaves dwarves without beds, drink or company for a week sees sulks. One fed and housed does not, so the anti-spiral guarantee (15 § Mood) is unchanged.
- **(b) Leave it.** Sulks stay a first-fortnight event, and the game's character comes from elsewhere.

Recommendation: (a). A sulk is harmless by design, and it is the one thing that tells a player in words that the fortress is failing its dwarves. Measure it in the twenty-seed sweep: sulks per fortress-year, and that deaths do not move.

## Done

- [ ] The decision recorded here and in 15 § Sulks.
- [ ] If (a): the hour count saved on `Mood`, the rule, a test that a dwarf Miserable 6 hours a day for 7 days sulks and one Miserable 1 hour a day does not, and the sweep measured.
