# T-490 — 11 still describes the crowded-doorway retry that crowding removed

**Source:** [T-487](../archive/tasks/T-487-failed-fetch-walk-never-retried.md) (found while editing 11 § Blocked jobs) · **Size:** S · **Needs:** — · **Status:** open

The paragraph on blocked-job retries in `docs/02-systems/11-jobs-and-labor.md` § Blocked jobs ends with a rule for "a walk that gave up only because creatures kept standing on its next tile (more than `REPATH_LIMIT` waits, as in a doorway)": the job is blocked without the failed-walk memory and retries "once the labels connect and no creature stands on the tile that held the walk up". The code has had no such rule since creatures share any tile (22 § Crowding): `movement.walkTo` never waits on a creature, the board keeps no `crowdedTile`, and its retry looks at no creature. The sentence describes behaviour that no longer exists.

## Decisions

- Delete the sentence from 11 § Blocked jobs, and check `algorithms/jobs-and-hauling.md` § Blocked retry and `module-interfaces.md` § Movement for any remaining mention of a walk blocked by creatures. Documentation only; no code changes.

## Done

- 11 and the algorithm files describe only the retry rules the code has; the six static checks pass.
