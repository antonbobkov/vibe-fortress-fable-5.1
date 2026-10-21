# Algorithm: Combat Resolution, Projectiles, Health

**Owner:** `systems/combat`, `systems/health` · **Depends on:** [`../../02-systems/16-combat.md`](../../02-systems/16-combat.md), [`../../02-systems/17-health-and-medicine.md`](../../02-systems/17-health-and-medicine.md), [`../../03-content/weapons-and-armor.md`](../../03-content/weapons-and-armor.md)

## Combat tick

```
tick(ctx):
  for id in creaturesWithTarget (ascending id):                       // Soldier.targetId or combat.targets map
    t = targetOf(id); if not alive(t) or not hostile(id, t): clearTarget(id); continue
    if not health.isConscious(id): continue
    if onDuty(id) and loadedLauncher(id) and legalKitingStep(id): walkTo(id, firstSafeAdjacentTile, 'combat'); continue
    if adjacent8SameZ(id, t): if cooldownUntil[id] <= tick: melee(id, t)
    else if ranged = launcherOf(id) and ammoOf(id) > 0 and dist(id,t) <= ranged.range and lineOfSight(id, t): if cooldownUntil[id] <= tick: shoot(id, t)
    else: approach(id, t)                                             // walkTo with urgency 'combat'; ranged keeps RANGED_KEEP_DISTANCE
  advanceProjectiles()
  threatScan(); squadDuties(); training()
```

A kiting step considers the nearest visible, conscious same-level melee threat within `RANGED_KITE_TRIGGER_DISTANCE`, ties by entity id, independent of the held target. Use legal horizontal path edges, finite cost and passability, at least `RANGED_KEEP_DISTANCE` from that threat and line of sight to it; ties by tile index. Without a qualifying tile, follow the ordinary attack/approach path.

## Melee

```
melee(a, d):
  w = Equipment[a].weapon; atk = w ? weaponDef(w) : naturalAttack(a) (rng.pick over species attacks)
  skillA = w ? skill(a, atk.skill) : speciesAttackSkill(a); dodge = skill(d, 'dodge')
  hit = 50 + (skillA - dodge)*3 + (agi(a) - agi(d))/4 + (unconsciousOrAsleep(d) ? 40 : 0) + (fleeing(d) ? 10 : 0) + (inDeepWater(d) ? 20 : 0)
  hit = clamp(5, 95, hit)
  cooldownUntil[a] = tick + max(MIN_ATTACK_COOLDOWN, atk.size*3 + 10 - agi(a)/10)
  if rng.int(0,99) >= hit: emit AttackResolved{miss}; xp(d,'dodge',2); xp(a, skill, 1); return
  if canAct(d):
    if wd = Equipment[d].weapon and weaponDef(wd).damageType != null: if rng.int(0,99) < min(30, skill(d, weaponDef(wd).skill)*2): emit AttackResolved{parried}; xp(d, wskill, 2); return
    if sh = Equipment[d].shield: bc = shieldDef(sh).buckler ? min(30, 5 + 2*skill(d,'shield')) : min(40, 10 + 2*skill(d,'shield')); if rng.int(0,99) < bc: emit AttackResolved{blocked}; xp(d,'shield',2); return
  part = weightedPick(plan(d).parts.hit, headDoubledIf(unconscious(d)))
  raw = w ? atk.damage * metal(w).weaponMult * qualityMult(w) * (50 + str(a)) / 100 : atk.damage * (50 + str(a)) / 100 * (warTrained(a) ? 1.5 : 1)
  if atk.type == 'blunt' and metal(w).bluntBonus: raw *= (100 + bluntBonus)/100
  red = 0
  for piece in armorCovering(d, part) (outer first): red += pieceDef.armor * armorMult(pieceMat) * coverage/100 * qualityArmorMult(piece) * dmgVsLayer[atk.type][pieceDef.layer]
  red += naturalArmor(d) * dmgVsLayer[atk.type]['plate']
  dmg = max(0, raw - red)
  if atk.type == 'blunt' and red > 0: dmg = max(dmg, raw * BLUNT_THROUGH_PERCENT / 100)
  dmg = round(dmg * (100 - min(10, tou(d)/10)) / 100)
  emit DamageDealt{d, part, atk.type, dmg, a, w}; emit AttackResolved{hit, part, dmg}
  xp(a, skill, 3); if red > 0: xp(d, 'armor_use', 1)
armorCovering(d, part): pieces = [Equipment.armor[slot] for slots] + clothing; keep those whose def.covers includes part; order by layer plate > mail > leather > padding
```

