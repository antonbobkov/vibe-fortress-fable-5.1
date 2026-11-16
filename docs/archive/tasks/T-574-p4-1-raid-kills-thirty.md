# T-574 — One raid kills over thirty dwarves on three-years-p4-1

**Closed:** 2026-11-16, in 85b66db4,d79a1f4f,fe59aa9e.

**Source:** the orchestrator, 2026-11-16, from [T-555](T-555-making-do-farm-hive-and-medicine.md)'s runs ([data](../../../reports/data/2026-11-16-t555-sweep-deaths.md)) · **Size:** M · **Needs:** — · **Status:** open

## Why

T-555 changed only which goods the Wildwood's caravan draws, and that moved seed `three-years-p4-1` onto another timeline. On it, a Gloam raid on day 297 (shift 0) killed 37 dwarves. Over eight shifts, p4-1's deaths went from 79 to 216, while the other 19 seeds moved by zero in total. The pooled sweep's deaths rose from 137.25 to 161.25, and the reference was refreshed to that level with this evidence. The game rules did not change; one timeline found a way for a single raid to kill a third of a fortress.

## What to do

Replay p4-1 at shift 0 on master after T-555 and read the day-297 raid:
- the raid's size against the fortress's renown;
- where the squad was, and whether it mustered;
- whether the gate and the second line held;
- whether civilians sheltered or were caught outside;
- what killed them.

Then decide whether a rule is wrong (for example, alert, shelter or morale) or the three-year script defended badly (for example, the gate left open, the squad away, or burrows), and fix it with a test. Don't make raids weaker without a rule that says so.

## Done

- A short report on the raid, a fix if one is plain, and the sweep (eight shifts if needed) with p4-1's deaths before and after.
