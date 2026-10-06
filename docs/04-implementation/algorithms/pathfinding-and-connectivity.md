# Algorithm: Pathfinding, Connectivity, Movement

**Owner:** `core/pathfinding.ts`, `core/connectivity.ts`, `core/movement.ts` · **Depends on:** [`../../02-systems/22-pathfinding-and-spatial.md`](../../02-systems/22-pathfinding-and-spatial.md)

## Passability and cost

```
passable(i, cls, faction):
  k = kind[i]
  if k in {Wall, Tree, Boulder, Open}: return false
  if k == Fortification and cls != 'small': return false
  b = buildingAt.get(i); if b and buildings.blocksMovementAt(i, cls, faction): return false
  f = fluid[i]; lv = level(f)
  if isMagma(f) and lv > 0 and not speciesMagmaSafe(faction/creature): return false
  if cls == 'aquatic': return not isMagma(f) and lv >= FLUID_DEEP_LEVEL
  if lv >= FLUID_DEEP_LEVEL and not isMagma(f) and cls != 'amphibious' and not (cls=='large' and sizeLarge and lv < 7): return false
  if flags[i] & Burning: return false
  if faction == 'fortress' and forbiddenTiles.has(i): return false
  return true
cost(i, cls, faction):   // Fixed, base 1000
  c = 1000
  if 1 <= level(fluid[i]) <= FLUID_WADE_LEVEL and not aquatic: c *= 2
  if flags[i] & Snow: c = c * SNOW_MOVE_COST_PERCENT / 100
  if flags[i] & Restricted and faction == 'fortress': c *= 5
  if flags[i] & Web: c *= 3
  if buildingAt has a door at i: c += 200
  return c
edges(i, cls, faction) -> [(j, stepCost)]:
  for d in 8 horizontal dirs: j = i + d; if inBounds and passable(j):
     if diagonal(d): a, b = the two orthogonal neighbors; if kind[a] or kind[b] in {Wall, Tree, Boulder, Fortification}: continue; yield (j, cost(j)*1414/1000) else yield (j, cost(j))
  k = kind[i]
  if k in {StairsUp, StairsUpDown} and cls != 'large': u = above(i); if kind[u] in {StairsDown, StairsUpDown} and passable(u) and not lockedHatchAt(u): yield (u, cost(u))
  if k in {StairsDown, StairsUpDown} and cls != 'large': dn = below(i); if kind[dn] in {StairsUp, StairsUpDown} and passable(dn) and not lockedHatchAt(i): yield (dn, cost(dn))
  if k == Ramp:                       // up: the ramp r leans on a solid tile w; the exit u is directly above w
    if kind[above(i)] != Open: skip
    for d in 4 cardinal: w = i + d; if kind[w] in {Wall, Tree, Boulder, Fortification}: u = above(w); if passable(u): yield (u, cost(u))
  w = below(i)                        // down: standing on u = i, the tile directly below is the solid w a ramp may lean on
  if kind[w] in {Wall, Tree, Boulder, Fortification}:
    for d in 4 cardinal: r = w + d; if kind[r] == Ramp and passable(r) and kind[above(r)] == Open: yield (r, cost(r))
```

Ramp rule in words: a ramp `r` at level z connects to the tile `u` at level z+1 that sits directly above any solid cardinal neighbor `w` of `r`, provided the tile above `r` is open. The edge is symmetric.

## Connectivity labels

```
rebuildChunk(c, cls):
  localLabel[c] = fill 0; count = 0
  for each tile i in chunk order: if passable(i, cls) and localLabel[i] == 0: count++; floodFillHorizontal(i, count)   // within the chunk, horizontal edges only (including diagonals)
  portals[c] = []
  for each tile i on the chunk boundary or with a vertical edge: for (j, _) in edges(i, cls): if chunk(j) != c: portals[c].push((localLabel[i], chunk(j), localLabel[j]))
rebuildGlobal(cls):
  uf = unionFind(total components = Σ counts)
  for c: for (la, cb, lb) in portals[c]: uf.union(gid(c, la), gid(cb, lb))
  globalLabel[c][la] = uf.find(gid(c, la))
label(i, cls) = globalLabel[chunk(i)][localLabel[i]] (0 if impassable)
onTickEnd(): if dirtyChunks non-empty: for c in dirtyChunks: for cls in classes: rebuildChunk(c, cls); for cls: rebuildGlobal(cls); dirtyChunks.clear(); pathCache.invalidate(dirtyChunks)
```

