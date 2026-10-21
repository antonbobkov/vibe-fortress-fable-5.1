# T-409 — A creature that cannot move holds a doorway, and a job waits on it for good

**Source:** T-406 (its p4-2 diagnosis) · **Size:** S · **Needs:** — · **Status:** open

## Why

Any creature on a door's tile stops every walker at the door (22 § movement). A walk held up there more than `REPATH_LIMIT` times unclaims its job as `unreachable` with `crowdedTile` set, and 11's periodic retry skips the job until no creature stands on that tile (11 § Blocking). T-406 found a conscious patient with no bed resting in a doorway in `three-years-p4-2` (day 39): the job never reopened. T-406 moved that patient off the door (10 § Behavior selection), but a creature that cannot move still holds a door for as long as it lies there: an unconscious dwarf with no bed (17 creates `carry_patient` only when the patient has a bed), an unconscious hostile, a sleeper on the floor for a night. The jobs that walk through the door wait for it, and the checker's `job.unreachable-with-path` reports them after a day.

## What to do

1. Decide between the two places: 17 carries an unconscious dwarf with no bed off a door tile (as `carry_patient` does to a bed), or 11's crowded wait stops waiting on a creature that has not moved for `BLOCKED_RETRY_TICKS` and lets the retry route the job again.
2. A stepped test with an unconscious dwarf on a door tile and a job whose walk passes it; the rule in 11 or 17.

## Done

- The job is worked, or reopened and claimed by a worker that does not pass the door, within a day.
