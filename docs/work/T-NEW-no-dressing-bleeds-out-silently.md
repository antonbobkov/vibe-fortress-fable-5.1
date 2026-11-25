# T-NEW — With no cloth or bandage the first serious cut is a death, and nothing says why

**Source:** playtest 2026-11-24 (second) ([report](../../reports/data/2026-11-24-playtest-2.md), finding 3) · **Size:** M · **Needs:** — · **Status:** open

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

## Done

- [ ] `npm run content:check` passes with the new preset totals; a test reads each preset and finds a `cloth` or `bandage`.
- [ ] Tests (`describe` with the task id): a serious cut in a fortress with no cloth or bandage gives the alert once; the patient's Care line names the cloth; the hospital panel shows the line while both are 0 and not once one exists.
- [ ] World hashes of scenarios that embark Warband or Farmstead move (the supplies changed); the commit names them.
