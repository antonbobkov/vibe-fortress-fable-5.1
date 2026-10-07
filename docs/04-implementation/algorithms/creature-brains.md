# Algorithm: Creature Brains (Dwarves, Animals, Hostiles, Caravans)

**Owner:** `systems/dwarves`, `systems/animals`, `systems/threats`, `systems/trade` · **Depends on:** [`../../02-systems/10-dwarves.md`](../../02-systems/10-dwarves.md), [`../../02-systems/08-animals-and-domestication.md`](../../02-systems/08-animals-and-domestication.md), [`../../02-systems/18-threats-monsters-and-raids.md`](../../02-systems/18-threats-monsters-and-raids.md)

## Dwarf brain (every tick per dwarf)

```
tickDwarf(id):
  if not health.isConscious(id): return
  b = Brain[id]
  if b.behavior == 'need' or 'social' or 'idle': runActivity(id) ; if activity finished: b.behavior = 'none'
  else if b.behavior == 'work': jobs.stepWorker(id) ; if Worker.jobId == 0: b.behavior = 'none'
  else if b.behavior == 'duty': (16 drives movement; nothing here)
  else if b.behavior in {'flee','retreat','patient'}: runMovementBehavior(id)
  if b.behavior == 'none' or interruptFlag[id]: select(id)
select(id):
  N = Needs[id]; civ = not combat.onDuty(id)
  if threatened[id] and civ:                                    b.behavior = 'flee'; goal = fleeTile(id); return
  if alert == 'hearth' and civ:                                 b.behavior = 'retreat'; goal = defense.retreatTile(id); return
  if health.isPatient(id):                                      b.behavior = 'patient'; goal = bedTile(id) or stay; return
  crit = highest need over its critical threshold
  if crit:                                                      startNeed(id, crit); return                       // interrupts jobs
  if combat.onDuty(id):                                         b.behavior = 'duty'; return
  want = highest need over its want threshold
  if want and not (jobs.hasUrgent(id, NEED_DEFER_PRIORITY)):    startNeed(id, want); return
  if jobs.assign(id) == 'assigned':                             b.behavior = 'work'; return
  if want in {social, comfort, joy}:                            startNeed(id, want); return
  b.behavior = 'idle'; goal = hearthHallTile(id) or wagonTile; activityEnd = tick + IDLE_TICKS; emit DwarfIdle (throttled)
startNeed(id, need):
  switch need:
    hunger:  it = items.findItem({edible: true}, pos, 'walker', {reservable: true}) preferring category food/meal; if none: emit Starving? (only at 100); b.behavior='idle'; return
             reserve it; plan: walk to it, pick up, walk to nearest dining seat within DINING_SEARCH_RADIUS (else eat in place), EAT_TICKS, consume 1, N.hunger -= (meal ? 100 : 70), emit MealEaten
    thirst:  barrel = findItem({drinkable:true}) else well = nearest working well else water = nearest adjacent-walkable water tile (level ≥ 1, not magma)
             plan: walk adjacent, DRINK_TICKS, consume 1 unit (barrel) ; N.thirst -= 100/80; emit DrankAlcohol/DrankWater{outdoors}
    rest:    bed = ownBed or freeUnassignedBed or hearthHallFloor or here; plan: walk, sleep until N.rest <= 0 or SLEEP_HOURS elapsed (−15/hour); emit Slept
    social:  plan: walk to hearth hall / meeting area; wait up to 200 ticks for another dwarf within 2; if found: both TALK_TICKS, N.social -= 40 (60 friends), relationships.talk++; emit Talked
    comfort: chair = best-tier free chair reachable; plan: walk, sit SIT_TICKS, N.comfort -= 40 (hearth hall floor: 20); emit Sat
    purpose: (no activity: relieved by work) → treat as idle
    joy:     plan: walk to hearth hall, stay 100 ticks; N.joy -= 30; emit HearthVisited
  b.behavior = 'need'
```

Hourly (on `HourPassed`): `N.hunger += 3*endFactor; N.thirst += 5*endFactor*thirstMod; N.rest += (asleep ? -15 : 5*endFactor); N.social += 2; N.comfort += 3; N.purpose += (working ? -10 : 2); N.joy += 1.5` (all clamped 0..100, `endFactor = (150 − Endurance)/100`); crossing a threshold sets `interruptFlag`. Sleep schedule: at `sleepStartHour` with `N.rest > 20` set `interruptFlag` and prefer `rest`.

Movement side effects on entering a tile: mist → `DwarfFeltMist` (cooldown), warm spring adjacency → `DwarfNearSpring`, outdoors in bad weather → `DwarfOutdoorsIn` (hourly), miasma → 15 standing check, undiscovered neighbors → 03 discovery, a fine-or-better statue or a masterwork item in view (same room) → `admired_statue` / `SawMasterwork` (per-object memory sets).

Children: `select` skips `duty` and `work` except `haul_to_stockpile` jobs (labors fixed to hauling).

## Animal brain

