# Algorithm: Local Map Generation

**Detail level:** W4 · **Owner:** `systems/terrain` · **Depends on:** [`../../02-systems/03-terrain-and-mining.md`](../../02-systems/03-terrain-and-mining.md), [`../../03-content/minerals-and-metals.md`](../../03-content/minerals-and-metals.md), [`../../03-content/regions-biomes-and-traits.md`](../../03-content/regions-biomes-and-traits.md)

```
generateLocal(spec: LocalMapSpec, map: Map3D, registry, progress): void
  W = LOCAL_MAP_W; H = LOCAL_MAP_H; D = LOCAL_MAP_Z; S = hash64(spec.seed)
  fill map.kind with Open, material 0, fluid 0, flags 0
  // 1. heightmap
  st = stream(S, 'terrain.height')
  base = SURFACE_Z_MIN + (spec.elevation - SEA_LEVEL) * (SURFACE_Z_MAX - SURFACE_Z_MIN) / (255 - SEA_LEVEL)
  amp = [1, 2, 4, 6][spec.relief]
  h[x][y] = clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base + round(noise(st, x, y, [32, 12], [amp*0.7, amp*0.3]) - amp/2))
  h = median3x3(h)
  // 2. rivers and lakes (carve before layers so beds get stone)
  riverTiles = set(); st = stream(S, 'terrain.rivers')
  if spec.river: for each inflow edge: path = wander(st, midpoint(inflow), spec.river.outflowEdge ? midpoint(outflow) : lakeCenter(st))
       width = {brook:1, river:3, major:5}[class]; depth = {brook:1, river:2, major:2}[class]
       for each path tile p and its width-band tiles q: riverTiles.add(q); h[q] = min over band of h - depth (bed level); sourceEdge/sinkEdge marks kept
  if spec.lake or lake created: center = lakeCenter; radius = st.int(6,12); for tiles within radius (noise-jittered): lakeTiles.add; h[q] = h - 2
  wander(st, from, to): walk with steps toward `to` 70% / perpendicular 30%, never leaving the map, until reaching `to`
  // 3. columns: soil, rock layers, magma sea
  st = stream(S, 'terrain.layers')
  stack = rollStack(spec.geology, st)                      // [{material, thickness}], repeats until it covers D
  soilDepth = (spec.biome.soilDepth) ; if 'glasslands' in traits: soilMaterial = obsidian; soilDepth = spec.biome.soilDepth
  for x, y:
    top = h[x][y]; undulation = round(noise(stream(S,'terrain.undulation'), x, y, [24], [2]) - 1)
    for z in 0..D-1:
      i = idx(x,y,z)
      if z <= MAGMA_SEA_TOP_Z:
        if x < 2 or y < 2 or x >= W-2 or y >= H-2 or noise(stream(S,'terrain.pillars'), x, y, [6], [100]) > 92: kind=Wall, material=basalt
        else: kind=Open; fluid = 7 | MAGMA | SOURCE
      else if z == MAGMA_SEA_TOP_Z + 1: kind=Wall, material=basalt
      else if z > top: kind=Open
      else if z > top - soilDepth: kind=Wall, material = soilMaterial or pick(biome.soil by weight, stream 'terrain.soil')
      else: kind=Wall, material = layerAt(stack, top - soilDepth - z + undulation)
    surface tile (x,y,top): if in riverTiles or lakeTiles: kind of bed tile = Floor of the stone below; fill z from bed+1 to original top-1 with water 7; edge tiles of inflow → SOURCE; outflow → sink list
    else: kind(x,y,top) = Floor (the column's top solid becomes the walkable surface: i.e. set tile at z=top to Floor with its material; tiles above Open)
  progress('layers')
  // 4. caverns
  for tier in [1,2,3]: (zmin, zmax) = band(tier); frac = CAVERN_OPEN_FRACTION(spec.deepness) + traitAdjust
    st = stream(S, 'terrain.cavern'+tier)
    for x,y,z in band: n = noise3(st, x, y, z, [14, 6], [70, 30]); open = n < frac*100
      if open and not (x<2 or y<2 or x>=W-2 or y>=H-2): kind=Open, material=0
    for x,y: for z in band ascending: if kind(z)==Open and kind(z-1)==Wall: kind(z-1) = Floor; if st.chance(600): material(z-1) = cave_loam (else the stone) ; flags |= Grass if cave_loam
    lakes: for floor tiles with noise3(..., [10],[100]) < 18: convert column above to water up to the band's lowest open z + 1
    magma pools (tier >= 2): for st.chance(2) per 100 floor tiles: circle radius st.int(2,4) of magma level 7 (no source) at floor level (tile becomes Open with magma; floor below stays)
    if 'deep_well' and tier == 1: lake threshold 60 instead of 18
  progress('caverns')
  // 5. veins and clusters
  st = stream(S, 'terrain.minerals'); mult = wealthMultiplier[spec.wealth]
  for mineral in registry.minerals (id order):
    n = expectedCount(mineral, spec) * mult.ore (gems: mult.gem); count = floor(n) + (st.fixed() < frac(n) ? 1 : 0)
    for k in 0..count-1:
      start = randomWallTile(st, hosts = mineral.hosts); if none after 50 tries: continue
      if mineral.shape == 'vein': walk = start; for s in 0..mineral.length-1:
          paint(walk, radius st.int(1,2)) with material=mineral (only Wall tiles whose material is a host)
          dir = st.weighted([[±x,3],[±y,3],[±z,1]]); walk += dir; if out of bounds or not host: break
      else: paint(start, radius mineral.radius)
  deepsilver: veins = mult.deepsilverVeins (+1 with wyrm_roost placed next to the chamber): start tiles are Wall tiles with z <= DEEPSILVER_Z_MAX within 2 of a magma tile; length 6, radius 1
  progress('minerals')
  // 6. volcano
  if spec.volcano: c = randomSurfacePoint(st) at chebyshev >= 20 from arrivalEdge midpoint; r = glasslands ? 3 : st.int(1,2)
    for z in 0..h[c]: tiles within r of c: kind=Open, fluid = 7|MAGMA|SOURCE; ring r+1..r+2: Wall obsidian; surface within 6: soil replaced by obsidian, no vegetation
  // 7. vegetation
  st = stream(S, 'terrain.plants')
  for surface floor tiles with soil material (not river/lake, not within 2 of river unless willow):
    if st.fixed() < biome.treeDensity: kind=Tree, material = pick(tree species by biome weight)
    else if st.fixed() < biome.shrubDensity: kind=Shrub, material = pick(shrub species)
    else flags |= Grass
  cavern floors (cave_loam): fungus trees with density 0.12 by cavern weights; cavern shrubs 0.08
  // 8. traits
  if old_battlefield: scatter BATTLEFIELD_ITEM_COUNT items on surface tiles in band 15..40 from arrival edge (spawned after entities exist: recorded as a spawn list applied by 02 arrival)
  if sunken_halls: carveHallTemplate(st, farthest hillside from arrival edge); record furniture and vault spawn list
  if gemsprings: 3 warm springs 2x2 on surface soil near the river: kind Open with water 7, springs list for 05
  if wyrm_roost: carve 9x9 chamber in cavern 3 band at a random interior point; deepsilver vein adjacent; wyrm spawn list
  // 9. discovery, outdoor, lit
  for x,y: top = highest non-Open z; for z: outdoor = z >= top ... (outdoor is true for tiles at or above the surface: the surface Floor tile and open tiles above it)
  discovered = outdoor tiles and their 26 neighbors; lit = outdoor or within LIGHT_SPREAD horizontally of an outdoor open tile on the same level with no wall between
  // 10. connectivity: pathing.rebuildAll()
```

`rollStack(geology, st)`: for each template layer, thickness = `st.int(min, max)`; concatenate; append the basement (`granite` 6–10, `gneiss` 4–6) repeated until total ≥ D. `layerAt(stack, depth)`: walk the stack summing thicknesses; `depth` counts downward from the first rock layer (negative depth means soil, handled before).

Arrival (02) consumes the spawn lists recorded in steps 8 after the world's entities exist.

Performance: steps 3 and 4 are O(W·H·D) = 442k tile visits each; noise3 is evaluated per tile only within cavern bands (3 × 4 × 9,216 = 110k). Budget 1.5 s is met with lattice noise cached per octave.
