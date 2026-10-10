# Wild animals and civilians: why one badger kills most of a fortress

**Date:** 2026-10-10 · **Task:** T-196 · **Commit examined:** `26b6b86` (branch `cloud/T-196`, equal to `cloud/main` at the start) · **By:** Claude (Opus), as the strong model on T-196

## The answer

One wild animal kills most of a group of civilians because of five things that add up. Three are faults in the code against the specification, one is a missing rule, and one is the player's job by design:

1. **The animal never lets go (code fault, 08).** The specification says an attacking animal returns to `idle` when its target dies or flees. The code does neither: it chases a fleeing dwarf for as long as the dwarf is in sight, and when the dwarf dies it picks the nearest other dwarf in sight and starts again. Measured: an attacking animal spent a median of 720 ticks chasing a fleeing dwarf in the hauling runs, and killed up to seven dwarves one after another.
2. **A light wound never stops bleeding (missing rule, 17).** A wound bleeds until a medic bandages it or it heals, and a light wound takes 6,000 ticks to heal. Measured: one light cut, untreated, kills a dwarf in 2,500 ticks (about two days); one light puncture in 1,250. So every bite that is not bandaged is fatal, and a fortress without cloth and a medic loses every dwarf an animal touches.
3. **A kill order on an animal more than 14 tiles away does nothing (code fault, 16).** Measured: a soldier with a kill order on a deer 25 tiles away did not move in 400 ticks. The order sets the target, and the same tick drops it again as "out of perception".
4. **Civilians never fight back in the open (by the specification, 10).** A civilian fights only when there is no tile to flee to. On open ground there always is one, so seven dwarves flee from one badger and none strikes. Measured: 0 attacks by civilians in 45 runs.
5. **The alert never rises by itself (by the specification, 16).** "There is no automatic alert change." The player is told by an alert announcement at the first attack and by a pausing announcement at each death.

With the first three fixed and the missing rule written, a careless fortress should lose a dwarf now and then to an animal it walks into, and a fortress that answers (a kill order to its squad, a medic with cloth) should lose nobody to a badger. Whether that holds is measured after the fixes, in a separate report.

The pastured animals are a separate matter (§ Livestock): six grazers on a 20-tile pasture eat it bare in 30 days. That is the fixture (below 08's own capacity rule) and a balance gap (even 08's capacity of 6 tiles per grazer is eaten down, 36 tiles to 4 in 60 days).

## What was examined and how

- The specification: `08` § Wild behavior, `10` § Behavior selection, `16` § Targeting, § Fleeing, § Squads, § Alerts, `17` § Bleeding and § Patients, `balance.md` § Combat pace; `algorithms/creature-brains.md` § Animal brain.
- The code: `src/systems/animals/brain.ts`, `src/systems/dwarves/brain.ts`, `src/systems/combat/index.ts`, `squads.ts`, `threats.ts`, `factions.ts`, `src/systems/health/tick.ts`, `producer.ts`.
- Three probes, written for this report and saved beside it. They run in Vitest against the headless game with `vitest.t196.config.ts` (saved as [`2026-10-10-t196-probe-vitest.config.ts.txt`](../data/2026-10-10-t196-probe-vitest.config.ts.txt)):
  - **Chain probe** ([source](../data/2026-10-10-t196-probe-chain.test.ts.txt); [per-run lines](../data/2026-10-10-t196-probe-before.txt); [data](../data/2026-10-10-t196-probe-before.json)). A 96 × 96 flat map, the 08 animal system on a temperate forest region with natural arrivals removed as they appear, so that exactly one animal is present. 50 stones lie west of the animal and a stone stockpile is east of it, so every haul passes it. One animal (badger, boar or wolf, not hungry) at (48, 42); 3,600 ticks (three days); seeds `s1` … `s5`. Four modes:
    - `lone`: one civilian hauling;
    - `haul`: seven civilians hauling;
    - `hospital`: `haul` plus a hospital zone with three beds, 20 cloth and 20 thread, and one of the seven as Chief Medic (medicine 5, hauling off);
    - `react`: `hospital` plus a squad of two dwarves with iron axes (skill 4) 28 tiles south; at the animal's first attack the probe sets the alert to `watchful` and gives the squad a kill order on the animal.
  - **Micro probe** ([source](../data/2026-10-10-t196-probe-micro.test.ts.txt); [output](../data/2026-10-10-t196-probe-pasture-and-micro.txt)): one wound on a resting dwarf, untreated; a kill order on a deer 25 tiles from the squad.
  - **Pasture probe** ([source](../data/2026-10-10-t196-probe-pasture.test.ts.txt); [output](../data/2026-10-10-t196-probe-pasture-and-micro.txt)): two cows, two sheep and two goats assigned to a 20-tile and to a 36-tile pasture on a generated temperate grassland map at peril 0, 60 days from spring.

