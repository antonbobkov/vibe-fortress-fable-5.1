# Algorithm: Creature Brains (Dwarves, Animals, Hostiles, Caravans)

**Owner:** `systems/dwarves`, `systems/animals`, `systems/threats`, `systems/trade` · **Depends on:** [`../../02-systems/10-dwarves.md`](../../02-systems/10-dwarves.md), [`../../02-systems/08-animals-and-domestication.md`](../../02-systems/08-animals-and-domestication.md), [`../../02-systems/18-threats-monsters-and-raids.md`](../../02-systems/18-threats-monsters-and-raids.md)

## Dwarf brain (every tick per dwarf)

```
on PatientAdmitted / PatientDischarged: interruptFlag[id] = true
tickDwarf(id):
  if not health.isConscious(id): cancelActivity(id); return
  b = Brain[id]
  if b.behavior == 'idle' and jobs.hasWork(id): select(id) immediately, from the current position
  if b.behavior in {'need','social'} and health.isPatient(id) and (not combat.onDuty(id) or not hostileInSight(id) or not currentActivityServesCriticalNeed(id)):
     cancelActivity(id); stopWalking(id); select(id); return   // patient priority resumes as soon as the fight ends
  if b.behavior == 'need' or 'social' or 'idle': runActivity(id) ; if activity finished: b.behavior = 'none'
  else if b.behavior == 'work': if Worker.jobId: jobs.stepWorker(id)
                                  else if not jobs.isQueued(id): leisureOrIdle(id, jobs.hasWork(id))
  else if b.behavior == 'duty': if health.isPatient(id) and health.isConscious(id) and not hostileInSight(id): select(id)   // otherwise 16 drives movement
  else if b.behavior in {'flee','retreat','patient'}: runMovementBehavior(id) // patient goal follows only its current held bed; without one, stay here until 17 allocates one
  if b.behavior == 'none' or interruptFlag[id]: select(id)
select(id):
  N = Needs[id]; civ = not combat.onDuty(id); if b.targetTile < 0: b.targetTile = currentTile(id)
  memory = threatened[id]; if hostile dead or outside THREAT_RADIUS of memory.tile: clearThreat(id)
  avoid = civ and memory remains ? memory.tile : none
  if hostile currently within THREAT_RADIUS on this level and civ, unless already fleeing with a critical need:
    if memory.caught and combat.targetOf(memory.hostile) != id: memory.caught = false   // the attacker broke off or fled
    goal = memory.caught ? sealedTile(id) : fleeTile(id)  // bounded legal-edge BFS; reachable safer hall preferred even beyond visit limit, then nearest safer tile
                                                          // sealedTile: first tile reached through a tile the attacker cannot enter
    if goal >= 0: memory.caught = false; if activity == 'Fighting': clearCombatTarget(id)
                  stopWalking(id); b.behavior = 'flee'; return
    if no critical need and civilianFightDeadline not elapsed: startOrKeepCorneredFight(id); return
    clearCombatTarget(id); stopWalking(id); if deadline elapsed: clearThreat(id)
  if alert == 'hearth' and civ and not (health.isPatient(id) and health.isConscious(id)): target = defense.retreatTile(id); watchShelter(id, target < 0)
     if target >= 0:                                            // a critical need overrides the retreat; a want-level hunger, thirst or rest is served only from a target inside the shelter
       if crit = highest need over its critical threshold and startNeed(id, crit): return
       if want = highest of hunger, thirst, rest over its want threshold and startNeed(id, want, targets in shelterArea(target), rest only where a bed is free there): return
       if jobs.holdsPatientCare(id) or (able to work and not day off and jobs.hasUrgent(id, PRIORITY_MAX)):   // under the alert 11 offers a sheltering civilian patient-care jobs only
         jobs.assign(id) unless it holds the job; b.behavior = 'work'; return   // back to 'retreat' when the job ends; a retreating dwarf looks for such a job every tick
       b.behavior = 'retreat'; goal = target; return          // otherwise continue; flee has precedence
                                                                // shelterArea(target): the hearth hall when target is one of its tiles, else the non-outdoor tiles around target reached without passing a door
  if health.isPatient(id) and (civ or not hostileInSight(id)):  b.behavior = 'patient'; goal = bedTile(id) or stay; return   // a soldier on duty fights on while a hostile is in sight
  crit = highest need over its critical threshold
  if crit:                                                      startNeed(id, crit); return                       // interrupts jobs
  if combat.onDuty(id):
    if Worker[id].jobId: jobs.interrupt(id, keepProgress = true)       // a soldier on duty steps no job; it returns to the board
    want = highest need with an errand (not purpose) over its want threshold, or scheduled sleep
    active = squad.mode == 'active' or alert != 'calm'                 // an alert treats every squad as active
    dutyHolds = (health.isPatient(id) and hostileInSight(id)) or (want and ((alert != 'calm' and hasExplicitOrder(squad)) or (active and hostileInSight(id))))
                                                                    // hostileInSight scans perception last, only when nothing else decides;
                                                                    // a held combat target is not sight
    if dutyHolds:                                               b.behavior = 'duty'; return
    if want:                                                    startNeed(id, want, targets outside remembered danger); return
    b.behavior = 'duty'; return
  want = highest of hunger, thirst, rest over its want threshold
  if want and not (jobs.hasUrgent(id, NEED_DEFER_PRIORITY)):    startNeed(id, want, targets outside remembered danger); return
  if not want and not jobs.hasUrgent(id, NEED_DEFER_PRIORITY) and max(N.social, N.comfort, N.joy) >= LEISURE_MARK and tick >= hallRetryUntil[id]:
    seat = nearest free chair on a reachable hearth-hall tile, else nearest reachable hall tile; if seat: plan = sit there SIT_TICKS, hall = true; return
  if able to work: jobs.assign(id); b.behavior = 'work'; return   // queue; 11 skips targets inside remembered danger and answers later this tick
  leisureOrIdle(id, workOpen = false)                             // a day off, a wound, a child with no hauling
leisureOrIdle(id, workOpen):                                      // also from tickDwarf when 11 answered nothing, with workOpen = jobs.hasWork(id)
  if not workOpen:
    if talks[id] and tick < talks[id].until: plan = stay here until talks[id].until; b.behavior = 'need'; return
    leisure = highest of social, comfort, joy over its want threshold
    if leisure:                                                 startNeed(id, leisure, targets outside remembered danger); return
  b.behavior = 'idle'; goal = hearthHallTile(id) or saved wagonTile or currentTile(id); activityEnd = tick + IDLE_TICKS; emit DwarfIdle once per stretch without a job (clear after real work)
startNeed(id, need):
  switch need:
    hunger:  it = items.findItem({edible: true}, pos, 'walker', {reservable: true}) preferring category food/meal; if none: emit Starving? (only at 100); b.behavior='idle'; return
             reserve it; plan: walk to it, pick up, walk to nearest dining seat within DINING_SEARCH_RADIUS (else eat in place), EAT_TICKS, consume 1, N.hunger -= (meal ? 100 : 70), emit MealEaten
             at a table: relief = seat room tier ≥ decent ? 40 : seat in hearth hall ? 20 : 0; if relief: N.comfort -= relief; emit Sat
             hearthTime(id, EAT_TICKS)
    thirst:  barrel = find reservable drink directly in a stockpiled barrel, else nearest working well, else reachable water (level ≥ 1, not magma or frozen); if none: reachable loose alcohol
             water: horizontal radius 32, z−8..z+8; rank horizontal Chebyshev + |dz|*Z_DISTANCE_WEIGHT, ties by stand tile
             plan: walk adjacent, DRINK_TICKS, consume 1 unit (barrel) ; N.thirst -= 100/80; emit DrankAlcohol/DrankWater{outdoors}; hearthTime(id, DRINK_TICKS)
    rest:    bed = ownBed if not held by another dwarf, else live freeUnassignedBed, else hearthHallFloor or here; save its id in plan.itemId to hold it immediately; walk, sleep until N.rest <= 0 or SLEEP_HOURS elapsed (−15/hour); release hold and emit Slept
             if the bed disappears or another saved holder wins its hold: abandon the activity and reselect; waking, abandonment and death release the hold
    social:  plan: walk to hearth hall / meeting area; wait up to 200 ticks for another dwarf within 2; choose living awake partners on the same level within Chebyshev 2 (friends then id); if found: TALK_TICKS without interrupting the partner, N.social -= 40 (60 friends), relationships.talk++; emit Talked
    comfort: chair = best-tier free chair reachable; plan: walk, sit SIT_TICKS, N.comfort -= 40 (hearth hall floor: 20); emit Sat; hearthTime(id, SIT_TICKS)
             hall errand only: every TALK_CHECK_TICKS while seated, if no partner yet, N.social >= want and no talk in passing: partner = friend first, then lowest id, among dwarves within 2 on this level not asleep
                               at the end: if partner alive and no talk in passing: relieve both, relationships.talk++, emit Talked
                               then if no talk in passing and max(N.social, N.comfort, N.joy) >= LEISURE_MARK: hallRetryUntil[id] = tick + LEISURE_RETRY_TICKS
    purpose: (no activity: relieved by work) → treat as idle
    joy:     plan: walk to hearth hall, stay HEARTH_VISIT_TICKS; N.joy -= 30; emit HearthVisited
  b.behavior = 'need'
  when a hunger, thirst, comfort or joy plan finishes and talks[id] is still running: plan = stay here until talks[id].until
hearthTime(id, ticks):                                            // only on a hearth-hall tile
  hearthTicks[id] += ticks; if hearthTicks[id] >= HEARTH_VISIT_TICKS: delete hearthTicks[id]; N.joy -= 30; emit HearthVisited
passingTalks():                                                   // 10's tick, before the brains, when tick % TALK_CHECK_TICKS == 0
  canTalk(d) = alive and conscious and not asleep and no walk under way
  for each talk (a < b), ascending a:
    together = canTalk(a) and canTalk(b) and same level and Chebyshev distance <= 2
    if together and tick < until: continue
    delete the talk; if together: relieve both (40, friends 60), relationships.talk++, emit Talked
  for each dwarf d, ascending id, with N.social >= want, canTalk(d), not in a talk, not on a social errand:
    p = first friend, else first dwarf, among spatial.inRadius(tile(d), 2) ascending id on d's level with canTalk(p), not in a talk, not on a social errand
    if p: talks[d] = talks[p] = { partner, until: tick + TALK_TICKS }
```

