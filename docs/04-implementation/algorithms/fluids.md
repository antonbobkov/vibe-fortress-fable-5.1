# Algorithm: Fluids

**Detail level:** W4 · **Owner:** `systems/fluids` · **Depends on:** [`../../02-systems/04-fluids.md`](../../02-systems/04-fluids.md), [`../../01-architecture/data-model.md`](../../01-architecture/data-model.md)

Bit helpers on the `fluid` byte: `level(f) = f & 7`, `isMagma(f) = f & 8`, `settled(f) = f & 16`, `source(f) = f & 32`, `frozen(f) = f & 64`. Writes go through `setLevel(i, n)` which preserves the other bits and touches the tile.

```
tick(ctx):
  if tick % FLUID_TICK_CADENCE_WATER == 0: step(WATER)
  if tick % FLUID_TICK_CADENCE_MAGMA == 0: step(MAGMA)
  processMistExpiry(); emit FluidsChanged { chunks: touchedChunks }; touchedChunks.clear()

step(type):
  parity ^= 1; rot = (rot + 1) & 3
  for c in chunks with activeFluidCount > 0 (ascending index):
    tiles = active[c] sorted ascending; if parity: iterate descending
    for T in tiles:
      f = fluid[T]
      if frozen(f) or level(f) == 0 or isMagma(f) != (type == MAGMA): deactivate(T); continue
      moved = fall(T) or spread(T) or (level(f)==7 and pressure(T)) or (type==WATER and evaporate(T))
      if not moved: idle(T)
      contactCheck(T)
  for S in sources[type]: if level(S) < 7: setLevel(S, 7)
  for K in sinks: if level(K) > 0: setLevel(K, 0)

passable(i, type): kind in {Open, Floor, Ramp, Stairs*, Sapling, Shrub, Fortification} and not buildings.blocksFluidAt(i) and (fluid[i]==0 or isMagma(fluid[i]) == (type==MAGMA))
fall(T): B = below(T); if not passable(B, type) or buildings.blocksFallAt(T): return false
         room = 7 - level(B); if room == 0: return false
         n = min(level(T), room); move(T, B, n); mistCheck(T, B); return true
spread(T): given = 0; for k in 0..3: N = neighbor(T, (k + rot) & 3); if not passable(N, type): continue
           if level(N) < level(T) - 1: move(T, N, 1); given += 1
           else if level(N) == level(T) - 1 and rng.chance(SPREAD_EQUALIZE_PERMILLE): move(T, N, 1); given += 1
           if given == SPREAD_MAX_PER_STEP: break
           return given > 0
pressure(T): A = above(T); if not passable(A, type) or level(A) == 7: return false
           if budget <= 0: return false
           H = bfsHead(T, targetZ = z(A)); if H == none: return false
           if source(H): setLevel(A, level(A)+1) else move(H, A, 1); return true
bfsHead(T, targetZ): queue=[T]; seen={T}; n=0
           while queue and n < PRESSURE_SEARCH_LIMIT and budget > 0: X = queue.shift(); n++; budget--
             if z(X) > targetZ and level(X)==7: return X
             for Y in 6-neighbors(X): if not seen and level(Y)==7 and same type and passable(Y): seen.add(Y); queue.push(Y)
           return none
evaporate(T): if level(T)==1 and not source(T) and no 6-neighbor has water: if rng.chance(WATER_EVAPORATE_PERMILLE): setLevel(T,0); return true
           return false
move(a, b, n): setLevel(a, level(a)-n); if level(b)==0: setType(b, type); setLevel(b, level(b)+n); if level(b) >= 1 and kind(b)==Floor: mud(b)
touch(i): idle[i]=0; activate(i); for Y in 6-neighbors(i): activate(Y); touchedChunks.add(chunk(i))
activate(i): if not in active[chunk(i)]: insert sorted; activeFluidCount++ ; clear settled bit
deactivate(i): remove from active; activeFluidCount--; set settled bit
idle(i): idle[i]++; if idle[i] >= FLUID_SETTLE_STEPS: deactivate(i)
mud(b): terrain.setFlag(b, Mud, true) if material class of b is soil or stone
mistCheck(T, B): if type==WATER and (kind(B) solid-bottomed or not passable(below(B))) and level(above(T)) > 0 and kind(above(T))==Open:
           for each tile M in 3x3 around B at z(B) and z(B)+1: mist[M] = tick + MIST_DURATION_TICKS; if new area: emit MistProduced
contactCheck(T): if isMagma(fluid[T]) : return
           for Y in 6-neighbors(T): if level(fluid[Y]) > 0 and isMagma(fluid[Y]):
             terrain.setKind(Y, level(Y) >= OBSIDIAN_WALL_LEVEL ? Wall : Floor, obsidian); fluid[Y] = 0; deactivate(Y)
             setLevel(T, level(T)-1); emit ObsidianFormed{Y}
```

Post-step entity checks: for each touched tile with entities (`spatial.at`): water level ≥ `FLUID_DEEP_LEVEL` → `CreatureSubmerged` per creature (unless `size ≥ WADE_LARGE_SIZE` and level < 7); magma level ≥ 1 → `MagmaContact { tile, entities }`.

Freeze and thaw (called from `TemperatureTick`):

```
for T in outdoorWaterTiles: t = materials.temperatureAt(T)
  if not frozen(T) and t < FREEZE_C and level(T) > 0: freeze(T)
  else if frozen(T) and t > THAW_C: thaw(T)
freeze(T): frozenOriginalKind[T] = kind(T); terrain.setKind(T, level(T) >= ICE_WALL_LEVEL ? Wall : (solidBottomed(below(T)) ? Floor : Wall), ice)
           fluid[T] |= FROZEN; deactivate(T); for creature on T: movement.teleport to nearest walkable within 2 else CreatureDied{frozen}
thaw(T):   terrain.setKind(T, frozenOriginalKind[T], 0); fluid[T] &= ~FROZEN; touch(T)
```

Determinism: the only randomness is `rng.chance` in `spread` and `evaporate`, drawn from the fluids stream in iteration order.
