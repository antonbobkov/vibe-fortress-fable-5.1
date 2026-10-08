# Algorithm: Fluids

**Owner:** `systems/fluids` · **Depends on:** [`../../02-systems/04-fluids.md`](../../02-systems/04-fluids.md), [`../../01-architecture/data-model.md`](../../01-architecture/data-model.md)

Bit helpers on the `fluid` byte: `level(f) = f & 7`, `isMagma(f) = f & 8`, `settled(f) = f & 16`, `source(f) = f & 32`, `frozen(f) = f & 64`. Writes go through `setLevel(i, n)` which preserves the other bits and touches the tile.
`eq[i] = 0` unless the write is an equalizing move.

```
tick(ctx):
  if freezePending: freezePending = false; process outdoor water freeze/thaw list
  if tick % FLUID_TICK_CADENCE_WATER == 0: step(WATER)
  if tick % FLUID_TICK_CADENCE_MAGMA == 0: step(MAGMA)
  processMistExpiry(); emit FluidsChanged { chunks: touchedChunks }; touchedChunks.clear()

step(type):
  parity ^= 1; rot = (rot + 1) & 3
  for c in chunks with activeFluidCount > 0 (ascending index):
    tiles = active[c] sorted ascending; if parity: iterate descending
    for T in tiles:
      f = fluid[T]
      if frozen(f) or level(f) == 0: deactivate(T); continue
      if isMagma(f) != (type == MAGMA): continue
      moved = fall(T) or spread(T) or (level(f)==7 and pressure(T)) or (type==WATER and evaporate(T))
      if not moved and neither pressure nor evaporation asks for retry: idle(T)
      contactCheck(T)
  for S in drained sources[type] (ascending): if not frozen(S) and level(S) < 7: setLevel(S, 7)
  for K in sinks: if level(K) > 0: setLevel(K, 0)

passable(i, type): kind in {Open, Floor, Ramp, Stairs*, Sapling, Shrub, Fortification} and not buildings.blocksFluidAt(i) and (fluid[i]==0 or isMagma(fluid[i]) == (type==MAGMA))
fall(T): B = below(T); if solidBottomed(T) or not passable(B, type) or buildings.blocksFallAt(T): return false
         room = 7 - level(B); if room == 0: return false
         n = min(level(T), room); move(T, B, n); mistCheck(T, B); return true
spread(T): given = 0; for k in 0..3: N = neighbor(T, (k + rot) & 3); if not passable(N, type): continue
           if level(N) < level(T) - 1: move(T, N, 1); given += 1
           else if level(N) == level(T) - 1 and level(N) >= 1 and eq[T] < FLUID_EQUALIZE_BUDGET and rng.chance(SPREAD_EQUALIZE_PERMILLE): move(T, N, 1); eq[T] += 1; given += 1
           if given == SPREAD_MAX_PER_STEP: break
           return given > 0
pressure(T): A = above(T); if solidBottomed(A) or not passable(A, type) or level(A) == 7: return false
           if budget <= 0: return retry
           H = bfsHead(T, targetZ = z(A)); if H == retry: return retry; if H == none: return false
           if source(H): setLevel(A, level(A)+1) else move(H, A, 1); return true
bfsHead(T, targetZ): queue=[T]; seen={T}; n=0
           while queue and n < PRESSURE_SEARCH_LIMIT:
             if budget <= 0: return retry
             X = queue.shift(); n++; budget--
             if z(X) > targetZ and level(X)==7: return X
             for Y in 6-neighbors(X): if not seen and level(Y)==7 and same type and passable(Y) and (not vertical or not solidBottomed(upper(X,Y))): seen.add(Y); queue.push(Y)
           return none
evaporate(T): if level(T)==1 and not source(T) and no 6-neighbor has liquid water:
             if rng.chance(WATER_EVAPORATE_PERMILLE): setLevel(T,0); return moved
             return retry   // no idle increment
           return idle
move(a, b, n): setLevel(a, level(a)-n); if level(b)==0: setType(b, type); setLevel(b, level(b)+n); if level(b) >= 1 and kind(b)==Floor: mud(b)
touch(i): if holds unfrozen fluid: idle[i]=0; activate(i)
           for Y in 6-neighbors(i): if Y holds unfrozen fluid: activate(Y)
           touchedChunks.add(chunk(i))
activate(i): if not in active[chunk(i)]: insert sorted; activeFluidCount++; idle[i]=0; clear settled bit
deactivate(i): remove from active; activeFluidCount--; set settled bit
idle(i): idle[i]++; if idle[i] >= FLUID_SETTLE_STEPS: deactivate(i)
mud(b): terrain.setFlag(b, Mud, true) if material class of b is soil or stone
mistCheck(T, B): if type==WATER and (kind(B) solid-bottomed or not passable(below(B))) and level(above(T)) > 0 and kind(above(T))==Open:
           area = valid tiles in 3x3 around B at z(B) and z(B)+1; newArea = none of area is misty at mistNow
           for M in area: mist[M] = tick + MIST_DURATION_TICKS
           if newArea: emit MistProduced{tiles: area}
contactCheck(T): if isMagma(fluid[T]) : return
           for Y in 6-neighbors(T): if level(fluid[Y]) > 0 and isMagma(fluid[Y]):
             terrain.setKind(Y, level(Y) >= OBSIDIAN_WALL_LEVEL ? Wall : Floor, obsidian); fluid[Y] = 0; deactivate(Y)
             setLevel(T, level(T)-1); emit ObsidianFormed{Y}
```