## Ranged

```
shoot(s, t):
  L = launcherDef(Equipment[s].weapon); ammoItem = quiverTake(s, L.ammo) (split 1 from the stack)
  dist = chebyshev(s,t) + |dz|*2
  hit = clamp(3, 95, 40 + skill(s, L.skill)*3 - dist*2 + (size(t) - 60)/4 - skill(t,'dodge')*2 + (unconscious(t) ? 40 : 0))
  cooldownUntil[s] = tick + max(MIN_ATTACK_COOLDOWN, L.size*3 + 10 - agi(s)/10)
  spawn Projectile { itemId: ammoItem, from: pos(s), to: pos(t), line: bresenham(pos(s), extend(pos(s), pos(t), L.range)), progress: 0, shooterId: s, targetId: t, hitRoll: rng.int(0,99) < hit, damage: ammoDef.damage * L.power * (metalCrossbow ? 1.083 : 1) * metal(ammo).weaponMult, damageType: ammoDef.damageType }
  emit ProjectileFired; xp(s, L.skill, 1)
advanceProjectiles(): for p in projectiles (ascending id):
  p.progress += PROJECTILE_SPEED * 1000
  while p.progress >= 1000 and p.line non-empty:
    p.progress -= 1000; cell = p.line.shift(); setPosition(p, cell)
    if blocksProjectile(cell, p): drop(p, previousCell); break
    creatures = spatial.at(cell).creatures
    if p.targetId in creatures: if p.hitRoll: resolveProjectileHit(p, targetId) ; drop(p, cell); break
                                 else continue (missed: flies on)
    else for c in creatures (not shooter): if rng.int(0,99) < hitChanceHalf: resolveProjectileHit(p, c); drop(p, cell); break
  if p.line empty: drop(p, cell)
resolveProjectileHit(p, d): like melee from `part` selection on, with raw = p.damage, no parry, block allowed, attacker skill xp +3 on hit
drop(p, cell): if rng.chance(AMMO_BREAK_PERMILLE): destroy item else items.dropAt(p.itemId, cell); destroy projectile
blocksProjectile(cell, p): kind in {Wall, Tree, Boulder} or closed door/raised bridge/closed floodgate, or (Fortification and not (adjacent(cell, p.from) or adjacent(cell, p.to)))
```

## Threat scan, duties, training

```
threatScan(): for h in hostileToFortress (not stealthed or spotted): for c in spatial.inRadius(pos(h), THREAT_RADIUS, fortress creatures): if lastThreat[c] + THREAT_THROTTLE_TICKS <= tick: emit ThreatNearby{c, h}; lastThreat[c] = tick
on SquadOrder: a new station/patrol/follow replaces the standing order, preserving queued kills; insert each kill after earlier kills and before the standing order
squadDuties(): for sq in squads: mode = alert != 'calm' ? 'active' : sq.mode
  for m in sq.members: Soldier[m].onDuty = mode != 'off'
    if not onDuty: continue
    order = sq.orders[0]
    if order.kind == 'kill': if target in perception: setTarget(m, order.targetId) else walkTo(m, tile(target), 'combat') (cleared when dead → orders.shift)
    else if hostile in perception: setTarget(m, nearest hostile (archers prefer soldiers))
    else if mode == 'active': goal = order.station ?? sq.station ?? nextPatrolTile(sq, m) ?? barracksTile(sq); walkTo(m, goal, 'job')
    else if mode == 'train': shiftTrainOrStation(sq, m) // swap at floor(tick / (TRAIN_SHIFT_HOURS * TICKS_PER_HOUR)) % 2
on ZoneChanged for barracks settings: refresh each squad’s barracksZoneId from its explicit zone setting, else the first barracks
training(): resolve the explicit assigned zone before any cached/default zone and refresh the cache; for that barracks: present = members on zone tiles; pairs = present sorted by id, paired consecutively
  for pair: if sessionEnd[pair] <= tick: for each: xp(weaponSkill, TRAIN_XP*bonus); xp('dodge', TRAIN_XP); if shield: xp('shield'); if armored: xp('armor_use');
     if not trainingWeapons and rng.chance(SPAR_INJURY_PERMILLE): emit DamageDealt{light bruise}; sessionEnd = tick + SPAR_TICKS; emit TrainingSession
  solo: half xp. Archery range: shooter at range tile shoots TRAIN_SHOTS at the target building; bolts drop around it.
```

