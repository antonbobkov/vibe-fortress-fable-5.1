# F-08 — M6/M7 spec arithmetic, the combat-skill gap, the Deep's emergences, embark supply prose (M)

**Needs:** — · **Resolves:** C-003, C-008 · **Spec touched:** `acceptance-tests.md`, `16-combat.md`, `17-health-and-medicine.md`, `18-threats-monsters-and-raids.md`, `03-content/weapons-and-armor.md`, `03-content/balance.md`, `03-content/embark-catalog.md`, `02-systems/02-embark-and-loadout.md`, `03-content/threat-schedules.md`

This task is mostly documentation, plus one exporter fix and one content-check rule. Do it before T-M6-01 so that M6 and M7 do not park more tests as `todo` contradictions.

## Why

In five milestones, seven acceptance rows contradicted the spec's own rules (C-002 … C-008), and every one was simple arithmetic. A pass over the M6 and M7 rows (plus the M4 rows deferred to M6) against the constants found more of the same, one exporter bug that silently empties content, and a gap M6 cannot implement without inventing numbers.

Row by row (✓ = consistent as written; ✎ = amended below):

| Row | Verdict | Arithmetic |
|---|---|---|
| `he_bleed` | ✎ | Dwarf maxBlood = 60 × 10 × (50 + 50)/100 = 600; a serious cut bleeds 3 per health tick (every 5 ticks). Unconscious below 40%: 360/3 = 120 health ticks = **600** ✓. Dead below 20%: 480/3 = 160 = **800**, not ~1,000. |
| `he_bandage` | ✎ fixture | A serious wound heals in 3 × 6,000 = 18,000 ticks = 15 days ✓, but only unsutured (a hospital with thread sutures: 10 days). "Within 300 ticks" fails at low skill (`TREAT_FAIL_PERMILLE` 200 at skill 0). |
| `he_fracture` | ✓ | |
| `he_infection` | ✎ | 100‰ per day on days 2–10 = 9 rolls: 1 − 0.9⁹ = 61.3%; "≥ 60% over 100 runs" fails ~40% of the time. A light cut heals in 5 days (4 rolls, 34%). A floor sleep doubles the rate. |
| `he_limb` | ✓ | Arm maxHp = 60 × 0.6 = 36 < 60. |
| `he_fall` | ✎ | 3² × 6 = 54 ✓, but 54 to a leg (maxHp 36) **destroys the leg**: 60% of 3-level falls would amputate, not "fracture likely". |
| `fl_drown` | ✓ (note) | Torso 60 hp at 8 per health tick: dead in 8 health ticks = **40 ticks**, well inside 400. Two real seconds at 1×: recorded as a balance finding, not changed. |
| `dw_starve` | ✎ wording | 8% of torso hp per day: death on the **13th** daily damage, not "about 12". |
| `cb_hit_table` | ✎ fixture | 50 + (5 − 5) × 3 = 50 ✓ only if the defender cannot parry or block. |
| `cb_armor` | ✎ fixture | 22 − 15 = 7, × 0.95 (Toughness 50) = 6.65 → 7 ✓ only for attacker Strength 50, defender Toughness 50, torso hits. |
| `cb_worked_examples` | ✎ | Example 3 uses a trollkin torso of 140; content has size 150 (and `df_cage` relies on 150), which makes the hit light, not serious. Example 5: 24/40 = 0.60 ≥ `SERIOUS_MAX` 0.5, so the wound is **grievous**, not serious. |
| `cb_ranged` | ✎ fixture | 40 + 18 − 16 − 5 − 4 = 33 ✓, with the deer's dodge 2, a number **no document defines** (see the skill gap below). The deer dies after about one hit, so 2,000 shots need a replacement deer. |
| `cb_squad_station`, `cb_training`, `cb_alert_hearth` | ✓ | Behavioural. |
| `th_schedule` | ✎ wording | Peril-1 raids: earliest year 2 autumn, size `min(12, 5 + renown × 0.2)` ✓. The captain is added on top of the size. |
| `th_warning`, `th_loiter`, `th_retreat`, `th_troll_door`, `th_restless` | ✓ | |
| `th_thief` | ✓ | Statistical; no arithmetic conflict. |
| `th_deep` | ✎ content | 5 × 10 = 50 = the level-1 threshold ✓, but `src/content/deepThresholds.json` has `emergence: []` at **every** level: nothing would emerge. |
| `df_*` | ✓ | Cage: trollkin 150 ≤ `CAGE_MAX_SIZE` 150; wyrm 220. |
| `td_schedule`, `td_no_depot`, `td_wood_penalty`, `td_attack` | ✓ | −2 × 3 = −6; −50 − 10 = −60 ≤ `CARAVAN_BAN_REP`. |
| `td_offer` | ✎ | The `balance.md` example is internally inconsistent: margin = 15 − 4 × 0.5 − 10/20 = **12.5%**, not 12; its own offer, 270 + 1,920 = 2,190, is **below** the 2,240 it says is needed; reputation +clamp(1, 5, 2,000/500) = **+4**, not +3. |
| `td_requests` | ✎ | The Hillfolk goods list has no bars: a request to the Hillfolk for iron bars can never be filled. The Mountainhome carries `bar` (count 5–10). |
| `im_guaranteed`, `im_cap` | ✓ | |
| `im_threshold` | ✎ bound | p = 700‰; the 99% band for 100 seeds is 58–82, not 60–80. |
| `im_composition` | ✓ | Statistical. |
| `an_breed` (C-003) | ✎ | 60-day gestation cannot give a birth in two seasons (56 days). In one year, conception must happen by day 52: 1 − 0.94⁵² = **96%**. |
| `fo_butcher_rot` (C-008) | ✎ | 150% of 14 days = **21**, not 20. |
| `fo_hunt` | ✓ | Deer 40: meat ⌊40/12⌋ = 3, hide 1, bone ⌊40/25⌋ = 1. |
| `fo_no_ammo`, `bd_bridge`, `bd_floodgate`, `bd_burial`, `an_predator`, `an_tame` | ✓ | |

