# F-01 — Core job-loop defects: assignment livelock, stacked build inputs, haul jobs for held items (M)

**Needs:** — · **Blocks:** F-04, F-09, T-M6-01 · **Spec touched:** `11-jobs-and-labor.md`, `algorithms/jobs-and-hauling.md`, `13-items-and-storage.md`, `14-buildings-and-rooms.md`

## Why

The M5 audit found no evidence that a fortress can bootstrap itself (audit finding 4). A bootstrap probe was run on a 48×48 `flat-test` map with the Balanced embark, three seeds, 20 days. It played only through player commands: an "everything" stockpile, a stairwell from z 32 to 29, a 5×5 room at z 29, then carpenter, mason, still, kitchen and hearth, stone-block orders and a barley plot. The probe found three defects in the core job loop. The first alone stops a fortress dead.

**1. Livelock (seeds boot-1 and boot-2).** Only the carpenter got built. The stairwell stopped after two of four levels. 24 haul jobs and the remaining stair job stayed `open` for 20 days while dwarves stood at "No job". The job log showed 2,239 `JobBlocked { build, missing_input }` events against 1 successful build claim. The mechanism:

- The still, kitchen and mason wait for raw stone, and their build jobs block `missing_input` at claim.
- `retryBlocked` reopens `missing_input` and `no_tool` jobs every `BLOCKED_RETRY_TICKS` (100) **without checking anything** (D-054 checks only `no_worker` and `unreachable`).
- `assignOne` chooses the single best-scoring candidate. The reopened build jobs outrank hauls and stairs, so they are chosen. The claim fails, the job blocks again, and **the worker gets no job at all**: `assignOne` returns 0 and the dwarf idles for `IDLE_TICKS`.
- The stair job, and with it all the stone, never happens.

W4 (`algorithms/jobs-and-hauling.md` § Jobs tick, § Assignment) specifies exactly this behaviour, so this is a spec defect that the code reproduced faithfully.

**2. Multi-unit building inputs count stacks (boot-1 and boot-2, after defect 1 is fixed).** The hearth needs `3 stone_block + 1 log`. `make_stone_block` yields a **stack of 2**, so two crafts leave two stacks of 2 (4 blocks). Build jobs count input *items*, not units, so the job needs three separate stacks and blocks `missing_input` for ever. D-124 fixed this for craft jobs only. This defect also stops every forge (1 anvil + 3 blocks) and every magma workshop from being built from crafted blocks. It went unnoticed because the tests build with `TestWorld.build()`, which places buildings instantly.

**3. Haul jobs outlive their item's pickup.** `haul:<pick id>` stayed `open` for 20 days while the pick was in a miner's hand. The haul job for an item is cancelled only when the item is destroyed (`hauling.ts` `cancelFor`), not when another job picks it up.

**Measured effect of the fixes below (prototype):**

| | Before | After |
|---|---|---|
| Seeds that dig the stairwell and room | 1 of 3 | 3 of 3 |
| `missing_input` blocks in 20 days | 2,239 | 5–8 |
| Still built | only boot-3 (day 5.6) | days 2.3–3.3 |
| Kitchen built | only boot-3 | days 2.3–3.8 |
| Mason built | only boot-3 | days 3.4–4.3 |
| Room dug | only boot-3 | days 4.2–4.7 |
| Hearth built | only boot-3 (day 8.5) | days 4.8–5.8 |

The balance table (`balance.md` § Year-one) asks for a still by days 1–3 and a lit hearth by days 4–10.

## Decisions

