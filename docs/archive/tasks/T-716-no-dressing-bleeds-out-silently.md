# T-716 — With no cloth or bandage the first serious cut is a death, and nothing says why

**Closed:** 2026-11-25, in e0aa0036,8f1c1faf,189b68a2,201f17a2.

**Source:** playtest 2026-11-24 (second) ([report](../../../reports/data/2026-11-24-playtest-2.md), finding 3) · **Size:** M · **Needs:** — · **Status:** open

## Why

The Warband preset (`embark-catalog.md` § Presets) brings a medic, Tova Brightbrow, with Medicine 5, four splints and five brightleaf, and no cloth, linen or bandage. So does Farmstead. Balanced and Miner's Guild bring five linen.

In the second playtest (world `deep-2346-1`, Warband at "Sedgefen", an `old_battlefield` site) the restless dead rose from Autumn 1. On Autumn 5 Borin Wolfcloak, one of the two axedwarves, killed one and took a serious cut to the right arm ("A restless dead hits Borin: 10 edge", `43-combat-log.png`). He bled for about 15 hours, lost consciousness and died: "!! Borin Wolfcloak has bled to death." (`42-alerts-borin.png`). The medic was in the fortress, hauling; a hospital zone existed with "Cloth: 0/10 · Bandages: 0/0 · Beds: 0" (`40-hospital-zone.png`). Between the wound and the death the log said only "Borin Wolfcloak has lost consciousness". Five dogs died the same way that autumn.

By 17 § Patients and hospitals this is the rule: `stop_bleeding` needs a bandage or a cloth, and a serious wound "bleeds until it is bandaged". But the player was never told the fortress had nothing to bandage with until a dwarf was dead, and the Warband preset, the one a player picks to fight, makes it certain. The hospital's own "Needs a chest" line says nothing of the missing cloth.

Reproduce: embark Warband at any `old_battlefield` site with peril 2 or more, or wound a dwarf with a serious cut in a test fortress with no cloth; run until he dies.

## What to do

Decisions:

- **Warband and Farmstead carry 5 linen** (`e_cloth`, 48 ☼): Warband takes 25 iron bolts in place of 50 (−90 ☼) and adds the linen (+48 ☼), 1,453 in all; Farmstead drops its pumpkin and hops seeds (−54 ☼) for the linen, 1,460 in all. New totals in the catalog. Every preset then has a dressing for a few wounds.
- **A blocked `stop_bleeding` is an alert**: when the job blocks `missing_input` for a dwarf, "Borin Wolfcloak is bleeding and there is no bandage or cloth: buy cloth from a caravan or weave it at a loom." (once per dwarf per wound), and its `[v]` opens the dwarf. The patient's `Care:` line already has a "the supply it waits for" case (17 § Player-facing behavior); make sure it names the cloth.
- **The hospital panel says "No cloth or bandages: a bleeding dwarf cannot be bandaged."** in the alert colour while both are 0 in the fortress, in place of the plain supply rows' silence.
- The embark screen's supplies hint gains one rule of thumb: "Bring linen: without cloth or bandages no wound can be bandaged." (`embark-catalog.md` § Rules of thumb).

Spec: `embark-catalog.md` § Presets and § Rules of thumb (totals re-checked by `content:check`); 17 § Player-facing behavior and § Registrations (the alert); `ui-screens/panels.md` (hospital zone line).

## Decision

As above, with these choices made in the work (17 § Patients and hospitals, § Player-facing behavior; `embark-catalog.md`):

- **No bandaging without a dressing, kept.** A medic does not stop a serious cut's bleeding by hand (pressure) or with a worse clot. The owner keeps hard trade-offs: five linen in the wagon, or a caravan's bandages, are the difference between a soldier bled out and a soldier bandaged, and that is a decision the player can now see coming. The fallback would also blunt the hospital's cloth reserve (T-693, T-696) and the clothier's bandages, which exist to matter. Logged as "No cloth, no clot" in `fun-features.md`, with what a fallback would take.
- **The alert is raised at the cut, not when the job blocks.** `NoDressing { id }` comes when a dwarf patient has a wound that bleeds until bandaged (serious or grievous; a light one clots), no bandage or cloth is to be had in the fortress, and no medic has its `stop_bleeding` under way. It is checked at every patient update, the wound's own tick included, so it is not delayed behind a medic trying the job. Once a wound: `Patient.noDressingAlerted` keeps the alert's tick, and only a later such wound raises it again; an older save without it warns at the next update. A light cut with no cloth raises nothing (it clots in `CLOT_TICKS`).
- **The text names what helps:** "… is bleeding and there is no bandage or cloth: buy them from a caravan, or weave cloth at a loom." The clothier's bandages need cloth, so they are not named when there is none.
- **The Care line names it first**, before the hospital: "Care: bleeding, and no bandage or cloth to bandage it. Buy them from a caravan, or weave cloth at a loom." (when its `stop_bleeding` is blocked for a missing input). In the playtest the hospital had no bed, so a line after the hospital's would have hidden it.
- **The hospital panel line** reads the fortress's bandages and cloth to be had (not the hospital's chests), above the supplies.
- **The hint** is a third line the supplies tab turns over to: "Hint: bring linen. Without cloth or bandages no wound can be bandaged, and a deep cut bleeds to death."
- No golden world hash moved: `world-hashes.json` plays Balanced, which already carried linen. The scenarios that embark Warband (`pp_defence`, T-521's world) or Farmstead (`pp_pasture`) keep no hash; T-521's timeline moved (another dwarf's hunt takes the put-down crossbow at once), and its step accepts that. `pp_defence` moved to seed `pp-defence-5`: on `pp-defence-4` the day-7 badger no longer comes, three boars outlast the wagon's food and the sheltered fortress starves by day 40, as that scenario's fortress does on master's seeds 3 and 7; on `pp-defence-5` a soldier kills a boar on day 17, and the medic bandages with the new linen.

## Done

- [x] `npm run content:check` passes with the new preset totals; a test reads each preset and finds a `cloth` or `bandage` (`test/unit/health/t716-no-dressing.test.ts`).
- [x] Tests (`describe` with the task id): a serious cut in a fortress with no cloth or bandage gives the alert once, at the cut, and again for a later serious cut, none for a light cut or with cloth; the patient's Care line names the bandage and cloth; the hospital panel shows the line while both are 0 and not once one exists; the save keeps the record; the embark hint.
- [x] World hashes: none recorded for Warband or Farmstead embarks (above).
- [x] Sweep (measure run 45562366410, on 189b68a2): pooled living 1140.25, deaths 111.5, alive 20, grown 7, extinct 0.25, need deaths 0.5; verdict pass, no seed worth tracing (bounds living ≥ 1046.63, deaths ≤ 132.5).
- [x] Follow-up: `T-723-animal-no-dressing-alert.md` (five dogs bled out the same way, unannounced).
