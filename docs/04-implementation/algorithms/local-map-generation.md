# Algorithm: Local Map Generation

**Owner:** `systems/terrain` · **Depends on:** [`../../02-systems/03-terrain-and-mining.md`](../../02-systems/03-terrain-and-mining.md), [`../../03-content/minerals-and-metals.md`](../../03-content/minerals-and-metals.md), [`../../03-content/regions-biomes-and-traits.md`](../../03-content/regions-biomes-and-traits.md)

```
generateLocal(spec: LocalMapSpec, map: Map3D, registry, progress): void
  W = LOCAL_MAP_W; H = LOCAL_MAP_H; D = LOCAL_MAP_Z; S = hash64(spec.seed)
  fill map.kind with Open, material 0, fluid 0, flags 0
  // 1. heightmap
  st = stream(S, 'terrain.height')
  base = SURFACE_Z_MIN + (spec.elevation - SEA_LEVEL) * (SURFACE_Z_MAX - SURFACE_Z_MIN) / (255 - SEA_LEVEL)
  amp = [0, 3, 5, 8][spec.relief]; ridges = [0, 1, 2, 3][spec.relief]; salt = st.u32(); ridgeSalt = st.u32()
  r = noise(ridgeSalt, x, y, [40], [1]); near = 1 - |2r - 1|; ridge = near > 0.8 ? round((near - 0.8) / 0.2 * ridges) : 0
  h[x][y] = clamp(SURFACE_Z_MIN, SURFACE_Z_MAX, base + roundTiesTowardZero(noise(salt, x, y, [32, 12], [amp*0.7, amp*0.3]) - amp/2) + ridge)
  h = median3x3(h)
  st = stream(S, 'terrain.relief'); rocky = set(); scree = set(); if relief == 0: skip outcrops and crags
  repeat round((biome.surface.outcrops + 3*(relief-1)) * W*H/9216): c = st point 3..W-4 x 3..H-4; r = st.int(1, 2 + (relief == 3)); rise = relief == 3 ? st.int(1,2) : 1
       disc d² <= r(r+1): h[q] = max(h[q], h[c] + rise); rocky.add(q)
  if biome.surface.crags > 0: repeat round((crags + 2*(relief-1)) * W*H/9216): c; r = st.int(2,4); peak = st.int(2,4) + relief - 1
       disc: h[q] = max(h[q], h[c] + max(1, round(peak * (1 - d/(r+1))))); rocky.add(q); ring r+1..r+2: scree.add
  // 2. rivers and lakes (carve before layers so beds get stone)
  riverTiles = set(); st = stream(S, 'terrain.rivers')
  // draw every path and the lake first; carve once all of them are known, since they share one water surface
  if spec.river: for each inflow edge: path = wander(st, midpoint(inflow), spec.river.outflowEdge ? midpoint(outflow) : lakeCenter(st))
       width = {brook:1, river:3, major:5}[class]; depth = {brook:1, river:2, major:2}[class]
       for each path tile p and its width-band tiles q: riverTiles.add(q); sourceEdge/sinkEdge marks kept
  if spec.lake or lake created: center = lakeCenter; radius = st.int(6,12); for tiles within radius (plain disc, no edge jitter): lakeTiles.add
  lakeCenter(st): uniform centre where radius 12 fits inside the map
  if spec.river and no inflow edge: spring = st point SPRING_EDGE_MARGIN from every edge, in the half away from the outflow edge (if any)
       path = wander(st, spring, outflow midpoint or lakeCenter); carved as above; the spring's band columns → SOURCE
  waterSurface = min of h over the dry tiles cardinally beside riverTiles and lakeTiles
  for q in riverTiles: h[q] = waterSurface - depth; for q in lakeTiles: h[q] = min(h[q], waterSurface - 2); waterTop[q] = waterSurface
  for each path, at i = floor(DRINK_STEP_SPACING/2), then every DRINK_STEP_SPACING: step(path[i], each way across the path); for a lake: step(center, each cardinal way)
  step(p, d): from p along d to the first dry tile, then k = 0, 1, ...: rise = waterSurface + k; stop at the tile with h <= rise; off the map or at water: no step
       h[lane k] = min(rise, h[end] + end - k); from relief 1 lane tiles and the end grow nothing and hold no boulder
  wander(st, from, to): walk with steps toward `to` 70% / perpendicular 30%, never leaving the map, until reaching `to`
  // 3. columns: soil, rock layers, magma sea
  st = stream(S, 'terrain.layers')
  stack = rollStack(spec.geology, st)                      // [{material, thickness}], repeats until it covers D
  soilDepth = (spec.biome.soilDepth), 0 on rocky columns ; if 'glasslands' in traits: soilMaterial = obsidian; soilDepth = spec.biome.soilDepth
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
    surface tile (x,y,top): if in riverTiles or lakeTiles: kind of bed tile = Floor of the stone below; fill z from the bed tile through waterTop-1 with water 7 (waterTop is the map's waterSurface); edge tiles of inflow and the spring's band → SOURCE; outflow → sink list
    else: kind(x,y,top) = Floor (the column's top solid becomes the walkable surface: i.e. set tile at z=top to Floor with its material; tiles above Open)
  progress('layers')
  // 4. caverns
  for tier in [1,2,3]: (zmin, zmax) = band(tier); frac = CAVERN_OPEN_FRACTION(spec.deepness) + traitAdjust
    st = stream(S, 'terrain.cavern'+tier)
    interior = band tiles outside the two-tile map rim, in tile order
    values = noise3(st, x, y, z, [14, 6], [70, 30]) for each interior tile
    open the floor(interior.length * frac) lowest-noise tiles, ties by position; kind=Open, material=0
    for x,y: for z in band ascending: if kind(z)==Open and kind(z-1)==Wall: kind(z-1) = Floor; if st.chance(600): material(z-1) = cave_loam (else the stone) ; flags |= Grass if cave_loam
    lakes: select the lowest-noise 18% of floor tiles, ties by position, count rounded down
      fill from the floor through lowestOpenZ+1, bounded by the band ceiling and fluid-passable kinds
    magma pools (tier >= 2): for each dry floor tile: if st.chance(2): circle radius st.int(2,4) of magma level 7 (no source) at floor level (tile becomes Open with magma; floor below stays)
    if 'deep_well' and tier == 1: lake fraction 60% instead of 18%
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
    for z in 0..h[c]: tiles within r of c: kind=Open, fluid = 7|MAGMA|SOURCE; ring r+1..r+2: Wall obsidian below each column’s surface, Floor obsidian at its surface; surface within 6: soil replaced by obsidian, no vegetation
  // 7. slopes, boulders, vegetation, snow
  for dry surface Floor (x,y,z) with Open above: if a cardinal neighbour has Wall at z and a dry Floor at z+1: kind = Ramp
  st = stream(S, 'terrain.boulders'); if relief == 0: no boulders
  for dry surface Floor not bare: p = rocky ? 3*biome.surface.boulders : biome.surface.boulders; if scree: p = max(p, 250‰)
    if st.fixed() < p: kind = Boulder, material = first non-soil material down the column
  st = stream(S, 'terrain.plants')
  for surface floor tiles with soil material (not river/lake, not within 2 of river unless willow):
    if st.fixed() < biome.treeDensity: kind=Tree, material = pick(tree species by biome weight)
    else if st.fixed() < biome.shrubDensity: kind=Shrub, material = pick(shrub species)
    else flags |= Grass
  cavern floors (cave_loam): fungus trees with density 0.12 by cavern weights; cavern shrubs 0.08
  rare patches: rare = stream(S, 'terrain.rare_patches'); each cavern floor shrub, by tier in floor order: for each rare species, if rare.chance(its rarePermille[tier]): material = that species, next shrub
  if biome.surface.snow > 0: salt = stream(S, 'terrain.snow').u32()
    for dry surface Floor or Ramp: if noise(salt, x, y, [14, 5], [0.7, 0.3]) + 0.1 * max(0, z - base) >= 1 - snow: flags |= Snow
  // 8. traits
  if old_battlefield: scatter BATTLEFIELD_ITEM_COUNT items on surface tiles in band 15..40 from arrival edge (spawned after entities exist: recorded as a spawn list applied by 02 arrival)
  if sunken_halls: site = highest dry floor in far half where the hall fits, ties by inward distance descending then column order; carve the layout in 03; record furniture and vault spawn list
  if gemsprings: 3 warm springs 2x2 on dry surface soil nearest a stream-selected river tile (map centre without river), one tile apart: kind Open with water 7, springs list for 05
  if wyrm_roost: carve 9x9 floor at the bottom of cavern 3 with two levels of headroom at a random interior point; vein starts in the east wall if the deepsilver magma-distance rule holds; sleeping wyrm spawn list
  if old_battlefield: ch = stream(S, 'terrain.battlefield_channel'); if ch.chance(BATTLEFIELD_CHANNEL_PERMILLE): type = ch.pick(weapons rows with a launcher and no ammo); tile = ch.pick(band, after the traits above)
    metal row: iron, quality 0, no stone; wooden row: material = ch.pick(materials of class wood), stone = ch.pick(spells' stones), quality 0; recorded in the spawn list
  // 9. discovery, outdoor, lit
  for x,y: top = highest non-Open z; for z: outdoor = z >= top ... (outdoor is true for tiles at or above the surface: the surface Floor tile and open tiles above it)
  discovered = outdoor tiles and their 26 neighbors; lit = outdoor or within LIGHT_SPREAD horizontally of an outdoor open tile on the same level with no wall between
  // 10. connectivity: pathing.rebuildAll()
```

`rollStack(geology, st)`: for each template layer, thickness = `st.int(min, max)`; concatenate; append the basement (`granite` 6–10, `gneiss` 4–6) repeated until total ≥ D. `layerAt(stack, depth)`: walk the stack summing thicknesses; `depth` counts downward from the first rock layer (negative depth means soil, handled before).

Arrival (02) consumes the spawn lists recorded in steps 8 after the world's entities exist.

Performance: steps 3 and 4 are O(W·H·D) = 442k tile visits each; noise3 is evaluated per tile only within cavern bands (3 × 4 × 9,216 = 110k). Budget 1.5 s is met with lattice noise cached per octave.
