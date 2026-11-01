# T-463 — Tame animals all stand on one hall tile

**Source:** T-457 ([measurement](../../reports/audits/2026-11-01-crowding.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

Every idle dog in `three-years-p0-2` stands motionless on the same hearth-hall tile: four on day 40, eleven on day 120. It looks like one dog, and since crowding, anyone who walks across that tile takes twice the time. It is the only lasting crowd in the twenty-seed file: in all 20 seeds one hall tile stays crowded for about 90% of the three years, usually in one unbroken stretch from the hall's first days.

## Decisions

1. **Idle tame animals spread out.** One choosing where to stand near the hall takes a free tile of the hall or beside it, with the fewest creatures on it, ties by lowest index. Do not add a wander where 08 has none.
2. Nothing else about tame animals changes, and `CROWD_*` stay as they are.

## Done

- **Unit test:** six idle dogs in a hall stand on six tiles.
- The crowd watch in `three_years_seeds` shows no hall tile crowded for more than a day at a time by animals alone.
- The six static checks, `npm test`, e2e, and the instrument by the T-308 rule pass.
