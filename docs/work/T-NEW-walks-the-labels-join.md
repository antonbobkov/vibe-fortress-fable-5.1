# T-NEW — Walks that fail between places the labels join: health jobs under the alert, sites behind forbidden tiles

**Source:** [T-489](T-489-p4-4-seed-delivery-walk-fails.md) (its probe of the twenty-seed file, [the probe](../../reports/data/2026-11-07-t489-walks.probe.ts.txt)) · **Size:** M · **Needs:** T-489 · **Status:** open

## Why

T-489 counted every walk that failed while the connectivity labels joined the worker to its tile, over 16 seeds of the twenty-seed file at the four sweep shifts (master `303a109a`, 274 walks in 64 runs). It fixed the largest class, a forbidden plot tile. Two remain, each kept from being lost by T-487's retry after `FAILED_WALK_RETRY_TICKS`, but each a walk that never should have been tried:

- **Health jobs under the hearth alert (35).** A doctor in the halls (z 26) walks to a patient on the surface (z 31 to 33): diagnose, suture, stop_bleeding, feed_patient, carry_patient. No search finds a way, even without the forbidden set, so the graph keeps the two apart while the labels join them. The likely place is the gate's `lock_on_alert` doors, whose lock 14 decides from the tick and from who stands in the doorway (`doorLocked`), while the labels change only when a door's chunks are marked dirty.
- **Build deliveries behind forbidden tiles (16).** The stand tile itself may be entered, but every way to it passes forbidden tiles (a workshop's corners), which the labels do not see.

## What to do

Probe one health case: at the failed walk, which door on the way is locked, whether its chunks were dirtied when it locked, and the labels a tick later. Make the labels and the graph agree on a door's lock, or have the board judge a health job's reach as it judges the rest. For the build case, decide whether a stand tile reached only through forbidden tiles is no stand tile (as T-489 decided for a forbidden stand tile), and write it into 11.

## Done

- The probe counts no failed walk of these two kinds over the same runs, or a dated report says why one remains.
