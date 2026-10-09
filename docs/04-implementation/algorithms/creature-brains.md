# Algorithm: Creature Brains (Dwarves, Animals, Hostiles, Caravans)

**Owner:** `systems/dwarves`, `systems/animals`, `systems/threats`, `systems/trade` · **Depends on:** [`../../02-systems/10-dwarves.md`](../../02-systems/10-dwarves.md), [`../../02-systems/08-animals-and-domestication.md`](../../02-systems/08-animals-and-domestication.md), [`../../02-systems/18-threats-monsters-and-raids.md`](../../02-systems/18-threats-monsters-and-raids.md)

## Dwarf brain (every tick per dwarf)

```
tickDwarf(id):
  if not health.isConscious(id): cancelActivity(id); return
  b = Brain[id]
  if b.behavior == 'idle' and jobs.hasWork(id): select(id) immediately, from the current position
  if b.behavior == 'need' or 'social' or 'idle': runActivity(id) ; if activity finished: b.behavior = 'none'
  else if b.behavior == 'work': if Worker.jobId: jobs.stepWorker(id)
                                  else if not jobs.isQueued(id): startIdle(id)
  else if b.behavior == 'duty': (16 drives movement; nothing here)
  else if b.behavior in {'flee','retreat','patient'}: runMovementBehavior(id)
  if b.behavior == 'none' or interruptFlag[id]: select(id)
select(id):
  N = Needs[id]; civ = not combat.onDuty(id); if b.targetTile < 0: b.targetTile = currentTile(id)
  memory = threatened[id]; if hostile dead or outside THREAT_RADIUS of memory.tile: clearThreat(id)
  avoid = civ and memory remains ? memory.tile : none
  if hostile currently within THREAT_RADIUS on this level and civ, unless already fleeing with a critical need:
    goal = fleeTile(id)  // bounded legal-edge BFS; reachable safer hall preferred even beyond visit limit, then nearest safer tile
    if goal >= 0: if activity == 'Fighting': clearCombatTarget(id)
                  stopWalking(id); b.behavior = 'flee'; return
    if no critical need and civilianFightDeadline not elapsed: startOrKeepCorneredFight(id); return
    clearCombatTarget(id); stopWalking(id); if deadline elapsed: clearThreat(id)
  if alert == 'hearth' and civ: target = defense.retreatTile(id); watchShelter(id, target < 0)
     if target >= 0: b.behavior = 'retreat'; goal = target; return  // otherwise continue; flee has precedence
  if health.isPatient(id):                                      b.behavior = 'patient'; goal = bedTile(id) or stay; return
  crit = highest need over its critical threshold
  if crit:                                                      startNeed(id, crit); return                       // interrupts jobs
  if combat.onDuty(id):                                         b.behavior = 'duty'; return
  want = highest need over its want threshold
  if want and not (jobs.hasUrgent(id, NEED_DEFER_PRIORITY)):    startNeed(id, want, targets outside remembered danger); return
  if able to work: jobs.assign(id); b.behavior = 'work'; return   // queue; 11 skips targets inside remembered danger and answers later this tick
  if want in {social, comfort, joy}:                            startNeed(id, want, targets outside remembered danger); return
  b.behavior = 'idle'; goal = hearthHallTile(id) or saved wagonTile or currentTile(id); activityEnd = tick + IDLE_TICKS; emit DwarfIdle once per stretch without a job (clear after real work)
startNeed(id, need):
  switch need:
    hunger:  it = items.findItem({edible: true}, pos, 'walker', {reservable: true}) preferring category food/meal; if none: emit Starving? (only at 100); b.behavior='idle'; return
             reserve it; plan: walk to it, pick up, walk to nearest dining seat within DINING_SEARCH_RADIUS (else eat in place), EAT_TICKS, consume 1, N.hunger -= (meal ? 100 : 70), emit MealEaten
    thirst:  barrel = find reservable drink directly in a stockpiled barrel, else nearest working well, else reachable water (level ≥ 1, not magma or frozen); if none: reachable loose alcohol
             water: horizontal radius 32, z−8..z+8; rank horizontal Chebyshev + |dz|*Z_DISTANCE_WEIGHT, ties by stand tile
             plan: walk adjacent, DRINK_TICKS, consume 1 unit (barrel) ; N.thirst -= 100/80; emit DrankAlcohol/DrankWater{outdoors}
    rest:    bed = ownBed or freeUnassignedBed or hearthHallFloor or here; plan: walk, sleep until N.rest <= 0 or SLEEP_HOURS elapsed (−15/hour); emit Slept
    social:  plan: walk to hearth hall / meeting area; wait up to 200 ticks for another dwarf within 2; choose living awake partners on the same level within Chebyshev 2 (friends then id); if found: TALK_TICKS without interrupting the partner, N.social -= 40 (60 friends), relationships.talk++; emit Talked
    comfort: chair = best-tier free chair reachable; plan: walk, sit SIT_TICKS, N.comfort -= 40 (hearth hall floor: 20); emit Sat
    purpose: (no activity: relieved by work) → treat as idle
    joy:     plan: walk to hearth hall, stay 100 ticks; N.joy -= 30; emit HearthVisited
  b.behavior = 'need'
```

Hourly (on `HourPassed`): apply the rates in 10's Needs table, clamping 0..100. `endFactor = (150 − Endurance)/100` scales only hunger and awake rest; weather alone scales thirst, and sleeping rest uses the unscaled relief rate. Crossing a threshold sets a saved `interruptFlag`; critical crossing emits `NeedCritical`. Sleep schedule: at `sleepStartHour` with `N.rest > 20` set `interruptFlag` and prefer `rest`.

