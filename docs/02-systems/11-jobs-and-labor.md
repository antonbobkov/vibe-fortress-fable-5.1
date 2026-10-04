# 11 Jobs & Labor

**Detail level:** W2 · **Owner:** `systems/jobs` · **Depends on:** [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), [10-dwarves.md](10-dwarves.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

## Purpose

Turn everything the fortress wants done into jobs, match jobs to workers, run each job's steps, and keep the player informed about why work is or is not happening. This is the system the player interacts with most, even when they do not know it.

## Concepts

- **Job**: a unit of work with a type, a target, a priority, a required labor, an optional minimum skill, inputs to fetch, a tool requirement, and a state.
- **Producer**: a system that creates jobs through the registration API and executes their work steps.
- **Labor**: a category of work a dwarf may do; toggled per dwarf. The labor list is content (`labors` table); the design fixes it below.
- **Priority**: 1 (most urgent) to 9 on each job; 5 by default. A **labor priority** per labor (also 1–9) shifts every job of that labor.
- **Claim**: a worker taking a job. **Reservation**: an item held for a job.
- **Blocked**: a job that cannot proceed, with a reason.
- **Standing order**: a fortress-wide toggle that lets a producer create jobs automatically.

## Rules

### Labors

`mining`, `woodcutting`, `construction`, `carpentry`, `masonry`, `crafts` (stone, bone, shell and wood crafts, engraving), `gem_cutting`, `mechanics`, `farming`, `herbalism`, `animal_care`, `animal_training`, `hunting`, `fishing`, `butchery`, `leather` (tanning and leatherworking), `textiles` (weaving and clothesmaking), `cooking`, `brewing`, `smelting`, `smithing` (weapons, armor, metalcrafts), `medicine`, `trading`, `hauling`, `cleaning`.

Each skill belongs to one labor (content). A job requires a labor; when it requires a skill, the skill's labor is the labor. Default labors for new dwarves: all on. Children: `hauling` only, fixed.

### The job record

```
Job {
  id, key,                       // key is unique per producer target, e.g. "dig:12345"
  type: Id<jobTypes>,            // from jobs.md: labor, skill, xp, needsTool, targetKind, baseTicks
  producer: string,
  priority: 1..9,
  target: { kind: tile | entity | building | zone, ref },
  workTile: TileIndex | 'adjacent' | 'at',   // where the worker must stand
  inputs: { filter: ItemFilter, count, reserved: EntityId[] }[],
  tool: 'pick' | 'axe' | 'ranged' | null,
  state: open | claimed | fetching | travelling | working | completing | blocked | cancelled | done,
  blockedReason: RejectReason | null, retryTick,
  workerId: EntityId | 0,
  progress: Fixed,               // 0..1000 of the work step; kept on interruption
  createdTick, claimedTick
}
```

Job types are content rows; the producer that owns the type executes its steps. Every type has a `baseTicks` and an `xp`.

### The board

- `open`, `blocked` and `claimed` lists; `byKey` map; `byWorker` map; `byTarget` map (for cancellation when a tile or entity changes).
- Producers are polled every tick in registration order: each may add jobs (checking `sink.exists(key)`) and cancel its own. Producers are cheap because they only look at their own dirty state (a new designation, a changed order, a ready product).

### Assignment

Each tick, for up to `ASSIGN_WORKERS_PER_TICK` workers that asked for a job (10 calls `jobs.assign(id)` during behavior selection; the requests are queued and answered in the same tick in id order):

1. Candidate jobs: `open` jobs whose labor is enabled for the worker, whose `minSkill` is met, and whose `workTile` region label equals the worker's region label for the worker's movement class (22 `reachable` is a constant-time label compare).
2. Sort candidates by `(priority + laborPriorityShift)`, then by estimated distance (Chebyshev on x, y plus `Z_DISTANCE_WEIGHT` per z-level), then by the worker's skill descending. Take the first `CANDIDATE_LIMIT`.
3. Score each: `score = effectivePriority × 1000 + distance × 10 − skillLevel × 15 − (worker is the workshop's assigned worker ? 500 : 0)`. Choose the minimum; ties by job id.
4. Claim: `state = claimed`, `workerId`; reserve inputs (first matching unreserved items by nearest distance to the workshop or work tile, through 13 `findItems`); if an input cannot be found, unclaim and mark `blocked: missing_input`.
5. Tool: if the job needs a tool and the worker does not carry it, the first step is to fetch one from a stockpile (`fetching`); if none exists, `blocked: no_tool`.

`laborPriorityShift = laborPriority − PRIORITY_DEFAULT`, so raising mining's labor priority to 3 makes every mining job behave two steps more urgent.

Workers keep the tool in their weapon slot after the job; a dwarf whose `mining` and `woodcutting` labors are both off drops the tool at the next stockpile they pass.

If the claim of the chosen job fails (it blocks `missing_input` or `no_tool`), the worker tries the next candidate in the same order; only when every candidate fails does the worker go idle.

### Job steps

`jobs.stepWorker(id, ctx)` is called by 10 every tick for a dwarf in `work` behavior:

```
switch job.state:
  claimed:     job.state = inputs.length ? fetching : travelling
  fetching:    for each input not yet delivered: path to the item, pick it up (13 attach to worker), path to the work tile, drop it there (or into the workshop); when all delivered → travelling
  travelling:  path to workTile (or an adjacent walkable tile for 'adjacent'); on arrival → working; on 'unreachable' → blocked: unreachable
  working:     progress += workRate(worker, job); if progress ≥ 1000 → completing
  completing:  producer.onComplete(job) (spawns outputs, applies tile changes, etc.); grant xp; job.state = done; emit JobCompleted; worker becomes free
```

`workRate = 1000 / (job.baseTicks × 100 / (100 + SKILL_TIME_BONUS_PERCENT × skill)) × productivity(worker) / 100` per tick.

Interruptions (critical need, threat, alert, cancellation): the job returns to `open` with `progress` kept if `state` was `working`; reserved items stay reserved for `RESERVE_KEEP_TICKS` so the same worker (or another) can resume; delivered inputs stay at the work tile. Hauling jobs interrupted mid-carry drop the item where the worker stands.

### Hauling

Hauling is a family of job types produced by 13 (`haul_to_stockpile`), 12 (`haul_to_workshop` as job inputs, not separate jobs), 14 (`haul_to_site` as build job inputs), 20 (`haul_to_depot`), and 13 again for `dump` and `refuse`.

- `haul_to_stockpile { itemId, stockpileId }`: 13 produces one per item that is not in a stockpile that accepts it and for which a stockpile with free capacity accepts it (13 keeps the "wants hauling" set incrementally). Priority is `HAUL_PRIORITY` by default, `HAUL_PRIORITY_FOOD` for food, and inherits the stockpile's priority setting if the player changes it.
- A worker carries one item or one stack. Containers (bins, barrels, bags) in stockpiles are filled by the same job when the item's category needs one (13 decides the destination tile as "into container X at tile T").
- A `wheelbarrow` is not in version 1; heavy items (stone, logs, corpses) simply slow the carrier (10).
- `hauling` labor on every dwarf is the default. The player is warned by a hint when more than `IDLE_HAULER_WARNING` items want hauling and fewer than three dwarves have hauling enabled.

### Blocking and retry

| Reason | Meaning | Retry trigger |
|---|---|---|
| `no_worker` | no dwarf has the labor enabled (or all are children) | `SetLabor`, `ImmigrantsArrived` |
| `unreachable` | no walkable route for any worker with the labor | `TilesChanged` in the target chunk, `BuildingStateChanged`, `FluidsChanged` |
| `missing_input` | an input item filter matches nothing available | `ItemCreated`, `ItemReleased`, `StocksChanged` |
| `no_tool` | no free pick, axe or ranged weapon | `ItemCreated`, `ToolDropped` |
| `target_invalid` | the target no longer matches (cancelled by the producer) | none; the job is removed |
| `workshop_suspended` | the workshop is suspended or has no worker allowed | `SuspendWorkshop`, `SetWorkshopWorker` |
| `no_magma` | magma workshop lost its magma | `FluidsChanged` |

Blocked jobs are re-evaluated on their trigger or every `BLOCKED_RETRY_TICKS`, whichever comes first, in creation order, at most `BLOCKED_RETRIES_PER_TICK` per tick.

A re-evaluated job opens only when its reason is gone: a worker with the labor exists (`no_worker`), a stand tile shares a connectivity label with such a worker (`unreachable`), every input still needed can be found (`missing_input`), and the tool is carried by a worker or can be found (`no_tool`). Otherwise it stays blocked until its next trigger or `BLOCKED_RETRY_TICKS`. A job whose inputs cannot be found must never be offered to workers, or it starves every job ranked below it.

### Cancellation

- The player cancels a job (`CancelJob`) or removes the designation, order or zone that produced it: the producer cancels through the sink; reservations release; delivered inputs stay where they are (they are hauled back by normal hauling).
- A target that changes (a tile designated for digging that is now a floor): the producer notices on `TilesChanged` and cancels with `target_invalid`.
- A worker who dies: the job returns to `open` with progress kept.

### Standing orders

Fortress-wide toggles owned here and read by producers: `autoHarvest` (07), `autoCollectProducts` (08), `autoButcher` (09: butcher any butcherable corpse), `autoHaulRefuse` (13), `autoRearmTraps` (19), `autoMeltMarked` (12). All default on.

### Priorities in the UI

- Designation priority is set while designating (keys 1–9) or afterward (`SetDesignationPriority`).
- Work orders have a priority field.
- Buildings have a priority field (build job).
- Labor priorities are a row of 1–9 in the jobs panel.
- Hauling priority is per stockpile.

Priority 1 jobs are done before a want-level need; priority ≥ 3 jobs yield to wants (10).

## State

- The board lists and maps; `laborPriorities: Uint8Array(laborCount)`; `Labors` components; `Worker` components; `standingOrders`; `assignQueue`.
- Producers' registrations (not saved; re-registered on init).
- Rng stream (only for tie-breaking that must be random, currently none; reserved).

## Interfaces

Implementation note: Additional public queries and secondary emitters implement the rules above; reader additions: `jobs.hasUrgent`, `jobs.hasWork`, `jobs.isQueued`, `jobs.typeOf`; events additions: `HuntAbandoned`, `HuntKill`, `HuntStarted`; audited in DECISIONS D-220.

### Reader

- `jobs.list(state?)`, `jobs.get(id)`, `jobs.byKey(key)`, `jobs.forWorker(dwarfId)`
- `jobs.blockedReason(id)`, `jobs.counts()` (open, claimed, blocked by reason)
- `jobs.laborEnabled(dwarfId, labor)`, `jobs.laborPriority(labor)`, `jobs.workersWithLabor(labor)`
- `jobs.standingOrder(name)`
- `jobs.wantsHaulingCount()`

### Commands

`SetLabor { dwarfId, labor, on }`, `SetLaborPriority { labor, priority }`, `CancelJob { jobId }`, `SetJobPriority { jobId, priority }`, `SetStandingOrder { name, on }`.

### Events consumed

`TilesChanged`, `BuildingStateChanged`, `FluidsChanged`, `ItemCreated`, `ItemDestroyed`, `ItemReleased`, `StocksChanged`, `CreatureDied`, `ImmigrantsArrived`, `NeedCritical` (interrupt), `AlertChanged` (interrupt civilians), `ThreatNearby` (interrupt).

### Events emitted

`JobCreated`, `JobClaimed`, `JobStarted` (entering `working`), `JobCompleted { jobId, type, workerId, target }`, `JobCancelled { jobId, reason }`, `JobBlocked { jobId, reason }`, `JobUnblocked`, `ItemReserved { itemId, jobId }`, `ItemReleased { itemId }`, `ToolEquipped { dwarfId, itemId }`, `ToolDropped { itemId }`.

### Registrations

Panel `jobs` (open jobs with worker and reason; labor priorities; standing orders); panel `labors` (grid); inspector section `creature › current job`.

## Player-facing behavior

- Jobs panel: a list sorted by priority with columns: job, target (clickable to center), priority (editable), worker or reason. A summary line: "42 open, 18 claimed, 6 blocked (4 unreachable, 2 missing materials)". Filters by labor and state.
- Labor grid: rows are dwarves, columns are labors; click to toggle; shift-click toggles a column for everyone; a number row above sets labor priorities.
- The look cursor on a designation shows its job state ("Dig, priority 3, claimed by Orm Ashbrow").
- Hints: "No one has mining enabled", "Jobs are blocked: no path (check for doors and water)".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `ASSIGN_WORKERS_PER_TICK` | 8 | |
| `CANDIDATE_LIMIT` | 32 | |
| `Z_DISTANCE_WEIGHT` | 6 | Tiles of horizontal distance one z-level counts as |
| `SKILL_TIME_BONUS_PERCENT` | 8 | Shared with 03; defined there; referenced here |
| `RESERVE_KEEP_TICKS` | 600 | |
| `BLOCKED_RETRY_TICKS` | 100 | |
| `BLOCKED_RETRIES_PER_TICK` | 20 | |
| `HAUL_PRIORITY` | 6 | Hauling is below default work |
| `HAUL_PRIORITY_FOOD` | 5 | |
| `IDLE_HAULER_WARNING` | 200 | |

## Extension points

- Hauling batches and wheelbarrows: a `carryCapacity` on the worker and a multi-item fetch step.
- Job preferences per dwarf (likes and dislikes): a personality term in the score.
- Squads doing civilian work while off duty: already the case; nothing to add.
- A "burrow"-like work area restriction: a per-dwarf allowed-region filter in candidate selection.