1. **Decision F-01a.** A job blocked `missing_input` or `no_tool` reopens only when the reason is gone, exactly as D-054 already does for `no_worker` and `unreachable`:
   - Every input with units still needed can be found now. Use the same search as `claim` (`findUnits` for unit-counted inputs, `findItems` otherwise), with `excludeIds` = the input's reserved and delivered items, searched from the job's first stand tile (or its anchor tile when it has no stand tile).
   - The job's tool, when it has one and `data.toolToFetch` is unset, is either carried by some worker or found by `findTool` from that same tile.

   Otherwise the job stays blocked with the same reason and `retryTick = now + BLOCKED_RETRY_TICKS`. The event triggers of `11` § Blocking and retry still pull the retry forward. (The search must start from a stand tile: a dig job's anchor is the wall itself, and a reachability search from a wall finds nothing. The prototype failed `test/unit/items/search.test.ts` "T-M2-08 … `no_tool` until one exists" until this was done.)
2. **Decision F-01b.** When `claim` fails for the chosen candidate, `assignOne` removes that candidate and chooses again from the rest, with the same `choose` rule, until a claim succeeds or no candidate is left. The failed job blocks as today.
3. **Decision F-01c.** A build job counts units when any of its inputs needs more than one unit (`data.inputUnits = inputs.some((i) => i.count > 1)`). On completion each input consumes exactly its `count` units, taken in delivery order from its delivered stacks. Any remainder of a stack stays where it was delivered. `settings.inputs` records one entry per consumed unit.
   - Single-unit build inputs keep the nearest-item search. With unit counting on every build job, `findUnits` prefers the largest stacks, and a wall ("1 block, log, bar or raw stone") was built from the embark's five iron bars instead of the nearby raw stone. `test/unit/buildings/build.test.ts` "deconstructing a construction … (D-050)" catches that.
4. **Decision F-01d.** When an item stops wanting hauling (13's `examine`) and a haul, dump or strip job exists for it in state `open` or `blocked`, that job is cancelled with `target_invalid`. A job already `claimed` or `working` is left alone, because its own worker is the one carrying the item.

## Spec amendments

`docs/02-systems/11-jobs-and-labor.md` § Blocking and retry, after the sentence "Blocked jobs are re-evaluated on their trigger or every `BLOCKED_RETRY_TICKS`, whichever comes first, in creation order, at most `BLOCKED_RETRIES_PER_TICK` per tick.", add:

> A re-evaluated job opens only when its reason is gone: a worker with the labor exists (`no_worker`), a stand tile shares a connectivity label with such a worker (`unreachable`), every input still needed can be found (`missing_input`), and the tool is carried by a worker or can be found (`no_tool`). Otherwise it stays blocked until its next trigger or `BLOCKED_RETRY_TICKS`. A job whose inputs cannot be found must never be offered to workers, or it starves every job ranked below it.

`docs/02-systems/11-jobs-and-labor.md` § Assignment: add at the end of the section:

> If the claim of the chosen job fails (it blocks `missing_input` or `no_tool`), the worker tries the next candidate in the same order; only when every candidate fails does the worker go idle.

`docs/04-implementation/algorithms/jobs-and-hauling.md`:

- In § Jobs tick, replace the `retryBlocked` line with:
  ```
  retryBlocked(n): for job in blocked (creation order, cursor-resumed): if job.retryTick <= tick or job.retryTrigger fired:
                     if reasonGone(job): job.state = open; job.blockedReason = null; emit JobUnblocked
                     else: job.retryTick = tick + BLOCKED_RETRY_TICKS
                     n--; if n==0: break
  reasonGone(job): no_worker → a worker has the labor; unreachable → a worker with the labor shares a label with a stand tile;
                   missing_input → every input's still-needed units are found (same search as claim, from the job's first stand tile);
                   no_tool → a worker carries the tool or findTool succeeds from that tile; any other reason → true
  ```
- In § Assignment, replace `  claim(w, best)` with:
  ```
  while cands non-empty: best = argmin over cands of score(w, job) with ties by job.id
                         if claim(w, best) succeeds: return 'assigned'
                         cands.remove(best)
  return 'none'
  ```

`docs/02-systems/14-buildings-and-rooms.md` § Placement (add as the last paragraph of the section, before `### Constructions`):

> A build input of more than one unit is counted in units, not stacks: a hearth's three blocks may arrive as a stack of two and a stack of one; the job consumes exactly the units it needs and leaves any remainder of a stack on the site.

`docs/02-systems/13-items-and-storage.md` § The "wants hauling" set (add as its last bullet):

> - When an item leaves the set because another job picked it up (a tool fetched, food eaten, an input delivered), an unclaimed haul, dump or strip job for it is cancelled (`target_invalid`).

## Code

| File | Change |
|---|---|
| `src/systems/jobs/board.ts` | `retryBlocked`: before reopening a `missing_input` or `no_tool` job, call a new private `inputsAvailable(job)` implementing Decision F-01a; if false, keep the reason, set `retryTick = now + BLOCKED_RETRY_TICKS`, `continue`. `assignOne`: loop as in Decision F-01b (`pool = candidates`; `choose(pool)`; on a failed `claim`, remove the chosen job id from `pool` and repeat). Update the doc comments that cite D-054 to cite D-054 and this task's decision. |
| `src/systems/buildings/build.ts` | `produce`: build jobs get `data.inputUnits = inputs.some((i) => i.count > 1)` (compute `inputsFor(...)` once). `onComplete`: for each `job.inputs[k]`, walk `delivered` in order and take `min(remaining, stack count)` units from each, building a `Map<itemId, units>`. `complete(...)` gains an optional `take` map: it consumes `take.get(it)` units (default 1, which keeps `TestWorld.build`'s path unchanged) and pushes one `settings.inputs` entry per unit. |
| `src/systems/items/hauling.ts` | `examine(id)`: when the item does not want hauling, look up `haulKey(id)`, `dumpKey(id)` and `stripKey(id)`; cancel each job whose state is `open` or `blocked` with `target_invalid` (reuse `cancelFor`'s loop with a state check; do not cancel `claimed`/`working` jobs). |

Keep every existing D-054/D-070/D-076 behaviour. `toolHeldElsewhere` stays as it is.

## Tests

Add to `test/unit/jobs/jobs.test.ts` (describe `F-01 job loop`):

1. **"a job whose inputs cannot be found stays blocked across retries and does not starve lower-ranked jobs"**:
   - Setup: `flat-test`, `embark: 'none'`, one dwarf with all labors, a `still` placed with `PlaceBuilding` (inputs barrel + raw_stone; spawn the barrel, no stone) at priority 4, and one log on the ground with a `wood` stockpile.
   - Run 600 ticks.
   - Assert: the log is hauled (a `JobCompleted { jobType: 'haul_to_stockpile' }` event exists); the still's build job has at most 2 `JobBlocked { missing_input }` events (its creation and one failed claim at most; before the fix it had one per retry); no `JobUnblocked` for it.
   - Then spawn a raw stone. Within 200 ticks the build job is unblocked and claimed.
2. **"a failed claim falls through to the next candidate"**:
   - Setup: two open jobs at the same priority, the nearer one needing a missing input.
   - Assert: after one assignment tick the dwarf holds the farther job (`Worker.jobId` is its id), and the nearer job is blocked `missing_input`.

Add to `test/unit/buildings/build.test.ts` (describe `F-01 unit-counted build inputs`):

3. **"a hearth builds from a stack of 2 and a stack of 1 blocks and leaves no remainder"**: spawn `stone_block` granite count 2 and count 1, plus a log; `PlaceBuilding hearth`; run until built (bound 2,000 ticks); assert `items.count('stone_block') === 0` and `settings.inputs` lists 3 blocks and 1 log.
4. **"a hearth builds from two stacks of 2 and leaves one block on the site"**: as test 3 with two stacks of 2; assert one `stone_block` remains (count 1) and lies on a footprint or stand tile of the hearth.
5. The existing "deconstructing a construction … returns the item it was built from (D-050)" must keep passing unchanged. It pins the single-unit input rule.

Add to `test/unit/items/hauling.test.ts`:

6. **"a haul job is cancelled when another job picks its item up"**: a pick on the ground with a `stone` stockpile (not accepting tools) and a `tools` stockpile (`filter: { categories: ['tool'] }`); a dig designation far from both. Assert: when `ToolEquipped { itemId: pick }` fires, the pick's haul job (if one was created) is cancelled `target_invalid` within one items tick, and no job with key `haul:<pick>` remains.

The bootstrap scenario that found these defects becomes `year_one` in F-04. It is the integration test for this task.

## Done

- `npm run lint && npm run typecheck && npm run content:check && npm test` green.
- `test/golden/world-hashes.json` regenerated (world hashes change because claims change). Commit body: "world hashes: F-01 changes which jobs are claimed and when".
- Two `DECISIONS.md` rows:
  - F-01a/b ("`missing_input` and `no_tool` reopen only when their reason is gone; a failed claim falls through to the next candidate; supersedes the reopen-blindly half of D-054"; pinning tests 1 and 2).
  - F-01c/d (pinning tests 3, 4 and 6).
- Every spec amendment above applied verbatim.