```
tickAnimal(id): W = Wild[id] or T = Tame[id]
  if tick < lastThink + thinkInterval(id): moveAlongPath(id); return
  lastThink = tick
  threats = perceivedThreats(id)   // per temperament rules in 08
  if T: if T.slaughter or T.assignedTo: (jobs / follow logic) ...
        if trained war and hostile within WAR_ANIMAL_RADIUS of station/owner: combat.setTarget(id, hostile); return
        if T.petOf and dist(owner) > 5: walkTo(near owner); return
        if grazer: if T.condition > 40 and grass tile within pasture (or within 6 if no pasture): walkTo(grass); on arrival: eatGrass (GrassGrazed, condition -= 25); return
        wander within pasture or near hearth; return
  switch W.state:
    idle:   if threats: W.state = timid/neutral-attacked ? 'flee' : 'idle'
            else if aggressive carnivore and W.hungry and prey in perception: W.state='hunt'; target=prey
            else if territorial and dwarf within TERRITORY_RADIUS: W.state='attack'; combat.setTarget
            else if restTime(species): W.state='sleep'; W.stateUntil = tick + 600
            else if grazer and grass within 6: W.state='graze' else W.state='wander'
    graze:  walk to grass; on arrival GrassGrazed; wait GRAZE_TICKS; state='idle'
    wander: walk to random tile within WANDER_RADIUS of homeChunk; on arrival or timeout: 'idle'
    flee:   goal = argmax over tiles within perception of Σ dist to threats (sampled 8 directions × 6 steps); if edge within perception: 'leave'; after FLEE_TICKS with no threat: 'idle'
    hunt:   combat.setTarget(id, prey); if prey dead: eat corpse EAT_CORPSE_TICKS (consume); W.hungry=false; 'idle'
    attack: (16 drives); if target gone: 'idle'; if blood < fleeBlood and not aggressive: 'flee'
    sleep:  stay; if threat: 'flee'/'attack'; at stateUntil: 'idle'
    leave:  walk to nearest edge tile; on arrival: despawn (AnimalLeft)
  moveAlongPath(id)
```

Daily: spawning per 08 (edge tiles at `SPAWN_MIN_DISTANCE` from dwarves), breeding rolls, product timers, condition and starvation, lifetime and cap checks (`leave`).

## Hostile party AI (party every 50 ticks; members every tick)

```
partyThink(P):
  alive = P.members.filter(alive and conscious); if alive.length == 0: P.state = 'gone'; emit RaidEnded{wiped}; return
  if P.state != 'retreat' and (P.members.length - alive.length) * 100 / P.members.length >= RETREAT_LOSS_PERCENT: P.state='retreat'; outcome = P.loot.length ? 'looted' : 'repelled'
  switch P.state:
    approach: goal = chooseGoal(P); if goal unreachable: P.goalTile = pathing.nearestReachable(leaderPos, hearthTile, cls, 3000); P.state = 'loiter'? (only after reaching the nearest tile)
              if any member perceives a fortress creature: P.state = 'engage'; P.stateSince = tick
    engage:   if no member has a target for ENGAGE_IDLE_TICKS: P.state = 'approach'
    loiter:   if tick - P.stateSince > LOITER_DAYS(P.purpose) * TICKS_PER_DAY: P.state = 'retreat'; outcome = P.loot.length ? 'looted' : 'withdrew'
    retreat:  if all members despawned or dead: P.state='gone'; emit RaidEnded{outcome}
chooseGoal(P): thief → most valuable reachable unattended item / small tame animal (outdoors preferred); bandits → nearest stockpile tile; ambush → nearest outdoor dwarf; raid/siege → hearth tile (or wagon, or nearest fortress building)
memberThink(m): P = party(m); H = Hostile[m]
  if H.stealthed and spotted(m): H.stealthed = false; H.spotted = true; emit ThiefSpotted/AmbushSprung
  if P.state == 'retreat': walkTo(edgeTile(P.edge)); if at edge: despawn (loot goes with them: ThiefEscaped per item); return
  if blood(m) < fleeBlood(species) and P.purpose != 'restless' and faction != 'deep': flee to edge; emit HostileFled; return
  target = nearest fortress creature within perception (archers prefer soldiers; reachability by m's own movement class); if target: combat.setTarget(m, target); return
  if combat.targetOf(m) != 0: return        // a held target survives losing sight of it; 16 drops it
  if P.state in {engage, loiter}: if breaksDoors(m) and adjacent locked door on the way to the goal: emit DoorBreakAttempt each tick (14 counts DOOR_BREAK_TICKS); return
                                  if item within LOOT_RADIUS unattended and m carries nothing: pick up (P.loot.push); return
  if m == P.leaderId: walkTo(P.goalTile, 'combat') else: if dist(m, leader) > FOLLOW_RADIUS: walkTo(leader's tile, sharing leader's path)
spotted(m): any fortress creature within SPOT_RADIUS (dogs SPOT_RADIUS_DOG) with lineOfSight, or a trap trigger
```

Each threat step builds one ascending-id snapshot of the living, conscious fortress creatures (position, soldier status, spotting radius) and shares it across the member decisions; the party cadence step builds its own, and a direct target or spotting query builds a fresh one. Each hostile's own distance, line-of-sight and tie rules are unchanged by the sharing.

Thief specifics: on reaching the goal item: pick up (`P.loot`), `P.state = 'retreat'`; if spotted before pickup: retreat empty. Restless dead: `approach` target = nearest fortress creature; never retreat; at dawn (`HourPassed` hour == sunrise) all `restless_dead` collapse: `CreatureDied { cause: dawn }` with no corpse (a `bone_pile` item instead).

Cavern monsters: `Wild`-like idle/wander within the cavern band; aggressive ones every think check `spatial.nearest(fortress creature within CAVE_SEEK_RADIUS)` and set targets; return after `CAVE_RETURN_TICKS` without a target. Hollow-born: target = nearest fortress creature on the map (global search every 50 ticks through the spatial index rings).

## Caravan AI (party every 50 ticks; members every tick)

`arrive → toDepot (leader path to depot's south entrance tile; members follow) → unload (goods from pack animals into the depot container) → wait (CARAVAN_STAY_DAYS) → pack → leave (walk to edge, despawn)`. On `AttackResolved` against any member: guards set targets on the attacker's faction; merchants and animals `flee` to the edge; if a merchant dies: `pack` immediately with whatever goods are in pack animals still alive; goods in the depot stay (`CaravanLost`).
