# Algorithm: Temperature, Fire, Weather, Plants

**Owner:** `systems/materials`, `systems/weather`, `systems/plants` · **Depends on:** [`../../02-systems/05-materials-and-temperature.md`](../../02-systems/05-materials-and-temperature.md), [`../../02-systems/06-weather-and-seasons.md`](../../02-systems/06-weather-and-seasons.md), [`../../02-systems/07-plants-and-farming.md`](../../02-systems/07-plants-and-farming.md)

## Temperature

```
temperatureAt(i):
  if forced[i] exists: return forced[i]
  surface = weather.surfaceTempC() if 06 exists, else UNDERGROUND_BASE_C
  (x,y,z) = unpack(i); f = flags[i]
  if f & (Outdoor|Lit): base = surface
  else: depth = terrain.surfaceZ(x,y) - z
        if depth <= NEAR_SURFACE_DEPTH: base = surface + trunc((UNDERGROUND_BASE_C - surface) * depth / NEAR_SURFACE_DEPTH)
        else: base = UNDERGROUND_BASE_C + max(0, DEEP_HEAT_START_Z - z) * DEEP_HEAT_PER_Z
  return base + tempOverride[i] * 5
recomputeOverrides(chunk c):
  for i in tiles(c): tempOverride[i] = 0
  for src in sourcesTouching(c):   // magma tiles in c and its 8 neighbors and the chunk below/above; burning tiles; springs; snow tiles in c
    for i in tiles(c) within Chebyshev 2 (same z or z+1) of src: add contribution (magma at distances 0/1/2: MAGMA_OVERRIDE, /2, /4; fire at 0/1 only: FIRE_OVERRIDE, /2; springs and snow only on their own tile)
  clamp each to [-24, 24]   // ×5 °C = ±120
```

At the first materials tick, compute magma and warm spring source reach and save `started`. A `FluidsChanged` chunk queues override work only when its magma index signature changes: itself, eight same-level neighbours and the nine above. Water alone does not queue work. Fire changes queue their reach; `SnowCoverChanged` queues named chunks. Process `pendingChunks` at the next materials tick. `forceTemperature(i, c)` sets a saved override that bypasses the model; `null` releases it.

## Fire (materials tick, every 10 ticks)

```
for T in pendingIgnite (ascending T): if burnableTile(T) and no water: ignite(T), ignoring Wet/Snow; clear pendingIgnite
for (T, s) in burning (ascending T):
  if not burnableTile(T): extinguish(T, ash=false); continue
  s.remainingTicks -= 10
  if weather in {rain, storm} and outdoor(T) and rng.chance(RAIN_EXTINGUISH_PERMILLE*10): extinguish(T, ash=false); continue
  if level(fluid[T]) >= 1 and water: extinguish(T, ash=false); continue
  if s.spreadCooldown > 0: s.spreadCooldown -= 10
  else: for N in 4 cardinal + above: if burnableTile(N) and not burning(N) and not (flags[N] & (Wet|Snow)): if rng.chance(weatherRain ? FIRE_SPREAD_WET_PERMILLE : FIRE_SPREAD_PERMILLE): ignite(N)
        s.spreadCooldown = FIRE_SPREAD_COOLDOWN
  for it in items.at(T): if burnable(material(it)): burnTimer[it] -= 10; if <= 0: items.destroy(it, 'burned')
  for c in creatures at T: emit BurnDamage{c, BURN_TICK_DAMAGE}
  if s.remainingTicks <= 0: burnOut(T)
ignite(T): burning.set(T, {remainingTicks: material burnTicks if positive else PLANT_BURN_TICKS, spreadCooldown: 0}); terrain.setFlag(T, Burning, true); emit FireStarted; recomputeOverrides
burnOut(T): k = kind[T]
  if k in {Tree, Sapling, Shrub}: terrain.setKind(T, Floor, materialBelowOrSoil); terrain.setFlag(T, Grass, false); terrain.setFlag(T, Ash, true)
  else if k == Floor and flags & Grass: clear Grass, set Ash
  else if constructed wooden tile: terrain.setKind(T, Open or Floor per remove rule, 0)   // 14 removes the building entity on TilesChanged
  extinguish(T, ash=true)
burnableTile(T): constructed wood anywhere, or outdoor natural tree/sapling/shrub/grass/peat; items do not make a tile burnable
```