## Equipment availability and destruction

Re-equipping considers only fortress items: exclude `merchant`, `at_depot`, `foreign`, `forbidden`, installed, reserved, owned or carried items under 13's availability rules. On synchronous item destruction, clear every matching weapon, shield, armor, clothing and quiver slot to 0 before the caller can save. Subscribe to `ItemDestroyed` for the same idempotent cleanup; other slots remain unchanged. The observer is derived and is installed again when a world is loaded.

## Health tick (every 5 ticks)

```
for id in union(wounded, admittedPatients) (ascending, once each):
  B = Body[id]; for w in wounds: if w.severity == light and tick - w.createdTick >= CLOT_TICKS: w.bleed = 0
  bleed = Σ w.bleed for w in wounds where not w.bandaged
  if bleed > 0: B.blood -= bleed else B.blood = min(B.maxBlood, B.blood + BLOOD_REGEN_PER_TICK) unless infected
  B.pain = Σ w.pain * (100 - wil(id)/2)/100 (+10 if any infected)
  wasConscious = B.conscious
  B.conscious = B.pain < PAIN_UNCONSCIOUS and B.blood >= B.maxBlood * BLOOD_UNCONSCIOUS_PERCENT/100
  if wasConscious != B.conscious: emit CreatureUnconscious / CreatureConscious
  if B.blood < B.maxBlood * BLOOD_DEATH_PERCENT/100: die(id, 'bled_out', lastAttacker[id]); continue
  for w in wounds: if healing blocked (fracture not splinted → rate 25%; infected → 0; wasting while starving → 0): rate accordingly
     w.healRemaining -= 5 * rate/100 * (w.sutured ? SUTURED_HEAL_PERCENT/100 : 1)
     if w.healRemaining <= 0: part.hp += w.damage; remove w; if w.type=='fracture' and not w.splinted: B.permanent.push('badly_healed_'+part)
  if wounds empty and blood == max: wounded.remove(id)
  updatePatient(id) // refresh every admitted patient's needs, even when only pain delays discharge
onDamageDealt(e):
  B = Body[e.defender]; part = B.parts[e.part]; maxHp = part.maxHp
  ratio = e.amount / maxHp; sev = ratio < LIGHT_MAX ? light : ratio < SERIOUS_MAX ? serious : grievous
  part.hp -= e.amount
  if part.hp <= 0: if e.part in {head, torso}: die(defender, 'killed', attacker); return
                   else: part.destroyed = true; B.permanent.push('lost_'+part); part.wounds = []; add wound(cut, grievous at stump); emit LimbLost; recomputeSpeed
  else: type = e.damageType == 'edge' ? cut : 'pierce' ? puncture : (e.amount >= maxHp*FRACTURE_PERCENT/100 ? fracture : bruise) (burn/frost sources pass their type)
        w = { type, sev, bleed: bleedTable[type][sev], pain: painTable[type][sev], healRemaining: HEAL_BASE_TICKS * sevMult[sev], damage: e.amount, ... }
        part.wounds.push(w); wounded.add(defender); emit WoundInflicted; lastAttacker[defender] = e.attacker
  updatePatient(defender); recomputeSpeed(defender)
die(id, cause, killer): emit CreatureDied{id, cause, killer}; (13 creates the corpse; 10/08/18 remove the creature; the entity is destroyed by the owner after handling)
```

