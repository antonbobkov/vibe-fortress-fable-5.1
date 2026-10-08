# 11 Jobs & Labor

**Owner:** `systems/jobs` · **Depends on:** [`../01-architecture/module-interfaces.md`](../01-architecture/module-interfaces.md), [10-dwarves.md](10-dwarves.md), [13-items-and-storage.md](13-items-and-storage.md), [14-buildings-and-rooms.md](14-buildings-and-rooms.md), [22-pathfinding-and-spatial.md](22-pathfinding-and-spatial.md)

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

For stand tiles and assignment distances, use `data.anchorTile` if supplied, else a numeric work tile, else the target. The board accesses items through an `ItemSource` seam; without 13, its test/core fallback finds no input and treats the tool as already held. Real games use 13's installed item source.

Job types are content rows; the producer that owns the type executes its steps. Every type has a `baseTicks` and an `xp`.

### The board

- `open`, `blocked` and `claimed` lists; `byKey` map; `byWorker` map; `byTarget` map (for cancellation when a tile or entity changes).
- Producers are polled every tick in registration order: each may add jobs (checking `sink.exists(key)`) and cancel its own. Producers are cheap because they only look at their own dirty state (a new designation, a changed order, a ready product).

### Assignment

Each tick, for up to `ASSIGN_WORKERS_PER_TICK` workers that asked for a job (10 calls `jobs.assign(id)` during behavior selection; the requests are queued and answered in the same tick in id order):

1. Candidate jobs: `open` jobs whose labor is enabled for the worker, whose `minSkill` is met, and whose `workTile` region label equals the worker's region label for the worker's movement class (22 `reachable` is a constant-time label compare). A civilian with a remembered still-near living hostile skips jobs anchored on the hostile's last seen level within `THREAT_RADIUS` horizontally; the same eligibility applies to `hasUrgent` and `hasWork`.
2. Sort candidates by `(priority + laborPriorityShift)`, then by estimated distance (Chebyshev on x, y plus `Z_DISTANCE_WEIGHT` per z-level), then by the worker's skill descending. Take the first `CANDIDATE_LIMIT`.
3. Score each: `score = effectivePriority × 1000 + distance × 10 − skillLevel × 15 − (worker is the workshop's assigned worker ? 500 : 0)`. Choose the minimum; ties by job id.
4. Claim: `state = claimed`, `workerId`; reserve required input units from as few stacks as possible, splitting only a partial stack and fetching each selected stack in one trip. Other entity-counted inputs retain their item search. For unit inputs use largest stacks first, ties by ordinary search order; delivery follows that search order. Reserve inputs (first matching unreserved items by nearest distance to the workshop or work tile, through 13 `findItems`); if an input cannot be found, unclaim and mark `blocked: missing_input`.
5. Tool: if the job needs a tool and the worker does not carry it, the first step is to fetch one from a stockpile (`fetching`); if none exists, `blocked: no_tool`.

`laborPriorityShift = laborPriority − PRIORITY_DEFAULT`, so raising mining's labor priority to 3 makes every mining job behave two steps more urgent.

A worker without a required tool skips the job while no free tool of that kind is reachable and another worker with the labor carries one, leaving the job available to that worker. If nobody could do it, the ordinary `no_tool` block still applies.

Workers keep their tool after the job. A living worker whose `mining` and `woodcutting` labors are both off drops a carried pick or axe on the next stockpile tile they pass, clears `Worker.toolId` and the matching weapon reference, and emits `ToolDropped` to unblock tool jobs. Other tools and a still-enabled labor retain their equipment.

If the claim of the chosen job fails (it blocks `missing_input` or `no_tool`), the worker tries the next candidate in the same order; only when every candidate fails does the worker go idle.

### Job steps

`jobs.stepWorker(id, ctx)` is called by 10 every tick for a dwarf in `work` behavior:

```
switch job.state:
  claimed:     job.state = inputs.length ? fetching : travelling
  fetching:    for each input not yet delivered: path to the item, pick it up (13 attach to worker), path to the work tile, drop it there (or into the workshop); when all delivered → travelling
  travelling:  path to workTile (or an adjacent walkable tile for 'adjacent'); on arrival → working; on 'unreachable' → blocked: unreachable
  working:     add effort; progress = floor(effort × 1000 / needed), capped at 1000; on reaching needed, complete in this step
  completing:  producer.onComplete(job) (spawns outputs, applies tile changes, etc.); grant xp; job.state = done; emit JobCompleted; worker becomes free
```

