# T-372 — Balance-status rows above its title

**Closed:** 2026-10-17, in ec2851d.

**Source:** T-333, [`../../reports/audits/2026-10-17-unmeasured-spec-numbers.md`](../../../reports/audits/2026-10-17-unmeasured-spec-numbers.md) § Contradictions found · **Size:** S · **Needs:** — · **Status:** open

## Why

`docs/balance-status.md` begins with thirteen table rows (lines 1 to 13) that carry the figures of [the measurement of 2026-10-12](../../../reports/audits/2026-10-12-economy-fixture-at-default-priority.md), above its `# Balance status` title and outside any table. The table under the title still holds the older rows for the same measures: wealth in year 1 is 18,891 above the title and 15,584 below it, population 15 / 34 / 56 above and 15 / 33 / 33 below, and so on for every one of the thirteen. The file's own rule is one row per measure with the latest figure; it now gives two answers to each.

## What to do

Move each of the thirteen rows into the table, replacing the older row for the same measure, and delete the copies above the title. Keep the rows the measurement of 2026-10-12 did not re-measure (immigration, raids and ambushes, the share of dwarf time, the mood time mean, wild animals and pasture feeding) as they are. Check that the paragraph under the title still matches the table.

## Done

- `balance-status.md` starts with its title and has one row per measure.