Wound tables (per type × severity): bleed light/serious/grievous: cut 1/3/6, puncture 2/4/8, bruise 0/0/0, fracture 0/1/2, burn 0/1/3, frost 0/0/1, wasting 0; pain: cut 5/15/30, puncture 4/12/25, bruise 4/10/20, fracture 15/30/45, burn 8/20/40, frost 5/12/25, wasting 5/10/15. Severity multipliers for healing: 1, 3, 6.

Daily: infection roll per cut/puncture/burn that is not cleaned, sutured or bandaged and is older than one day (`INFECTION_PERMILLE`, ×2 in miasma or after a floor sleep); infected daily death roll (`INFECTION_DEATH_PERMILLE`); `clean_wound` with brightleaf sets the first `curedAt = today + INFECTION_CURE_DAYS`. A wound with a pending cure is excluded from cleaning needs, input selection and completion targets; its deadline is preserved and it still counts as infected for admission. Select the first infected wound without a pending cure, otherwise the first uncleaned uninfected wound, in body-part/wound order. Only an untreated infection requires brightleaf. Pending cleaning jobs revalidate that requirement: if a newly infected target needs brightleaf and the job lacks its input, `health.canComplete` holds the final work step; the next production cancels and recreates the job with brightleaf through the normal job-board path. Cancellation releases tools and reservations. Delivered inputs must pass 11’s ownership/count check before the replacement can complete. Failed treatment consumes inputs without setting a deadline and remains a need.

Patient management: `updatePatient(id)` admits when any wound bleeds, any fracture is unsplinted, any burn undressed, any wound infected, or the creature is unconscious from wounds; it refreshes `needs` in priority order for every admitted patient and the producer creates one job per need with the inputs from 17; discharge when none of the admission reasons remain, conscious, and `pain < PAIN_DISCHARGE`; `PatientHealed` when all wounds are light or gone. `awaitsBandage(id)`: some wound has `bleed > 0`, is not bandaged and `tick − createdTick < RESERVE_KEEP_TICKS`, a dwarf other than `id` has the `medicine` labor, and `stop_bleeding:id` is not `blocked`; while it holds, the producer makes no new `carry_patient` and the dwarf brain keeps a conscious patient's goal on its tile. Treatment failure rolls for every treatment kind but `stop_bleeding`.

Failed wound treatments: after consuming the failed job's inputs, retain its kind for a living dwarf only if the current wounds still require it. At ordinary production, visit the union of admitted patients and saved request targets in ascending entity-id order. Prune requests whose target died or whose wound no longer requires the treatment; recreate remaining kinds through the normal job sink, in the wound-need order `set_bone`, `suture`, `clean_wound`, `dress_burn` (`stop_bleeding` does not fail). For discharged targets, produce only retained failed kinds, cancel stale retries in sorted kind order, and leave other existing care jobs alone. Carrying, feeding, watering, diagnosis and crutches still follow admission. Completing treatment refreshes retained requests from the current wounds; do not readmit a discharged target or restart a pending infection cure.

Animal care: for each tame animal with an unbandaged bleeding wound, create one `bandage_animal` job with one cloth and the job catalogue's duration. On successful completion, bandage every bleeding wound, set its bleed to 0, consume the cloth and emit `TreatmentDone` with that job kind. Failure uses animal-care skill and the treatment-failure rule. No animal surgery or care for wild/hostile creatures.

Speed and productivity: `speedModifier = Π over permanent: lost leg 50% (75% with a crutch), badly healed leg 85%; both legs lost → 0 (bedridden)`; `productivityModifier = max(PRODUCTIVITY_FLOOR, 100 − pain/2 − (100 − bloodPct)/2 − permanent arm penalties)`.