## Checking the capture

The capture ([`2026-10-10-wildlife-capture.md`](../data/2026-10-10-wildlife-capture.md)) was taken by a weaker model. Its key facts were checked with the chain probe, which uses a different map, positions and seeds:

| Capture fact | Check |
|---|---|
| A civilian within 5 tiles of a territorial animal is attacked | Holds. Read: `animals/brain.ts:374-381`. Measured: every `lone` run, all three species. |
| Civilians never strike back, even seven against one | Holds. Measured: 0 civilian attacks in the 45 `lone`, `haul` and `hospital` runs. |
| All flee; three to five of seven bleed to death within a third of a day | Holds, and the spread is wider: 0 to 7 of 7 died in a `haul` run (badger 18 of 35, boar 24 of 35, wolf 18 of 35 over five seeds). A wounded dwarf died a median of 208 to 277 ticks after its first wound. |
| Nobody is treated even with a stocked hospital | Holds. Measured: 0 treatments in 15 `hospital` runs, although a `stop_bleeding` job was created for every wounded dwarf. |
| The alert never changes | Holds, and it is the specification (§ The chain, link 5). |
| Two armed soldiers end the fight in one or two hits | Holds. Measured: the badger died after 1 to 3 soldier hits in all five `react` runs. |
| After a kill, the animal targets the next dwarf in sight | Holds. Read: `animals/brain.ts:476-487`. Measured: up to 7 different targets in one run. |

The capture's own numbers are not consistent in places (for example its experiment A table gives 16 badger hits and its text 13 for the same run), and its experiment D did not use a kill order. Its numbers are not used below; its observations are.

One trap for anyone repeating this: a squad order is `{ kind: 'kill', targetId }`. The first version of the chain probe sent `{ type: 'kill' }`, which is refused with `bad_setting`, and the squad then fought only when the fight drifted within 14 tiles of it. The `react` lines in the data are from the corrected probe, which throws if the order is refused.

## Baseline (the chain probe at `26b6b86`)

| Mode | Species | Runs with an attack | Civilians dead / at risk | Wounded dwarves who died | Ticks from first wound to death (median, range) | Ticks spent biting unconscious dwarves (sum) | Ticks chasing a fleeing dwarf (median per run) | Dwarf hits / attacks on the animal | Treatments | Animal killed |
|---|---|---|---|---|---|---|---|---|---|---|
| lone | badger | 5/5 | 5/5 | 5/5 | 268 (239–324) | 195 | 246 | 0 / 0 | 0 | 0/5 |
| lone | boar | 5/5 | 5/5 | 5/5 | 182 (173–225) | 145 | 188 | 0 / 0 | 0 | 0/5 |
| lone | wolf | 5/5 | 5/5 | 5/5 | 185 (180–252) | 150 | 190 | 0 / 0 | 0 | 0/5 |
| haul | badger | 4/5 | 18/35 | 18/21 | 277 (139–361) | 658 | 721 | 0 / 0 | 0 | 0/5 |
| haul | boar | 4/5 | 24/35 | 24/24 | 208 (65–324) | 715 | 719 | 0 / 0 | 0 | 0/5 |
| haul | wolf | 4/5 | 18/35 | 18/19 | 219 (175–269) | 567 | 746 | 0 / 0 | 0 | 0/5 |
| hospital | badger | 4/5 | 13/35 | 13/14 | 261 (233–366) | 511 | 757 | 0 / 0 | 0 | 0/5 |
| hospital | boar | 4/5 | 19/35 | 19/19 | 200 (154–266) | 551 | 661 | 0 / 0 | 0 | 0/5 |
| hospital | wolf | 2/5 | 13/35 | 13/13 | 197 (175–336) | 359 | 652 | 0 / 0 | 0 | 0/5 |
| react | badger | 5/5 | 5/35 | 5/9 | 277 (255–1033) | 155 | 80 | 9 / 10 | 16 | 5/5 |
| react | boar | 5/5 | 7/35 | 9/10 | 226 (156–270) | 198 | 195 | 16 / 24 | 3 | 4/5 |
| react | wolf | 3/5 | 0/35 | 1/3 | 239 (239–239) | 0 | 7 | 7 / 12 | 8 | 3/5 |

