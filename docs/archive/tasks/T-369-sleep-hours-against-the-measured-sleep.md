# T-369 — Seven hours of sleep against the measured sleep

**Closed:** 2026-10-21, in aab8bcb.

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) § Contradictions found · **Size:** S · **Needs:** — · **Status:** open

## Why

The spec gives three different lengths for a dwarf's sleep:

- `balance.md` § Needs and consumption, rest row: "7 hours of sleep per 24"; 10 § Sleeping: a dwarf sleeps `SLEEP_HOURS` (7) from its start hour unless rest is below 20.
- The same section's measured table: sleep is 9% of a dwarf's time in use, about 2.2 hours a day. The [walking-speed report](../../../reports/audits/2026-10-09-walking-speed.md) § Why the work share does not move measured 1.14 to 1.20 sleep errands a dwarf-day of 118 to 121 ticks in use each: under 3 hours.
- The rest rates of 10 § Needs (+5 an hour awake, −15 an hour asleep) balance at 6 hours a day.

At most one of these can describe the game. Either sleep ends long before `SLEEP_HOURS` (on rest reaching 0, or by an interrupt), and the balance model's "7 hours" is wrong, or the time accounting counts only part of sleep as "use".

## What to do

1. Read 10 § Sleeping and § Needs against `src/systems/dwarves` to establish when sleep ends, and check how the walking-speed accounting classes a sleeping dwarf.
2. Make the spec say one thing: correct the balance model's rest row and, if the rule itself is not what the spec says, file the code or rule change as its own task.

## Done

- `balance.md`, 10 § Sleeping and the measured table agree, or a task exists for the part that needs a rule or code change.
