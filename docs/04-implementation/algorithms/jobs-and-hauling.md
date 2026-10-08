# Algorithm: Job Assignment, Job Steps, Hauling, Stockpile Slots

**Owner:** `systems/jobs`, `systems/items` · **Depends on:** [`../../02-systems/11-jobs-and-labor.md`](../../02-systems/11-jobs-and-labor.md), [`../../02-systems/13-items-and-storage.md`](../../02-systems/13-items-and-storage.md)

## Jobs tick

```
tick(ctx):
  for producer in producers: producer.produce(ctx, sink)            // sink.create(key, jobSpec) is idempotent; sink.cancel(key)
  retryBlocked(min(BLOCKED_RETRIES_PER_TICK, blocked.length))
  served = 0
  while assignQueue non-empty and served < ASSIGN_WORKERS_PER_TICK: w = assignQueue.shift(); assign(w); served++
retryBlocked(n): for job in blocked (creation order, cursor-resumed): if job.retryTick <= tick or job.retryTrigger fired:
                   if reasonGone(job): job.state = open; job.blockedReason = null; emit JobUnblocked
                   else: job.retryTick = tick + BLOCKED_RETRY_TICKS
                   n--; if n==0: break
reasonGone(job): no_worker → a worker has the labor; unreachable → a worker with the labor shares a label with a stand tile;
                 missing_input → every input's still-needed units are found (same search as claim, from the job's first stand tile);
                 no_tool → a worker carries the tool or findTool succeeds from that tile; any other reason → true
```

## Assignment

```
assign(w):
  L = Labors[w]; wLabel = pathing.label(position(w), 'walker')
  cands = []
  for job in open:                                             // open is sorted by (effectivePriority, createdTick)
    if not L.has(job.type.labor): continue
    if job.type.skill and job.minSkill > skill(w, job.type.skill): continue
    t = workTileOf(job); if t == null: continue
    if pathing.label(t, 'walker') != wLabel: continue           // 'adjacent' jobs: any walkable 8-neighbor with the label (cached per job)
    cands.push(job)
  cands.sort(effectivePriority, distance, skill descending, job id); cands = first CANDIDATE_LIMIT
  if cands empty: return 'none'
  best = argmin over cands of score(w, job) with ties by job.id
  score(w, job) = effPriority(job) * 1000 + estDistance(position(w), workTileOf(job)) * 10 - skill(w, job.type.skill) * 15 - (job.workshopWorker == w ? 500 : 0)
  effPriority(job) = job.priority + laborPriority[job.type.labor] - PRIORITY_DEFAULT
  estDistance = max(|dx|,|dy|) + |dz| * Z_DISTANCE_WEIGHT
  while cands non-empty: best = argmin over cands of score(w, job) with ties by job.id
                         if claim(w, best) succeeds: return 'assigned'
                         cands.remove(best)
  return 'none'
claim(w, job):
  job.state = claimed; job.workerId = w; job.claimedTick = tick; Worker[w].jobId = job.id
  for input in job.inputs:
     needed = input.count - delivered amount (units for unit-counted inputs, entities otherwise)
     found = unit input ? find required units in as few stacks as possible (split a partial stack) : items.findItems(input.filter, needed, workTileOf(job), 'walker', {reservable:true})
     if found amount < needed: unclaim(job, 'missing_input'); return
     for it in found: items.setFlag(it, Reserved, true); Item[it].reservedBy = job.id; input.reserved.push(it); emit ItemReserved
  if job.tool and not hasTool(w, job.tool): tool = items.findItem({tag: job.tool, category: 'tool/*' or weapon for 'ranged'}, position(w), 'walker', {reservable:true})
     if not tool: unclaim(job, 'no_tool'); return
     reserve tool; job.data.toolToFetch = tool
  emit JobClaimed
unclaim(job, reason): release reservations; job.state = blocked; job.blockedReason = reason; job.retryTick = tick + BLOCKED_RETRY_TICKS; job.workerId = 0; emit JobBlocked
```