`BURN_TICK_DAMAGE` = 6 per materials tick. Ignition sources: changed magma chunks queue burnable cardinal neighbours and the tile above each magma tile; `LightningStrike` queues its tile; spread occurs in the tick. All burning-flag changes occur during the materials tick and dirty connectivity. Emit FireStarted per queued-source ignition, and batch FireSpread/FireOut once per tick. Save pendingIgnite and itemBurn timers.

## Weather tick (hourly)

```
onHour():
  if tick >= stateEndsTick: transition()
  surfaceTempCached = seasonBase() + dayCurve[hour] + tempDelta[state] + temperSpread()
  growthModifierCached = seasonGrowth[season] * stateGrowth[state] / 100 (stateGrowth: overcast 90, else 100)
  isDaylight = hour in daylight window for (season, temper)
  if state == 'rain' or 'storm': for c in outdoorChunks: wetChunks[c] = tick; flag Wet on outdoor tiles of c (batched); mud on outdoor soil floors with rain for 2+ hours
  if state == 'storm' and rng.chance(LIGHTNING_PER_HOUR_PERMILLE * (thunderhead?1.5:1)): T = weightedExposedTile(chunks ascending, tiles ascending within chunk; trees ×4, else creatures of sizeClass >= WADE_LARGE_SIZE ×2, else 1); emit LightningStrike{T}
  if state == 'snow': cover SNOW_CHUNKS_PER_HOUR random uncovered outdoor chunks (Snow flag on outdoor tiles); emit SnowCoverChanged
  else if surfaceTempCached > MELT_C: melt SNOW_CHUNKS_PER_HOUR covered chunks (clear Snow; mud on soil); emit SnowCoverChanged
  clear Wet on chunks with wetChunks[c] + WET_DURATION_HOURS*TICKS_PER_HOUR < tick
transition():
  row = transitions[season][state]; weights = copy; apply temper scaling (storm, fog, heatwave, cold_snap × (1 + temper*0.5); clear × (1 - temper*0.1)); trait rules; disallow heatwave/cold_snap per season and temper
  next = rng.weighted(weights); constraints: snow ↔ rain by SNOW_C using previous hour’s cached surface temperature
  from = state; state = next; stateEndsTick = tick + rng.int(minHours, maxHours) * TICKS_PER_HOUR; if from != to: emit WeatherChanged{from, to}
```

Outdoor iteration means exposed tiles (outdoor, non-open, no unfrozen liquid), excluding sky. Snow cover and melt choose chunk columns; stored sets and event arrays name the chunks with exposed tiles. Daylight uses `[sunrise, sunset)`. The seasonal lookups and `frostmarrow` constraints follow 06. A forced test state remains until released with `null`; the next weather tick then transitions.

## Plant growth (hourly)

```
for crop in crops (ascending id):
  d = def(crop.plant); T = crop.tile
  if surface and season not in d.seasons: if temperatureAt(T) < FROST_KILL_C: die(crop, 'frost'); continue    // dormant otherwise
  if (d.light=='sun' and not lit(T)) or (d.light=='dark' and lit(T)): continue
  if not (d.minC <= temperatureAt(T) <= d.maxC): continue
  g = BASE_GROWTH * (cave ? 100 : weather.growthModifier()) / 100
  crop.growth += g
  stageLen = d.stageDays * HOURS_PER_DAY * BASE_GROWTH
  while crop.growth >= stageLen and crop.stage < 3: crop.growth -= stageLen; crop.stage++
  if crop.stage == 3: keep accumulating, capped at stageLen; ready = crop.growth >= stageLen
  if weather=='heatwave' and surface and stage >= 1 and rng.chance(WILT_PERMILLE): crop.stage--
plots (hourly): for zone in plots: species = settings.crop_per_season[season]; if none: continue
  for t in zone.tiles: if cropAtTile.has(t) or job exists: continue
    if items.countAvailable({type: seed, materialId: species}) > 0: sink.create('plant:'+t, plant job) else announceNeedsSeeds(zone, species) once per season
harvest jobs: crops with the fourth stage complete (plants.cropReady) and (autoHarvest or designated) → sink.create('harvest:'+t)
daily: saplings (age ≥ saplingYears and no creature on tile → Tree, SaplingGrew; occupied mature saplings wait); regrowth tries; grass regrowth over bareSoil; shrub timers; ash expiry
```

Harvest yield: `count = rng.int(min, max) + floor(skill/5)`, capped at `max + 2`; `SEEDS_PER_HARVEST` seeds; secondary yield only if no registry recipe produces its item; a quality tier from the farmer's roll (12's table) stored on the produce for meal quality.
