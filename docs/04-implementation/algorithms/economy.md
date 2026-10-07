# Algorithm: Workshops, Quality, Rooms, Trade Valuation, Immigration, Embark Party

**Owner:** `systems/workshops`, `systems/buildings`, `systems/trade`, `systems/immigration`, `systems/embark` · **Depends on:** [`../../02-systems/12-workshops-and-professions.md`](../../02-systems/12-workshops-and-professions.md), [`../../02-systems/14-buildings-and-rooms.md`](../../02-systems/14-buildings-and-rooms.md), [`../../02-systems/20-trade-and-caravans.md`](../../02-systems/20-trade-and-caravans.md), [`../../02-systems/21-immigration.md`](../../02-systems/21-immigration.md)

## Workshop operation (every tick per built workshop)

```
for ws in workshops (ascending id): W = Workshop[ws]
  if W.suspended or W.currentJobId: continue
  for (k, order) in W.orders (list order) then globalOrders matching this workshop type:
    if not runnable(order, ws): continue
    r = recipe(order.recipe)
    inputs = r.inputs.map(inp => ({ filter: toFilter(inp, order.materialFilter), count: inp.count }))
    if r.fuel and not W.magmaPowered: inputs.push({ filter: {category:'bar/coal' or 'bar/charcoal'}, count: 1 })
    if r.container: inputs.push({ filter: { emptyContainer: r.container }, count: 1 })
    jobId = sink.create('craft:'+ws+':'+k, { type: craft, target: ws, workTile: 'workshop', priority: order.priority, inputs, data: { orderKey: k, recipe: r.id } })
    W.currentJobId = jobId; break
  if no order started and W.orders non-empty and reason changed: emit WorkshopBlocked{ws, reason}
runnable(order, ws): (order.mode=='once' and order.remaining>0) or (order.mode=='maintain' and items.countAvailable(outputFilter(order)) < order.threshold)
   and every input has countAvailable >= count and (not r.fuel or W.magmaPowered or fuelAvailable) and (not r.container or emptyContainerAvailable) and (W.assignedWorker == 0 or alive)
onComplete(job):
  r = recipe(job.data.recipe); w = job.workerId
  for input (except container): items.consume(delivered, count)
  quality = r.quality ? rollQuality(skill(w, r.skill)) : 1
  for out in r.outputs: mat = resolveMaterial(out, delivered); n = out.count
     it = spawn.item(out.item, mat, r.container ? containerItem : outputTile(ws), n, quality); Item[it].crafterId = w
     emit ItemCrafted; if quality == 5: emit MasterworkCreated
  if order.mode == 'once': order.remaining--; if 0: remove order; emit WorkOrderCompleted
  W.currentJobId = 0
rollQuality(level): roll = level*5 + rng.int(0,40); return roll < 30 ? 0 : roll < 55 ? 1 : roll < 75 ? 2 : roll < 90 ? 3 : roll < 105 ? 4 : 5
resolveMaterial(out, delivered): from input i → material(delivered[i][0]); fixed → id; alloy → metal; plantDrink → def(plant of input 0).brew
```

Magma power check at job start: `fluids.levelAt(below(any footprint tile)) ≥ MAGMA_POWER_LEVEL and isMagma` else block `no_magma`.

Profession: `professionOf(d) = child ? 'Child' : (inSquadOnDuty ? militaryTitle(bestWeaponSkill) : civilianTitle(best civilian skill by (level desc, lastRaised desc)) or 'Settler')`.

## Room quality (14, on dirty rooms and daily)

```
scoreRoom(zone):
  tiles = zone.tiles; score = 0
  for t in tiles: f = flags[t]; m = material[t]
     score += (f & Constructed) ? constructedFloorValue(m) : (f & Engraved) ? 3 + engravingQuality(t) : (f & Smoothed) ? 3 : class(m)=='stone' ? 1 : 0
  border = tiles' 8-neighbors not in tiles (same z); enclosed = every border tile is Wall/Fortification or has a door/hatch building
  for b in border: if kind[b]==Wall: score += (flags[b]&Engraved) ? 2 + engravingQuality(b)/2 : (flags[b]&Smoothed) ? 2 : 0
  for bld in buildings within tiles: if bld.itemId and quality(item) > 0: score += value(item)/10; else if bld.type.roomValue is number: score += it
  score += min(tiles.length, ROOM_SIZE_CAP)
  if enclosed: score = score * ENCLOSED_PERCENT / 100
  tier = score < 20 ? 0 : < 60 ? 1 : < 150 ? 2 : < 400 ? 3 : < 1000 ? 4 : 5
  requirementsMet per zone type (bed; table+adjacent chair; hearth inside; bed+chest; coffin)
  if tier changed: emit RoomQualityChanged
constructedFloorValue(m) = value(m) (blocks: 1 for common stone, 2 granite, 3 marble; metal blocks value(bar)/5)
```

## Trade valuation and offer check (20)

