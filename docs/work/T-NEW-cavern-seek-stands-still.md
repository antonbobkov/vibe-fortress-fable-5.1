# T-NEW — A seeking cavern monster stands still until a dwarf comes near

**Source:** T-461 ([journal](../../reports/audits/2026-11-01-crawlers-in-the-halls.md)) · **Size:** S · **Needs:** — · **Status:** open

## Why

18 says aggressive monsters seek fortress creatures within `CAVE_SEEK_RADIUS` of the cavern and "will follow a breach corridor into the fortress". `src/systems/threats/caverns.ts` sets a target anywhere on the monster's label with no check of distance, and `src/systems/combat/index.ts` drops any target beyond `PERCEPTION_RADIUS` or more than two levels away on its next tick. So the monster reports `seek` and does not move. On `three-years-p4-2` one crawler stood at z 19 for 10.4 days this way, until a dwarf came to its level.

## What to do

Make the code follow 18, or change 18 with a stated reason. Walking in would make a breach more dangerous, so measure before deciding. It is the orchestrator's decision if the rows move much.

## Done

- 18 and the code agree, with a unit test.
- The instrument by the T-308 rule, and the twenty-seed file by the set rule if the monsters now walk.