Blocked jobs also record a `retryTrigger` from the reason (see 11's table) and are retried early when the corresponding event arrives (a per-reason dirty flag set by the event handler).

## Job steps (driven by 10 through `jobs.stepWorker`)

```
stepWorker(w, ctx):
  job = jobs[Worker[w].jobId]
  switch job.state:
    claimed:    job.state = job.data.toolToFetch or pendingInputs(job) ? 'fetching' : 'travelling'; job.phase = 0
    fetching:
      target = job.data.toolToFetch ?? nextUndeliveredInput(job)
      if Worker[w].carrying == 0:                                                     // go pick it up
        if at(w, tileOf(target)): items.attachToCarrier(target, w); Worker[w].carrying = target
           if target is tool: equip(w, target); Worker[w].carrying = 0; release its reservation; emit ItemReleased{itemId: target, jobId: job.id} if live; job.data.toolToFetch = null
        else: walkTo(w, tileOf(target), 'job')
      else:                                                                            // deliver
        dest = deliveryTile(job)                                                       // workshop: input tile; build: origin; haul: slot tile
        if at(w, dest): items.dropAt(carrying, dest) or items.putIn(carrying, workshopContainer); mark delivered; Worker[w].carrying = 0
        else: walkTo(w, dest, 'job')
      if no undelivered inputs and no tool to fetch: job.state = 'travelling'
    travelling:
      t = workTileOf(job); if job.workTile == 'adjacent': t = nearest walkable 8-neighbor of target with the worker's label
      if at(w, t): job.state = 'working'; emit JobStarted
      else: r = walkTo(w, t, 'job'); if r == 'unreachable': release(w, job, 'unreachable')
    working:
      job.effort += (100 + SKILL_TIME_BONUS_PERCENT * skill(w, job.type.skill)) * productivity(w)
      needed = baseTicks(job) * 100 * 100
      job.progress = min(1000, floor(job.effort * 1000 / needed))
      if job.effort >= needed: run completing now
    completing:
      producer(job).onComplete(job, ctx)                                               // spawns outputs, applies tile changes, consumes inputs
      grantXp(w, job.type.skill, job.type.xp); release reservations of consumed inputs
      job.state = 'done'; Worker[w].jobId = 0; emit JobCompleted; remove job
walkTo(w, t, urgency): if Motion[w].pathId targets t: r = movement.moveAlongPath(w); if r == 'blocked': re-request; return r
                       else: req = pathing.requestPath(w, position(w), t, 'walker', urgency); when ready: Motion[w].pathId = path; when failed: return 'unreachable'
interrupt(w, keepProgress): job = current; if job.state == 'working' and keepProgress: job.state = 'open' (progress kept, reservations kept for RESERVE_KEEP_TICKS) else job.state='open'
                            if Worker[w].carrying: items.dropAt(carrying, position(w)); Worker[w].jobId = 0; emit JobCancelled? (no: JobReleased is a JobBlocked with reason 'interrupted' not emitted; the job simply returns to open)
```

Each selected input stack is carried in one trip. Unit searches select largest stacks first, ties by ordinary item search order; delivery uses that search order. The job anchor is `data.anchorTile`, else a numeric work tile, else the target.

Hauling jobs (`haul_to_stockpile`) are a special case of the same machine with one input (the item), delivery to the slot, and `working` of 5 ticks.

## Wants-hauling and haul job creation (13, every items tick)

```
created = 0
for it in wantsHauling (ascending id) while created < HAUL_JOBS_PER_TICK:
  if hasJob(it): continue
  if in dump zone: remove from wantsHauling; continue
  if Dump flag: nearest dump zone by centroid, first tile; without one move to noHome; continue
  sp = bestStockpileFor(it); if sp == waiting for wanted container: continue
  if sp == none: wantsHauling.remove(it); noHome.add(it); continue
  slot = findSlot(sp, it); if slot == none: continue                         // full; StockpileFull emitted once
  reserveSlot(slot, jobId); sink.create('haul:'+it, { type: haul_to_stockpile, target: it, workTile: slot.tile, priority: sp.priority, inputs: [item it], data: {slot} })
  created++
bestStockpileFor(it): among stockpiles that accept(it) and have a free slot: min by (chebyshev(tileOf(it), centroid(sp)) then sp.priority then id)
accept(sp, it): categoryUnder(type.category, sp.filter.categories) and (sp.filter.materialClasses == 'any' or class(it) in it) and minQ <= quality <= maxQ and not (rotting and not allowRot) and (sp.linkedSources empty or stockpileOf(it) in linkedSources)
findSlot(sp, it):
  cls = type.container
  if cls != 'none': for c in containers in sp of class cls (tile order): if room(c) >= count(it) (or can merge a stack): return {tile: tileOf(c), container: c}
                    if sp.containersWanted[cls] > containersPresent(cls): request an empty container haul (a separate haul job for the nearest empty container of that class) ; return none
  for t in sp.tiles (sorted): if no item on t and no reservation: return {tile: t, container: 0}
  for t in sp.tiles: if item on t is an identical stack with room: return {tile: t, merge: true}
  return none
```

Each items tick re-examines `noHome` when a previously full stockpile gains space, drops slot reservations whose job is gone, and requests one nearest free empty container per wanted class per stockpile, counting incoming containers. Empty wanted containers already on their stockpile are stored. Non-dwarf corpses with worn items get `strip_corpse`; destroyed items and removed destination stockpiles cancel their haul jobs with `target_invalid`.

On delivery: `dropAt(it, slot.tile)` or `putIn(it, slot.container)`; merge identical stacks; release the slot reservation; the item leaves `wantsHauling`.

## Item search

```
findItem(filter, from, cls, opts):
  fromLabel = pathing.label(from, cls)
  for r in [4, 8, 16, 32, FIND_RADIUS_MAX]:
    best = none
    for it in spatial.inRadius(from, r, kind=item) (ascending id): if not match(it, filter): continue
       if opts.reservable and (flags & (Forbidden|Reserved|Owned|AtDepot)): continue
       t = tileOf(it) (container's tile if inside one); if pathing.label(t, cls) != fromLabel: continue
       d = chebyshev(from, t) + |dz|*Z_DISTANCE_WEIGHT; if d < bestD: best = it
    if best: return best
  // fallback through the stock index
  for it in all matching items (stockpile items first, each group ascending id): same checks; return first
  return 0
match(it, filter): type/category/tag/materialClass/materialId/minQuality/edible/drinkable/emptyContainer as in 13
```

`findItems(filter, n, from, cls)` repeats `findItem` with `excludeIds` accumulating, stopping at `n`.

An optional `allowedTile(tile)` search option rejects a matching candidate at its resolved tile before it can win either the radius search or the stock fallback. It changes no search radius, distance, tie or stockpile preference, and avoids a separate scan of all stock instances for threat exclusions.

## Rot queue (13)

Buckets keyed by tick rounded to `TICKS_PER_HOUR`; an item's expiry tick for its next stage is computed when it is created or moved (`speed` from its location and temperature at that moment); moving an item re-queues it. Each items tick pops buckets with `bucketTick ≤ tick` and advances stages; the head bucket's items are re-sampled for temperature every `SeasonChanged` (cheap approximation stated in 13).