Each work tick adds `(100 + SKILL_TIME_BONUS_PERCENT × skill) × productivity(worker)` effort. Required effort is `baseTicks × 100 × 100`, without per-tick rounding; `progress` is its fixed-thousandths display. Completion runs in the same step that reaches required effort.

Interruptions (critical need, threat, alert): the job returns to `open` with `progress` kept if `state` was `working`; undelivered items stay reserved for `RESERVE_KEEP_TICKS` so the same worker (or another) can resume. Inputs delivered to a building site stay reserved to its build job until the building is finished or cancelled. Inputs delivered to a workshop stay reserved to the craft job while its order stands, until completion or cancellation. These delivered reservations survive the interruption timeout and a block/unclaim; haulers cannot take them. Other jobs retain the ordinary reservation timeout. Hauling jobs interrupted mid-carry drop the item where the worker stands. Cancellation releases every remaining reservation.

On resume and before completion, a delivered input counts only while it exists, is unconsumed and is still reserved to this job. If an external release, destruction or another holder invalidates it, remove the stale delivered id and fetch a replacement with progress kept, or block for missing input. Never consume another job's item or release its reservation.

### Hauling

Hauling is a family of job types produced by 13 (`haul_to_stockpile`), 12 (`haul_to_workshop` as job inputs, not separate jobs), 14 (`haul_to_site` as build job inputs), 20 (`haul_to_depot`), and 13 again for `dump` and `refuse`.

- `haul_to_stockpile { itemId, stockpileId }`: 13 produces one per item that is not in a stockpile that accepts it and for which a stockpile with free capacity accepts it (13 keeps the "wants hauling" set incrementally). Priority is `HAUL_PRIORITY` by default, `HAUL_PRIORITY_FOOD` for food, and inherits the stockpile's priority setting if the player changes it.
- A worker carries one item or one stack. Containers (bins, barrels, bags) in stockpiles are filled by the same job when the item's category needs one (13 decides the destination tile as "into container X at tile T").
- A `wheelbarrow` is not in version 1; heavy items (stone, logs, corpses) simply slow the carrier (10).
- `hauling` labor on every dwarf is the default. The player is warned by a hint when more than `IDLE_HAULER_WARNING` items want hauling and fewer than three dwarves have hauling enabled.

For idle wake-up, `hasWork` summarizes open jobs once per tick by reachable connectivity label and enabled labor. Restricted jobs keep exact worker-specific eligibility and tool checks. A civilian holding a remembered threat uses exact target eligibility rather than the shared availability summary. Invalidate this availability index on job state changes and load; assignment and its scoring remain unchanged.

A fetched tool's reservation ends when its worker equips it. Every released reservation whose item still exists emits exactly one `ItemReleased { itemId, jobId }`, including an equipped tool. A held tool remains unavailable to searches through `Worker.toolId` and the item's `carriedBy`, even after its reservation ends. Workers keep their equipped tool after the job.

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
- Cancelling a terrain job with `CancelJob` clears its designation; removing or changing that designation cancels the job with `target_invalid`.
- A target that changes (a tile designated for digging that is now a floor): the producer notices on `TilesChanged` and cancels with `target_invalid`.
- A worker who dies: the job returns to `open` with progress kept.

### Standing orders

Fortress-wide toggles owned here and read by producers: `autoHarvest` (07), `autoCollectProducts` (08), `autoButcher` (09: butcher any butcherable corpse), `autoHaulRefuse` (13), `autoRearmTraps` (19), `autoMeltMarked` (12). All default on.

### Priorities in the UI

- Designation priority is set while designating (keys 1–9) or afterward (`SetDesignationPriority`).
- Work orders have a priority field.
- Buildings have a priority field (build job).
- Labor priorities are a row of 1–9 in the labor manager (`SetLaborPriority`); the jobs panel shows them.
- Hauling priority is per stockpile.

Priority 1 jobs are done before a want-level need; priority ≥ 3 jobs yield to wants (10).

## State

- The board lists and maps; `laborPriorities: Uint8Array(laborCount)`; `Labors` components; `Worker` components; `standingOrders`; `assignQueue`.
- Producers' registrations (not saved; re-registered on init).
- Rng stream (only for tie-breaking that must be random, currently none; reserved).