Movement classes with labels: `walker`, `small`, `large`, `aquatic`. `amphibious` = `walker` labels merged with `aquatic` at query time (reachable if either matches through a chain: implemented by a third label set `amphibious` computed with amphibious passability; cheap enough).

## A*

```
requestPath(id, from, to, cls, urgency, opts): r = { id, from, to, cls, urgency, opts, state: pending, open: heap, g: stamped arrays }; queue.push(r) ordered by (urgency, requestId); return r.id
tick(): budget = PATH_NODES_PER_TICK (halved for non-dwarves under load shedding)
  for r in queue (in order) while budget > 0 and inProgress <= PATH_CONCURRENT:
    if r.state == pending: if label(from) != label(to) and not opts.nearest: r.state = failed(unreachable); continue
                            init: g[from]=0; open.push(from, h(from)); r.state = running; r.expanded = 0
    while budget > 0 and r.open non-empty:
      cur = open.pop(); if cur == to: r.state = ready(reconstruct); break
      if cur in closed: continue; closed.add(cur); r.expanded++; budget--
      if r.expanded >= PATH_NODE_LIMIT: r.state = opts.nearest ? ready(reconstruct(bestSoFar)) : failed(too_far); break
      for (j, c) in edges(cur, cls, faction): ng = g[cur] + c; if ng < g[j]: g[j] = ng; parent[j] = cur; open.push(j, ng + h(j)); track bestSoFar by min h
    if r.open empty and r.state == running: r.state = opts.nearest ? ready(reconstruct(bestSoFar)) : failed(unreachable)
h(i) = max(|dx|,|dy|) * 1000 + |dz| * Z_HEURISTIC_COST
```

`g`, `parent`, `closed` are typed arrays sized to the map with a generation stamp per request, so no clearing is needed. Ties in the heap break by tile index. Paths are arrays of tile indices from `from` (exclusive) to `to` (inclusive).

Path cache: key `(chunk(from), to, cls)`; store path and its chunk set; on hit, run A* from `from` to `path[0]` with node limit 512 and splice.

## Movement helper

```
moveAlongPath(id, ctx):
  m = Motion[id]; if m.pathId == 0: return 'idle'
  p = paths[m.pathId]; if m.stepIndex >= p.length: clear; return 'arrived'
  if m.waitUntil > tick: return 'moving'
  next = p[m.stepIndex]
  m.progress += m.speed * 1000 / cost(next, m.cls, faction(id))
  while m.progress >= 1000:
    if not passable(next, cls, faction) : return repath(id, 'blocked')
    if blockedByCreature(next, id): m.waitUntil = tick + REPATH_WAIT_TICKS; m.repathCount++; if m.repathCount > REPATH_LIMIT: return repath(id,'blocked'); return 'moving'
    prev = position(id); setPosition(id, next); spatial.move(id, prev, next); movesThisTick.push([id, prev, next])
    if kind[next] == Open: return fall(id)
    m.progress -= 1000; m.stepIndex++; m.repathCount = 0
    if m.stepIndex >= p.length: clear; return 'arrived'
    next = p[m.stepIndex]
  return 'moving'
fall(id): z0 = z(pos); descend while kind(below) == Open or (below has fluid and no solid bottom); land on first solid-bottomed tile (or fluid surface at level 7); levels = z0 - z(landed); setPosition; emit Fell{id, levels, landedOn}; clear path; return 'fell'
blockedByCreature(next, id): any creature on `next` that is hostile to `id`, or any creature if buildingAt(next) is a door
```

`EntitiesMoved { moves: movesThisTick }` is emitted once per tick by the core after the last brain ran. Spatial index: `spatial.move(id, a, b)` removes from `chunks[chunk(a)].entities` and inserts sorted into `chunks[chunk(b)].entities` when the chunk differs.

Line of sight: Bresenham on the same z from `a` to `b` (exclusive of `a`, inclusive of `b`); blocked if any intermediate tile's kind is in {Wall, Tree, Boulder} or a closed door / raised bridge / closed floodgate stands on it, or it is a Fortification and neither `a` nor `b` is adjacent to it. Length cap `LOS_MAX`.