At each step set `mistNow = tick`; after the step drop mist entries whose expiry is at or before `mistNow`. `isMisty` compares with this saved last-step tick.

A new game starts with an empty active set. Generated fluid remains still until touched; sinks drain on the first step. Source refills track only drained sources in ascending order. Save idle counters parallel to active tile indices, without a first-tick activation flag.

Post-step entity checks: for each touched tile with entities (`spatial.at`): water level ≥ `FLUID_DEEP_LEVEL` → `CreatureSubmerged` per creature (unless `size ≥ WADE_LARGE_SIZE` and level < 7); magma level ≥ 1 → `MagmaContact { tile, entities }`, also for a magma tile that holds a building and no entity (`entities` empty).

On `EntitiesMoved`, also check each moved entity on its destination tile, including settled water or magma.

Freeze and thaw (`TemperatureTick` queues `freezePending`; the pass runs at 04's next tick):

```
for T in outdoorWaterTiles: t = materials.temperatureAt(T)
  if not frozen(T) and t < FREEZE_C and level(T) > 0: freeze(T)
  else if frozen(T) and t > THAW_C: thaw(T)
freeze(T): frozenOriginalKind[T] = kind(T); frozenOriginalMaterial[T] = material(T); terrain.setKind(T, level(T) >= ICE_WALL_LEVEL ? Wall : (solidBottomed(below(T)) ? Floor : Wall), ice)
           fluid[T] |= FROZEN; deactivate(T); for creature on T: movement.teleport to first walkable in Chebyshev rings 1 then 2, (dz,dy,dx) order, else CreatureDied{id, cause:frozen, killerId:0}
thaw(T):   terrain.setKind(T, frozenOriginalKind[T], frozenOriginalMaterial[T]); fluid[T] &= ~FROZEN; touch(T)
```

Keep outdoor liquid or frozen water on level writes and for whole columns named by TilesChanged. A frozen tile that loses its recorded ice kind or material loses its fluid and freeze record; digging itself follows 03's ice-to-floor rule. Wells follow open tiles downward, return the first liquid water tile, and stop at any other non-open tile.

Determinism: the only randomness is `rng.chance` in `spread` and `evaporate`, drawn from the fluids stream in iteration order.
