# T-NEW — A soldier killed on the tick before an invariant sample fails the sweep seed as `squad.member-dead`

**Source:** T-753's sweep (GitHub run 45686734409, seed job `sweep (p4-1, 50)`) · **Size:** S · **Needs:** — · **Status:** open

## Why

The sweep's verdict passed, but one seed job failed on its invariants: `squad.member-dead (-) from tick 158400: t158400: squad 16777321 member 16777285 not alive`. The seed's log has the death: dwarf 16777285 (the fixture's forge specialist, a squad member) was killed by a gloam warrior at tick 158399, one tick before the invariant sample at 158400 (`test/scenarios/invariants.ts` samples every 100 ticks). 16 prunes dead members in `stepSquads` (`src/systems/combat/squads.ts`, "Prune dead members") on its own tick; a member killed after that point in a tick, or on the tick just before a sample, is still listed when the sample reads the squad. Only the one sample saw it, so the squad is not left with a dead member for long: the check meets 16's cadence, not a leak.

It is rare (a squad member has to die in the last tick before a sample), so it shows as a lone failed seed job on a timeline that moved for another reason. Here the timeline moved because T-753 changed a retreat tile.

## What to do

Decide which side holds: either 16 removes a dead member at once (on `CreatureDied`, as the leader is cleared), so the squad never lists one, or the invariant allows a member that died since 16's last squad step. The first keeps the squad honest for every reader (the Military panel reads members too); prefer it. Pin it with a unit test: a squad member killed after 16's tick is no longer a member when the tick ends.

## Done

- [ ] Test: a squad member that dies mid-tick is gone from `Squad.members` (and as leader) by the end of that tick.
- [ ] The invariant stays as it is.
