# T-809 — A designation job's priority set in Jobs stays

**Source:** T-799 (playtest 8, [report](../../reports/data/2026-11-26-playtest-8.md), finding 5) · **Size:** S · **Needs:** — · **Status:** open

## Why

Found while doing T-799. 03's producer keeps each designation job's priority equal to its tile's designation priority: whenever any designation changes (`designationsVersion`), `TerrainProducer.produce` (`src/systems/terrain/producer.ts`, "priorities follow the grid") sets every terrain job back to the grid's priority. The Jobs panel's `[p]` / `[S-p]` send `SetJobPriority`, which changes the job only (`src/systems/jobs/commands.ts`), not the tile's designation priority. So a dig or stair job made sooner in Jobs goes back to its old priority the next time the player designates anything anywhere, with nothing said. That may be part of what playtest 8 saw as "a redrawn box keeps the old priority": the player set the stair column from Jobs and from Designate in turn.

## What to do

Decisions taken here:

- `SetJobPriority` on a job of 03's producer (a designation job) also sets its tile's designation priority, as `SetDesignationPriority` would, so the two never disagree. The rule lives in 03 (the command handler or a producer hook that 11 calls); 11's command stays as it is for every other producer.
- A test: a dig job set to 2 in Jobs keeps 2 after another box is designated elsewhere, and Look shows "priority 2 (urgent)" on its tile.

## Done

- [ ] `SetJobPriority` reaches the designation of a designation job; a test.
- [ ] 03 § Designations and 11 § Commands updated.