Talks in passing, the hearth-hall tick counts and `hallRetryUntil` are saved with 10's state and omitted when empty. A dead dwarf's talk, count and retry tick are dropped.

Hourly (on `HourPassed`): apply the rates in 10's Needs table, clamping 0..100. `endFactor = (150 − Endurance)/100` scales only hunger and awake rest; weather alone scales thirst, and sleeping rest uses the unscaled relief rate. Crossing a threshold sets a saved `interruptFlag`; critical crossing emits `NeedCritical`. Sleep schedule: at `sleepStartHour` with `N.rest > 20` set `interruptFlag` and prefer `rest`.

Movement side effects on entering a tile: mist → `DwarfFeltMist` (cooldown), warm spring adjacency → `DwarfNearSpring`, outdoors in bad weather → `DwarfOutdoorsIn` (hourly), miasma → 15 standing check, undiscovered neighbors → 03 discovery, a fine-or-better statue or a masterwork item in view (same room) → `admired_statue` / `SawMasterwork` (per-object memory sets).

The movement handler writes `Brain` thought timers and `Needs` for masterwork joy relief, never tile grids. Mist uses zero as never and otherwise its cooldown; bad-weather thoughts use the saved hour index. Spring adjacency is an entry from outside its same-level 8-neighbourhood.

