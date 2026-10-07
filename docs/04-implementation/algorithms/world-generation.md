# Algorithm: World Generation

**Owner:** `systems/worldgen` · **Depends on:** [`../../02-systems/01-world-generation.md`](../../02-systems/01-world-generation.md), [`../../03-content/regions-biomes-and-traits.md`](../../03-content/regions-biomes-and-traits.md)

All arithmetic is integer or `Fixed`. Noise is value noise on an integer lattice with fixed-point smoothstep interpolation; `noise(stream, x, y, periods, amps)` uses periods in cells and sums octaves with lattice values drawn from a hash of `(seed, octave, lx, ly)` so that the field is a pure function of the seed (the stream is used only for the per-stage salt).

```
generate(seed: string, size: number, progress: (stage, pct) => void): WorldMap
  S = hash64(seed)
  regions = new Array(size*size)
  // 1. elevation
  attempt = 0
  loop:
    st = stream(S, 'worldgen.elevation', attempt)
    for y in 0..size-1, x in 0..size-1:
      n = noise(st, x, y, [size/32, size/16, size/8, size/4], [128, 64, 32, 16])      // 0..240
      cx = x - size/2; cy = y - size/2
      mask = clamp01(1 - (cx*cx + cy*cy) / ((size*0.55)^2))                            // Fixed
      e = roundHalfUp(n * mask)
      regions[y*size+x].elevation = clamp(0, 255, e)
    lo = min(region elevations); hi = max(region elevations)
    for each r: r.elevation = hi == lo ? 0 : roundHalfUp((r.elevation - lo) * 255 / (hi - lo))
    land = count(e >= SEA_LEVEL); mountainCluster = exists 3x3 block with all e >= MOUNTAIN_ELEVATION
    if land >= MIN_LAND_FRACTION * size*size and mountainCluster: break
    attempt += 1; if attempt == 8: break
  progress('elevation', 100)
  // 2. climate
  st = stream(S, 'worldgen.climate')
  for each region r at (x,y):
    r.tempC = TEMP_SOUTH - (TEMP_SOUTH - TEMP_NORTH) * y / size - max(0, r.elevation - SEA_LEVEL) * TEMP_LAPSE_PER_ELEVATION / 100
    r.rain = noise(st, x, y, [size/16, size/8], [160, 95])                               // 0..255
  for y: shadow = 0
    for x in 0..size-1: r = region(x,y)
      if r.elevation >= MOUNTAIN_ELEVATION: shadow = RAIN_SHADOW_STRENGTH
      r.rain = clamp(0, 255, r.rain - shadow); shadow = max(0, shadow - RAIN_SHADOW_DECAY)
      if any 4-neighbor is ocean (elevation < SEA_LEVEL): r.rain = min(255, r.rain + COAST_RAIN_BONUS)
  // 3. biomes
  for each r: r.biome = lookup(tempBand(r.tempC), rainBand(r.rain), elevBand(r.elevation))
  // 4. rivers
  st = stream(S, 'worldgen.rivers')
  candidates = regions with elevation >= RIVER_SOURCE_ELEVATION and rain >= RIVER_SOURCE_RAIN, sorted by id
  sources = []; while sources.length < size/8 and candidates non-empty:
    c = st.pick(candidates); candidates = candidates.filter(d => chebyshev(c, d) >= 4); sources.push(c)
  for each source in id order: traceRiver(source)
  for each river record: record.class = class of its last region
  traceRiver(src):
    if src.river already exists: return
    path = [src]; cur = src; riverId = rivers.length
    loop:
      lower = 4-neighbors of cur with elevation < cur.elevation, sorted by (elevation asc, id asc)
      if lower empty: cur.lake = true; break
      next = lower[0]
      cur.river.outflow = edgeToward(cur, next); next.river.inflow.push(edgeToward(next, cur))
      path.push(next); cur = next
      if cur.elevation < SEA_LEVEL: break                   // reached the sea
      if cur.river.class already set (confluence): mark downstream of cur as major; break
    for i, r in path:
      pathClass = i < BROOK_LENGTH ? 'brook' : i < MAJOR_LENGTH ? 'river' : 'major'
      r.river.class = higher of existing class and pathClass
    rivers.push({ id: riverId, regions: path.map(id), class: placeholder until every river is traced })
  // 5. geology, volcano, deepness
  st = stream(S, 'worldgen.geology')
  for each r: g = noise(st, x, y, [size/12], [255])
    bias = r.elevation >= MOUNTAIN_ELEVATION ? +40 : r.elevation < HILLS_ELEVATION ? -40 : 0
    g = clamp(0,255, g + bias)
    r.geology = g < 102 ? 'sedimentary' : g < 166 ? 'igneous' : g < 217 ? 'metamorphic' : 'mixed'
    r.volcano = (r.biome in {mountain, alpine}) and st.chance(VOLCANO_CHANCE_PERMILLE)
    if r.volcano: r.geology = 'igneous'
    r.deepness = noise(stream(S,'worldgen.deepness'), x, y, [size/10], [255])
  // 6. civilizations
  // scores and id ties place civilizations without consuming rng draws
  homes = {}
  place('mountainhome', score = r => (r.biome in {mountain, alpine}) ? 100 + mountainClusterSize(r) : 0)
  place('gloam',        score = r => (r.biome in {badlands, taiga}) ? 50 + chebyshev(r, homes.mountainhome) : 0)
  paint dark_forest on land 8-neighbors of homes.gloam
  place('hillfolk',     score = r => (r.biome in {temperate_grassland, savanna}) and r.river ? 60 : 0)
  place('wildwood',     score = r => (r.biome in {temperate_forest, tropical_forest}) ? forestComponentSize(r) : 0)
  place(civ, score): best = argmax over land regions with chebyshev to every placed home >= CIV_MIN_SEPARATION (ties by id) of score; if none, relax separation by 2 and retry; homes[civ] = best
  for each civ:
    shortest paths over land from homes[civ], cost 1 (2 into mountain/alpine) -> civDistance
    unreachable regions have civDistance = size*size*2
    nearestEdgeTo = dominant axis toward home, horizontal ties; home itself faces n
  // 7. ratings
  st = stream(S, 'worldgen.ratings')
  for each r:
    wealthScore = geologyScore(r.geology) + (r.volcano?2:0) + r.deepness/64 + st.int(0,2)
    perilScore  = 4 - min(4, r.civDistance.gloam / PERIL_DISTANCE_STEP) + r.deepness/96 + (r.biome in {badlands, dark_forest, wetland} ? 1 : 0)
    temperScore = biomeTemper(r.biome) + (r.elevation >= MOUNTAIN_ELEVATION ? 1 : 0) + (r.rain > 200 ? 1 : 0) + st.int(0,1)
    r.wealth = bucket(wealthScore, [3,5,7,9]); r.peril = bucket(perilScore, [1,2,3,4]); r.temper = bucket(temperScore, [1,2,3,4])
  // 8. traits
  st = stream(S, 'worldgen.traits')
  for each region with an embarkable biome in id order:
    eligible = traits.filter(t => meets(t.requirements, r))
    for t in eligible (table order): if st.chance(t.freq): r.traits.push(t); if not t.companion: break; if r.traits.length == TRAIT_MAX_PER_REGION: break
    apply trait rating overrides (serene_vale: peril = 0; ironheart: wealth += 1; glasslands: temper += 1)
  // 9. names
  st = stream(S, 'worldgen.names'); for each r: r.name = regionName(st, r)
  return { size, seed, regions, civHomes: homes, rivers }
```

Helpers: `tempBand`: < −5 frozen, < 5 cold, < 18 temperate, < 26 warm, else hot. `rainBand`: < 60 arid, < 110 dry, < 170 moderate, else wet. `elevBand`: < SEA_LEVEL ocean, < HILLS_ELEVATION lowland, < MOUNTAIN_ELEVATION hills, else mountain. `bucket(v, thresholds)`: number of thresholds ≤ v. `geologyScore`: sedimentary 1, mixed 2, metamorphic 3, igneous 3. `biomeTemper`: glacier, tundra, desert, alpine 2; taiga, badlands, savanna, mountain 1; else 0.

Progress callbacks fire after each stage. Generation is synchronous; the screen draws the completed preview with the last stage at 100% after the call returns. Total work is O(size²) plus BFS per civ; under 200 ms at size 64.