Movement side effects on entering a tile: mist → `DwarfFeltMist` (cooldown), warm spring adjacency → `DwarfNearSpring`, outdoors in bad weather → `DwarfOutdoorsIn` (hourly), miasma → 15 standing check, undiscovered neighbors → 03 discovery, a fine-or-better statue or a masterwork item in view (same room) → `admired_statue` / `SawMasterwork` (per-object memory sets).

The movement handler writes `Brain` thought timers and `Needs` for masterwork joy relief, never tile grids. Mist uses zero as never and otherwise its cooldown; bad-weather thoughts use the saved hour index. Spring adjacency is an entry from outside its same-level 8-neighbourhood.

A food or drink plan validates that its item still exists, is reserved by its dwarf, and remains edible or drinkable before travelling or consuming. Cancellation on death, unconsciousness, flight, failed travel or rot drops any held meal and releases only that dwarf's reservation, emitting one `ItemReleased`. Repeated cancellation has no effect.

Need targets must be reachable; a failed walk blocks that need until `tick + NEED_RETRY_TICKS`, saved in `needRetryUntil`. Recheck only watched shut-out civilian ids when alerts, building state or the derived connectivity revision change. Save their ids. Patient rest without a bed, cornered fighting and duty target the current tile. Idle without an anchor follows the current position.

A civilian fight uses `Brain.behaviorUntil` as its saved deadline. Refresh it on melee reach or a recorded attack opportunity, never merely on `ThreatNearby`. Reaching an escape goal ends the flee behavior without clearing a still-near living hostile's saved last seen tile. Critical need activities can enter that remembered danger and continue across threat scans even when an escape exists; a newly more critical need still cancels them for selection. Noncritical activity searches exclude unsafe resources, beds, water stands, meeting tiles and dining seats, trying safe alternatives. The escape search and combat timeout use 10's tuning constants and safety rules.

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
            else if (territorial and dwarf within TERRITORY_RADIUS) or (aggressive and dwarf within APPROACH_RADIUS): W.state='attack'; combat.setTarget
            else if restTime(species): W.state='sleep'; W.stateUntil = tick + 600
            else if grazer and grass within 6: W.state='graze' else W.state='wander'
    graze:  walk to grass; on arrival GrassGrazed; wait GRAZE_TICKS; state='idle'
    wander: walk to random tile within WANDER_RADIUS of homeChunk; on arrival or WANDER_TIMEOUT_TICKS: 'idle'
    flee:   goal = argmax over tiles within perception of Σ dist to threats (sampled 8 directions × 6 steps); if edge within perception: 'leave'; after FLEE_TICKS with no threat: 'idle'
    hunt:   combat.setTarget(id, prey); if prey dead: eat corpse EAT_CORPSE_TICKS (consume); W.hungry=false; 'idle'
    attack: (16 drives); if target gone: 'idle'; if blood < fleeBlood and not aggressive: 'flee'
    sleep:  stay; if threat: 'flee'/'attack'; at stateUntil: 'idle'
    leave:  walk to nearest edge tile; on arrival: despawn (AnimalLeft)
  moveAlongPath(id)
```

Tame animals use `WILD_THINK_TICKS` between ordinary thinks. Only grazers accumulate hourly condition or seek grass; the other diets forage abstractly.

At first breach, initialize nonzero fauna from content once per cavern tier, under species and global caps; save the completed tier. Zero initial populations consume no randomness.

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

Only a departing item holder emits its ThiefEscaped; other members' held items stay. Unconscious survivors trigger retreat (except the restless dead, which never retreat), not a wiped ending. On a member escaping with loot, increment the party's saved escapedLootCount when emitting ThiefEscaped. At party end, any recorded loot escape makes the outcome looted even if remaining members die. Held loot that never left does not qualify; otherwise resolve wiped, repelled or withdrew from the actual ending and retreat reason. Missing escape counts in older saves mean zero.

Thief specifics: on reaching the goal item: pick up (`P.loot`), `P.state = 'retreat'`; if spotted before pickup: retreat empty. Restless dead: `approach` target = nearest fortress creature; never retreat; at dawn (`HourPassed` hour == sunrise) all `restless_dead` collapse: `CreatureDied { cause: dawn }` with no corpse (a `bone_pile` item instead).

Cavern monsters: `Wild`-like idle/wander within the cavern band; aggressive ones every think check `spatial.nearest(fortress creature within CAVE_SEEK_RADIUS)` and set targets; return after `CAVE_RETURN_TICKS` without a target. Hollow-born: target = nearest fortress creature on the map (global search every 50 ticks through the spatial index rings).

## Caravan AI (party every 50 ticks; members every tick)

`arrive → toDepot (leader path to depot's south entrance tile; members follow) → unload (goods from pack animals into the depot container) → wait (CARAVAN_STAY_DAYS) → pack → leave (walk to edge, despawn)`. On `AttackResolved` against any member: guards set targets on the attacker's faction; merchants and animals `flee` to the edge; if a merchant dies: `pack` immediately with whatever goods are in pack animals still alive; goods in the depot stay (`CaravanLost`).

A requested trade job belongs to the current depot stay: cancel it on packing, attack-driven departure or final departure. While it waits, compare its assigned and claimed worker with the living Broker whose trading labor is enabled; reissue for that Broker, or any trading worker if none is eligible, retaining priority. Title changes and deaths repair it at event dispatch; the job producer also checks labor changes before assignment. Repeated `TradeOpen` repairs the same request. A completion with an ineligible worker opens no session and requests a replacement in the job producer phase, after the old job has been removed.