A food or drink plan validates that its item still exists, is reserved by its dwarf, and remains edible or drinkable before travelling or consuming. Cancellation on death, unconsciousness, flight, weeping, failed travel or rot drops any held meal and releases only that dwarf's reservation, emitting one `ItemReleased`. Cancel before a weeping controller replaces the brain and stop the obsolete walk. Repeated cancellation has no effect. On death, 13 releases any remaining reservation under the removed creature's id, including an older saved orphan with no current plan, without duplicating a release already performed by 10.

Need targets must be reachable; a failed walk blocks that need until `tick + NEED_RETRY_TICKS`, saved in `needRetryUntil`. Recheck only watched shut-out civilian ids when alerts, building state or the derived connectivity revision change. Save their ids. Patient rest without a bed, cornered fighting and duty target the current tile. Idle without an anchor follows the current position. While a soldier's brain behavior is `need` (or `flee`, `retreat`, `patient`), squad positioning and training do not command movement, set a target (a kill order's included) or pair partners; the squad's step skips such a member before its kill-order and perception steps.

On `AttackResolved` with outcome `hit` against a civilian whose behavior is `flee`, from an adjacent attacker on its level that is a wild animal hunting (`Wild.state == 'hunt'`, or `'attack'` with `Wild.defendFrom` unset) with `Motion.speed` at least the civilian's (any other attacker leaves the civilian fleeing): `threatened[id] = { hostile: attacker, tick, tile: attacker's tile, caught: true }` and set the interrupt flag. A `ThreatNearby` from another hostile leaves a caught record alone; one from the same hostile refreshes its tick and tile. A fighting civilian (cornered or caught) never paths toward its target (16).

A civilian fight uses `Brain.behaviorUntil` as its saved deadline. Refresh it on melee reach or a recorded attack opportunity, never merely on `ThreatNearby`. Reaching an escape goal ends the flee behavior without clearing a still-near living hostile's saved last seen tile. Critical need activities can enter that remembered danger and continue across threat scans even when an escape exists; a newly more critical need still cancels them for selection. Noncritical activity searches exclude unsafe resources, beds, water stands, meeting tiles and dining seats, trying safe alternatives. The escape search and combat timeout use 10's tuning constants and safety rules.

Children: `select` skips `duty` and `work` except `haul_to_stockpile` jobs (labors fixed to hauling).

## Animal brain

```
tickAnimal(id): W = Wild[id] or T = Tame[id]
  deadlineDue = W and (eating deadline or saved attack-grace deadline reached)
  if not deadlineDue and tick < lastThink + thinkInterval(id): moveAlongPath(id); return
  lastThink = tick
  threats = perceivedThreats(id)   // per temperament rules in 08
  if T: if T.slaughter or T.assignedTo: (jobs / follow logic) ...
        if trained war and hostile within WAR_ANIMAL_RADIUS of station/owner: combat.setTarget(id, hostile); return
        if T.petOf and dist(owner) > 5: walkTo(near owner); return
        if grazer: if T.condition > 40 and grass tile within pasture (or within 6 if no pasture) with the animal's region label (the grass it is already walking to while that tile still qualifies): walkTo(grass); on arrival: if the tile is unclaimed, claim it and eatGrass (GrassGrazed, condition -= 25); return. A claimed tile is skipped, when choosing grass and on arrival
        wander within pasture or near hearth; return
  if W.pendingMeal: moveAlongPath(id); return  // await the corpse notification
  if W.mealId and W.state in {idle, wander, hunt}: W.state = eat; W.stateUntil = 0
  switch W.state:
    idle:   if threats: W.state = timid/neutral-attacked ? 'flee' : 'idle'
            else if aggressive carnivore and W.hungry and quarry(id): W.state='hunt'; combat.setTarget(id, quarry(id))
            else if (territorial and dwarf within TERRITORY_RADIUS) or (aggressive and dwarf within APPROACH_RADIUS): W.state='attack'; W.defendFrom = tile; combat.setTarget
            else if restTime(species): W.state='sleep'; W.stateUntil = tick + 600
            else if grazer and grass within 6: W.state='graze' else W.state='wander'
    graze:  walk to grass; on arrival GrassGrazed; wait GRAZE_TICKS; state='idle'
    wander: walk to random tile within WANDER_RADIUS of homeChunk; on arrival or WANDER_TIMEOUT_TICKS: 'idle'
    flee:   goal = argmax over tiles within perception of Σ dist to threats (sampled 8 directions × 6 steps); if edge within perception: 'leave'; after FLEE_TICKS with no threat: 'idle'
    hunt:   if not W.hungry: 'idle'
            target = combat.targetOf(id) if alive else quarry(id); none or on another level: 'idle'
            if animal target no longer meets the pack size limit: clear target; 'idle'
            combat.setTarget(id, target); adjacent: 'attack' else walk to it
    attack: (16 drives); if blood < fleeBlood and not aggressive: 'flee'
            if target dead/gone or animal-quarry size no longer eligible: 'idle' (no new target here)
            if W.defendFrom and (dist(target, W.defendFrom) > provoke radius or other level or target unconscious): clear target; W.state = 'wander' (WANDER_TIMEOUT_TICKS)
            if target unseen (species range, same level, line of sight): save first unseen tick; at ATTACK_PERCEPTION_GRACE_TICKS unseen: 'idle'
            else clear unseen tick; 16 does not apply its generic perception cutoff to this wild attack
    eat:    walk to saved ground corpse; on arrival stateUntil = tick + EAT_CORPSE_TICKS; at deadline consume corpse through 13, clear meal and idle
            missing, carried-away or unreachable corpse: clear meal and idle, with no consumption
    on CreatureDied with killerId = a hungry predator: W.hungry = false for it and every member of its pack; for each newly fed member in hunt or attack without defendFrom, clear combat target and stopWalking
  quarry(id):   // pack = wild animals of the species with the same arrivedTick
    q = target of a hungry pack member in 'hunt' (or in an 'attack' without defendFrom), ascending member id
    if q: return q if within perception and visible and still eligible, else none
    members(q) = living members of this pack perceiving q (same level, range and line of sight), including id, capped at PREY_PACK_MAX_MEMBERS
    prey = animals (Wild or Tame) within perception and visible, not carnivore, size < own size × 0.8 × members(prey)
    return nearest prey (Chebyshev, then id), else nearest visible dwarf within perception, else none
    sleep:  stay; if threat: 'flee'/'attack'; at stateUntil: 'idle'
    leave:  walk to nearest edge tile; on arrival: despawn (AnimalLeft)
  moveAlongPath(id)