"Wounded dwarves who died" counts soldiers as well as civilians. In the `react` runs, two unarmoured soldiers died to boars. In `react` boar `s3` the squad never reached the boar in 3,600 ticks (link 3).

## The chain, link by link

### 1. Why a fleeing civilian is never safe — code fault (08)

- **The specification** (`08-animals-and-domestication.md:43`): in `attack`, "the animal returns to `idle` when the target dies, flees, or is out of perception for 50 ticks". `algorithms/creature-brains.md` § Animal brain: "attack: … if target gone: 'idle'".
- **The code** (`animals/brain.ts:464-498`) checks only the animal's own blood, then: if the target is dead it takes the nearest dwarf within perception (`:476-487`); it ends the attack only when the target is on another level or farther than perception (`:489-495`). Nothing looks at whether the target flees, and nothing ends the attack when the target dies.
- **The civilian's side** (`dwarves/brain.ts:72-117`, `:183-194`): without a hearth hall the escape goal is the first tile, breadth first, that is one step farther from the threat. A badger walks as fast as a dwarf (0.15 tiles per tick each, `creatures.md`), a boar and a wolf faster, so the animal stays adjacent and bites every 12 ticks (`MIN_ATTACK_COOLDOWN`) at +10 to hit against a fleeing defender (16 § Melee resolution).
- **Measured**: median 188 to 757 ticks of chasing a fleeing target per run; up to 41 tiles chased from where the attack began; in the `lone`, `haul` and `hospital` runs 120 of 125 wounded dwarves died.

**Whether a territorial animal should break off when the intruder leaves its territory: yes.** The specification already says so ("flees"); it does not say how far. Decision (written into 08): an animal that attacked because a dwarf came near (a *defending* animal, as against a hungry hunter) follows its target no farther than its provoke radius (`TERRITORY_RADIUS` or `APPROACH_RADIUS`) from the tile where the attack began, and leaves alone a target that is unconscious. Then it wanders, so that it does not attack the same dwarf again at once. A hungry hunter keeps its prey until it kills it. Whether this is enough is measured after the change.

### 2. Whether civilians in a group should defend themselves or each other — by the specification; no rule added now

- **The specification**: 10 § Behavior selection step 1 and § escape ("If no safer tile is found, the civilian is cornered and fights back"); 16 § Targeting ("10 for civilians only when cornered").
- **The code** follows it (`dwarves/brain.ts:186-199`). **Measured**: 0 civilian attacks in 45 runs; seven civilians fled from one badger every time.
- **Decision**: no new rule in this task. Fleeing is right once the animal breaks off (link 1): the first thing to measure is whether a fleeing civilian is then safe. If the measurement after the fixes still shows civilians dying in the open, fighting back when caught is the next rule to consider, and it will be filed with its numbers.

### 3. Whether the alert should rise and call the squad and a hunter — the alert by design; the squad was broken

- **The alert**: 16 § Alerts: "There is no automatic alert change; `ThreatWarning` and `RaidArrived` are `danger` announcements that pause the game so the player can choose." The code has no automatic change (`combat/index.ts:461-474`, the only writer is `SetAlert`). The player is told: the first attack of each attacker and defender pair is an `alert` announcement that centres the view (16 § Combat log) and a dwarf's death is a `danger` announcement that pauses (17 § Registrations). **Decision**: keep it. Raising the alert is the player's choice by design; a wild animal is not a raid.
- **The squad**: 16 § Squads: "`kill` orders queue and execute in the order issued … a target's death completes its kill order." **Code fault**: `combat/squads.ts:404-408` sets the kill target, and `combat/index.ts:293-296` drops any target beyond `PERCEPTION_RADIUS` (14) in the same tick, so a squad more than 14 tiles from the animal never moves. Measured: micro probe (soldier stayed at (40, 70), deer at (40, 45), 400 ticks); `react` boar `s3` (no soldier attack in 3,600 ticks). **Fix**: a soldier whose kill target is out of perception walks toward it; within perception the ordinary targeting takes over.
- **A hunter**: nothing in 09 makes a hunter go after a dangerous animal, and nothing should by itself: a hunt is the player's order. Not changed.