## Interfaces

### Reader

- `jobs.list(state?)`, `jobs.get(id)`, `jobs.byKey(key)`, `jobs.forWorker(dwarfId)`
- `jobs.blockedReason(id)`, `jobs.counts()` (open, claimed, blocked by reason)
- `jobs.laborEnabled(dwarfId, labor)`, `jobs.laborPriority(labor)`, `jobs.workersWithLabor(labor)`
- `jobs.standingOrder(name)`
- `jobs.wantsHaulingCount()`
- `jobs.typeOf(id)` — the job type id of a job, or null
- `jobs.isQueued(dwarfId)` — the worker is waiting in the assignment queue
- `jobs.hasWork(dwarfId)` — an open job exists that this worker could take
- `jobs.hasUrgent(dwarfId, priority)` — an open job of that priority or more urgent exists that this worker could take (the dwarf brain's interrupt check)

### Commands

`SetLabor { dwarfId, labor, on }`, `SetLaborPriority { labor, priority }`, `CancelJob { jobId }`, `SetJobPriority { jobId, priority }`, `SetStandingOrder { name, on }`.

### Events consumed

`TilesChanged`, `BuildingStateChanged`, `FluidsChanged`, `ItemCreated`, `ItemDestroyed`, `ItemReleased`, `StocksChanged`, `CreatureDied`, `ImmigrantsArrived`, `NeedCritical` (interrupt), `AlertChanged` (interrupt civilians), `ThreatNearby` (interrupt).

### Events emitted

`JobCreated`, `JobClaimed`, `JobStarted` (entering `working`; each job event carries the content id as `jobType`), `JobCompleted { jobId, jobType, workerId, target }`, `JobCancelled { jobId, reason }`, `JobBlocked { jobId, reason }`, `JobUnblocked`, `ItemReserved { itemId, jobId }`, `ItemReleased { itemId, jobId }`, `ToolEquipped { dwarfId, itemId }`, `ToolDropped { itemId }`. While it executes 09's hunt jobs it emits `HuntStarted { hunterId, targetId }`, `HuntKill { hunterId, targetId }` and `HuntAbandoned { hunterId, targetId, reason }`.

### Registrations

Panel `jobs` (open jobs with worker and reason; labor priorities; standing orders); panel `labors` (grid); inspector section `creature › current job`.

## Player-facing behavior

- Jobs panel: a list sorted by priority with columns: job, target (clickable to center), priority (editable), worker or reason. The reason names the missing item type and count ("waiting: 1 door"), and the selected job's reason also says where the item is made when one to three workshops make it ("— order at a carpenter's workshop"). A summary line: "42 open, 18 claimed, 6 blocked (4 unreachable, 2 missing materials)". Filters by labor and state.
- Labor grid: rows are dwarves, columns are labors; click to toggle; shift-click toggles a column for everyone; a number row above sets labor priorities. The labors panel is the quick view of the grid; the labor manager is the grid as a full-window screen with every labor named, the priority row, multi-select of dwarves and profession templates (Miner, Hauler only, Farmer, Crafter, Soldier, Everything off).
- Labor templates enable exactly the named labors and disable the rest: Miner (`mining`, `hauling`); Hauler only (`hauling`); Farmer (`farming`, `herbalism`, `brewing`, `cooking`, `hauling`); Crafter (`carpentry`, `masonry`, `crafts`, `mechanics`, `gem_cutting`, `leather`, `textiles`, `smelting`, `smithing`, `hauling`); Soldier and Everything off (none). Send only changed cells. Children are skipped with a message. The manager displays pending values immediately and removes them when the reader agrees or a tick passes.
- The look cursor on a designation shows its job state ("Dig, priority 3, claimed by Orm Ashbrow").
- Hints: "No one has mining enabled", "Jobs are blocked: no path (check for doors and water)".

## Tuning constants

| Name | Value | Meaning |
|---|---|---|
| `ASSIGN_WORKERS_PER_TICK` | 8 | |
| `CANDIDATE_LIMIT` | 32 | |
| `Z_DISTANCE_WEIGHT` | 6 | Tiles of horizontal distance one z-level counts as |
| `SKILL_TIME_BONUS_PERCENT` | 8 | Shared with 03; defined there; referenced here |
| `RESERVE_KEEP_TICKS` | 600 | Interrupted undelivered reservations; delivered build/workshop inputs remain with their job |
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