```

Tame animals use `WILD_THINK_TICKS` between ordinary thinks. Only grazers accumulate hourly condition or seek grass; the other diets forage abstractly.

At first breach, initialize nonzero fauna from content once per cavern tier, under species and global caps; save the completed tier. Zero initial populations consume no randomness.

Daily: spawning per 08 (edge tiles at `SPAWN_MIN_DISTANCE` from dwarves), breeding rolls, product timers, condition and starvation, lifetime and cap checks (`leave`).

A hungry wild killer saves the victim id while waiting for `CorpseCreated`; its pack is fed and hunting targets and paths are cleared at the kill as usual. The notification associates the killer with the corpse item. A genuine defending attack, flee or leave keeps precedence; a waiting meal resumes from idle/wander. Save the grace start, pending victim, meal item and eating deadline in `Wild`. The waiting-for-corpse boundary and the middle of eating survive save/load; an eating or attack-grace deadline is checked even when an ordinary think is not due.

## Hostile party AI (party every 50 ticks; members every tick)

```
partyThink(P):
  if P.state == 'retreat' and tick - P.stateSince >= RETREAT_GIVE_UP_DAYS * TICKS_PER_DAY: despawn every living member through the departure path; return
  alive = P.members.filter(alive and conscious); if alive.length == 0: living unconscious survivors retreat; only no living survivors ends the party; return
  if P.state != 'retreat' and (P.members.length - alive.length) * 100 / P.members.length >= RETREAT_LOSS_PERCENT: P.state='retreat'; outcome = P.loot.length ? 'looted' : 'repelled'
  switch P.state:
    approach: for a thief, chooseGoal each threats tick; if no quarry, wait hidden at arrival, then retreat with withdrew at THIEF_WAIT_DAYS after arrival; reaching an empty goal never counts as theft; return
              goal = chooseGoal(P); if goal unreachable: P.goalTile = pathing.nearestReachable(leaderPos, hearthTile, cls, 3000); P.state = 'loiter'? (only after reaching the nearest tile)
              if any revealed ambush member (or any member of another non-thief party) perceives a reachable fortress creature: clear goalIdleSince; P.state = 'engage'; P.stateSince = tick
              else if leader on or adjacent to goal (except thieves and restless dead): begin goalIdleSince if absent; after ENGAGE_IDLE_TICKS enter loiter
              else: clear goalIdleSince
    engage:   if no member has a target for ENGAGE_IDLE_TICKS: P.state = 'approach'
    loiter:   if tick - P.stateSince > LOITER_DAYS(P.purpose) * TICKS_PER_DAY: P.state = 'retreat'; outcome = P.loot.length ? 'looted' : 'withdrew'
    retreat:  if all members despawned or dead: P.state='gone'; emit RaidEnded{outcome}