### 4. Whether bleeding leaves time for any treatment — missing rule (17)

- **The specification** (17 § Bleeding): every health tick, `blood −= Σ wound.bleed` for wounds not bandaged; a wound stops bleeding only when bandaged or healed; `HEAL_BASE_TICKS` is 6,000 for a light wound. `balance.md` § Combat pace expects a soldier with "2–3 light cuts" to need "a hospital visit", not to be dying.
- **The code** follows the specification (`health/tick.ts:366-381`, `:425-450`).
- **Measured** (micro probe, a resting dwarf with 600 blood): one light cut kills in 2,500 ticks, one light puncture in 1,250, one serious puncture in 625. During a mauling the bites stack: a dwarf died a median 182 to 277 ticks after its first wound, shorter than `TREAT_TICKS` (200) plus a medic's walk. A `stop_bleeding` job existed for every wounded dwarf and none finished before death in the `hospital` runs; in the `react` runs, where the animal was killed, 27 treatments finished.
- **Decision**: a light wound stops bleeding by itself after a while; a serious or grievous one bleeds until a medic bandages it. The value is set by measurement after the change. Without such a rule every unbandaged bite is a death, and a fortress has no cloth in its first weeks (the Balanced embark brings none).

### 5. Fighting on an unconscious dwarf — part of link 1

Measured: the animal bit unconscious dwarves for 145 to 715 ticks per mode (summed over seeds). 16 adds +40 to hit an unconscious defender. A defending animal will leave an unconscious target (link 1).

## Livestock: why pastured animals starve

- **The specification**: 08 § Pastures and feeding: condition rises 2 per hour; a grass tile lowers it by 25; a grazer dies after 10 days at 100; the pasture warns when grazers exceed `grass tiles / GRASS_PER_GRAZER` (6). 07 § Grass: a bare tile with a grass neighbour regrows with 120 permille per day, never outdoors in winter.
- **Arithmetic** (from those numbers): a grazer needs 48 / 25 ≈ 1.9 grass tiles a day. Six tiles regrow at most 6 × 0.12 = 0.72 a day. A pasture at 08's own capacity is eaten down.
- **Measured** (pasture probe, two cows, two sheep, two goats, temperate grassland, peril 0, spring): on 20 tiles the grass was gone on day 30, all six reached condition 100 on day 32, 14 starving notes followed, and they lived on by finding the odd regrown tile (no death in 60 days). On 36 tiles (08's capacity) grass fell from 35 to 4 by day 60. No wild grazer was seen grazing inside the pasture (the probe's detection is coarse).
- **The fixture**: the shared fortress fixture (`test/scenarios/three_years_fortress.ts:397-411`, read only, owned by another task) makes a pasture of at most 20 tiles and assigns every tame animal to it; the Balanced embark brings two cows, two sheep and two goats (`embark-catalog.md`), which 08's rule says need 36.
- **Classification**: FIXTURE (the pasture is below the capacity rule) and BALANCE (the capacity rule is not sustainable against the regrowth rate). The three deaths in the `defence_year` run of T-151 (day 56, peril 2) were not reproduced: the stage that reaches day 56 is not on this branch. **Cause of those deaths not established.** Filed as a backlog row; not changed in this task.

## Not established

- Whether hungry wolves hunting dwarves (08: "any prey … or dwarf within perception triggers `hunt` when hungry") are survivable; the chain probe spawns animals that are not hungry. Measured after the fixes.
- Why the T-151 `defence_year` run lost five civilians to wolves and a bear between days 41 and 55 at a `calm` alert: not reproduced here.
- Corpse eating after a kill (`EAT_CORPSE_TICKS`) is not implemented; the code clears hunger in other ways. Whether that matters for the danger of predators is not measured.