```
valuation(civ, it) = value(it) * preference(civ, keyOf(it)) / 100          // keyOf: most specific matching row (material deepsilver > category > class > default)
price(civ, it) = valuation(civ, it) * MERCHANT_MARKUP / 100
margin(civ) = max(MARGIN_MIN, MARGIN_BASE - tradingSkill(trader) * MARGIN_PER_SKILL - reputation[civ] / MARGIN_REP_DIVISOR)
acceptOffer(give, take): G = Σ valuation(civ, it)*qty for give; T = Σ price(civ, it)*qty for take
  if take empty: gift: reputation += min(10 - giftedThisCaravan, G/100); transfer; emit GiftGiven; return
  if G >= T * (100 + margin)/100: transfer both ways; reputation += clamp(1, 5, (G+T)/2 / 500); xp(trader, 'trading', TRADE_XP * (1 + (G+T)/2000)); emit TradeCompleted
  else: emit TradeRefused{ shortfall: ceil(T*(100+margin)/100 - G) }
  wood penalty: for it in give with class wood (or wooden furniture) and civ == wildwood: reputation -= 2 (once per item per session)
goodsGeneration(civ): budget = CARAVAN_VALUE_BASE + renown*CARAVAN_VALUE_PER_RENOWN + rep*CARAVAN_VALUE_PER_REP
  reqBudget = budget * REQUEST_SHARE/100; for req in requests[civ] sorted by priority desc: if civ list contains req.item: spend up to reqBudget on it (count = min(entry max, floor(reqBudget/value)))
  remaining: loop: e = rng.weighted(entries with rare filter by reputation); n = rng.int(e.count); mat = rng.weighted(e.materials); v = value*n; if v > remaining*1.2: continue (max 20 skips then stop); spawn into pack animals; remaining -= v
```

## Immigration wave (21, on SeasonChanged)

```
evaluate():
  if population == 0: return
  if activeRaid: deferredUntil = tomorrow; return
  guaranteed = (year==1 and season==summer and not done[0]) or (year==1 and season==autumn and not done[1])
  if guaranteed: size = rng.int(GUARANTEED_SIZE_MIN, GUARANTEED_SIZE_MAX); mark done; arrive(size, true); return
  reasons = []
  if hallSpirit < IMMIGRATION_SPIRIT_MIN: reasons.push('spirit')
  if population >= cap: reasons.push('cap')
  if wealth < WEALTH_PER_WAVE * wavesSoFar: reasons.push('wealth')
  if season == winter and temper >= 2: reasons.push('winter')
  if reasons: emit ImmigrationSkipped{reasons[0]}; return
  if not rng.chance(IMMIGRATION_PERMILLE + rep.mountainhome * REP_PERMILLE_PER_POINT): emit ImmigrationSkipped{'luck'}; return
  size = IMMIGRANT_BASE + floor(wealth / WEALTH_PER_IMMIGRANT) + (spiritTier - 2) * SPIRIT_SIZE_STEP + floor(rep.mountainhome / REP_PER_IMMIGRANT)
  if season == winter: size = ceil(size/2)
  size = clamp(IMMIGRANT_BASE, min(WAVE_MAX, cap - population), size)
  arrive(size, false)
arrive(size, guaranteed):
  coverage = { prof: any adult with skill(profSkill) >= COVERAGE_SKILL } for key professions
  ids = []; while ids.length < size:
    if rng.chance(PEASANT_PERMILLE): d = makeDwarf(skills: none) else: prof = rng.weighted(profs, w = 1 + (covered ? 0 : UNCOVERED_WEIGHT)); d = makeDwarf(primary: prof.skill rng.int(PRIMARY_MIN, PRIMARY_MAX), secondary: prof.related rng.int(1,3))
    ids.push(d)
    if rng.chance(FAMILY_PERMILLE) and ids.length < size: spouse = makeDwarf(...); link spouse; ids.push(spouse); for k in rng.int(0, CHILDREN_MAX): if ids.length < size: ids.push(makeChild(parents)); if rng.chance(PET_PERMILLE): spawn pet (dog/cat) petOf(d)
  for (k, d) in ids: spawn at arrival edge walkable tile at tick + k * ARRIVAL_INTERVAL_TICKS (scheduled spawns); equip clothing; tool per profession if fortress stock < TOOL_STOCK_MIN
  wavesSoFar++; emit ImmigrantsArrived{ids, size, guaranteed}
makeDwarf(): name = names.unique(rng); sex = rng.int(0,1); age = rng.int(EMBARK_AGE_MIN, EMBARK_AGE_MAX) years; attributes each = ATTRIBUTE_BASELINE + Σ3 rng.int(-8,8); personality = one trait from each of 3 random pairs; needs 30; all labors on
```

`dwarfComponents(record, registry, world.rngFor('10'), title)` draws `sleepStartHour` uniformly in 20–23 and sets `sleepHours = SLEEP_HOURS` for both embark and immigration.

`makeDwarf` is shared with 02 (embark party), which additionally lets the player assign skill points.

## Embark budget check (02)

`total = Σ entry.price × count`; `budget = EMBARK_BUDGET_BASE + EMBARK_BUDGET_PER_PERIL × peril`; the Embark button is enabled when `total ≤ budget` and every dwarf has ≤ `EMBARK_SKILL_POINTS_PER_DWARF` points with no skill above `EMBARK_SKILL_MAX_PER_SKILL`.