chooseGoal(P): thief → most valuable reachable unattended item / small tame animal (outdoors preferred); bandits → nearest stockpile tile; ambush → nearest outdoor dwarf; raid/siege → hearth tile (or wagon, or nearest fortress building)
memberThink(m): P = party(m); H = Hostile[m]
  if H.stealthed and spotted(m): for an ambush, spring the whole party once; otherwise H.stealthed = false; H.spotted = true; emit ThiefSpotted for a thief
  if P.state == 'retreat': at RETREAT_GIVE_UP_DAYS despawn even an unconscious survivor
                           otherwise clear combat target on beginning retreat; save one selected exit and progress clock, retaining the exit through geometric tie changes
                           if distance improves: save bestDistance and progressSince
                           after RETREAT_STUCK_TICKS without improvement: choose nearest reachable passable tile on any edge by own movement class, distance, then tile index
                           if at any edge: despawn (loot goes with them: ThiefEscaped per item); otherwise walk to the selected exit; return
  if blood(m) < fleeBlood(species) and P.purpose != 'restless' and faction != 'deep': flee to edge; emit HostileFled; return
  target = nearest fortress creature within perception (archers prefer soldiers; reachability by m's own movement class); if target: combat.setTarget(m, target); return
  if combat.targetOf(m) != 0: return        // a held target survives losing sight of it; 16 drops it
  if P.state in {engage, loiter}: if breaksDoors(m) and adjacent locked door on the way to the goal: emit DoorBreakAttempt each tick (14 counts DOOR_BREAK_TICKS); return
                                  if item within LOOT_RADIUS unattended and m carries nothing: pick up (P.loot.push); return
  if m == P.leaderId: walkTo(P.goalTile, 'combat') else: if dist(m, leader) > FOLLOW_RADIUS: walkTo(leader's tile, sharing leader's path)
spotted(m): conscious dwarf within SPOT_RADIUS, or conscious war/hunting-trained animal of an eligible trainable species within SPOT_RADIUS_DOG, with lineOfSight, or a trap trigger
```

An unrelated `TilesChanged` does not restart loiter at a reachable empty goal; only a previously unreachable goal becoming reachable returns it to approach. Spotting an already retreating thief does not restart its deadline. The party idle clock and member retreat progress are saved with their components; absent fields begin tracking on the next decision without resetting the saved party retreat deadline.

Each threat step builds one ascending-id snapshot of the living, conscious fortress creatures (position, soldier status, spotting radius) and shares it across the member decisions; the party cadence step builds its own, and a direct target or spotting query builds a fresh one. Each hostile's own distance, line-of-sight and tie rules are unchanged by the sharing.

Only a departing item holder emits its ThiefEscaped; other members' held items stay. Unconscious survivors trigger retreat (except the restless dead, which never retreat), not a wiped ending. On a member escaping with loot, increment the party's saved escapedLootCount when emitting ThiefEscaped. At party end, any recorded loot escape makes the outcome looted even if remaining members die. Held loot that never left does not qualify; otherwise resolve wiped, repelled or withdrew from the actual ending and retreat reason. Missing escape counts in older saves mean zero.

Ambush arrival emits no `RaidArrived`; all members start stealthed, independent of species. Creature and trap spotting share one reveal: save `ambushSprung`, clear stealth and set spotted on every living member, enter engage, then emit one `AmbushSprung`. Trap triggering may clear the victim's stealth before its queued event is delivered; the party reveal guard uses `ambushSprung`, independent of that victim flag. Late spawns read the reveal flag and arrive already visible; a restored flag prevents another reveal announcement. Hidden ambush members cannot start an engagement by perception alone, including during loiter.

Thief specifics: on reaching the goal item: pick up (`P.loot`), `P.state = 'retreat'`; if spotted before pickup: retreat empty. Restless dead: `approach` target = nearest fortress creature; never retreat; at dawn (`HourPassed` hour == sunrise) all `restless_dead` collapse: `CreatureDied { cause: dawn }` with no corpse (a `bone_pile` item instead).

On `CavernBreached`, change each living sleeping monster of that cavern to `wander` and emit `MonsterSpawned { id, cavern }` once for it; leave already-awake monsters and other caverns unchanged.

Cavern monsters: `Wild`-like idle/wander within the cavern band; aggressive ones every think check `spatial.nearest(fortress creature within CAVE_SEEK_RADIUS)` and set targets; return after `CAVE_RETURN_TICKS` without a target. Hollow-born: target = nearest fortress creature on the map (global search every 50 ticks through the spatial index rings).

Animal loot saves its carrier in Party.animalCarriers and has neither Position nor a spatial entry while held; pickup stops its movement. Only its carrier reports its escape. CreatureDied restores the carrier's stolen animals at the recorded death tile through the movement/spatial API, then clears their party loot and carrier entries.

## Caravan AI (party every 50 ticks; members every tick)

`arrive → toDepot (leader path to depot's south entrance tile; members follow) → unload (goods from pack animals into the depot container) → wait (CARAVAN_STAY_DAYS) → pack → leave (walk to edge, despawn)`. On `AttackResolved` against any member: guards set targets on the attacker's faction; merchants and animals `flee` to the edge; if a merchant dies: `pack` immediately with whatever goods are in pack animals still alive; goods in the depot stay (`CaravanLost`).

A requested trade job belongs to the current depot stay: cancel it on packing, attack-driven departure or final departure. While it waits, compare its assigned and claimed worker with the living Broker whose trading labor is enabled; reissue for that Broker, or any trading worker if none is eligible, retaining priority. Title changes and deaths repair it at event dispatch; the job producer also checks labor changes before assignment. Repeated `TradeOpen` repairs the same request. A completion with an ineligible worker opens no session and requests a replacement in the job producer phase, after the old job has been removed.