## Decisions

1. **Decision F-08a — creature attributes and combat skills (a gap: W4 calls `speciesAttackSkill(a)` and `skill(d, 'dodge')` for creatures that have neither `Attributes` nor `Skills`).**
   - A creature without `Attributes` has every attribute at `CREATURE_ATTRIBUTE_DEFAULT = 50`, so a natural attack does its listed damage.
   - A creature without `Skills` has every combat skill (natural attacks, every weapon skill, `dodge`, `shield`) at `CREATURE_BASE_SKILL = 2`, the deer of the ranged worked example.
   - Hostile party members spawned by 18 get a `Skills` component with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gearTier` (`HOSTILE_SKILL_PER_TIER = 2`), plus 2 for captains. Tier 0 bandits fight at 2; a tier-3 raid at 8.
   - All three are new constants in `16` § Tuning constants. T-M8-06 may retune them.
2. **Decision F-08b — Toughness applies to combat hits only.** `17` § Wound creation step 4 (reduce by Toughness before step 1) conflicts with W4, where the reduction is in 16's resolution and `onDamageDealt` does not reduce. W4 wins: environmental damage (falls, drowning, starvation, burns) is not reduced by Toughness.
3. **Decision F-08c — falls break bones; they do not sever limbs.** Fall damage to a **limb** is capped at `part.hp − 1`, so a fall never destroys a limb. Damage to the torso is not capped: a 4-level fall (96) can kill.
   - A 3-level fall: leg (60%) → 35 damage to a healthy leg, a grievous fracture; torso (40%) → 54, a grievous fracture.
4. **Decision F-08d — trade arithmetic.**
   - Margin is not rounded (12.5%). The required valuation is `ceil(Σ price(take) × (100 + margin) / 100)`, and the UI shows the margin rounded down ("12%").
   - The reputation gain's `value` is `Σ price(take)`, floored after dividing by 500.
5. **Decision F-08e — embark supplies (prose only; an owner question stays open).** The documents disagree with `balance.md`'s need rates:
   - `balance.md`: 1.4 food and 2.4 drink per dwarf per day, so 274 food and 470 drink per season for seven dwarves.
   - `embark-catalog.md` says a season is "about 100 food units and 150 drink units".
   - `02` says the Balanced preset carries "a season of food and drink". It carries 60 food units and 60 drinks: about **6 days** of food and **3.5 days** of drink for seven dwarves.
   - A bootstrap probe on seven dwarves ran out of food around day 6 on every seed and ate the brewable dimcaps raw before the still could use them.

   This task corrects the prose to the arithmetic and records balance findings. **It changes no constant and no content**: the workflow forbids agents from changing constants, and T-M8-06 owns balance. See "Owner question" at the end.
6. **Decision F-08f — the Deep's content.**
   - Fix the exporter: `exportDeepThresholds` calls `plain()`, which strips backticks, before `ticked()`, so no species is ever found.
   - The "5+" row is a formula, not a threshold, and must not be exported as a threshold: its "pressure 28" is `HOLLOW_WAVE_DAYS` misread.
   - `deepThresholds.json` gets exactly the four threshold rows with their emergence lists. The wave formula stays in `18`'s text, where it already is.
   - New content-check rule: every `deepThresholds` row has a non-empty `emergence`.

## Spec amendments

**`docs/04-implementation/acceptance-tests.md`.** Replace these rows (Scenario and Expected columns):

| id | Scenario | Expected |
|---|---|---|
| `he_bleed` | a dwarf with Toughness 50 and a serious cut on the torso, no treatment | unconscious at 600 ± 10 ticks; dead at 800 ± 10 ticks |
| `he_bandage` | same, with a hospital, cloth (no thread) and a medic of medicine skill 20 | `stop_bleeding` within 300 ticks of admission; survives; `PatientHealed` at day 15 ± 1 |
| `he_infection` | a serious untreated cut, the dwarf sleeping in a bed, no miasma, 10 days | 49–74% infected over 100 runs (model 1 − 0.9⁹ = 61%); brightleaf cures in 3 days |
| `he_fall` | a dwarf falls 3 levels | 54 damage to the torso, or damage capped at the leg's hp − 1 to a leg; a fracture either way; never `LimbLost` |
| `dw_starve` | no food | `Starving` at hunger 100; `Starvation` damage daily after `STARVE_DAYS`; death on the 13th day of damage |
| `cb_hit_table` | 10,000 attacks, skill 5 vs dodge 5, equal agility, defender without weapon or shield | hit rate 50% ± 2% |
| `cb_armor` | a common iron axe (attacker Strength 50) vs a common iron mail shirt and tunic (defender Toughness 50), 1,000 torso hits | damage 7 on every hit; every wound light |
| `cb_ranged` | crossbow, skill 6, range 8, at a deer (a fresh deer replaces a dead one) | hit 33% ± 3% over 2,000 shots; 17–23% of the bolts break, the rest drop |
| `th_schedule` | peril 1 region, 3 years | no raid before autumn year 2; `size` 5–12 (the captain is added on top) |
| `td_offer` | the worked example in `balance.md` (30 fine stone crafts and 42 lavish meals for goods priced 2,000) | accepted; reputation +4; with 41 meals refused, shortfall 12 |
| `td_requests` | request iron bars from the Mountainhome | its next caravan carries ≥ 5 iron bars |
| `im_threshold` | year 2, spirit 60 vs 70 | 60: `ImmigrationSkipped { spirit }`; 70: a wave with probability ~70% (over 100 seeds: 58–82) |
| `an_breed` | cow and bull in a pasture, one year (112 days) | ≥ 1 `AnimalBorn` (conception by day 52 is needed: 96% at `BREED_PERMILLE` 60) |
| `fo_butcher_rot` | corpse left 21 days | `skeleton`; butchering yields bones only |

**`docs/02-systems/16-combat.md` § Tuning constants**: add `CREATURE_ATTRIBUTE_DEFAULT` 50, `CREATURE_BASE_SKILL` 2 and `HOSTILE_SKILL_PER_TIER` 2, and one paragraph under § Melee (or the section that defines the hit formula) stating Decision F-08a.

**`docs/02-systems/18-threats-monsters-and-raids.md`**, party generation: add "Members get `Skills` with every combat skill at `2 + HOSTILE_SKILL_PER_TIER × gear tier` (captains + 2) and no `Attributes` (`16`'s defaults apply)."

**`docs/02-systems/17-health-and-medicine.md` § Wound creation**, replace step 4 with

> 4. Toughness reduces combat hits in 16's resolution (`min(10, Toughness / 10)` percent). Environmental damage is not reduced.

and in the table row for Falling, append "; damage to a limb is capped at the limb's hp − 1: a fall breaks bones but never severs a limb".

**`docs/03-content/weapons-and-armor.md` § Worked examples**:

- Replace example 1's result with: "raw 22; the goblin's Toughness is the default 50, so damage round(22 × 0.95) = 21; goblin torso maxHp = 55; ratio 0.38 → serious cut. Bleed 3 per health tick; the goblin (blood 550) is unconscious after 330 / 3 = 110 health ticks = 550 ticks, dead after 733 ticks …"
- Replace example 3 with: "**Steel warhammer (common) vs trollkin (natural armor 4, size 150)**: raw = 24 × 1.25 × 1.0 × (50 + 60)/100 = 33; natural plate 4 × 0.9 = 3.6; 29.4 × 0.95 (Toughness 50) = 27.9 → 28; trollkin torso 150 → ratio 0.19 → light bruise, no fracture (45); a limb (maxHp 90): 28 ≥ 27 → a fracture in one hit."
- Replace example 5's tail with: "damage 20 × 1.2 × 1.0 = 24 × 0.95 = 22.8 → 23 vs deer torso 40 → ratio 0.575 → grievous puncture, bleed 8: the deer (blood 400) is unconscious after 150 ticks and dead within 200 ticks of a torso hit."

**`docs/03-content/balance.md`**, the trade paragraph (line 99): replace from "Selling 30 stone crafts" to "must give 2,240 in valuation." with

> Selling 30 fine stone crafts (9 each → 270 at Hillfolk 100%) and 42 lavish meals (60 each at 80% = 48 → 2,016) gives 2,286 in valuation for goods priced 2,000 at the 12.5% margin (trading skill 4, reputation 10: 15 − 2 − 0.5), which asks for ceil(2,000 × 1.125) = 2,250; with 41 meals the offer is 12 short. The trade raises reputation by 2,000 / 500 = 4.

**`docs/03-content/embark-catalog.md`** line 150: replace the sentence with

> A season of food and drink for seven dwarves is about 275 food units and 470 drink units at `balance.md`'s rates. The presets carry about a week of food and half a week of drink: they buy the time to dig, brew and cook, and the first days must find water, set up a still and start a farm (the year-one hints push exactly that).

**`docs/02-systems/02-embark-and-loadout.md`**, preset table, `balanced` row: replace "a season of food and drink" with "a week of food and half a week of drink"; § Supplies rule of thumb: replace "food and drink for a season" with "food and drink for the first week, and water or a still soon after".

**`docs/03-content/threat-schedules.md` § The Deep**: move the "5+" row out of the table into a sentence under it: "After level 4, a wave every `HOLLOW_WAVE_DAYS` (28) days: wave n brings 3 + n crawlers, 1 + n/2 stalkers, and a maw every third wave; 'The Hollow does not forget.'"

## Code and content

| File | Change |
|---|---|
| `scripts/lib/export/meta.mjs` `exportDeepThresholds` | Split the raw cell on `+` and call `ticked(part)` on the **raw** part (before `plain`). Skip rows whose Level cell is not an integer. |
| `src/content/deepThresholds.json` | Regenerate: levels 1–4 with emergences `[3 hollow_crawler]`, `[2 hollow_stalker, 3 hollow_crawler]`, `[1 magma_wyrm, 2 hollow_stalker]` (the "if none alive" is 18's rule), and `[1 hollow_maw, 4 hollow_crawler, 2 hollow_stalker]`. |
| `src/content/schema.ts` | Validation: every `deepThresholds` row has a non-empty `emergence`. |
| `test/unit/content.test.ts` | "F-08: the Deep's emergences are exported": the four rows above exactly. "F-08: content never has an all-empty list column": for every content table, no array-valued column is empty in every row. `embarkCatalog.sex` and `weatherStates.tempDelta` are the known exceptions, the latter by D-009/D-101. |
| `test/scenarios/fo_butcher_rot.scenario.ts`, `test/unit/items/rot.test.ts` | The 20-day skeleton `it.todo('C-008 …')` becomes a real assertion at day 21. |
| `test/scenarios/an_breed.scenario.ts` | Remove `todo: 'C-003'`; run 112 days; assert ≥ 1 `AnimalBorn`. If seed `an-breed` gives no birth (the 4% case), keep the seed and assert instead, from the recorded events, that a pregnancy started after day 52 or never started; record the measured conception day in the scenario's header. Never replace the seed to make it pass. |

The combat and health rows above are implemented in M6 by T-M6-01/02/03 against the amended rows; this task only amends them.

## Balance findings

Append to `DECISIONS.md` § Balance findings:

- `| B-<n> | probe year-one … year-one-e | flat-test 48×48 | Balanced embark food and drink for 7 dwarves | "a season" (02) | ~6 days food, ~3.5 days drink | hunger and thirst rates (balance.md § Needs), preset contents (embark-catalog.md § Presets) |`
- `| B-<n+1> | fl_drown fixture | — | time to drown | "within 400 ticks" | 40 ticks (2 s at 1×) | DROWN_DAMAGE (17) |`

## Owner question (not for the agent)

With M6, starvation and dehydration kill (death roughly 12 days after damage starts). A new player's first fortress, following the hints, will be hungry from about day 6. On a map without surface water it will be thirsty from about day 4, until farms yield (first dimcap harvest ~day 16, barley ~day 28). The spec treats this as intended pressure, and it is internally consistent. The owner should confirm it before M6, or choose one of these:

- halve the need rates (hunger 1.5/h, thirst 2.5/h), which halves every farm and still size in `balance.md`;
- raise the presets' food and drink.

**Answered (2026-09-25).** The owner chose to change the rates, not the presets, and anchored them to a figure the specification already states: `embark-catalog.md` § Rules of thumb says a season for seven dwarves is about 100 food units and 150 drink units, which the old rates overshot by about 3×. Hunger becomes 1/h and thirst 1.6/h, making that sentence true; the presets and `EMBARK_BUDGET_BASE` stay as they are. Raising the presets instead would have needed about +700 embark points against a base of 1500. The owner also wanted the secondary effect of fewer need interruptions during long tasks.

This is now its own task, [F-10](F-10-need-rates.md), because F-08 changes no constant and no content. The balance findings this task records still stand; T-M8-06 re-measures them against the new rates.

## Done

- Every amendment applied verbatim. Exporter fixed, content regenerated, content check and tests added. C-003 and C-008 marked resolved (`Resolved by F-08 (<date>): …`); their `it.todo`s removed.
- One `DECISIONS.md` row for F-08a–f. Balance-finding rows added.
